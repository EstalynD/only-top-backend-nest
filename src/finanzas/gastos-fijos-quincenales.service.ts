import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  GastoFijoQuincenalEntity, 
  GastoFijoQuincenalDocument 
} from './gasto-fijo-quincenal.schema.js';
import { 
  ResumenGastosMensualEntity, 
  ResumenGastosMensualDocument 
} from './resumen-gastos-mensual.schema.js';
import { FinanzasModeloEntity, FinanzasModeloDocument } from './finanzas-modelo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';
import { MoneyService } from '../money/money.service.js';
import { BankOnlyTopService } from './bank-onlytop.service.js';
import {
  RegistrarGastoFijoDto,
  ActualizarGastoFijoDto,
  AprobarGastoDto,
  ConsolidarResumenMensualDto,
  GenerarNominaQuincenalDto,
  GastoFijoFormateadoDto,
  ResumenQuincenalDto,
  ResumenMensualConsolidadoDto,
  ComparativaMensualDto,
  CategoriaGasto,
  QuincenaEnum,
  EstadoGasto,
  EstadoResumen,
} from './dto/gastos-fijos.dto.js';

/**
 * GastosFijosQuincenalesService - Servicio profesional para gestión de gastos fijos
 * 
 * Funcionalidades:
 * - Registro de gastos discriminados por quincena
 * - Vinculación automática con empleados RRHH (nómina)
 * - Cálculo de utilidad neta (ingresos - gastos)
 * - Comparativa mes a mes con % de crecimiento
 * - Resúmenes quincenales y mensuales
 * - Integración con MoneyService para precisión decimal
 */
@Injectable()
export class GastosFijosQuincenalesService {
  private readonly logger = new Logger(GastosFijosQuincenalesService.name);

  constructor(
    @InjectModel(GastoFijoQuincenalEntity.name)
    private gastoModel: Model<GastoFijoQuincenalDocument>,
    @InjectModel(ResumenGastosMensualEntity.name)
    private resumenModel: Model<ResumenGastosMensualDocument>,
    @InjectModel(FinanzasModeloEntity.name)
    private finanzasModel: Model<FinanzasModeloDocument>,
    @InjectModel(EmpleadoEntity.name)
    private empleadoModel: Model<EmpleadoDocument>,
    private readonly moneyService: MoneyService,
    private readonly bankService: BankOnlyTopService,
  ) {}

  // ========== REGISTRO DE GASTOS ==========

  /**
   * Registra un nuevo gasto fijo quincenal
   */
  async registrarGasto(
    dto: RegistrarGastoFijoDto,
    userId: string,
  ): Promise<GastoFijoFormateadoDto> {
    // Validar empleado si es NOMINA
    if (dto.categoria === CategoriaGasto.NOMINA) {
      if (!dto.empleadoId) {
        throw new BadRequestException('Los gastos de NOMINA requieren empleadoId');
      }
      
      const empleado = await this.empleadoModel.findById(dto.empleadoId).exec();
      if (!empleado) {
        throw new NotFoundException(`Empleado con ID ${dto.empleadoId} no encontrado`);
      }
      
      if (empleado.estado !== 'ACTIVO') {
        throw new BadRequestException('El empleado debe estar activo');
      }
    }

    // Generar periodoId
    const periodoId = this.generarPeriodoId(dto.anio, dto.mes, dto.quincena);

    // Convertir monto a BigInt
    const montoUSD = this.moneyService.toDatabase(dto.montoUSD, 'USD');

    // Crear gasto
    const gasto = new this.gastoModel({
      mes: dto.mes,
      anio: dto.anio,
      quincena: dto.quincena,
      periodoId,
      categoria: dto.categoria,
      empleadoId: dto.empleadoId ? new Types.ObjectId(dto.empleadoId) : null,
      montoUSD,
      concepto: dto.concepto,
      proveedor: dto.proveedor || null,
      fechaPago: new Date(dto.fechaPago),
      numeroFactura: dto.numeroFactura || null,
      archivoComprobante: dto.archivoComprobante || null,
      estado: dto.estado || EstadoGasto.PENDIENTE,
      registradoPor: new Types.ObjectId(userId),
      fechaRegistro: new Date(),
      notas: dto.notas || null,
    });

    const saved = await gasto.save();
    
    this.logger.log(`💰 Gasto registrado: ${dto.categoria} - ${dto.concepto} - ${dto.montoUSD} USD`);

    return this.formatearGasto(saved);
  }

