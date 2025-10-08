import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

/**
 * PeriodoConsolidado - Schema para cierres oficiales de periodos financieros
 * 
 * Este schema representa el cierre oficial de un mes contable.
 * Una vez consolidado, los datos de este periodo quedan "congelados" y se transfieren
 * del dinero en movimiento al consolidado en bank_onlytop.
 * 
 * Relación:
 * - Un PeriodoConsolidado contiene múltiples FinanzasModelo
 * - Cada FinanzasModelo tiene referencia a su periodoId
 */

@Schema({ collection: 'finanzas_periodos_consolidados', timestamps: true })
export class PeriodoConsolidadoEntity {
  // Identificador del periodo (formato: "YYYY-MM")
  @Prop({ type: String, required: true, unique: true })
  periodo!: string; // ej: "2025-10"

  // Mes y año separados para queries
  @Prop({ type: Number, required: true, min: 1, max: 12 })
  mes!: number;

  @Prop({ type: Number, required: true })
  anio!: number;

  // ========== TOTALES CONSOLIDADOS (BigInt × 100,000) ==========

  // Suma total de ventas netas de todas las modelos del periodo
  @Prop({ type: BigInt, required: true, default: 0n })
  totalVentasNetasUSD!: bigint;

  // Suma total de comisiones de agencia (ganancias brutas OnlyTop)
  @Prop({ type: BigInt, required: true, default: 0n })
  totalComisionAgenciaUSD!: bigint;

  // Suma total de comisiones bancarias
  @Prop({ type: BigInt, required: true, default: 0n })
  totalComisionBancoUSD!: bigint;

  // Suma total de ganancias de modelos
  @Prop({ type: BigInt, required: true, default: 0n })
  totalGananciaModelosUSD!: bigint;

  // Suma total de ganancias netas de OnlyTop (después de comisión banco)
  @Prop({ type: BigInt, required: true, default: 0n })
  totalGananciaOnlyTopUSD!: bigint;

  // ========== CONTADORES Y ESTADÍSTICAS ==========

  // Cantidad total de modelos con finanzas en este periodo
  @Prop({ type: Number, required: true, default: 0 })
  cantidadModelos!: number;

  // Cantidad total de ventas registradas
  @Prop({ type: Number, required: true, default: 0 })
  cantidadVentas!: number;

  // Promedio de ventas por modelo
  @Prop({ type: Number, default: 0 })
  promedioVentasPorModelo!: number;

  // Promedio del porcentaje de comisión bancaria usado en el periodo
  @Prop({ type: Number, default: 2, min: 0, max: 100 })
  porcentajeComisionBancoPromedio!: number;

  // ========== ESTADO DE CONSOLIDACIÓN ==========

  @Prop({
    type: String,
    required: true,
    enum: ['ABIERTO', 'EN_REVISION', 'CONSOLIDADO', 'CERRADO'],
    default: 'ABIERTO',
    index: true,
  })
  estado!: string;

  // Fecha en que se consolidó oficialmente el periodo
  @Prop({ type: Date, default: null })
  fechaConsolidacion?: Date | null;

  // Usuario que realizó la consolidación
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  consolidadoPor?: Types.ObjectId | null;

  // ========== METADATOS ==========

  // Notas sobre el cierre del periodo
  @Prop({ type: String, default: null })
  notasCierre?: string | null;

  // Desglose detallado (top modelos, distribución por tipo venta, etc.)
  @Prop({
    type: SchemaTypes.Mixed,
    default: {},
  })
  meta?: {
    topModelos?: Array<{
      modeloId: string;
      nombreCompleto: string;
      ventasNetas: number;
      gananciaOT: number;
    }>;
    desglosePorEstado?: Record<string, number>;
    desglosePorTipoVenta?: Record<string, any>;
    [key: string]: any;
  };

  // ========== REFERENCIAS A DOCUMENTOS RELACIONADOS ==========

  // IDs de todos los documentos de finanzas_modelos incluidos en este periodo
  @Prop({ type: [SchemaTypes.ObjectId], ref: 'FinanzasModeloEntity', default: [] })
  finanzasIds!: Types.ObjectId[];
}

export type PeriodoConsolidadoDocument = HydratedDocument<PeriodoConsolidadoEntity>;
export const PeriodoConsolidadoSchema = SchemaFactory.createForClass(PeriodoConsolidadoEntity);

// Índices compuestos
PeriodoConsolidadoSchema.index({ anio: -1, mes: -1 });
PeriodoConsolidadoSchema.index({ estado: 1, fechaConsolidacion: -1 });
// periodo ya tiene unique: true en @Prop, no necesita índice adicional
