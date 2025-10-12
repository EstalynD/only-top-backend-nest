import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Tipo de periodicidad de pago
export enum PeriodicidadPago {
  QUINCENAL = 'QUINCENAL',
  MENSUAL = 'MENSUAL',
}

// Tipo de porcentaje de comisión
export enum TipoComision {
  FIJO = 'FIJO',
  ESCALONADO = 'ESCALONADO',
}

// Estados del contrato
export enum EstadoContrato {
  BORRADOR = 'BORRADOR',
  PENDIENTE_FIRMA = 'PENDIENTE_FIRMA',
  FIRMADO = 'FIRMADO',
  RECHAZADO = 'RECHAZADO',
  CANCELADO = 'CANCELADO',
}

// Schema para comisión fija
@Schema({ _id: false })
export class ComisionFija {
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  porcentaje!: number;
}

export const ComisionFijaSchema = SchemaFactory.createForClass(ComisionFija);

// Schema para comisión escalonada (referencia a escala del sistema)
@Schema({ _id: false })
export class ComisionEscalonada {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CommissionScaleEntity', required: true })
  escalaId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  escalaNombre!: string;
}

export const ComisionEscalonadaSchema = SchemaFactory.createForClass(ComisionEscalonada);

// Schema para firma digital
@Schema({ _id: false })
export class FirmaDigital {
  @Prop({ type: Date, required: true })
  fechaFirma!: Date;

  @Prop({ type: String, required: true })
  nombreCompleto!: string;

  @Prop({ type: String, required: true })
  numeroIdentificacion!: string;

  @Prop({ type: String, required: true })
  ipAddress!: string;

  @Prop({ type: String, required: true })
  userAgent!: string;

  @Prop({ type: String, default: null })
  dispositivo?: string | null;

  @Prop({ type: Boolean, default: true })
  otpVerificado!: boolean;
}

export const FirmaDigitalSchema = SchemaFactory.createForClass(FirmaDigital);

// Schema principal del contrato
@Schema({ collection: 'rrhh_contratos_modelos', timestamps: true })
export class ContratoModeloEntity {
  // Relación con la modelo
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', required: true, index: true })
  modeloId!: Types.ObjectId;

  // Información del contrato
  @Prop({ type: String, required: true, unique: true })
  numeroContrato!: string;

  @Prop({ type: Date, required: true })
  fechaInicio!: Date;

  @Prop({ type: String, required: true, enum: Object.values(PeriodicidadPago) })
  periodicidadPago!: PeriodicidadPago;

  @Prop({ type: Date, required: true })
  fechaInicioCobro!: Date;

  // Comisión
  @Prop({ type: String, required: true, enum: Object.values(TipoComision) })
  tipoComision!: TipoComision;

  @Prop({ type: ComisionFijaSchema, default: null })
  comisionFija?: ComisionFija | null;

  @Prop({ type: ComisionEscalonadaSchema, default: null })
  comisionEscalonada?: ComisionEscalonada | null;

  // Procesador de pago
  @Prop({ type: SchemaTypes.ObjectId, ref: 'PaymentProcessorEntity', required: true })
  procesadorPagoId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  procesadorPagoNombre!: string;

  // Estado y firma
  @Prop({ type: String, required: true, enum: Object.values(EstadoContrato), default: EstadoContrato.BORRADOR, index: true })
  estado!: EstadoContrato;

  @Prop({ type: FirmaDigitalSchema, default: null })
  firma?: FirmaDigital | null;

  // Token único para firma externa
  @Prop({ type: String })
  tokenFirmaUnico?: string;

  @Prop({ type: Date, default: null })
  tokenFirmaExpiracion?: Date | null;

  // Auditoría
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  creadoPor?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  fechaEnvioPendienteFirma?: Date | null;

  @Prop({ type: Date, default: null })
  fechaFirma?: Date | null;

  @Prop({ type: String, default: null })
  notasInternas?: string | null;

  // Datos del Sales Closer que gestionó el contrato
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', default: null })
  salesCloserAsignado?: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type ContratoModeloDocument = HydratedDocument<ContratoModeloEntity>;
export const ContratoModeloSchema = SchemaFactory.createForClass(ContratoModeloEntity);

// Índices compuestos
ContratoModeloSchema.index({ modeloId: 1, estado: 1 });
ContratoModeloSchema.index({ fechaInicio: -1 });
ContratoModeloSchema.index({ estado: 1, createdAt: -1 });


