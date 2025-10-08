import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BankOnlyTopEntity, BankOnlyTopDocument } from './bank-onlytop.schema.js';
import { TransaccionesService } from './transacciones.service.js';
import {
  TipoTransaccion,
  OrigenTransaccion,
} from './transaccion-movimiento.schema.js';
import { MoneyService } from '../money/money.service.js';

/**
 * DTOs para operaciones del banco
 */
export interface AplicarMovimientoDto {
  tipo: 'INGRESO' | 'EGRESO';
  montoUSD: bigint;
  motivo: string;
  origen: OrigenTransaccion;
  referencia?: string;
  referenciaModelo?: string;
  modeloId?: string;
  userId?: string;
  meta?: any;
}

export interface ConsolidarPeriodoDto {
  periodo: string;
  mes: number;
  anio: number;
  usuarioId?: string;
  notas?: string;
}

export interface EstadoBankDto {
  dineroConsolidadoUSD: number;
  dineroConsolidadoFormateado: string;
  dineroMovimientoUSD: number;
  dineroMovimientoFormateado: string;
  simulacionAfectoGastosFijosUSD: number;
  simulacionAfectoGastosFijosFormateado: string;
  saldoProyectadoUSD: number; // movimiento - simulación
  saldoProyectadoFormateado: string;
  totalUSD: number;
  totalFormateado: string;
  periodoActual: string;
  ultimaConsolidacion?: Date | null;
  totalPeriodosConsolidados: number;
  totalModelosHistorico: number;
  totalVentasHistorico: number;
  meta?: any;
}

/**
 * BankOnlyTopService - Servicio de dominio para el banco corporativo
 * 
 * REGLA CRÍTICA (rules.md):
 * - Única puerta de entrada para modificar bank_onlytop
 * - Todos los módulos DEBEN usar este servicio
 * - NUNCA escribir directamente al modelo BankOnlyTopEntity desde otros servicios
 * 
 * Responsabilidades:
 * 1. aplicarMovimiento: registra transacción + actualiza dineroMovimientoUSD
 * 2. consolidarPeriodo: transfiere movimiento → consolidado (atómico)
 * 3. getEstado: retorna snapshot actual (siempre con fromDatabase)
 * 
 * Integración:
 * - FinanzasService: llama a aplicarMovimiento(INGRESO) por cada ganancia
 * - CostosFijosService: llama a aplicarMovimiento(EGRESO) por cada gasto
 * - Consolidación: llama a consolidarPeriodo al cerrar el mes
 */
@Injectable()
export class BankOnlyTopService {
  private readonly logger = new Logger(BankOnlyTopService.name);
  private readonly BANK_ID = 'onlytop_bank';

  constructor(
    @InjectModel(BankOnlyTopEntity.name)
    private bankModel: Model<BankOnlyTopDocument>,
    private readonly transaccionesService: TransaccionesService,
    private readonly moneyService: MoneyService,
  ) {}

  // ========== OPERACIONES PRINCIPALES ==========

