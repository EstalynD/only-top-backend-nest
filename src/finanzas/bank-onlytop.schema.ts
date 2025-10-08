import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * BankOnlyTop - Schema para el balance general de la empresa
 * 
 * Este documento es ÚNICO y global. Representa la caja fuerte de OnlyTop.
 * Contiene dos tipos de dinero:
 * 
 * 1. CONSOLIDADO: Dinero de periodos cerrados oficialmente (histórico inmutable)
 * 2. MOVIMIENTO: Dinero del periodo actual en curso (se actualiza en tiempo real)
 * 
 * Flujo:
 * - Al calcular finanzas → actualiza "movimiento"
 * - Al consolidar periodo → transfiere "movimiento" a "consolidado" y resetea "movimiento"
 * 
 * ID fijo: "onlytop_bank" (solo existe un documento)
 */

@Schema({ collection: 'bank_onlytop', timestamps: true })
export class BankOnlyTopEntity {
  // ID fijo para el documento único
  @Prop({ type: String, required: true, default: 'onlytop_bank' })
  _id!: string;

  // Nombre de la empresa (informativo)
  @Prop({ type: String, required: true, default: 'OnlyTop' })
  empresa!: string;

  // ========== DINERO (BigInt × 100,000) ==========

  /**
   * CONSOLIDADO: Suma de todas las ganancias de periodos cerrados oficialmente
   * Este valor solo aumenta cuando se consolida un periodo.
   * Es el "capital histórico" de la empresa.
   */
  @Prop({ type: BigInt, required: true, default: 0n })
  dineroConsolidadoUSD!: bigint;

  /**
   * MOVIMIENTO: Suma de ganancias del periodo actual en curso
   * Este valor se actualiza cada vez que se calculan finanzas de modelos.
   * Al consolidar el periodo, se transfiere a "consolidado" y este se resetea a 0.
   */
  @Prop({ type: BigInt, required: true, default: 0n })
  dineroMovimientoUSD!: bigint;

  /**
   * SIMULACIÓN AFECTO GASTOS FIJOS: Proyección del impacto de gastos pendientes
   * 
   * Este campo muestra cuánto dinero se verá afectado cuando se consoliden
   * los gastos fijos (principalmente nómina).
   * 
   * Flujo:
   * 1. Al generar nómina → se SUMA el monto total aquí (simulación)
   * 2. Al consolidar gastos fijos → se transfiere a dineroMovimientoUSD (real)
   * 3. Se resetea a 0 tras consolidación
   * 
   * Esto permite ver la proyección del saldo sin afectar el dinero real hasta
   * que se confirme oficialmente el pago de gastos.
   */
  @Prop({ type: BigInt, required: true, default: 0n })
  simulacionAfectoGastosFijosUSD!: bigint;

  // ========== PERIODO ACTUAL ==========

  // Periodo actual en formato "YYYY-MM" (ej: "2025-10")
  @Prop({ type: String, required: true })
  periodoActual!: string;

  // Fecha de la última consolidación realizada
  @Prop({ type: Date, default: null })
  ultimaConsolidacion?: Date | null;

  // ========== ESTADÍSTICAS GLOBALES ==========

  // Total de periodos consolidados en la historia
  @Prop({ type: Number, default: 0 })
  totalPeriodosConsolidados!: number;

  // Total de modelos atendidas en toda la historia
  @Prop({ type: Number, default: 0 })
  totalModelosHistorico!: number;

  // Total de ventas procesadas en toda la historia
  @Prop({ type: Number, default: 0 })
  totalVentasHistorico!: number;

  // ========== METADATOS ==========

  @Prop({
    type: Object,
    default: {},
  })
  meta?: {
    mejorMes?: {
      periodo: string;
      ganancia: number;
    };
    promedioMensual?: number;
    tendencia?: 'CRECIENTE' | 'ESTABLE' | 'DECRECIENTE';
    [key: string]: any;
  };
}

export type BankOnlyTopDocument = HydratedDocument<BankOnlyTopEntity>;
export const BankOnlyTopSchema = SchemaFactory.createForClass(BankOnlyTopEntity);

// No necesita índices adicionales porque solo hay un documento
// El _id ya está indexado por defecto
