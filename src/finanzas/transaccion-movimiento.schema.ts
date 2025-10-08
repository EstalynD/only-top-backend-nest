import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

/**
 * Tipos de transacción soportados
 */
export enum TipoTransaccion {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

/**
 * Origen de la transacción (para auditoría y reportes)
 */
export enum OrigenTransaccion {
  GANANCIA_MODELO = 'GANANCIA_MODELO',           // Ingreso: ganancia OnlyTop de cálculo de modelo
  COSTO_FIJO = 'COSTO_FIJO',                     // Egreso: gasto fijo mensual registrado
  COSTO_VARIABLE = 'COSTO_VARIABLE',             // Egreso: gasto variable o puntual
  AJUSTE_MANUAL = 'AJUSTE_MANUAL',               // Ajuste administrativo (ingreso o egreso)
  CONSOLIDACION_COSTOS = 'CONSOLIDACION_COSTOS', // Egreso: consolidación mensual de costos
  RECALCULO_PERIODO = 'RECALCULO_PERIODO',       // Ajuste por recálculo de finanzas
  OTRO = 'OTRO',
}

/**
 * Estado de la transacción en el flujo de consolidación
 */
export enum EstadoTransaccion {
  EN_MOVIMIENTO = 'EN_MOVIMIENTO', // Transacción activa en periodo actual
  CONSOLIDADO = 'CONSOLIDADO',     // Transacción ya consolidada en histórico
  REVERTIDO = 'REVERTIDO',         // Transacción revertida por corrección
}

/**
 * TransaccionMovimiento - Schema para auditoría de flujo de caja
 * 
 * Cada transacción representa un movimiento de dinero en el banco de OnlyTop.
 * Este sistema permite rastrear TODO el dinero antes de consolidarlo.
 * 
 * Flujo:
 * 1. Se genera ganancia/gasto → se crea transacción EN_MOVIMIENTO
 * 2. Se actualiza dineroMovimientoUSD en bank_onlytop
 * 3. Al consolidar periodo → transacciones pasan a CONSOLIDADO
 * 4. dineroMovimientoUSD se transfiere a dineroConsolidadoUSD
 * 
 * Ventajas:
 * - Auditoría completa: cada peso tiene su registro
 * - Reportes detallados: ingresos vs egresos por tipo/origen
 * - Reversibilidad: se puede revertir/corregir transacciones
 * - Trazabilidad: de dónde viene y a dónde va cada monto
 */
@Schema({ collection: 'finanzas_transacciones_movimiento', timestamps: true })
export class TransaccionMovimientoEntity {
  // ========== IDENTIFICACIÓN ==========

  // Periodo al que pertenece (formato: "YYYY-MM")
  @Prop({ type: String, required: true, index: true })
  periodo!: string;

  @Prop({ type: Number, required: true, min: 1, max: 12, index: true })
  mes!: number;

  @Prop({ type: Number, required: true, index: true })
  anio!: number;

  // ========== TIPO Y CLASIFICACIÓN ==========

  @Prop({
    type: String,
    required: true,
    enum: Object.values(TipoTransaccion),
    index: true,
  })
  tipo!: TipoTransaccion; // INGRESO o EGRESO

  @Prop({
    type: String,
    required: true,
    enum: Object.values(OrigenTransaccion),
    index: true,
  })
  origen!: OrigenTransaccion; // De dónde viene

  // ========== MONTO (BigInt × 100,000) ==========

  /**
   * Monto de la transacción en USD (siempre positivo)
   * El signo lo determina el campo "tipo"
   */
  @Prop({ type: BigInt, required: true })
  montoUSD!: bigint;

  // ========== REFERENCIAS ==========

  /**
   * ID del documento que generó la transacción
   * Ejemplos:
   * - Para GANANCIA_MODELO: ID de FinanzasModelo
   * - Para COSTO_FIJO: ID de CostosFijosMensuales o ID de gasto específico
   * - Para AJUSTE_MANUAL: ID de documento de ajuste
   */
  @Prop({ type: String, default: null, index: true })
  referenciaId?: string | null;

