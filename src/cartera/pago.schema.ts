import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Métodos de pago
export enum MetodoPago {
  TRANSFERENCIA = 'TRANSFERENCIA',
  EFECTIVO = 'EFECTIVO',
  CHEQUE = 'CHEQUE',
  TARJETA = 'TARJETA',
  OTRO = 'OTRO',
}

// Información del comprobante (Cloudinary)
@Schema({ _id: false })
export class ComprobanteInfo {
  @Prop({ type: String, required: true })
  publicId!: string; // Cloudinary public ID

  @Prop({ type: String, required: true })
  url!: string; // URL para visualizar

  @Prop({ type: String, required: true })
  downloadUrl!: string; // URL firmada para descargar

  @Prop({ type: String, required: true })
  format!: string; // jpg, png, pdf

  @Prop({ type: Number, required: true })
  size!: number; // Tamaño en bytes

  @Prop({ type: Date, default: () => new Date() })
  fechaSubida!: Date;
}

export const ComprobanteInfoSchema = SchemaFactory.createForClass(ComprobanteInfo);

// Schema principal de Pago
@Schema({ collection: 'cartera_pagos', timestamps: true })
export class PagoEntity {
  // Identificación del pago
  @Prop({ type: String, required: true, unique: true, uppercase: true, trim: true })
  numeroRecibo!: string; // REC-2025-001

  // Relación con factura
  @Prop({ type: SchemaTypes.ObjectId, ref: 'FacturaEntity', required: true, index: true })
  facturaId!: Types.ObjectId;

  // Información del pago
  @Prop({ type: Date, required: true, index: true })
  fechaPago!: Date;

  // Moneda del pago
  @Prop({ 
    type: String, 
    required: true, 
    enum: ['USD', 'COP'],
    default: 'USD',
    index: true
  })
  moneda!: 'USD' | 'COP';

  // Monto del pago (valor escalado a 5 decimales)
  @Prop({ type: SchemaTypes.BigInt, required: true })
  monto!: bigint;

  @Prop({ 
    type: String, 
    required: true, 
    enum: Object.values(MetodoPago),
    default: MetodoPago.TRANSFERENCIA
  })
  metodoPago!: MetodoPago;

  @Prop({ type: String, default: null, trim: true })
  referencia?: string | null; // Número de transacción, cheque, etc.

  // Comprobante de pago (Cloudinary)
  @Prop({ type: ComprobanteInfoSchema, default: null })
  comprobante?: ComprobanteInfo | null;

  // Información adicional
  @Prop({ type: String, default: null, trim: true })
  observaciones?: string | null;

  // Auditoría
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', required: true })
  registradoPor!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  modificadoPor?: Types.ObjectId | null;

  // Metadatos
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type PagoDocument = HydratedDocument<PagoEntity>;
export const PagoSchema = SchemaFactory.createForClass(PagoEntity);

// Índices compuestos para optimización
PagoSchema.index({ facturaId: 1, fechaPago: -1 });
PagoSchema.index({ fechaPago: -1 });
// numeroRecibo ya tiene unique: true en @Prop, no necesita índice adicional
PagoSchema.index({ metodoPago: 1, fechaPago: -1 });
PagoSchema.index({ registradoPor: 1, fechaPago: -1 });
