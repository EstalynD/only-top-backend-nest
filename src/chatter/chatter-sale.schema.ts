import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Tipos de venta que puede registrar un chatter
export enum TipoVenta {
  TIP = 'TIP',
  CONTENIDO_PERSONALIZADO = 'CONTENIDO_PERSONALIZADO',
  SUSCRIPCION = 'SUSCRIPCION',
  PPV = 'PPV', // Pay Per View
  SEXTING = 'SEXTING',
  VIDEO_CALL = 'VIDEO_CALL',
  AUDIO_CALL = 'AUDIO_CALL',
  MENSAJE_MASIVO = 'MENSAJE_MASIVO',
  OTRO = 'OTRO',
}

// Turnos de trabajo de los chatters
export enum TurnoChatter {
  AM = 'AM',
  PM = 'PM',
  MADRUGADA = 'MADRUGADA',
  SUPERNUMERARIO = 'SUPERNUMERARIO',
}

// Schema principal para registro de ventas de chatters
@Schema({ collection: 'chatter_sales', timestamps: true })
export class ChatterSaleEntity {
  // Modelo atendida
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', required: true, index: true })
  modeloId!: Types.ObjectId;

  // Chatter responsable de la venta
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  chatterId!: Types.ObjectId;

  // Información de la venta
  @Prop({ type: Number, required: true, min: 0 })
  monto!: number; // En USD

  @Prop({ type: String, default: 'USD', uppercase: true })
  moneda!: string;

  @Prop({ type: String, required: true, enum: Object.values(TipoVenta), index: true })
  tipoVenta!: TipoVenta;

  @Prop({ type: String, required: true, enum: Object.values(TurnoChatter), index: true })
  turno!: TurnoChatter;

  // Fecha y hora de la venta
  @Prop({ type: Date, required: true, index: true })
  fechaVenta!: Date;

  // Información adicional
  @Prop({ type: String, default: null })
  descripcion?: string | null;

  @Prop({ type: String, default: null })
  notasInternas?: string | null;

  // Usuario que registró la venta (para auditoría)
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  registradoPor?: Types.ObjectId | null;

  // Plataforma donde se realizó la venta
  @Prop({ type: String, default: null })
  plataforma?: string | null; // OnlyFans, Fansly, etc.

  // Metadatos adicionales
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type ChatterSaleDocument = HydratedDocument<ChatterSaleEntity>;
export const ChatterSaleSchema = SchemaFactory.createForClass(ChatterSaleEntity);

// Índices compuestos para optimización de consultas
ChatterSaleSchema.index({ modeloId: 1, fechaVenta: -1 });
ChatterSaleSchema.index({ chatterId: 1, fechaVenta: -1 });
ChatterSaleSchema.index({ modeloId: 1, chatterId: 1, fechaVenta: -1 });
ChatterSaleSchema.index({ tipoVenta: 1, fechaVenta: -1 });
ChatterSaleSchema.index({ turno: 1, fechaVenta: -1 });
ChatterSaleSchema.index({ fechaVenta: -1 });

