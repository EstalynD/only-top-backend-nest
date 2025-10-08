import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

/**
 * GastoFijo - Schema embebido para cada gasto dentro de una categoría
 * 
 * Representa un gasto específico con su concepto y monto.
 * Todos los montos se almacenan como BigInt escalados × 100,000 (5 decimales).
 */
export class GastoFijo {
  @Prop({ type: String, required: true })
  categoriaId!: string; // ID de la categoría global

  @Prop({ type: String, required: true })
  concepto!: string; // ej: "Alquiler de oficina"

  @Prop({ type: BigInt, required: true })
  montoUSD!: bigint; // Monto escalado × 100,000

  @Prop({ type: Date, required: true, default: () => new Date() })
  fechaRegistro!: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  registradoPor?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  notas?: string | null;
}

/**
 * CostosFijosMensuales - Schema principal para gestión de costos fijos
 * 
 * Documento único por mes/año que agrupa todas las categorías de gastos.
 * Similar a FinanzasModelo, pero para gastos operativos de la empresa.
 * 
 * Flujo de vida:
 * 1. ABIERTO: Se puede editar, agregar/eliminar gastos y categorías
 * 2. CONSOLIDADO: Cerrado oficialmente, se integra con periodo consolidado
 * 
 * Integración:
 * - Al consolidar, se resta del dinero en bank_onlytop
 * - Se vincula con finanzas_periodos_consolidados
 */
@Schema({ collection: 'finanzas_costos_fijos', timestamps: true })
export class CostosFijosMensualesEntity {
  // ========== PERIODO ==========

  @Prop({ type: Number, required: true, min: 1, max: 12, index: true })
  mes!: number; // 1-12

  @Prop({ type: Number, required: true, index: true })
  anio!: number; // ej: 2025

  // Identificador del periodo (formato: "YYYY-MM")
  @Prop({ type: String, required: true, index: true })
  periodo!: string; // ej: "2025-10"

  // ========== ESTADO ==========

  @Prop({
    type: String,
    required: true,
    enum: ['ABIERTO', 'CONSOLIDADO'],
    default: 'ABIERTO',
    index: true,
  })
  estado!: string;

  // ========== GASTOS ==========

  @Prop({ type: [GastoFijo], default: [] })
  gastos!: GastoFijo[];

  // ========== TOTALES (BigInt × 100,000) ==========

  // Total general de todos los gastos del mes
  @Prop({ type: BigInt, required: true, default: 0n })
  totalGastosUSD!: bigint;

  // ========== CONSOLIDACIÓN ==========

  @Prop({ type: Boolean, required: true, default: false })
  consolidado!: boolean;

  @Prop({ type: Date, default: null })
  fechaConsolidacion?: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  consolidadoPor?: Types.ObjectId | null;

  // Referencia al periodo consolidado (si aplica)
  @Prop({ type: String, default: null })
  periodoConsolidadoId?: string | null;

  // ========== METADATOS ==========

  @Prop({ type: Date, default: null })
  fechaUltimaActualizacion?: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  actualizadoPor?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  notasInternas?: string | null;

  @Prop({
    type: SchemaTypes.Mixed,
    default: {},
  })
  meta?: {
    categoriaMayorGasto?: string;
    categoriaConMasGastos?: string;
    promedioGastoPorDia?: number;
    [key: string]: any;
  };
}

export type CostosFijosMensualesDocument = HydratedDocument<CostosFijosMensualesEntity>;
export const CostosFijosMensualesSchema = SchemaFactory.createForClass(CostosFijosMensualesEntity);

// Índices compuestos para optimización
CostosFijosMensualesSchema.index({ anio: -1, mes: -1 });
CostosFijosMensualesSchema.index({ estado: 1, fechaUltimaActualizacion: -1 });
CostosFijosMensualesSchema.index({ consolidado: 1, fechaConsolidacion: -1 });

// Índice único: solo un documento por mes/año
CostosFijosMensualesSchema.index(
  { mes: 1, anio: 1 },
  { unique: true }
);
