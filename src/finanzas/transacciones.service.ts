import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TransaccionMovimientoEntity,
  TransaccionMovimientoDocument,
  TipoTransaccion,
  OrigenTransaccion,
  EstadoTransaccion,
} from './transaccion-movimiento.schema.js';
import {
  CrearTransaccionDto,
  FiltrarTransaccionesDto,
  TransaccionFormateadaDto,
  TransaccionesPaginadasDto,
  ResumenTransaccionesPeriodoDto,
  SaldoMovimientoDto,
  FlujoCajaDetalladoDto,
  ComparativaTransaccionesDto,
} from './transacciones.dto.js';
import { MoneyService } from '../money/money.service.js';

/**
 * TransaccionesService - Servicio profesional de gestión de transacciones de movimiento
 * 
 * Responsabilidades:
 * - Registrar cada ingreso/egreso como transacción
 * - Consultar historial con filtros avanzados
 * - Calcular saldos y resúmenes por periodo
 * - Marcar transacciones como consolidadas
 * - Generar reportes de flujo de caja
 * 
 * IMPORTANTE: Este servicio NO modifica bank_onlytop directamente.
 * BankOnlyTopService se encarga de eso.
 */
@Injectable()
export class TransaccionesService {
  private readonly logger = new Logger(TransaccionesService.name);

  constructor(
    @InjectModel(TransaccionMovimientoEntity.name)
    private transaccionModel: Model<TransaccionMovimientoDocument>,
    private readonly moneyService: MoneyService,
  ) {}

  // ========== CREACIÓN ==========

