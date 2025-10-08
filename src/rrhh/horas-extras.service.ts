import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HorasExtrasEntity, HorasExtrasDocument, DetalleHoraExtra, TipoHoraExtra, RECARGOS_COLOMBIA } from './horas-extras.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from './empleado.schema.js';
import { CreateHorasExtrasDto, UpdateHorasExtrasDto, AprobarHorasExtrasDto, FiltrosHorasExtrasDto, AprobarHorasExtrasLoteDto } from './dto/horas-extras.dto.js';
import { MoneyService } from '../money/money.service.js';
import { GastosFijosQuincenalesService } from '../finanzas/gastos-fijos-quincenales.service.js';
import { CategoriaGasto, QuincenaEnum } from '../finanzas/dto/gastos-fijos.dto.js';
import { SistemaService } from '../sistema/sistema.service.js';

@Injectable()
export class HorasExtrasService {
  private readonly logger = new Logger(HorasExtrasService.name);

  constructor(
    @InjectModel(HorasExtrasEntity.name) private horasExtrasModel: Model<HorasExtrasDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    private readonly moneyService: MoneyService,
    private readonly gastosService: GastosFijosQuincenalesService,
    private readonly sistemaService: SistemaService,
  ) {}

  // ========== CREACIÓN DE REGISTRO QUINCENAL ==========

