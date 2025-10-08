import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum GoalStatus {
  ACTIVA = 'ACTIVA',
  COMPLETADA = 'COMPLETADA',
  VENCIDA = 'VENCIDA',
  CANCELADA = 'CANCELADA',
}

export enum NotificationLevel {
  PERCENT_25 = 25,
  PERCENT_50 = 50,
  PERCENT_75 = 75,
  PERCENT_90 = 90,
  PERCENT_100 = 100,
}

// Registro de notificaciones enviadas
@Schema({ _id: false })
export class GoalNotificationRecord {
  @Prop({ type: Number, required: true })
  percentage!: number;

  @Prop({ type: Date, required: true })
  sentAt!: Date;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: [String], default: [] })
  recipients!: string[]; // emails
}

// Schema principal para metas de grupos de chatters
@Schema({ collection: 'chatter_goals', timestamps: true })
export class ChatterGoalEntity {
  // Grupo (Modelo) al que pertenece la meta
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', required: true, index: true })
  modeloId!: Types.ObjectId;

  // Meta en USD
  @Prop({ type: Number, required: true, min: 0 })
  montoObjetivo!: number;

  @Prop({ type: String, default: 'USD', uppercase: true })
  moneda!: string;

  // Periodo de la meta
  @Prop({ type: Date, required: true, index: true })
  fechaInicio!: Date;

  @Prop({ type: Date, required: true, index: true })
  fechaFin!: Date;

  // Estado de la meta
  @Prop({ 
    type: String, 
    enum: Object.values(GoalStatus), 
    default: GoalStatus.ACTIVA,
    index: true 
  })
  estado!: GoalStatus;

  // Tracking de progreso (se actualiza periódicamente)
  @Prop({ type: Number, default: 0 })
  montoActual!: number;

  @Prop({ type: Number, default: 0 })
  porcentajeCumplimiento!: number;

  @Prop({ type: Date, default: null })
  ultimaActualizacion?: Date | null;

  // Configuración de notificaciones
  @Prop({ type: [Number], default: [25, 50, 75, 90, 100] })
  nivelesNotificacion!: number[];

  @Prop({ type: Boolean, default: true })
  notificacionesActivas!: boolean;

  // Historial de notificaciones enviadas
  @Prop({ type: [GoalNotificationRecord], default: [] })
  notificacionesEnviadas!: GoalNotificationRecord[];

  // Información adicional
  @Prop({ type: String, default: null })
  descripcion?: string | null;

  @Prop({ type: String, default: null })
  notas?: string | null;

  // Usuario que creó la meta
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  creadoPor?: Types.ObjectId | null;

  // Resultados finales (se llenan al cerrar la meta)
  @Prop({ type: Number, default: null })
  montoFinal?: number | null;

  @Prop({ type: Number, default: null })
  porcentajeFinal?: number | null;

  @Prop({ type: Date, default: null })
  fechaCierre?: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  cerradoPor?: Types.ObjectId | null;

  // Metadatos
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type ChatterGoalDocument = HydratedDocument<ChatterGoalEntity>;
export const ChatterGoalSchema = SchemaFactory.createForClass(ChatterGoalEntity);

// Índices compuestos
ChatterGoalSchema.index({ modeloId: 1, fechaInicio: -1 });
ChatterGoalSchema.index({ modeloId: 1, estado: 1 });
ChatterGoalSchema.index({ estado: 1, fechaFin: 1 });
ChatterGoalSchema.index({ fechaInicio: 1, fechaFin: 1 });