  /**
   * Actualiza un gasto existente
   */
  async actualizarGasto(
    id: string,
    dto: ActualizarGastoFijoDto,
  ): Promise<GastoFijoFormateadoDto> {
    const gasto = await this.gastoModel.findById(id).exec();
    
    if (!gasto) {
      throw new NotFoundException(`Gasto con ID ${id} no encontrado`);
    }

    // No permitir editar gastos consolidados
    const resumen = await this.resumenModel.findOne({
      mes: gasto.mes,
      anio: gasto.anio,
      estado: EstadoResumen.CONSOLIDADO,
    }).exec();

    if (resumen) {
      throw new BadRequestException('No se pueden editar gastos de periodos consolidados');
    }

    // Actualizar campos
    if (dto.montoUSD !== undefined) {
      gasto.montoUSD = this.moneyService.toDatabase(dto.montoUSD, 'USD');
    }
    if (dto.concepto) gasto.concepto = dto.concepto;
    if (dto.proveedor !== undefined) gasto.proveedor = dto.proveedor || null;
    if (dto.fechaPago) gasto.fechaPago = new Date(dto.fechaPago);
    if (dto.numeroFactura !== undefined) gasto.numeroFactura = dto.numeroFactura || null;
    if (dto.archivoComprobante !== undefined) gasto.archivoComprobante = dto.archivoComprobante || null;
    if (dto.estado) gasto.estado = dto.estado;
    if (dto.notas !== undefined) gasto.notas = dto.notas || null;

    const updated = await gasto.save();
    
    this.logger.log(`✏️ Gasto actualizado: ${id}`);

    return this.formatearGasto(updated);
  }

  /**
   * Aprueba o rechaza un gasto
   */
  async aprobarGasto(
    id: string,
    dto: AprobarGastoDto,
    userId: string,
  ): Promise<GastoFijoFormateadoDto> {
    const gasto = await this.gastoModel.findById(id).exec();
    
    if (!gasto) {
      throw new NotFoundException(`Gasto con ID ${id} no encontrado`);
    }

    gasto.estado = dto.estado;
    gasto.aprobadoPor = new Types.ObjectId(userId);
    gasto.fechaAprobacion = new Date();
    
    if (dto.notas) {
      gasto.notas = dto.notas;
    }

    const updated = await gasto.save();
    
    this.logger.log(`${dto.estado === EstadoGasto.APROBADO ? '✅' : '❌'} Gasto ${dto.estado.toLowerCase()}: ${id}`);

    return this.formatearGasto(updated);
  }

  /**
   * Elimina un gasto (soft delete - marca como RECHAZADO)
   */
  async eliminarGasto(id: string): Promise<void> {
    // Validar que el ID sea un ObjectId válido
    if (!id || id === 'undefined' || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`ID de gasto inválido: ${id}`);
    }
    
    const gasto = await this.gastoModel.findById(id).exec();
    
    if (!gasto) {
      throw new NotFoundException(`Gasto con ID ${id} no encontrado`);
    }

    // No permitir eliminar gastos de periodos consolidados
    const resumen = await this.resumenModel.findOne({
      mes: gasto.mes,
      anio: gasto.anio,
      estado: EstadoResumen.CONSOLIDADO,
    }).exec();

    if (resumen) {
      throw new BadRequestException('No se pueden eliminar gastos de periodos consolidados');
    }

    // Soft delete
    gasto.estado = EstadoGasto.RECHAZADO;
    await gasto.save();
    