  async create(createDto: CreateHorasExtrasDto, userId: string): Promise<HorasExtrasDocument> {
    // Validar empleado
    if (!Types.ObjectId.isValid(createDto.empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    const empleado = await this.empleadoModel.findById(createDto.empleadoId).exec();
    if (!empleado) {
      throw new NotFoundException(`Empleado ${createDto.empleadoId} no encontrado`);
    }

    if (empleado.estado !== 'ACTIVO') {
      throw new BadRequestException('El empleado debe estar en estado ACTIVO para registrar horas extras');
    }

    // Generar periodo
    const periodo = this.generarPeriodo(createDto.anio, createDto.mes, createDto.quincena);

    // Verificar que no exista registro duplicado
    const existente = await this.horasExtrasModel.findOne({
      empleadoId: new Types.ObjectId(createDto.empleadoId),
      periodo,
      quincena: createDto.quincena,
    }).exec();

    if (existente) {
      throw new BadRequestException(
        `Ya existe un registro de horas extras para el empleado en el periodo ${periodo}, quincena ${createDto.quincena}`
      );
    }

    // Obtener salario base del empleado
    const salarioBase = empleado.salario;

    // Calcular horas laborales del mes (por defecto 220h en Colombia 2025)
    const horasLaboralesMes = createDto.horasLaboralesMes || 220;

    // Calcular valor hora ordinaria usando MoneyService (escalado × 100000 para 5 decimales)
    // Valor hora ordinaria = Salario mensual / Horas laborales mensuales
    const valorHoraOrdinaria = salarioBase.monto / horasLaboralesMes;
    // Redondear según la moneda (USD=2 decimales, COP=0 decimales) - Política centralizada
    const valorHoraOrdinariaRedondeado = this.moneyService.roundForCurrency(valorHoraOrdinaria, salarioBase.moneda);
    const valorHoraOrdinariaBigInt = this.moneyService.toDatabase(valorHoraOrdinariaRedondeado, salarioBase.moneda);

    // Procesar cada detalle de hora extra
    const detallesCalculados: DetalleHoraExtra[] = createDto.detalles.map((detalle) => {
      const recargoPorcentaje = RECARGOS_COLOMBIA[detalle.tipo];
      
      // Valor de la hora con recargo aplicado
      // Calcular, redondear según moneda (política centralizada), luego escalar
      const valorConRecargo = valorHoraOrdinariaRedondeado * (1 + recargoPorcentaje);
      const valorConRecargoRedondeado = this.moneyService.roundForCurrency(valorConRecargo, salarioBase.moneda);
      const valorConRecargoBigInt = this.moneyService.toDatabase(valorConRecargoRedondeado, salarioBase.moneda);

      // Total para este detalle = valorConRecargoRedondeado × cantidadHoras
      // Usar el valor YA redondeado monetariamente según la moneda
      const totalDetalle = valorConRecargoRedondeado * detalle.cantidadHoras;
      const totalDetalleRedondeado = this.moneyService.roundForCurrency(totalDetalle, salarioBase.moneda);
      const totalBigInt = this.moneyService.toDatabase(totalDetalleRedondeado, salarioBase.moneda);

      return {
        tipo: detalle.tipo,
        cantidadHoras: detalle.cantidadHoras,
        observaciones: detalle.observaciones || null,
        fechaRegistro: new Date(detalle.fechaRegistro),
        valorHoraOrdinaria: valorHoraOrdinariaBigInt,
        recargoPorcentaje,
        valorConRecargo: valorConRecargoBigInt,
        total: totalBigInt,
      };
    });

    // Calcular totales generales
    const totalHoras = detallesCalculados.reduce((sum, d) => sum + d.cantidadHoras, 0);
    const totalRecargo = detallesCalculados.reduce((sum, d) => sum + d.total, 0n);

    // Crear documento
    const horasExtras = new this.horasExtrasModel({
      empleadoId: new Types.ObjectId(createDto.empleadoId),
      anio: createDto.anio,
      mes: createDto.mes,
      quincena: createDto.quincena,
      periodo,
      detalles: detallesCalculados,
      salarioBase,
      horasLaboralesMes,
      valorHoraOrdinaria: valorHoraOrdinariaBigInt,
      totalHoras,
      totalRecargo,
      estado: 'PENDIENTE',
      registradoPor: new Types.ObjectId(userId),
    });

    const saved = await horasExtras.save();

    const totalFormateado = this.moneyService.fromDatabase(totalRecargo);
    this.logger.log(
      `Registro de horas extras creado: Empleado ${empleado.nombre} ${empleado.apellido}, ` +
      `Periodo ${periodo}, Total horas: ${totalHoras}, Total: ${totalFormateado} ${salarioBase.moneda}`
    );

    return this.formatResponse(saved);
  }

  // ========== CONSULTAS Y LISTADOS ==========

  async findAll(filtros: FiltrosHorasExtrasDto): Promise<HorasExtrasDocument[]> {
    const query: any = {};

    if (filtros.empleadoId) {
      if (!Types.ObjectId.isValid(filtros.empleadoId)) {
        throw new BadRequestException('ID de empleado inválido');
      }
      query.empleadoId = new Types.ObjectId(filtros.empleadoId);
    }

    if (filtros.anio) query.anio = filtros.anio;
    if (filtros.mes) query.mes = filtros.mes;
    if (filtros.quincena) query.quincena = filtros.quincena;
    if (filtros.periodo) query.periodo = filtros.periodo;
    if (filtros.estado) query.estado = filtros.estado;

    const registros = await this.horasExtrasModel
      .find(query)
      .populate('empleadoId', 'nombre apellido numeroIdentificacion salario')
      .populate('registradoPor', 'username')
      .populate('aprobacion.aprobadoPor', 'username')
      .sort({ createdAt: -1 })
      .exec();

    return registros.map(registro => this.formatResponse(registro));
  }

  async findById(id: string): Promise<HorasExtrasDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }

    const registro = await this.horasExtrasModel
      .findById(id)
      .populate('empleadoId', 'nombre apellido numeroIdentificacion correoElectronico salario')
      .populate('registradoPor', 'username')
      .populate('aprobacion.aprobadoPor', 'username')
      .exec();

    if (!registro) {
      throw new NotFoundException(`Registro de horas extras ${id} no encontrado`);
    }

    return this.formatResponse(registro);
  }