  /**
   * Tipo de documento referenciado (para facilitar queries)
   */
  @Prop({ type: String, default: null })
  referenciaModelo?: string | null; // "FinanzasModelo", "CostosFijosMensuales", etc.

  /**
   * Para GANANCIA_MODELO: ID de la modelo
   */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', default: null, index: true })
  modeloId?: Types.ObjectId | null;

  // ========== DESCRIPCIÓN Y CONTEXTO ==========

  @Prop({ type: String, required: true })
  descripcion!: string; // ej: "Ganancia OnlyTop - Modelo Ana Pérez - Octubre 2025"

  @Prop({ type: String, default: null })
  notas?: string | null; // Notas adicionales

  // ========== ESTADO Y CONSOLIDACIÓN ==========

  @Prop({
    type: String,
    required: true,
    enum: Object.values(EstadoTransaccion),
    default: EstadoTransaccion.EN_MOVIMIENTO,
    index: true,
  })
  estado!: EstadoTransaccion;

  // Fecha de consolidación (cuando pasó a CONSOLIDADO)
  @Prop({ type: Date, default: null })
  fechaConsolidacion?: Date | null;

  // Usuario que consolidó
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  consolidadoPor?: Types.ObjectId | null;

  // Referencia al periodo consolidado (si aplica)
  @Prop({ type: String, default: null })
  periodoConsolidadoId?: string | null;

  // ========== AUDITORÍA ==========

  // Usuario que creó la transacción
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  creadoPor?: Types.ObjectId | null;

  // Si fue revertida, ID de la transacción que la revirtió
  @Prop({ type: SchemaTypes.ObjectId, default: null })
  revertidaPor?: Types.ObjectId | null;

  // Fecha de reversión
  @Prop({ type: Date, default: null })
  fechaReversion?: Date | null;

  // Motivo de reversión
  @Prop({ type: String, default: null })
  motivoReversion?: string | null;

  // ========== METADATOS ==========

  @Prop({
    type: SchemaTypes.Mixed,
    default: {},
  })
  meta?: {
    // Para GANANCIA_MODELO
    ventasNetas?: number;
    comisionAgencia?: number;
    comisionBanco?: number;
    porcentajeComision?: number;

    // Para COSTO_FIJO
    nombreCategoria?: string;
    conceptoGasto?: string;

    // Cualquier otro dato contextual
    [key: string]: any;
  };
}

export type TransaccionMovimientoDocument = HydratedDocument<TransaccionMovimientoEntity>;
export const TransaccionMovimientoSchema = SchemaFactory.createForClass(TransaccionMovimientoEntity);

// ========== ÍNDICES ==========

// Consultas por periodo y estado (las más comunes)
TransaccionMovimientoSchema.index({ periodo: 1, estado: 1 });
TransaccionMovimientoSchema.index({ anio: -1, mes: -1, estado: 1 });

// Por tipo de transacción (ingresos vs egresos)
TransaccionMovimientoSchema.index({ tipo: 1, estado: 1, periodo: 1 });

// Por origen (reportes especializados)
TransaccionMovimientoSchema.index({ origen: 1, estado: 1, periodo: 1 });

// Por referencia (rastrear transacciones de un documento específico)
TransaccionMovimientoSchema.index({ referenciaId: 1, referenciaModelo: 1 });

// Por modelo (ver todas las transacciones de una modelo)
TransaccionMovimientoSchema.index({ modeloId: 1, periodo: -1 });

// Para consolidación
TransaccionMovimientoSchema.index({ estado: 1, fechaConsolidacion: -1 });
TransaccionMovimientoSchema.index({ periodoConsolidadoId: 1 });

// Timestamp descendente para historial
TransaccionMovimientoSchema.index({ createdAt: -1 });