    this.logger.log(`🗑️ Gasto eliminado (soft): ${id}`);
  }

  // ========== CONSULTAS ==========

  /**
   * Obtiene resumen quincenal de gastos
   */
  async obtenerResumenQuincenal(
    mes: number,
    anio: number,
    quincena: QuincenaEnum,
  ): Promise<ResumenQuincenalDto> {
    const periodoId = this.generarPeriodoId(anio, mes, quincena);
    
    const gastos = await this.gastoModel
      .find({ periodoId, estado: { $ne: EstadoGasto.RECHAZADO } })
      .populate('empleadoId', 'nombre apellido')
      .sort({ fechaPago: -1 })
      .lean()
      .exec();

    // Calcular totales
    let totalGastosUSD = 0n;
    const porCategoria = new Map<CategoriaGasto, { total: bigint; cantidad: number }>();
    const porEstado = { pendientes: 0, aprobados: 0, pagados: 0, rechazados: 0 };

    for (const gasto of gastos) {
      totalGastosUSD += BigInt(gasto.montoUSD);
      
      // Por categoría
      const catData = porCategoria.get(gasto.categoria as CategoriaGasto) || { total: 0n, cantidad: 0 };
      catData.total += BigInt(gasto.montoUSD);
      catData.cantidad++;
      porCategoria.set(gasto.categoria as CategoriaGasto, catData);
      
      // Por estado
      switch (gasto.estado) {
        case EstadoGasto.PENDIENTE: porEstado.pendientes++; break;
        case EstadoGasto.APROBADO: porEstado.aprobados++; break;
        case EstadoGasto.PAGADO: porEstado.pagados++; break;
        case EstadoGasto.RECHAZADO: porEstado.rechazados++; break;
      }
    }

    // Formatear por categoría
    const totalGastosNumber = this.moneyService.fromDatabase(totalGastosUSD);
    const categoriasFormateadas = Array.from(porCategoria.entries()).map(([categoria, data]) => {
      const totalUSD = this.moneyService.fromDatabase(data.total);
      return {
        categoria,
        totalUSD,
        totalFormateado: this.moneyService.formatForUser(totalUSD, 'USD'),
        cantidad: data.cantidad,
        porcentaje: totalGastosNumber > 0 ? (totalUSD / totalGastosNumber) * 100 : 0,
      };
    });

    return {
      mes,
      anio,
      quincena,
      periodoId,
      totales: {
        totalGastosUSD: totalGastosNumber,
        totalGastosFormateado: this.moneyService.formatForUser(totalGastosNumber, 'USD'),
        cantidadGastos: gastos.length,
      },
      porCategoria: categoriasFormateadas.sort((a, b) => b.totalUSD - a.totalUSD),
      gastos: gastos.map(g => this.formatearGastoLean(g)),
      porEstado,
    };
  }

  /**
   * Obtiene resumen mensual consolidado
   */
  async obtenerResumenMensual(
    mes: number,
    anio: number,
  ): Promise<ResumenMensualConsolidadoDto> {
    const periodoId = `${anio}-${mes.toString().padStart(2, '0')}`;
    
    // Buscar o crear resumen
    let resumen = await this.resumenModel.findOne({ periodoId }).exec();
    
    if (!resumen) {
      resumen = await this.calcularResumenMensual(mes, anio);
    }

    return this.formatearResumenMensual(resumen);
  }

  /**
   * Consolida el resumen mensual (cierra el periodo)
   * 
   * Este método:
   * 1. Valida que todos los gastos estén aprobados o pagados
   * 2. Consolida los gastos fijos en el banco (simulación → movimiento real)
   * 3. Marca el resumen como consolidado
   */
  async consolidarResumenMensual(
    dto: ConsolidarResumenMensualDto,
    userId: string,
  ): Promise<ResumenMensualConsolidadoDto> {
    // Validar que todos los gastos estén aprobados o pagados
    const gastosPendientes = await this.gastoModel.countDocuments({
      mes: dto.mes,
      anio: dto.anio,
      estado: EstadoGasto.PENDIENTE,
    }).exec();
    
    if (gastosPendientes > 0) {
      throw new BadRequestException(
        `No se puede consolidar: hay ${gastosPendientes} gasto(s) pendiente(s) de aprobación. ` +
        `Todos los gastos deben estar APROBADOS o PAGADOS antes de consolidar.`
      );
    }
    
    // 🎯 CONSOLIDAR GASTOS FIJOS EN EL BANCO
    await this.bankService.consolidarGastosFijos(dto.mes, dto.anio);
    
    // Calcular y actualizar resumen
    const resumen = await this.calcularResumenMensual(dto.mes, dto.anio);
    
    resumen.estado = EstadoResumen.CONSOLIDADO;
    resumen.fechaConsolidacion = new Date();
    
    await resumen.save();
    
    this.logger.log(`🔒 Resumen mensual consolidado: ${dto.mes}/${dto.anio}`);
    
    return this.formatearResumenMensual(resumen);
  }

  /**
   * Genera gastos de nómina automáticamente desde empleados RRHH
   */
  async generarNominaQuincenal(
    dto: GenerarNominaQuincenalDto,
    userId: string,
  ): Promise<{ generados: number; errores: string[] }> {
    const soloActivos = dto.soloActivos ?? true;
    const modoPago = dto.modoPago || 'QUINCENAL_DIVIDIDO';
    
    // Filtro base por estado
    const filter: any = soloActivos ? { estado: 'ACTIVO' } : {};
    
    // Filtro adicional por empleados seleccionados
    if (dto.empleadosSeleccionados && dto.empleadosSeleccionados.length > 0) {
      filter._id = { $in: dto.empleadosSeleccionados };
    }
    
    const empleados = await this.empleadoModel.find(filter).exec();
    
    let generados = 0;
    const errores: string[] = [];
    
    for (const empleado of empleados) {
      try {
        const salarioMensual = empleado.salario.monto;
        
        if (modoPago === 'MENSUAL_COMPLETO') {
          // Pago completo SIEMPRE en la SEGUNDA quincena (lógica de negocio)
          await this.registrarGasto(
            {
              mes: dto.mes,
              anio: dto.anio,
              quincena: QuincenaEnum.SEGUNDA_QUINCENA,
              categoria: CategoriaGasto.NOMINA,
              empleadoId: empleado._id.toString(),
              montoUSD: salarioMensual,
              concepto: `Nómina mensual completa - ${empleado.nombre} ${empleado.apellido}`,
              fechaPago: this.calcularFechaPagoQuincena(dto.mes, dto.anio, QuincenaEnum.SEGUNDA_QUINCENA),
              estado: EstadoGasto.PENDIENTE,
            },
            userId,
          );
          generados++;
        } else {
          // Pago dividido: la mitad en cada quincena
          const salarioQuincenal = salarioMensual / 2;
          
          // Crear gasto para primera quincena
          await this.registrarGasto(
            {
              mes: dto.mes,
              anio: dto.anio,
              quincena: QuincenaEnum.PRIMERA_QUINCENA,
              categoria: CategoriaGasto.NOMINA,
              empleadoId: empleado._id.toString(),
              montoUSD: salarioQuincenal,
              concepto: `Nómina primera quincena - ${empleado.nombre} ${empleado.apellido}`,
              fechaPago: this.calcularFechaPagoQuincena(dto.mes, dto.anio, QuincenaEnum.PRIMERA_QUINCENA),
              estado: EstadoGasto.PENDIENTE,
            },
            userId,
          );
          
          // Crear gasto para segunda quincena
          await this.registrarGasto(
            {
              mes: dto.mes,
              anio: dto.anio,
              quincena: QuincenaEnum.SEGUNDA_QUINCENA,
              categoria: CategoriaGasto.NOMINA,
              empleadoId: empleado._id.toString(),
              montoUSD: salarioQuincenal,
              concepto: `Nómina segunda quincena - ${empleado.nombre} ${empleado.apellido}`,
              fechaPago: this.calcularFechaPagoQuincena(dto.mes, dto.anio, QuincenaEnum.SEGUNDA_QUINCENA),
              estado: EstadoGasto.PENDIENTE,
            },
            userId,
          );
          
          generados++;
        }
      } catch (error: any) {
        errores.push(`${empleado.nombre} ${empleado.apellido}: ${error.message}`);
      }
    }
    
    this.logger.log(`📋 Nómina generada (${modoPago}): ${generados} empleados, ${errores.length} errores`);
    
    // 🎯 APLICAR SIMULACIÓN AL BANCO
    // Calcular monto total de nómina generada
    const gastosGenerados = await this.gastoModel.find({
      mes: dto.mes,
      anio: dto.anio,
      categoria: CategoriaGasto.NOMINA,
      estado: EstadoGasto.PENDIENTE,
    }).exec();
    
    const montoTotalNomina = gastosGenerados.reduce(
      (sum, g) => sum + BigInt(g.montoUSD),
      0n
    );
    
    if (montoTotalNomina > 0n) {
      await this.bankService.aplicarSimulacionGastosFijos(montoTotalNomina);
      
      this.logger.log(
        `💰 Simulación aplicada al banco: ${this.moneyService.formatForUser(
          this.moneyService.fromDatabase(montoTotalNomina),
          'USD'
        )}`
      );
    }
    
    return { generados, errores };
  }

  /**
   * Obtiene comparativa de múltiples meses
   */
  async obtenerComparativaMensual(
    anio: number,
    cantidadMeses: number = 12,
  ): Promise<ComparativaMensualDto[]> {
    const meses: ComparativaMensualDto[] = [];
    
    for (let i = 0; i < cantidadMeses; i++) {
      const mesActual = new Date().getMonth() + 1 - i;
      const anioActual = mesActual <= 0 ? anio - 1 : anio;
      const mes = mesActual <= 0 ? 12 + mesActual : mesActual;
      
      const periodoId = `${anioActual}-${mes.toString().padStart(2, '0')}`;
      const resumen = await this.resumenModel.findOne({ periodoId }).exec();
      
      if (resumen) {
        const totalGastosUSD = this.moneyService.fromDatabase(resumen.totalGastosMensualUSD);
        const totalIngresosUSD = this.moneyService.fromDatabase(resumen.totalIngresosUSD);
        const utilidadNetaUSD = this.moneyService.fromDatabase(resumen.utilidadNetaUSD);
        
        meses.push({
          periodo: this.nombreMes(mes) + ' ' + anioActual,
          mes,
          anio: anioActual,
          totalGastosUSD,
          totalGastosFormateado: this.moneyService.formatForUser(totalGastosUSD, 'USD'),
          totalIngresosUSD,
          totalIngresosFormateado: this.moneyService.formatForUser(totalIngresosUSD, 'USD'),
          utilidadNetaUSD,
          utilidadNetaFormateado: this.moneyService.formatForUser(utilidadNetaUSD, 'USD'),
          porcentajeCrecimiento: resumen.porcentajeCrecimiento || undefined,
        });
      }
    }
    
    return meses;
  }

  // ========== MÉTODOS AUXILIARES ==========

  /**
   * Calcula el resumen mensual desde los gastos registrados
   */
  private async calcularResumenMensual(
    mes: number,
    anio: number,
  ): Promise<any> {
    const periodoId = `${anio}-${mes.toString().padStart(2, '0')}`;
    
    // Obtener todos los gastos del mes
    const gastosQ1 = await this.gastoModel.find({
      mes,
      anio,
      quincena: QuincenaEnum.PRIMERA_QUINCENA,
      estado: { $ne: EstadoGasto.RECHAZADO },
    }).exec();
    
    const gastosQ2 = await this.gastoModel.find({
      mes,
      anio,
      quincena: QuincenaEnum.SEGUNDA_QUINCENA,
      estado: { $ne: EstadoGasto.RECHAZADO },
    }).exec();
    
    // Calcular totales
    const totalQ1 = gastosQ1.reduce((sum, g) => sum + BigInt(g.montoUSD), 0n);
    const totalQ2 = gastosQ2.reduce((sum, g) => sum + BigInt(g.montoUSD), 0n);
    const totalMensual = totalQ1 + totalQ2;
    
    // Desglose por categoría
    const desgloseCategoria = new Map<string, any>();
    
    for (const gasto of [...gastosQ1, ...gastosQ2]) {
      const cat = gasto.categoria;
      const catData = desgloseCategoria.get(cat) || {
        primeraQuincena: 0n,
        segundaQuincena: 0n,
        total: 0n,
        cantidad: 0,
      };
      
      if (gasto.quincena === QuincenaEnum.PRIMERA_QUINCENA) {
        catData.primeraQuincena += BigInt(gasto.montoUSD);
      } else {
        catData.segundaQuincena += BigInt(gasto.montoUSD);
      }
      
      catData.total += BigInt(gasto.montoUSD);
      catData.cantidad++;
      desgloseCategoria.set(cat, catData);
    }
    
    // Obtener ingresos del mes (desde FinanzasModelo)
    const finanzas = await this.finanzasModel.find({ mes, anio }).exec();
    const totalIngresos = finanzas.reduce((sum, f) => sum + BigInt(f.gananciaOnlyTopUSD), 0n);
    
    // Calcular utilidad neta
    const utilidadNeta = totalIngresos - totalMensual;
    
    // Obtener mes anterior para comparativa
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anioAnterior = mes === 1 ? anio - 1 : anio;
    const periodoAnterior = `${anioAnterior}-${mesAnterior.toString().padStart(2, '0')}`;
    const resumenAnterior = await this.resumenModel.findOne({ periodoId: periodoAnterior }).exec();
    
    let porcentajeCrecimiento: number | null = null;
    let utilidadMesAnterior: bigint | null = null;
    
    if (resumenAnterior) {
      utilidadMesAnterior = resumenAnterior.utilidadNetaUSD;
      const utilidadAnteriorNumber = this.moneyService.fromDatabase(utilidadMesAnterior);
      const utilidadActualNumber = this.moneyService.fromDatabase(utilidadNeta);
      
      if (utilidadAnteriorNumber !== 0) {
        porcentajeCrecimiento = ((utilidadActualNumber - utilidadAnteriorNumber) / utilidadAnteriorNumber) * 100;
      }
    }
    
    // Contar por estado
    const todosGastos = [...gastosQ1, ...gastosQ2];
    const gastosPendientes = todosGastos.filter(g => g.estado === EstadoGasto.PENDIENTE).length;
    const gastosAprobados = todosGastos.filter(g => g.estado === EstadoGasto.APROBADO).length;
    const gastosPagados = todosGastos.filter(g => g.estado === EstadoGasto.PAGADO).length;
    
    // Buscar mayor gasto
    let mayorGasto: any = null;
    if (todosGastos.length > 0) {
      const gastoMax = todosGastos.reduce((max, g) => BigInt(g.montoUSD) > BigInt(max.montoUSD) ? g : max);
      mayorGasto = {
        concepto: gastoMax.concepto,
        monto: gastoMax.montoUSD,
        categoria: gastoMax.categoria,
      };
    }
    
    // Buscar o crear resumen
    let resumen = await this.resumenModel.findOne({ periodoId }).exec();
    
    if (!resumen) {
      resumen = new this.resumenModel({
        mes,
        anio,
        periodoId,
      });
    }
    
    // Actualizar valores
    resumen.totalPrimeraQuincenaUSD = totalQ1;
    resumen.totalSegundaQuincenaUSD = totalQ2;
    resumen.totalGastosMensualUSD = totalMensual;
    resumen.desgloseCategoria = desgloseCategoria;
    resumen.totalIngresosUSD = totalIngresos;
    resumen.utilidadNetaUSD = utilidadNeta;
    resumen.porcentajeCrecimiento = porcentajeCrecimiento;
    resumen.utilidadMesAnteriorUSD = utilidadMesAnterior;
    resumen.totalGastos = todosGastos.length;
    resumen.gastosPendientes = gastosPendientes;
    resumen.gastosAprobados = gastosAprobados;
    resumen.gastosPagados = gastosPagados;
    resumen.meta = { mayorGasto };
    
    return resumen.save();
  }

  /**
   * Formatea un gasto para respuesta
   */
  private formatearGasto(gasto: GastoFijoQuincenalDocument): GastoFijoFormateadoDto {
    const montoUSD = this.moneyService.fromDatabase(gasto.montoUSD);
    
    return {
      id: gasto._id.toString(),
      _id: gasto._id.toString(), // Mantener para compatibilidad
      mes: gasto.mes,
      anio: gasto.anio,
      quincena: gasto.quincena as QuincenaEnum,
      periodoId: gasto.periodoId,
      categoria: gasto.categoria as CategoriaGasto,
      empleadoId: gasto.empleadoId?.toString(),
      concepto: gasto.concepto,
      proveedor: gasto.proveedor || undefined,
      montoUSD,
      montoFormateado: this.moneyService.formatForUser(montoUSD, 'USD'),
      fechaPago: gasto.fechaPago.toISOString(),
      numeroFactura: gasto.numeroFactura || undefined,
      archivoComprobante: gasto.archivoComprobante || undefined,
      estado: gasto.estado as EstadoGasto,
      registradoPor: gasto.registradoPor.toString(),
      fechaRegistro: gasto.fechaRegistro.toISOString(),
      aprobadoPor: gasto.aprobadoPor?.toString(),
      fechaAprobacion: gasto.fechaAprobacion?.toISOString(),
      notas: gasto.notas || undefined,
      meta: gasto.meta,
    };
  }

  /**
   * Formatea un gasto desde lean()
   */
  private formatearGastoLean(gasto: any): GastoFijoFormateadoDto {
    const montoUSD = this.moneyService.fromDatabase(gasto.montoUSD);
    
    const empleadoNombre = gasto.empleadoId ? 
      `${gasto.empleadoId.nombre} ${gasto.empleadoId.apellido}` : 
      undefined;
    
    return {
      id: gasto._id.toString(),
      _id: gasto._id.toString(), // Mantener para compatibilidad
      mes: gasto.mes,
      anio: gasto.anio,
      quincena: gasto.quincena,
      periodoId: gasto.periodoId,
      categoria: gasto.categoria,
      empleadoId: gasto.empleadoId?._id?.toString(),
      empleadoNombre,
      concepto: gasto.concepto,
      proveedor: gasto.proveedor,
      montoUSD,
      montoFormateado: this.moneyService.formatForUser(montoUSD, 'USD'),
      fechaPago: gasto.fechaPago.toISOString(),
      numeroFactura: gasto.numeroFactura,
      archivoComprobante: gasto.archivoComprobante,
      estado: gasto.estado,
      registradoPor: gasto.registradoPor.toString(),
      fechaRegistro: gasto.fechaRegistro.toISOString(),
      aprobadoPor: gasto.aprobadoPor?.toString(),
      fechaAprobacion: gasto.fechaAprobacion?.toISOString(),
      notas: gasto.notas,
      meta: gasto.meta,
    };
  }

  /**
   * Formatea resumen mensual para respuesta
   */
  private formatearResumenMensual(resumen: any): ResumenMensualConsolidadoDto {
    const totalQ1 = this.moneyService.fromDatabase(resumen.totalPrimeraQuincenaUSD);
    const totalQ2 = this.moneyService.fromDatabase(resumen.totalSegundaQuincenaUSD);
    const totalGastos = this.moneyService.fromDatabase(resumen.totalGastosMensualUSD);
    const totalIngresos = this.moneyService.fromDatabase(resumen.totalIngresosUSD);
    const utilidadNeta = this.moneyService.fromDatabase(resumen.utilidadNetaUSD);
    
    const desgloseCategoria = Array.from(resumen.desgloseCategoria.entries()).map(([categoria, data]) => {
      const primeraQuincenaUSD = this.moneyService.fromDatabase(data.primeraQuincena);
      const segundaQuincenaUSD = this.moneyService.fromDatabase(data.segundaQuincena);
      const totalUSD = this.moneyService.fromDatabase(data.total);
      
      return {
        categoria: categoria as CategoriaGasto,
        primeraQuincenaUSD,
        segundaQuincenaUSD,
        totalUSD,
        totalFormateado: this.moneyService.formatForUser(totalUSD, 'USD'),
        cantidad: data.cantidad,
        porcentaje: totalGastos > 0 ? (totalUSD / totalGastos) * 100 : 0,
      };
    });
    
    let comparativa: any = undefined;
    if (resumen.porcentajeCrecimiento !== null && resumen.porcentajeCrecimiento !== undefined && resumen.utilidadMesAnteriorUSD) {
      const mesAnterior = resumen.mes === 1 ? 12 : resumen.mes - 1;
      const anioAnterior = resumen.mes === 1 ? resumen.anio - 1 : resumen.anio;
      const utilidadAnterior = this.moneyService.fromDatabase(resumen.utilidadMesAnteriorUSD);
      
      comparativa = {
        mesAnterior: `${this.nombreMes(mesAnterior)} ${anioAnterior}`,
        utilidadMesAnteriorUSD: utilidadAnterior,
        utilidadMesAnteriorFormateado: this.moneyService.formatForUser(utilidadAnterior, 'USD'),
        porcentajeCrecimiento: resumen.porcentajeCrecimiento,
        direccion: resumen.porcentajeCrecimiento > 0 ? 'crecimiento' as const : 
                   resumen.porcentajeCrecimiento < 0 ? 'decrecimiento' as const : 'neutro' as const,
      };
    }
    
    return {
      mes: resumen.mes,
      anio: resumen.anio,
      periodoId: resumen.periodoId,
      primeraQuincena: {
        totalUSD: totalQ1,
        totalFormateado: this.moneyService.formatForUser(totalQ1, 'USD'),
        cantidadGastos: 0, // Se puede calcular si es necesario
      },
      segundaQuincena: {
        totalUSD: totalQ2,
        totalFormateado: this.moneyService.formatForUser(totalQ2, 'USD'),
        cantidadGastos: 0,
      },
      totalGastosMensual: {
        totalUSD: totalGastos,
        totalFormateado: this.moneyService.formatForUser(totalGastos, 'USD'),
        cantidadGastos: resumen.totalGastos,
      },
      totalIngresos: {
        totalUSD: totalIngresos,
        totalFormateado: this.moneyService.formatForUser(totalIngresos, 'USD'),
      },
      utilidadNeta: {
        totalUSD: utilidadNeta,
        totalFormateado: this.moneyService.formatForUser(utilidadNeta, 'USD'),
        esPositiva: utilidadNeta >= 0,
        color: utilidadNeta >= 0 ? 'verde' : 'rojo',
      },
      comparativa,
      desgloseCategoria: desgloseCategoria.sort((a, b) => b.totalUSD - a.totalUSD),
      estado: resumen.estado as EstadoResumen,
      fechaConsolidacion: resumen.fechaConsolidacion?.toISOString(),
      meta: {
        mayorGasto: resumen.meta?.mayorGasto ? {
          concepto: resumen.meta.mayorGasto.concepto,
          montoFormateado: this.moneyService.formatForUser(
            this.moneyService.fromDatabase(resumen.meta.mayorGasto.monto),
            'USD'
          ),
          categoria: resumen.meta.mayorGasto.categoria as CategoriaGasto,
        } : undefined,
        categoriaMayorGasto: desgloseCategoria[0]?.categoria,
        totalGastos: resumen.totalGastos,
        gastosPendientes: resumen.gastosPendientes,
        gastosAprobados: resumen.gastosAprobados,
        gastosPagados: resumen.gastosPagados,
      },
    };
  }

  /**
   * Genera el ID del periodo quincenal
   */
  private generarPeriodoId(anio: number, mes: number, quincena: QuincenaEnum): string {
    const q = quincena === QuincenaEnum.PRIMERA_QUINCENA ? 'Q1' : 'Q2';
    return `${anio}-${mes.toString().padStart(2, '0')}-${q}`;
  }

  /**
   * Calcula la fecha de pago de la quincena
   */
  private calcularFechaPagoQuincena(mes: number, anio: number, quincena: QuincenaEnum): string {
    const dia = quincena === QuincenaEnum.PRIMERA_QUINCENA ? 15 : 
                new Date(anio, mes, 0).getDate(); // Último día del mes
    return `${anio}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
  }

  /**
   * Obtiene el nombre del mes en español
   */
  private nombreMes(mes: number): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1];
  }
}