  async findByEmpleadoAndPeriodo(empleadoId: string, anio: number, mes: number): Promise<HorasExtrasDocument[]> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    const registros = await this.horasExtrasModel
      .find({
        empleadoId: new Types.ObjectId(empleadoId),
        anio,
        mes,
      })
      .populate('empleadoId', 'nombre apellido numeroIdentificacion')
      .populate('registradoPor', 'username')
      .sort({ quincena: 1 })
      .exec();

    return registros.map(registro => this.formatResponse(registro));
  }

  // ========== ACTUALIZACIÓN ==========

  async update(id: string, updateDto: UpdateHorasExtrasDto): Promise<HorasExtrasDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }

    const registro = await this.horasExtrasModel.findById(id).exec();
    if (!registro) {
      throw new NotFoundException(`Registro de horas extras ${id} no encontrado`);
    }

    // Solo se puede actualizar si está en estado PENDIENTE
    if (registro.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo se pueden actualizar registros en estado PENDIENTE');
    }

    // Obtener empleado para recalcular
    const empleado = await this.empleadoModel.findById(registro.empleadoId).exec();
    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    // Si se actualizan detalles, recalcular totales
    if (updateDto.detalles) {
      const horasLaboralesMes = updateDto.horasLaboralesMes || registro.horasLaboralesMes;
      const valorHoraOrdinaria = empleado.salario.monto / horasLaboralesMes;
      // Redondear según la moneda (política centralizada)
      const valorHoraOrdinariaRedondeado = this.moneyService.roundForCurrency(valorHoraOrdinaria, empleado.salario.moneda);
      const valorHoraOrdinariaBigInt = this.moneyService.toDatabase(valorHoraOrdinariaRedondeado, empleado.salario.moneda);

      const detallesCalculados: DetalleHoraExtra[] = updateDto.detalles.map((detalle) => {
        const recargoPorcentaje = RECARGOS_COLOMBIA[detalle.tipo];
        // Calcular valorConRecargo con el valor YA redondeado monetariamente
        const valorConRecargo = valorHoraOrdinariaRedondeado * (1 + recargoPorcentaje);
        const valorConRecargoRedondeado = this.moneyService.roundForCurrency(valorConRecargo, empleado.salario.moneda);
        const valorConRecargoBigInt = this.moneyService.toDatabase(valorConRecargoRedondeado, empleado.salario.moneda);
        // Total usando valorConRecargo YA redondeado monetariamente
        const totalDetalle = valorConRecargoRedondeado * detalle.cantidadHoras;
        const totalDetalleRedondeado = this.moneyService.roundForCurrency(totalDetalle, empleado.salario.moneda);
        const totalBigInt = this.moneyService.toDatabase(totalDetalleRedondeado, empleado.salario.moneda);

        return {
          tipo: detalle.tipo,
          cantidadHoras: detalle.cantidadHoras,
          observaciones: detalle.observaciones || null,
          fechaRegistro: new Date(detalle.fechaRegistro),
          valorHoraOrdinaria: valorHoraOrdinariaBigInt,
          recargoPorcentaje,
          valorConRecargo: valorConRecargoBigInt,
          total: totalBigInt,
        };
      });

      const totalHoras = detallesCalculados.reduce((sum, d) => sum + d.cantidadHoras, 0);
      const totalRecargo = detallesCalculados.reduce((sum, d) => sum + d.total, 0n);

      registro.detalles = detallesCalculados;
      registro.totalHoras = totalHoras;
      registro.totalRecargo = totalRecargo;
      registro.horasLaboralesMes = horasLaboralesMes;
      registro.valorHoraOrdinaria = valorHoraOrdinariaBigInt;
    }

    const updated = await registro.save();

    this.logger.log(`Registro de horas extras ${id} actualizado`);

    return this.formatResponse(updated);
  }

  // ========== APROBACIÓN ==========

  async aprobar(id: string, aprobarDto: AprobarHorasExtrasDto, userId: string): Promise<HorasExtrasDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }

    const registro = await this.horasExtrasModel.findById(id).exec();
    if (!registro) {
      throw new NotFoundException(`Registro de horas extras ${id} no encontrado`);
    }

    if (registro.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo se pueden aprobar registros en estado PENDIENTE');
    }

    registro.estado = aprobarDto.estado;
    registro.aprobacion = {
      aprobadoPor: new Types.ObjectId(userId),
      fechaAprobacion: new Date(),
      comentarios: aprobarDto.comentarios || null,
    };

    const updated = await registro.save();

    this.logger.log(
      `Registro de horas extras ${id} ${aprobarDto.estado.toLowerCase()} por usuario ${userId}`
    );

    // Si fue APROBADO, registrar gasto fijo quincenal en Finanzas (categoría NOMINA)
    if (aprobarDto.estado === 'APROBADO') {
      try {
        await this.registrarGastoFijoDesdeHorasExtras(updated);
      } catch (e) {
        this.logger.error(`No se pudo registrar gasto fijo para horas extras ${id}: ${e}`);
      }
    }

    return this.formatResponse(updated);
  }

  // Estado PAGADO eliminado: no se soporta marcar pago desde RRHH

  // ========== ELIMINACIÓN ==========

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }

    const registro = await this.horasExtrasModel.findById(id).exec();
    if (!registro) {
      throw new NotFoundException(`Registro de horas extras ${id} no encontrado`);
    }

    // Solo se puede eliminar si está en estado PENDIENTE o RECHAZADO
    if (!['PENDIENTE', 'RECHAZADO'].includes(registro.estado)) {
      throw new BadRequestException('Solo se pueden eliminar registros en estado PENDIENTE o RECHAZADO');
    }

    await this.horasExtrasModel.findByIdAndDelete(id).exec();

    this.logger.log(`Registro de horas extras ${id} eliminado`);
  }

  // ========== ESTADÍSTICAS Y REPORTES ==========

  async obtenerResumenPorEmpleado(empleadoId: string, anio: number, mes: number): Promise<any> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    const registros = await this.findByEmpleadoAndPeriodo(empleadoId, anio, mes);

    const totalHorasMes = registros.reduce((sum, r) => sum + r.totalHoras, 0);
    const totalRecargo = registros.reduce((sum, r) => sum + r.totalRecargo, 0n);

    // Desglose por tipo
    const desglosePorTipo: Record<string, { horas: number; total: bigint }> = {};
    
    registros.forEach((registro) => {
      registro.detalles.forEach((detalle) => {
        if (!desglosePorTipo[detalle.tipo]) {
          desglosePorTipo[detalle.tipo] = { horas: 0, total: 0n };
        }
        desglosePorTipo[detalle.tipo].horas += detalle.cantidadHoras;
        desglosePorTipo[detalle.tipo].total += detalle.total;
      });
    });

    const moneda = registros[0]?.salarioBase?.moneda || 'COP'; // Obtener moneda del primer registro

    return {
      empleadoId,
      anio,
      mes,
      cantidadRegistros: registros.length,
      totalHorasMes,
      totalRecargo: this.formatBigInt(totalRecargo),
      totalRecargoRaw: totalRecargo.toString(),
      moneda,
      desglosePorTipo: Object.entries(desglosePorTipo).map(([tipo, data]) => ({
        tipo,
        horas: data.horas,
        total: this.formatBigInt(data.total),
        totalRaw: data.total.toString(),
      })),
      registros: registros.map((r) => ({
        id: r._id.toString(),
        quincena: r.quincena,
        periodo: r.periodo,
        totalHoras: r.totalHoras,
        totalRecargo: this.formatBigInt(r.totalRecargo),
        estado: r.estado,
      })),
    };
  }

  async obtenerEstadisticasGenerales(anio: number, mes: number): Promise<any> {
    const registros = await this.horasExtrasModel
      .find({ anio, mes })
      .populate('empleadoId', 'nombre apellido salario')
      .exec();

    const totalRegistros = registros.length;
    const totalHoras = registros.reduce((sum, r) => sum + r.totalHoras, 0);
    const totalRecargo = registros.reduce((sum, r) => sum + r.totalRecargo, 0n);

    const porEstado = registros.reduce((acc: any, r) => {
      if (!acc[r.estado]) acc[r.estado] = { cantidad: 0, total: 0n };
      acc[r.estado].cantidad += 1;
      acc[r.estado].total += r.totalRecargo;
      return acc;
    }, {});

    return {
      periodo: `${anio}-${String(mes).padStart(2, '0')}`,
      totalRegistros,
      totalHoras,
      totalRecargo: this.formatBigInt(totalRecargo),
      totalRecargoRaw: totalRecargo.toString(),
      porEstado: Object.entries(porEstado).map(([estado, data]: [string, any]) => ({
        estado,
        cantidad: data.cantidad,
        total: this.formatBigInt(data.total),
        totalRaw: data.total.toString(),
      })),
    };
  }

  // ========== UTILIDADES ==========

  private generarPeriodo(anio: number, mes: number, quincena: number): string {
    return `${anio}-${String(mes).padStart(2, '0')}-Q${quincena}`;
  }

  /**
   * Formatea un BigInt a número decimal usando MoneyService
   * @param value BigInt escalado × 100000 (5 decimales)
   * @returns Número decimal para mostrar al usuario
   */
  private formatBigInt(value: bigint): number {
    return this.moneyService.fromDatabase(value);
  }

  /**
   * Formatea la respuesta de un documento de horas extras con valores monetarios profesionales
   * Similar al patrón usado en FinanzasService
   * @param doc Documento de horas extras (puede estar populado o no)
   * @returns Documento con campos monetarios formateados (ej: "$ 2,500.00")
   */
  private formatResponse(doc: HorasExtrasDocument): any {
    const plain = doc.toObject();
    const moneda = plain.salarioBase?.moneda || 'USD';

    // Formatear valores principales
    const valorHoraOrdinaria = this.formatBigInt(plain.valorHoraOrdinaria);
    const totalRecargo = this.formatBigInt(plain.totalRecargo);

    // Formatear detalles
    const detallesFormateados = plain.detalles.map((detalle: any) => {
      const valorHoraOrdinariaDetalle = this.formatBigInt(detalle.valorHoraOrdinaria);
      const valorConRecargo = this.formatBigInt(detalle.valorConRecargo);
      const total = this.formatBigInt(detalle.total);

      return {
        ...detalle,
        valorHoraOrdinaria: this.moneyService.formatForUser(valorHoraOrdinariaDetalle, moneda),
        valorConRecargo: this.moneyService.formatForUser(valorConRecargo, moneda),
        total: this.moneyService.formatForUser(total, moneda),
      };
    });

    return {
      ...plain,
      valorHoraOrdinaria: this.moneyService.formatForUser(valorHoraOrdinaria, moneda),
      totalRecargo: this.moneyService.formatForUser(totalRecargo, moneda),
      detalles: detallesFormateados,
      // Mantener valores raw para cálculos si es necesario
      _raw: {
        valorHoraOrdinaria,
        totalRecargo,
      },
    };
  }

  // ========== MÉTODO PÚBLICO PARA CÁLCULO DE VALOR HORA ==========

  /**
   * Calcula el valor de la hora ordinaria según el salario mensual y horas laborales
   * @param salarioMensual Salario mensual en COP
   * @param horasLaboralesMes Horas laborales mensuales (default: 220h para Colombia 2025)
   * @returns Valor de la hora ordinaria en COP
   */
  calcularValorHoraOrdinaria(salarioMensual: number, horasLaboralesMes = 220): number {
    if (salarioMensual <= 0) {
      throw new BadRequestException('El salario mensual debe ser mayor a 0');
    }
    if (horasLaboralesMes <= 0) {
      throw new BadRequestException('Las horas laborales deben ser mayores a 0');
    }
    return salarioMensual / horasLaboralesMes;
  }

  /**
   * Calcula el valor de una hora extra con recargo aplicado
   * @param valorHoraOrdinaria Valor de la hora ordinaria
   * @param tipoHoraExtra Tipo de hora extra (DIURNA, NOCTURNA, etc.)
   * @returns Valor de la hora con recargo aplicado
   */
  calcularValorHoraConRecargo(valorHoraOrdinaria: number, tipoHoraExtra: TipoHoraExtra): number {
    const recargo = RECARGOS_COLOMBIA[tipoHoraExtra];
    return valorHoraOrdinaria * (1 + recargo);
  }

  // ========== LOTE Y SOPORTE ==========

  async listarPendientesPorPeriodo(anio: number, mes: number, quincena?: number) {
    const query: any = { anio, mes, estado: 'PENDIENTE' };
    if (quincena) query.quincena = quincena;

    const registros = await this.horasExtrasModel
      .find(query)
      .populate('empleadoId', 'nombre apellido numeroIdentificacion salario')
      .sort({ quincena: 1, createdAt: -1 })
      .exec();

    return registros.map(r => this.formatResponse(r));
  }

  async aprobarLote(dto: AprobarHorasExtrasLoteDto, userId: string) {
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of dto.ids) {
      try {
        const res = await this.aprobar(id, { estado: dto.estado, comentarios: dto.comentarios }, userId);
        results.push({ id: (res as any)._id?.toString?.() || id, ok: true });
      } catch (e: any) {
        results.push({ id, ok: false, error: e?.message || String(e) });
      }
    }
    return { processed: results.length, success: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
  }

  // ========== INTEGRACIÓN FINANZAS ==========

  private async registrarGastoFijoDesdeHorasExtras(registro: HorasExtrasDocument) {
    // Convertir BigInt totalRecargo a número decimal
    const totalMonedaEmpleado = this.moneyService.fromDatabase(registro.totalRecargo);
    const moneda = (registro.salarioBase as any).moneda || 'COP';

    // Convertir a USD si es necesario usando TRM vigente
    let montoUSDDecimal = totalMonedaEmpleado;
    if (moneda !== 'USD') {
      const trm = await this.sistemaService.getCurrentTrm();
      if (!trm) throw new BadRequestException('No hay TRM vigente para convertir a USD');
      // Si moneda es COP y trm.copPerUsd = 4000, entonces USD = COP / 4000
      montoUSDDecimal = this.moneyService.divide(totalMonedaEmpleado, trm.copPerUsd);
    }

    // Armar DTO para gasto fijo
    const quincenaEnum: QuincenaEnum = registro.quincena === 1 ? QuincenaEnum.PRIMERA_QUINCENA : QuincenaEnum.SEGUNDA_QUINCENA;
    const concepto = `Horas extras ${registro.periodo} - ${(registro as any).empleadoId?.nombre || ''} ${(registro as any).empleadoId?.apellido || ''}`.trim();
    const fechaPago = this.calcularFechaPagoQuincena(registro.mes, registro.anio, quincenaEnum);

    await this.gastosService.registrarGasto({
      mes: registro.mes,
      anio: registro.anio,
      quincena: quincenaEnum,
      categoria: CategoriaGasto.NOMINA,
      empleadoId: registro.empleadoId.toString(),
      montoUSD: this.moneyService.roundForCurrency(montoUSDDecimal, 'USD'),
      concepto,
      fechaPago,
      notas: 'Generado automáticamente desde Horas Extras aprobadas',
      estado: undefined, // dejar default
    }, (registro.registradoPor as any)?.toString?.() || undefined);
  }

  private calcularFechaPagoQuincena(mes: number, anio: number, quincena: QuincenaEnum): string {
    const dia = quincena === QuincenaEnum.PRIMERA_QUINCENA ? 15 : new Date(anio, mes, 0).getDate();
    // new Date(year, monthIndex, day) -> monthIndex 0-based
    const date = new Date(anio, mes - 1, dia);
    return date.toISOString().split('T')[0];
  }
}
