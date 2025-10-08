import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types, Schema as MongooseSchema } from 'mongoose';

/**
 * FinanzasModelo - Schema para cálculos financieros mensuales por modelo
 * 
 * Este schema almacena:
 * - Ventas netas del mes (desde ChatterSales)
 * - Porcentaje de comisión de la agencia (desde Contrato)
 * - Comisión bancaria
 * - Ganancia de la modelo
 * - Ganancia de OnlyTop
 * 
 * Todos los montos se almacenan como BigInt escalados por 100,000 (5 decimales)
 * usando el patrón de MoneyService.
 */

@Schema({ collection: 'finanzas_modelos', timestamps: true })
export class FinanzasModeloEntity {
  // Referencia a la modelo
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', required: true, index: true })
  modeloId!: Types.ObjectId;

  // Período de cálculo
  @Prop({ type: Number, required: true, min: 1, max: 12, index: true })
  mes!: number; // 1-12

  @Prop({ type: Number, required: true, index: true })
  anio!: number;

  // Periodo consolidado al que pertenece (formato: "YYYY-MM")
  @Prop({ type: String, default: null, index: true })
  periodoId?: string | null; // ej: "2025-10"

  // ========== MONTOS (BigInt escalados × 100,000) ==========

  // Ventas netas totales del mes (suma de todas las ventas en ChatterSales)
  @Prop({
    type: BigInt,
    required: true,
    default: 0n,
  })
  ventasNetasUSD!: bigint;

  // Porcentaje de comisión de la agencia (ej: 20 = 20%)
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  porcentajeComisionAgencia!: number;

  // Monto de comisión de la agencia (ventasNetas × porcentajeComision / 100)
  @Prop({
    type: BigInt,
    required: true,
    default: 0n,
  })
  comisionAgenciaUSD!: bigint;

  // Porcentaje de comisión bancaria (configurable, default: 2%)
  @Prop({ type: Number, required: true, min: 0, max: 100, default: 2 })
  porcentajeComisionBanco!: number;

  // Monto de comisión bancaria (comisionAgencia × porcentajeBanco / 100)
  // IMPORTANTE: La comisión bancaria SOLO se aplica a la comisión de agencia (Ganancia OT)
  @Prop({
    type: BigInt,
    required: true,
    default: 0n,
  })
  comisionBancoUSD!: bigint;

  // Ganancia neta de la modelo (ventasNetas - comisionAgencia)
  // NO se ve afectada por la comisión bancaria
  @Prop({
    type: BigInt,
    required: true,
    default: 0n,
  })
  gananciaModeloUSD!: bigint;

  // Ganancia de OnlyTop (comisionAgencia - comisionBanco)
  // Esta es la ganancia que alimenta el bank_onlytop
  @Prop({
    type: BigInt,
    required: true,
    default: 0n,
  })
  gananciaOnlyTopUSD!: bigint;

  // ========== INFORMACIÓN ADICIONAL ==========

  // Cantidad de ventas registradas en el mes
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  cantidadVentas!: number;

  // Contrato asociado (para rastrear el % de comisión)
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ContratoModeloEntity', default: null })
  contratoId?: Types.ObjectId | null;

  // Estado del cálculo
  @Prop({
    type: String,
    required: true,
    enum: ['CALCULADO', 'PENDIENTE_REVISION', 'APROBADO', 'PAGADO'],
    default: 'CALCULADO',
    index: true,
  })
  estado!: string;

  // Fecha de última actualización del cálculo
  @Prop({ type: Date, default: null })
  fechaUltimoCalculo?: Date | null;

  // Usuario que realizó el último cálculo
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  calculadoPor?: Types.ObjectId | null;

  // Notas internas
  @Prop({ type: String, default: null })
  notasInternas?: string | null;

  // Metadatos adicionales (para desglose detallado si es necesario)
  @Prop({
    type: SchemaTypes.Mixed,
    default: {},
  })
  meta?: {
    desglosePorTipoVenta?: Record<string, any>;
    desglosePorChatter?: Record<string, any>;
    promedioVentaDiaria?: number;
    diasActivos?: number;
    [key: string]: any;
  };
}

export type FinanzasModeloDocument = HydratedDocument<FinanzasModeloEntity>;
export const FinanzasModeloSchema = SchemaFactory.createForClass(FinanzasModeloEntity);

// Índices compuestos para optimización
FinanzasModeloSchema.index({ modeloId: 1, anio: -1, mes: -1 });
FinanzasModeloSchema.index({ anio: -1, mes: -1, estado: 1 });
FinanzasModeloSchema.index({ estado: 1, fechaUltimoCalculo: -1 });

// Índice único: una modelo solo puede tener un registro por mes/año
FinanzasModeloSchema.index(
  { modeloId: 1, mes: 1, anio: 1 },
  { unique: true }
);