  /**
   * Registra una nueva transacción
   * Este método es llamado por BankOnlyTopService al aplicar movimientos
   */
  async registrarTransaccion(dto: CrearTransaccionDto): Promise<TransaccionMovimientoDocument> {
    try {
      // Validar que el monto sea positivo
      if (dto.montoUSD <= 0n) {
        throw new BadRequestException('El monto de la transacción debe ser mayor a cero');
      }

      const transaccion = new this.transaccionModel({
        periodo: dto.periodo,
        mes: dto.mes,
        anio: dto.anio,
        tipo: dto.tipo,
        origen: dto.origen,
        montoUSD: dto.montoUSD,
        descripcion: dto.descripcion,
        referenciaId: dto.referenciaId,
        referenciaModelo: dto.referenciaModelo,
        modeloId: dto.modeloId ? new Types.ObjectId(dto.modeloId) : null,
        notas: dto.notas,
        creadoPor: dto.creadoPor ? new Types.ObjectId(dto.creadoPor) : null,
        estado: EstadoTransaccion.EN_MOVIMIENTO,
        meta: dto.meta || {},
      });

      await transaccion.save();

      const montoDecimal = this.moneyService.fromDatabase(dto.montoUSD);
      const signo = dto.tipo === TipoTransaccion.INGRESO ? '+' : '-';

      this.logger.log(
        `✅ Transacción registrada: ${dto.periodo} | ${dto.origen} | ${signo}$${montoDecimal} | ${dto.descripcion}`,
      );

      return transaccion;
    } catch (error: any) {
      this.logger.error(`❌ Error al registrar transacción: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ========== CONSULTAS ==========

  /**
   * Obtiene transacciones con filtros
   */
  async obtenerTransacciones(
    filtros: FiltrarTransaccionesDto,
  ): Promise<TransaccionesPaginadasDto> {
    const query: any = {};

    // Filtros básicos
    if (filtros.periodo) query.periodo = filtros.periodo;
    if (filtros.mes) query.mes = filtros.mes;
    if (filtros.anio) query.anio = filtros.anio;
    if (filtros.tipo) query.tipo = filtros.tipo;
    if (filtros.origen) query.origen = filtros.origen;
    if (filtros.estado) query.estado = filtros.estado;
    if (filtros.modeloId) query.modeloId = new Types.ObjectId(filtros.modeloId);
    if (filtros.referenciaId) query.referenciaId = filtros.referenciaId;

    // Filtro por rango de fechas
    if (filtros.fechaDesde || filtros.fechaHasta) {
      query.createdAt = {};
      if (filtros.fechaDesde) query.createdAt.$gte = new Date(filtros.fechaDesde);
      if (filtros.fechaHasta) query.createdAt.$lte = new Date(filtros.fechaHasta);
    }

    // Paginación
    const limite = filtros.limite || 50;
    const saltar = filtros.saltar || 0;

    const [transacciones, total] = await Promise.all([
      this.transaccionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(saltar)
        .limit(limite)
        .exec(),
      this.transaccionModel.countDocuments(query).exec(),
    ]);

    const transaccionesFormateadas = transacciones.map((t) => this.formatearTransaccion(t));

    return {
      transacciones: transaccionesFormateadas,
      total,
      pagina: Math.floor(saltar / limite) + 1,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  /**
   * Obtiene una transacción por ID
   */
  async obtenerTransaccionPorId(id: string): Promise<TransaccionFormateadaDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de transacción inválido');
    }

    const transaccion = await this.transaccionModel.findById(id).exec();

    if (!transaccion) {
      throw new NotFoundException('Transacción no encontrada');
    }

    return this.formatearTransaccion(transaccion);
  }

  /**
   * Obtiene resumen de transacciones por periodo
   */
  async obtenerResumenPeriodo(
    mes: number,
    anio: number,
  ): Promise<ResumenTransaccionesPeriodoDto> {
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

    const transacciones = await this.transaccionModel.find({ periodo }).exec();

    // Calcular totales
    let totalIngresos = 0n;
    let totalEgresos = 0n;
    let cantidadIngresos = 0;
    let cantidadEgresos = 0;

    const desglosePorOrigen = new Map<
      string,
      { origen: OrigenTransaccion; tipo: TipoTransaccion; cantidad: number; total: bigint }
    >();

    let transaccionesEnMovimiento = 0;
    let transaccionesConsolidadas = 0;
    let ultimaFecha: Date | undefined;

    for (const t of transacciones) {
      if (t.tipo === TipoTransaccion.INGRESO) {
        totalIngresos += t.montoUSD;
        cantidadIngresos++;
      } else {
        totalEgresos += t.montoUSD;
        cantidadEgresos++;
      }

      // Desglose por origen
      const key = `${t.origen}_${t.tipo}`;
      const actual = desglosePorOrigen.get(key);
      if (actual) {
        actual.cantidad++;
        actual.total += t.montoUSD;
      } else {
        desglosePorOrigen.set(key, {
          origen: t.origen,
          tipo: t.tipo,
          cantidad: 1,
          total: t.montoUSD,
        });
      }

      // Estado
      if (t.estado === EstadoTransaccion.EN_MOVIMIENTO) transaccionesEnMovimiento++;
      if (t.estado === EstadoTransaccion.CONSOLIDADO) transaccionesConsolidadas++;

      // Última fecha
      const doc = t as any;
      if (!ultimaFecha || doc.createdAt > ultimaFecha) {
        ultimaFecha = doc.createdAt;
      }
    }

    const saldoNeto = totalIngresos - totalEgresos;

    // Formatear desglose
    const desgloseFormateado = Array.from(desglosePorOrigen.values()).map((item) => ({
      origen: item.origen,
      tipo: item.tipo,
      cantidad: item.cantidad,
      total: this.moneyService.fromDatabase(item.total),
      totalFormateado: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(item.total),
        'USD',
      ),
    }));

    // Determinar estado del periodo
    const estado = transaccionesConsolidadas > 0 && transaccionesEnMovimiento === 0
      ? 'CONSOLIDADO'
      : 'ABIERTO';

    const fechaConsolidacion =
      estado === 'CONSOLIDADO'
        ? transacciones.find((t) => t.fechaConsolidacion)?.fechaConsolidacion
        : null;

    return {
      periodo,
      mes,
      anio,
      totalIngresos: this.moneyService.fromDatabase(totalIngresos),
      totalIngresosFormateado: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(totalIngresos),
        'USD',
      ),
      totalEgresos: this.moneyService.fromDatabase(totalEgresos),
      totalEgresosFormateado: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(totalEgresos),
        'USD',
      ),
      saldoNeto: this.moneyService.fromDatabase(saldoNeto),
      saldoNetoFormateado: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(saldoNeto),
        'USD',
      ),
      cantidadIngresos,
      cantidadEgresos,
      cantidadTotal: cantidadIngresos + cantidadEgresos,
      desglosePorOrigen: desgloseFormateado,
      transaccionesEnMovimiento,
      transaccionesConsolidadas,
      estado,
      fechaUltimaTransaccion: ultimaFecha,
      fechaConsolidacion,
    };
  }

  /**
   * Obtiene el saldo actual en movimiento
   */
  async obtenerSaldoMovimiento(periodo?: string): Promise<SaldoMovimientoDto> {
    const periodoActual =
      periodo ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const transaccionesEnMovimiento = await this.transaccionModel
      .find({
        periodo: periodoActual,
        estado: EstadoTransaccion.EN_MOVIMIENTO,
      })
      .exec();

    let ingresosEnMovimiento = 0n;
    let egresosEnMovimiento = 0n;

    for (const t of transaccionesEnMovimiento) {
      if (t.tipo === TipoTransaccion.INGRESO) {
        ingresosEnMovimiento += t.montoUSD;
      } else {
        egresosEnMovimiento += t.montoUSD;
      }
    }

    const saldoNetoMovimiento = ingresosEnMovimiento - egresosEnMovimiento;

    // Obtener última transacción
    const ultimaTransaccion = transaccionesEnMovimiento.sort(
      (a, b) => ((b as any).createdAt?.getTime() || 0) - ((a as any).createdAt?.getTime() || 0),
    )[0];

    return {
      periodoActual,
      dineroMovimientoUSD: this.moneyService.fromDatabase(saldoNetoMovimiento),
      dineroMovimientoFormateado: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(saldoNetoMovimiento),
        'USD',
      ),
      dineroConsolidadoUSD: 0, // Se obtiene de bank_onlytop
      dineroConsolidadoFormateado: '$0.00',
      totalUSD: this.moneyService.fromDatabase(saldoNetoMovimiento),
      totalFormateado: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(saldoNetoMovimiento),
        'USD',
      ),
      ingresosEnMovimiento: this.moneyService.fromDatabase(ingresosEnMovimiento),
      egresosEnMovimiento: this.moneyService.fromDatabase(egresosEnMovimiento),
      saldoNetoMovimiento: this.moneyService.fromDatabase(saldoNetoMovimiento),
      transaccionesEnMovimiento: transaccionesEnMovimiento.length,
      ultimaTransaccion: ultimaTransaccion
        ? {
            fecha: (ultimaTransaccion as any).createdAt,
            tipo: ultimaTransaccion.tipo,
            origen: ultimaTransaccion.origen,
            monto: this.moneyService.fromDatabase(ultimaTransaccion.montoUSD),
            descripcion: ultimaTransaccion.descripcion,
          }
        : undefined,
    };
  }

  // ========== CONSOLIDACIÓN ==========

  /**
   * Marca todas las transacciones de un periodo como consolidadas
   * Este método es llamado por BankOnlyTopService al consolidar
   */
  async marcarComoConsolidadas(
    mes: number,
    anio: number,
    periodoConsolidadoId: string,
    userId?: string,
  ): Promise<number> {
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

    const resultado = await this.transaccionModel
      .updateMany(
        {
          periodo,
          estado: EstadoTransaccion.EN_MOVIMIENTO,
        },
        {
          $set: {
            estado: EstadoTransaccion.CONSOLIDADO,
            fechaConsolidacion: new Date(),
            consolidadoPor: userId ? new Types.ObjectId(userId) : null,
            periodoConsolidadoId,
          },
        },
      )
      .exec();

    this.logger.log(
      `✅ ${resultado.modifiedCount} transacciones marcadas como CONSOLIDADO para periodo ${periodo}`,
    );

    return resultado.modifiedCount;
  }

  /**
   * Revierte una transacción (marca como REVERTIDO y crea transacción inversa)
   */
  async revertirTransaccion(
    id: string,
    motivo: string,
    userId?: string,
  ): Promise<TransaccionMovimientoDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de transacción inválido');
    }

    const transaccion = await this.transaccionModel.findById(id).exec();

    if (!transaccion) {
      throw new NotFoundException('Transacción no encontrada');
    }

    if (transaccion.estado === EstadoTransaccion.CONSOLIDADO) {
      throw new BadRequestException('No se puede revertir una transacción consolidada');
    }

    if (transaccion.estado === EstadoTransaccion.REVERTIDO) {
      throw new BadRequestException('La transacción ya está revertida');
    }

    // Crear transacción inversa
    const tipoInverso =
      transaccion.tipo === TipoTransaccion.INGRESO
        ? TipoTransaccion.EGRESO
        : TipoTransaccion.INGRESO;

    const transaccionInversa = await this.registrarTransaccion({
      periodo: transaccion.periodo,
      mes: transaccion.mes,
      anio: transaccion.anio,
      tipo: tipoInverso,
      origen: OrigenTransaccion.AJUSTE_MANUAL,
      montoUSD: transaccion.montoUSD,
      descripcion: `REVERSIÓN: ${transaccion.descripcion}`,
      referenciaId: transaccion.referenciaId || undefined,
      referenciaModelo: transaccion.referenciaModelo || undefined,
      modeloId: transaccion.modeloId?.toString(),
      notas: `Reversión de transacción ${id}. Motivo: ${motivo}`,
      creadoPor: userId,
      meta: {
        transaccionOriginalId: id,
        motivoReversion: motivo,
      },
    });

    // Marcar original como revertida
    transaccion.estado = EstadoTransaccion.REVERTIDO;
    transaccion.revertidaPor = transaccionInversa._id;
    transaccion.fechaReversion = new Date();
    transaccion.motivoReversion = motivo;
    await transaccion.save();

    this.logger.log(`✅ Transacción ${id} revertida exitosamente`);

    return transaccionInversa;
  }

  // ========== REPORTES ==========

  /**
   * Genera flujo de caja detallado de un periodo
   */
  async generarFlujoCaja(mes: number, anio: number): Promise<FlujoCajaDetalladoDto> {
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
    const resumen = await this.obtenerResumenPeriodo(mes, anio);

    // Agrupar ingresos y egresos por tipo
    const ingresos = resumen.desglosePorOrigen
      .filter((d) => d.tipo === TipoTransaccion.INGRESO)
      .map((d) => ({
        tipo: d.origen,
        cantidad: d.cantidad,
        total: d.total,
        totalFormateado: d.totalFormateado,
      }));

    const egresos = resumen.desglosePorOrigen
      .filter((d) => d.tipo === TipoTransaccion.EGRESO)
      .map((d) => ({
        tipo: d.origen,
        cantidad: d.cantidad,
        total: d.total,
        totalFormateado: d.totalFormateado,
      }));

    // Calcular cambio
    const cambioAbsoluto = resumen.saldoNeto;
    const cambioRelativo = resumen.totalIngresos > 0 ? (cambioAbsoluto / resumen.totalIngresos) * 100 : 0;

    return {
      periodo,
      mes,
      anio,
      saldoInicial: 0, // Se obtiene de bank consolidado anterior
      saldoInicialFormateado: '$0.00',
      ingresos,
      egresos,
      totalIngresos: resumen.totalIngresos,
      totalIngresosFormateado: resumen.totalIngresosFormateado,
      totalEgresos: resumen.totalEgresos,
      totalEgresosFormateado: resumen.totalEgresosFormateado,
      saldoFinal: resumen.saldoNeto,
      saldoFinalFormateado: resumen.saldoNetoFormateado,
      cambioAbsoluto,
      cambioRelativo,
      consolidado: resumen.estado === 'CONSOLIDADO',
      fechaConsolidacion: resumen.fechaConsolidacion,
    };
  }

  /**
   * Genera comparativa entre múltiples periodos
   */
  async generarComparativa(periodos: string[]): Promise<ComparativaTransaccionesDto> {
    const datosperiodos = await Promise.all(
      periodos.map(async (periodo) => {
        const [anio, mes] = periodo.split('-').map(Number);
        const resumen = await this.obtenerResumenPeriodo(mes, anio);
        return {
          periodo,
          ingresos: resumen.totalIngresos,
          egresos: resumen.totalEgresos,
          saldo: resumen.saldoNeto,
          consolidado: resumen.estado === 'CONSOLIDADO',
        };
      }),
    );

    // Calcular promedios
    const totalPeriodos = datosperiodos.length;
    const promedioIngresos =
      datosperiodos.reduce((acc, p) => acc + p.ingresos, 0) / totalPeriodos;
    const promedioEgresos =
      datosperiodos.reduce((acc, p) => acc + p.egresos, 0) / totalPeriodos;
    const promedioSaldo = datosperiodos.reduce((acc, p) => acc + p.saldo, 0) / totalPeriodos;

    // Mejor y peor periodo
    const ordenadosPorSaldo = [...datosperiodos].sort((a, b) => b.saldo - a.saldo);
    const mejorPeriodo = ordenadosPorSaldo[0];
    const peorPeriodo = ordenadosPorSaldo[ordenadosPorSaldo.length - 1];

    // Calcular tendencia
    let tendencia: 'CRECIENTE' | 'ESTABLE' | 'DECRECIENTE' = 'ESTABLE';
    if (datosperiodos.length >= 2) {
      const primeros3 = datosperiodos.slice(0, Math.min(3, datosperiodos.length));
      const ultimos3 = datosperiodos.slice(-Math.min(3, datosperiodos.length));
      const promedioPrimeros = primeros3.reduce((acc, p) => acc + p.saldo, 0) / primeros3.length;
      const promedioUltimos = ultimos3.reduce((acc, p) => acc + p.saldo, 0) / ultimos3.length;

      if (promedioUltimos > promedioPrimeros * 1.1) tendencia = 'CRECIENTE';
      else if (promedioUltimos < promedioPrimeros * 0.9) tendencia = 'DECRECIENTE';
    }

    return {
      periodos: datosperiodos,
      promedioIngresos,
      promedioEgresos,
      promedioSaldo,
      mejorPeriodo: { periodo: mejorPeriodo.periodo, saldo: mejorPeriodo.saldo },
      peorPeriodo: { periodo: peorPeriodo.periodo, saldo: peorPeriodo.saldo },
      tendencia,
    };
  }

  // ========== MÉTODOS AUXILIARES ==========

  /**
   * Formatea una transacción para frontend
   */
  private formatearTransaccion(
    transaccion: TransaccionMovimientoDocument,
  ): TransaccionFormateadaDto {
    const montoDecimal = this.moneyService.fromDatabase(transaccion.montoUSD);

    return {
      id: transaccion._id.toString(),
      periodo: transaccion.periodo,
      mes: transaccion.mes,
      anio: transaccion.anio,
      tipo: transaccion.tipo,
      origen: transaccion.origen,
      montoUSD: montoDecimal,
      montoFormateado: this.moneyService.formatForUser(montoDecimal, 'USD'),
      descripcion: transaccion.descripcion,
      notas: transaccion.notas,
      estado: transaccion.estado,
      referenciaId: transaccion.referenciaId,
      referenciaModelo: transaccion.referenciaModelo,
      modeloId: transaccion.modeloId?.toString(),
      fechaCreacion: (transaccion as any).createdAt,
      fechaConsolidacion: transaccion.fechaConsolidacion,
      consolidadoPor: transaccion.consolidadoPor?.toString(),
      creadoPor: transaccion.creadoPor?.toString(),
      meta: transaccion.meta,
    };
  }
}
