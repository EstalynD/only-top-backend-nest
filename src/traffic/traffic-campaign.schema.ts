import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Plataformas de pauta disponibles
export enum PlataformaCampana {
  REDDIT_ORGANICO = 'REDDIT_ORGANICO',
  REDDIT_ADS = 'REDDIT_ADS',
  INSTAGRAM = 'INSTAGRAM',
  X_TWITTER = 'X_TWITTER',
  TIKTOK = 'TIKTOK',
  APP_DATES = 'APP_DATES', // Tinder, Bumble, etc.
}

// Estados de campaña
export enum EstadoCampana {
  ACTIVA = 'ACTIVA',
  PAUSADA = 'PAUSADA',
  FINALIZADA = 'FINALIZADA',
}

// Servicios de acortamiento de URL
export enum AcortadorURL {
  BITLY = 'BITLY',
  TINYURL = 'TINYURL',
  REBRANDLY = 'REBRANDLY',
  BLINK = 'BLINK',
  SHORT_IO = 'SHORT_IO',
  LINKTREE = 'LINKTREE',
  PICKLINK = 'PICKLINK',
  BEACONS = 'BEACONS',
}

// Schema para segmentación detallada
@Schema({ _id: false })
export class Segmentacion {
  @Prop({ type: String, default: null })
  descripcion?: string | null; // Descripción general de la segmentación

  @Prop({ type: [String], default: [] })
  paises!: string[]; // Países objetivo

  @Prop({ type: [String], default: [] })
  regiones!: string[]; // Regiones/ciudades específicas

  @Prop({ 
    type: {
      min: { type: Number, min: 18 },
      max: { type: Number, max: 100 }
    },
    default: null 
  })
  edadObjetivo?: { min: number; max: number } | null; // Rango de edad

  @Prop({ type: [String], default: [] })
  intereses!: string[]; // Intereses para segmentación
}

export const SegmentacionSchema = SchemaFactory.createForClass(Segmentacion);

// Schema para presupuesto
@Schema({ _id: false })
export class PresupuestoCampana {
  @Prop({ type: Number, required: true, min: 0 })
  asignado!: number; // Presupuesto total asignado

  @Prop({ type: Number, required: true, min: 0 })
  gastado!: number; // Presupuesto efectivamente consumido

  @Prop({ type: String, required: true, uppercase: true })
  moneda!: string; // Código de moneda (USD, COP, etc.) - debe existir en sistema
}

export const PresupuestoCampanaSchema = SchemaFactory.createForClass(PresupuestoCampana);

// Schema principal para campaña de traffic
@Schema({ collection: 'traffic_campaigns', timestamps: true })
export class TrafficCampaignEntity {
  // Modelo asociada a la campaña
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', required: true, index: true })
  modeloId!: Types.ObjectId;

  // Trafficker responsable de la campaña
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  traffickerId!: Types.ObjectId;

  // Plataforma de pauta
  @Prop({ 
    type: String, 
    enum: Object.values(PlataformaCampana), 
    required: true,
    index: true 
  })
  plataforma!: PlataformaCampana;

  // Segmentación aplicada
  @Prop({ type: SegmentacionSchema, required: true })
  segmentaciones!: Segmentacion;

  // Fechas clave de la campaña
  @Prop({ type: Date, required: true, index: true })
  fechaActivacion!: Date; // Día de activación

  @Prop({ type: Date, required: true })
  fechaPublicacion!: Date; // Fecha de publicación real

  @Prop({ type: Date, default: null, index: true })
  fechaFinalizacion?: Date | null; // Fecha de finalización (puede ser null si está activa)

  // Presupuesto
  @Prop({ type: PresupuestoCampanaSchema, required: true })
  presupuesto!: PresupuestoCampana;

  // Estado de la campaña
  @Prop({ 
    type: String, 
    enum: Object.values(EstadoCampana), 
    required: true,
    default: EstadoCampana.ACTIVA,
    index: true 
  })
  estado!: EstadoCampana;

  // Copy y enlaces
  @Prop({ type: String, required: true })
  copyUtilizado!: string; // Texto publicitario principal

  @Prop({ type: String, default: null })
  linkPauta?: string | null; // URL del anuncio publicado

  @Prop({ type: String, default: null })
  trackLinkOF?: string | null; // Link de seguimiento a OnlyFans

  @Prop({ 
    type: String, 
    enum: Object.values(AcortadorURL), 
    default: null 
  })
  acortadorUtilizado?: AcortadorURL | null; // Servicio de acortamiento usado

  // Rendimiento
  @Prop({ 
    type: {
      metrica: { type: String, required: true }, // Ej: "leads", "clics", "conversiones", "ROI"
      valor: { type: Number, required: true, min: 0 },
      unidad: { type: String, default: null } // Ej: "%", "USD", "cantidad"
    },
    default: null 
  })
  rendimiento?: {
    metrica: string;
    valor: number;
    unidad?: string | null;
  } | null;

  // Notas y observaciones
  @Prop({ type: String, default: null })
  notas?: string | null;

  // Usuario que creó la campaña
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  creadoPor?: Types.ObjectId | null;

  // Metadatos adicionales
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type TrafficCampaignDocument = HydratedDocument<TrafficCampaignEntity>;
export const TrafficCampaignSchema = SchemaFactory.createForClass(TrafficCampaignEntity);

// Índices compuestos para optimización
TrafficCampaignSchema.index({ modeloId: 1, fechaActivacion: -1 });
TrafficCampaignSchema.index({ traffickerId: 1, fechaActivacion: -1 });
TrafficCampaignSchema.index({ modeloId: 1, estado: 1 });
TrafficCampaignSchema.index({ plataforma: 1, estado: 1 });
TrafficCampaignSchema.index({ estado: 1, fechaActivacion: -1 });
TrafficCampaignSchema.index({ 'segmentaciones.paises': 1 });
TrafficCampaignSchema.index({ fechaActivacion: 1, fechaFinalizacion: 1 });