  /**
   * Aplica un movimiento al banco (ingreso o egreso)
   * 
   * Flujo:
   * 1. Registra transacción en finanzas_transacciones_movimiento
   * 2. Actualiza dineroMovimientoUSD en bank_onlytop (atómico con $inc)
   * 3. Retorna estado actualizado
   * 
   * @param dto Datos del movimiento
   * @returns Estado actualizado del banco
   */
  async aplicarMovimiento(dto: AplicarMovimientoDto): Promise<EstadoBankDto> {
    try {
      // Validar monto
      if (dto.montoUSD <= 0n) {
        throw new BadRequestException('El monto debe ser mayor a cero');
      }

      // Extraer periodo del motivo o usar el actual
      const ahora = new Date();
      const periodo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
      const [anio, mes] = periodo.split('-').map(Number);

      // 1. Registrar transacción
      const tipoTransaccion =
        dto.tipo === 'INGRESO' ? TipoTransaccion.INGRESO : TipoTransaccion.EGRESO;

      await this.transaccionesService.registrarTransaccion({
        periodo,
        mes,
        anio,
        tipo: tipoTransaccion,
        origen: dto.origen,
        montoUSD: dto.montoUSD,
        descripcion: dto.motivo,
        referenciaId: dto.referencia,
        referenciaModelo: dto.referenciaModelo,
        modeloId: dto.modeloId,
        notas: dto.meta?.notas,
        creadoPor: dto.userId,
        meta: dto.meta,
      });

      // 2. Actualizar bank atómicamente
      const incremento = dto.tipo === 'INGRESO' ? dto.montoUSD : -dto.montoUSD;

      const bankActualizado = await this.bankModel
        .findOneAndUpdate(
          { _id: this.BANK_ID },
          {
            $inc: { dineroMovimientoUSD: incremento },
            $set: { periodoActual: periodo },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          },
        )
        .exec();

      if (!bankActualizado) {
        throw new Error('Error al actualizar el banco');
      }

      const montoDecimal = this.moneyService.fromDatabase(dto.montoUSD);
      const signo = dto.tipo === 'INGRESO' ? '+' : '-';

      this.logger.log(
        `💰 Movimiento aplicado: ${dto.tipo} ${signo}$${montoDecimal} | ${dto.motivo}`,
      );

      return this.formatearEstado(bankActualizado);
    } catch (error: any) {
      this.logger.error(`❌ Error al aplicar movimiento: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Consolida un periodo: transfiere dineroMovimientoUSD → dineroConsolidadoUSD
   * 
   * Flujo (ATÓMICO):
   * 1. Valida que el periodo tenga transacciones en movimiento
   * 2. Transfiere el saldo atómicamente
   * 3. Marca todas las transacciones del periodo como CONSOLIDADO
   * 4. Actualiza contadores globales
   * 
   * @param dto Datos de consolidación
   * @returns Estado actualizado del banco
   */
  async consolidarPeriodo(dto: ConsolidarPeriodoDto): Promise<EstadoBankDto> {
    try {
      const { periodo, mes, anio, usuarioId } = dto;

      this.logger.log(`🔄 Iniciando consolidación del periodo ${periodo}...`);

      // 1. Obtener estado actual del banco
      const bank = await this.obtenerOCrearBank();

      // Validar que haya dinero en movimiento
      if (bank.dineroMovimientoUSD === 0n) {
        this.logger.warn(`⚠️ No hay dinero en movimiento para consolidar en ${periodo}`);
      }

      // 2. Obtener resumen de transacciones del periodo
      const resumen = await this.transaccionesService.obtenerResumenPeriodo(mes, anio);

      if (resumen.transaccionesEnMovimiento === 0) {
        throw new BadRequestException(
          `No hay transacciones en movimiento para el periodo ${periodo}`,
        );
      }

      // 3. Transferir dinero atómicamente (movimiento → consolidado)
      const bankConsolidado = await this.bankModel
        .findOneAndUpdate(
          { _id: this.BANK_ID },
          {
            $inc: {
              dineroConsolidadoUSD: bank.dineroMovimientoUSD,
              totalPeriodosConsolidados: 1,
            },
            $set: {
              dineroMovimientoUSD: 0n,
              ultimaConsolidacion: new Date(),
            },
          },
          { new: true },
        )
        .exec();

      if (!bankConsolidado) {
        throw new Error('Error al consolidar el banco');
      }

      // 4. Marcar transacciones como consolidadas
      const periodoConsolidadoId = `consolidado_${periodo}`;
      await this.transaccionesService.marcarComoConsolidadas(
        mes,
        anio,
        periodoConsolidadoId,
        usuarioId,
      );

      const montoConsolidado = this.moneyService.fromDatabase(bank.dineroMovimientoUSD);

      this.logger.log(
        `✅ Periodo ${periodo} consolidado exitosamente | Monto: $${montoConsolidado}`,
      );
      this.logger.log(
        `📊 Transacciones consolidadas: ${resumen.transaccionesEnMovimiento} | ` +
          `Ingresos: $${resumen.totalIngresos} | Egresos: $${resumen.totalEgresos}`,
      );

      return this.formatearEstado(bankConsolidado);
    } catch (error: any) {
      this.logger.error(`❌ Error al consolidar periodo: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtiene el estado actual del banco
   * 
   * @returns Estado formateado (BigInt → number con fromDatabase)
   */
  async getEstado(): Promise<EstadoBankDto> {
    const bank = await this.obtenerOCrearBank();
    return this.formatearEstado(bank);
  }

  /**
   * Aplica simulación de gastos fijos (incrementa proyección)
   * 
   * Este método se llama al generar nómina para proyectar el impacto.
   * NO afecta dineroMovimientoUSD hasta la consolidación.
   * 
   * @param montoUSD Monto a simular (positivo)
   */
  async aplicarSimulacionGastosFijos(montoUSD: bigint): Promise<EstadoBankDto> {
    try {
      if (montoUSD <= 0n) {
        throw new Error('El monto de simulación debe ser positivo');
      }

      const bank = await this.obtenerOCrearBank();
      
      // Incrementar simulación
      bank.simulacionAfectoGastosFijosUSD += montoUSD;
      await bank.save();
      
      this.logger.log(
        `💭 Simulación aplicada: +${this.moneyService.formatForUser(this.moneyService.fromDatabase(montoUSD), 'USD')} ` +
        `(Total simulado: ${this.moneyService.formatForUser(this.moneyService.fromDatabase(bank.simulacionAfectoGastosFijosUSD), 'USD')})`
      );
      
      return this.formatearEstado(bank);
    } catch (error: any) {
      this.logger.error(`Error al aplicar simulación: ${error.message}`);
      throw error;
    }
  }

  /**
   * Consolida gastos fijos: transfiere simulación → movimiento real
   * 
   * Este método se llama al consolidar gastos fijos del periodo.
   * Convierte la proyección en afectación real del dinero.
   * 
   * @param mes Mes del periodo
   * @param anio Año del periodo
   */
  async consolidarGastosFijos(mes: number, anio: number): Promise<EstadoBankDto> {
    try {
      const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
      const bank = await this.obtenerOCrearBank();
      
      if (bank.simulacionAfectoGastosFijosUSD === 0n) {
        this.logger.warn(`No hay simulación de gastos fijos para consolidar en ${periodo}`);
        return this.formatearEstado(bank);
      }
      
      const montoAConsolidar = bank.simulacionAfectoGastosFijosUSD;
      
      // Transferir simulación a movimiento real (egreso)
      bank.dineroMovimientoUSD -= montoAConsolidar;
      bank.simulacionAfectoGastosFijosUSD = 0n;
      
      await bank.save();
      
      this.logger.log(
        `💸 Gastos fijos consolidados en ${periodo}: ` +
        `-${this.moneyService.formatForUser(this.moneyService.fromDatabase(montoAConsolidar), 'USD')} ` +
        `(Saldo movimiento: ${this.moneyService.formatForUser(this.moneyService.fromDatabase(bank.dineroMovimientoUSD), 'USD')})`
      );
      
      // Registrar transacción de consolidación
      await this.transaccionesService.registrarTransaccion({
        periodo,
        mes,
        anio,
        tipo: TipoTransaccion.EGRESO,
        origen: OrigenTransaccion.CONSOLIDACION_COSTOS,
        montoUSD: montoAConsolidar,
        descripcion: `Consolidación de gastos fijos - ${periodo}`,
        notas: 'Transferencia de simulación a movimiento real',
        meta: {
          tipo: 'CONSOLIDACION_GASTOS_FIJOS',
          periodo,
        },
      });
      
      return this.formatearEstado(bank);
    } catch (error: any) {
      this.logger.error(`Error al consolidar gastos fijos: ${error.message}`);
      throw error;
    }
  }

  // ========== MÉTODOS AUXILIARES ==========

  /**
   * Obtiene o crea el documento del banco (idempotente)
   */
  private async obtenerOCrearBank(): Promise<BankOnlyTopDocument> {
    let bank = await this.bankModel.findById(this.BANK_ID).exec();

    if (!bank) {
      const ahora = new Date();
      const periodo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

      bank = new this.bankModel({
        _id: this.BANK_ID,
        empresa: 'OnlyTop',
        dineroConsolidadoUSD: 0n,
        dineroMovimientoUSD: 0n,
        periodoActual: periodo,
        ultimaConsolidacion: null,
        totalPeriodosConsolidados: 0,
        totalModelosHistorico: 0,
        totalVentasHistorico: 0,
        meta: {},
      });

      await bank.save();
      this.logger.log(`🏦 Banco OnlyTop creado con ID: ${this.BANK_ID}`);
    }

    return bank;
  }

  /**
   * Formatea el estado del banco para respuesta (nunca expone BigInt)
   */
  private formatearEstado(bank: BankOnlyTopDocument): EstadoBankDto {
    const consolidado = this.moneyService.fromDatabase(bank.dineroConsolidadoUSD);
    const movimiento = this.moneyService.fromDatabase(bank.dineroMovimientoUSD);
    const simulacion = this.moneyService.fromDatabase(bank.simulacionAfectoGastosFijosUSD || 0n);
    const saldoProyectado = this.moneyService.subtract(movimiento, simulacion);
    const total = this.moneyService.add(consolidado, movimiento);

    return {
      dineroConsolidadoUSD: consolidado,
      dineroConsolidadoFormateado: this.moneyService.formatForUser(consolidado, 'USD'),
      dineroMovimientoUSD: movimiento,
      dineroMovimientoFormateado: this.moneyService.formatForUser(movimiento, 'USD'),
      simulacionAfectoGastosFijosUSD: simulacion,
      simulacionAfectoGastosFijosFormateado: this.moneyService.formatForUser(simulacion, 'USD'),
      saldoProyectadoUSD: saldoProyectado,
      saldoProyectadoFormateado: this.moneyService.formatForUser(saldoProyectado, 'USD'),
      totalUSD: total,
      totalFormateado: this.moneyService.formatForUser(total, 'USD'),
      periodoActual: bank.periodoActual,
      ultimaConsolidacion: bank.ultimaConsolidacion,
      totalPeriodosConsolidados: bank.totalPeriodosConsolidados,
      totalModelosHistorico: bank.totalModelosHistorico,
      totalVentasHistorico: bank.totalVentasHistorico,
      meta: bank.meta,
    };
  }

  /**
   * Actualiza contadores globales del banco (llamado tras operaciones masivas)
   */
  async actualizarContadores(incrementos: {
    modelos?: number;
    ventas?: number;
  }): Promise<void> {
    const update: any = {};
    if (incrementos.modelos) update.totalModelosHistorico = incrementos.modelos;
    if (incrementos.ventas) update.totalVentasHistorico = incrementos.ventas;

    if (Object.keys(update).length > 0) {
      await this.bankModel
        .findByIdAndUpdate(this.BANK_ID, { $inc: update })
        .exec();

      this.logger.log(`📈 Contadores del banco actualizados: ${JSON.stringify(incrementos)}`);
    }
  }
}
