import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

/**
 * ResumenGastosMensualEntity - Resumen consolidado de gastos fijos del mes
 * 
 * Este schema almacena:
 * - Total de gastos por quincena
 * - Total de gastos del mes completo
 * - Utilidad neta final (ingresos - gastos)
 * - % de crecimiento mes a mes
 * - Desglose por categoría
 * 
 * Se calcula automáticamente al consolidar el mes.
 */
@Schema({ collection: 'resumenes_gastos_mensuales', timestamps: true })
export class ResumenGastosMensualEntity {
  // Período
  @Prop({ type: Number, required: true, min: 1, max: 12, index: true })
  mes!: number;

  @Prop({ type: Number, required: true, index: true })
  anio!: number;

  @Prop({ type: String, required: true, unique: true, index: true })
  periodoId!: string; // "YYYY-MM"

  // ========== TOTALES DE GASTOS (BigInt escalados × 100,000) ==========

  // Primera quincena (1-15)
  @Prop({ type: BigInt, required: true, default: 0n })
  totalPrimeraQuincenaUSD!: bigint;

  // Segunda quincena (16-fin)
  @Prop({ type: BigInt, required: true, default: 0n })
  totalSegundaQuincenaUSD!: bigint;

  // Total mensual
  @Prop({ type: BigInt, required: true, default: 0n })
  totalGastosMensualUSD!: bigint;

  // ========== DESGLOSE POR CATEGORÍA ==========

  @Prop({
    type: Map,
    of: SchemaTypes.Mixed,
    default: {},
  })
  desgloseCategoria!: Map<string, {
    primeraQuincena: bigint;
    segundaQuincena: bigint;
    total: bigint;
    cantidad: number; // Cantidad de gastos
  }>;

  // ========== INGRESOS DEL MES (desde FinanzasModelo) ==========

  @Prop({ type: BigInt, required: true, default: 0n })
  totalIngresosUSD!: bigint; // Suma de gananciaOnlyTopUSD de todas las modelos

  // ========== UTILIDAD NETA FINAL ==========

  // Utilidad = Ingresos - Gastos
  @Prop({ type: BigInt, required: true, default: 0n })
  utilidadNetaUSD!: bigint;

  // ========== COMPARATIVA MES A MES ==========

  // % de crecimiento respecto al mes anterior
  @Prop({ type: Number, default: null })
  porcentajeCrecimiento?: number | null; // ej: 15.5 (positivo = crecimiento, negativo = decrecimiento)

  // Utilidad del mes anterior para comparación
  @Prop({ type: BigInt, default: null })
  utilidadMesAnteriorUSD?: bigint | null;

  // ========== ESTADO ==========

  @Prop({ 
    type: String, 
    required: true, 
    enum: ['ABIERTO', 'EN_REVISION', 'CONSOLIDADO'],
    default: 'ABIERTO',
    index: true 
  })
  estado!: string;

  @Prop({ type: Date, default: null })
  fechaConsolidacion?: Date | null;

  // ========== METADATOS ==========

  @Prop({ type: Number, default: 0 })
  totalGastos!: number; // Cantidad de registros de gastos

  @Prop({ type: Number, default: 0 })
  gastosPendientes!: number;

  @Prop({ type: Number, default: 0 })
  gastosAprobados!: number;

  @Prop({ type: Number, default: 0 })
  gastosPagados!: number;

  @Prop({
    type: SchemaTypes.Mixed,
    default: {},
  })
  meta?: {
    mayorGasto?: {
      concepto: string;
      monto: bigint;
      categoria: string;
    };
    categoriaMayorGasto?: string;
    [key: string]: any;
  };
}

export type ResumenGastosMensualDocument = HydratedDocument<ResumenGastosMensualEntity>;
export const ResumenGastosMensualSchema = SchemaFactory.createForClass(ResumenGastosMensualEntity);

// Índices
ResumenGastosMensualSchema.index({ anio: -1, mes: -1 });
ResumenGastosMensualSchema.index({ estado: 1, fechaConsolidacion: -1 });
