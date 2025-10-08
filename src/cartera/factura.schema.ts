import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Estados de factura
export enum EstadoFactura {
  PENDIENTE = 'PENDIENTE',
  PARCIAL = 'PARCIAL',
  PAGADO = 'PAGADO',
  VENCIDO = 'VENCIDO',
  CANCELADO = 'CANCELADO',
}

// Periodo de facturación
@Schema({ _id: false })
export class PeriodoFacturacion {
  @Prop({ type: Number, required: true, min: 2020, max: 2100 })
  anio!: number;

  @Prop({ type: Number, required: true, min: 1, max: 12 })
  mes!: number;

  @Prop({ type: Number, enum: [1, 2], default: null })
  quincena?: number | null;
}

export const PeriodoFacturacionSchema = SchemaFactory.createForClass(PeriodoFacturacion);

// Item de factura
@Schema({ _id: false })
export class ItemFactura {
  @Prop({ type: String, required: true, trim: true })
  concepto!: string;

  @Prop({ type: Number, required: true, min: 0, default: 1 })
  cantidad!: number;

  @Prop({ type: SchemaTypes.BigInt, required: true })
  valorUnitario!: bigint; // Valor escalado a 5 decimales

  @Prop({ type: SchemaTypes.BigInt, required: true })
  subtotal!: bigint; // Valor escalado a 5 decimales

  @Prop({ type: String, default: null })
  notas?: string | null;
}

export const ItemFacturaSchema = SchemaFactory.createForClass(ItemFactura);

// Schema principal de Factura
@Schema({ collection: 'cartera_facturas', timestamps: true })
export class FacturaEntity {
  // Identificación de factura
  @Prop({ type: String, required: true, unique: true, uppercase: true, trim: true })
  numeroFactura!: string; // FACT-2025-001

  // Relaciones
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', required: true, index: true })
  modeloId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'ContratoModeloEntity', required: true, index: true })
  contratoId!: Types.ObjectId;

  // Periodo de facturación
  @Prop({ type: PeriodoFacturacionSchema, required: true })
  periodo!: PeriodoFacturacion;

  // Fechas
  @Prop({ type: Date, required: true, index: true })
  fechaEmision!: Date;

  @Prop({ type: Date, required: true, index: true })
  fechaVencimiento!: Date;

  // Estado
  @Prop({ 
    type: String, 
    required: true, 
    enum: Object.values(EstadoFactura), 
    default: EstadoFactura.PENDIENTE,
    index: true
  })
  estado!: EstadoFactura;

  // Moneda de la factura
  @Prop({ 
    type: String, 
    required: true, 
    enum: ['USD', 'COP'],
    default: 'USD',
    index: true
  })
  moneda!: 'USD' | 'COP';

  // Items de factura
  @Prop({ type: [ItemFacturaSchema], required: true, validate: (v: any[]) => Array.isArray(v) && v.length > 0 })
  items!: ItemFactura[];

  // Totales (valores escalados a 5 decimales)
  @Prop({ type: SchemaTypes.BigInt, required: true })
  subtotal!: bigint;

  @Prop({ type: SchemaTypes.BigInt, default: 0n })
  descuento!: bigint;

  @Prop({ type: SchemaTypes.BigInt, required: true })
  total!: bigint;

  // Pagos relacionados
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'PagoEntity' }], default: [] })
  pagos!: Types.ObjectId[];

  // Saldo pendiente (valor escalado a 5 decimales)
  @Prop({ type: SchemaTypes.BigInt, required: true })
  saldoPendiente!: bigint;

  // Notas adicionales
  @Prop({ type: String, default: null, trim: true })
  notas?: string | null;

  // Auditoría
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', required: true })
  creadaPor!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  modificadaPor?: Types.ObjectId | null;

  // Metadatos
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type FacturaDocument = HydratedDocument<FacturaEntity>;
export const FacturaSchema = SchemaFactory.createForClass(FacturaEntity);

// Índices compuestos para optimización
FacturaSchema.index({ modeloId: 1, estado: 1 });
FacturaSchema.index({ contratoId: 1, estado: 1 });
FacturaSchema.index({ 'periodo.anio': 1, 'periodo.mes': 1 });
FacturaSchema.index({ fechaVencimiento: 1, estado: 1 });
FacturaSchema.index({ estado: 1, fechaEmision: -1 });
// numeroFactura ya tiene unique: true en @Prop, no necesita índice adicional

// Middleware para actualizar saldoPendiente antes de guardar
FacturaSchema.pre('save', function (next) {
  // El saldo se calcula en el servicio al registrar pagos
  // Este middleware solo valida que exista
  if (this.saldoPendiente === undefined || this.saldoPendiente === null) {
    this.saldoPendiente = this.total;
  }
  next();
});
