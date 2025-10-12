import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Schema para categorías de dotación
@Schema({ collection: 'rrhh_endowment_categories', timestamps: true })
export class EndowmentCategoryEntity {
  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true })
  description!: string;

  @Prop({ type: String, default: null, trim: true })
  icon?: string | null;

  @Prop({ type: String, default: null, trim: true })
  color?: string | null;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type EndowmentCategoryDocument = HydratedDocument<EndowmentCategoryEntity>;
export const EndowmentCategorySchema = SchemaFactory.createForClass(EndowmentCategoryEntity);

// Schema para elementos de dotación
@Schema({ collection: 'rrhh_endowment_items', timestamps: true })
export class EndowmentItemEntity {
  @Prop({ type: String, required: true, trim: true, index: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true })
  description!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'EndowmentCategoryEntity', required: true, index: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: String, default: null, trim: true })
  brand?: string | null;

  @Prop({ type: String, default: null, trim: true })
  model?: string | null;

  @Prop({ type: String, default: null, trim: true })
  serialNumber?: string | null;

  @Prop({ 
    type: {
      monto: { type: Number, required: true, min: 0 },
      moneda: { type: String, required: true, default: 'COP', uppercase: true }
    },
    default: null
  })
  estimatedValue?: {
    monto: number;
    moneda: string;
  } | null;

  @Prop({ type: String, default: null, trim: true })
  condition?: string | null; // NUEVO, USADO, DAÑADO, etc.

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type EndowmentItemDocument = HydratedDocument<EndowmentItemEntity>;
export const EndowmentItemSchema = SchemaFactory.createForClass(EndowmentItemEntity);

// Schema para el seguimiento de dotación
@Schema({ collection: 'rrhh_endowment_tracking', timestamps: true })
export class EndowmentTrackingEntity {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  empleadoId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'EndowmentItemEntity', required: true, index: true })
  itemId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'EndowmentCategoryEntity', required: true, index: true })
  categoryId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['ENTREGA', 'DEVOLUCION', 'MANTENIMIENTO', 'REPARACION', 'REEMPLAZO'], index: true })
  action!: string;

  @Prop({ type: Date, required: true, index: true })
  actionDate!: Date;

  @Prop({ type: String, default: null, trim: true })
  observations?: string | null;

  @Prop({ type: String, default: null, trim: true })
  condition?: string | null; // Estado del elemento al momento de la acción

  @Prop({ type: String, default: null, trim: true })
  location?: string | null; // Ubicación donde se realizó la acción

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null, index: true })
  processedBy?: Types.ObjectId | null; // Usuario que procesó la acción

  @Prop({ type: String, default: null, trim: true })
  referenceNumber?: string | null; // Número de referencia interno

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type EndowmentTrackingDocument = HydratedDocument<EndowmentTrackingEntity>;
export const EndowmentTrackingSchema = SchemaFactory.createForClass(EndowmentTrackingEntity);

// Índices compuestos para optimización
EndowmentCategorySchema.index({ name: 1, isActive: 1 });
EndowmentItemSchema.index({ categoryId: 1, isActive: 1 });
EndowmentItemSchema.index({ name: 1, categoryId: 1 });
EndowmentTrackingSchema.index({ empleadoId: 1, actionDate: -1 });
EndowmentTrackingSchema.index({ itemId: 1, actionDate: -1 });
EndowmentTrackingSchema.index({ categoryId: 1, actionDate: -1 });
EndowmentTrackingSchema.index({ action: 1, actionDate: -1 });
