import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum GoalType {
  MODELOS_CERRADAS = 'MODELOS_CERRADAS',
  FACTURACION = 'FACTURACION',
}

export enum GoalPeriod {
  SEMANAL = 'SEMANAL',
  MENSUAL = 'MENSUAL',
  TRIMESTRAL = 'TRIMESTRAL',
  ANUAL = 'ANUAL',
  PERSONALIZADO = 'PERSONALIZADO',
}

export enum GoalStatus {
  ACTIVA = 'ACTIVA',
  COMPLETADA = 'COMPLETADA',
  CANCELADA = 'CANCELADA',
  VENCIDA = 'VENCIDA',
}

// Schema para registrar notificaciones enviadas
@Schema({ _id: false })
export class NotificationSent {
  @Prop({ type: Number, required: true })
  porcentaje!: number;

  @Prop({ type: Date, required: true })
  fechaEnvio!: Date;

  @Prop({ type: String, required: true })
  mensaje!: string;
}

export const NotificationSentSchema = SchemaFactory.createForClass(NotificationSent);

// Schema principal de meta de recruitment
@Schema({ collection: 'recruitment_goals', timestamps: true })
export class RecruitmentGoalEntity {
  // Sales Closer asignado
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  salesCloserId!: Types.ObjectId;

  // Información de la meta
  @Prop({ type: String, required: true, trim: true })
  titulo!: string;

  @Prop({ type: String, default: null })
  descripcion?: string | null;

  @Prop({ type: String, enum: Object.values(GoalType), required: true })
  tipo!: GoalType;

  // Valor objetivo (número de modelos o monto de facturación)
  @Prop({ type: Number, required: true, min: 1 })
  valorObjetivo!: number;

  // Moneda (solo aplica para FACTURACION)
  @Prop({ type: String, default: 'USD', uppercase: true })
  moneda!: string;

  // Periodo de la meta
  @Prop({ type: String, enum: Object.values(GoalPeriod), required: true })
  periodo!: GoalPeriod;

  @Prop({ type: Date, required: true, index: true })
  fechaInicio!: Date;

  @Prop({ type: Date, required: true, index: true })
  fechaFin!: Date;

  // Estado de la meta
  @Prop({ type: String, enum: Object.values(GoalStatus), default: GoalStatus.ACTIVA, index: true })
  estado!: GoalStatus;

  // Progreso actual
  @Prop({ type: Number, default: 0, min: 0 })
  valorActual!: number;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  porcentajeCompletado!: number;

  // Configuración de notificaciones
  @Prop({ type: Boolean, default: true })
  notificacionesActivas!: boolean;

  // Umbrales de notificación (ej: [25, 50, 75, 90])
  @Prop({ type: [Number], default: [25, 50, 75, 90, 100] })
  umbralNotificaciones!: number[];

  // Notificaciones enviadas
  @Prop({ type: [NotificationSentSchema], default: [] })
  notificacionesEnviadas!: NotificationSent[];

  // Correo electrónico del Sales Closer (cache para no hacer lookup cada vez)
  @Prop({ type: String, default: null })
  emailSalesCloser?: string | null;

  @Prop({ type: String, default: null })
  nombreSalesCloser?: string | null;

  // Auditoría
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  creadoPor?: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  actualizadoPor?: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type RecruitmentGoalDocument = HydratedDocument<RecruitmentGoalEntity>;
export const RecruitmentGoalSchema = SchemaFactory.createForClass(RecruitmentGoalEntity);

// Índices compuestos para optimizar queries
RecruitmentGoalSchema.index({ salesCloserId: 1, estado: 1, fechaFin: -1 });
RecruitmentGoalSchema.index({ estado: 1, fechaFin: 1 });

