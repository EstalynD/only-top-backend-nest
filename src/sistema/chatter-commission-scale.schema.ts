import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

// Regla de comisión basada en porcentaje de cumplimiento de meta
export interface ChatterCommissionRule {
  minPercent: number; // % mínimo de cumplimiento (ej: 60)
  maxPercent: number; // % máximo de cumplimiento (ej: 69)
  commissionPercent: number; // % de comisión a aplicar (0-100)
}

// Configuración global de comisiones de chatters
@Schema({ collection: 'chatter_commission_scales', timestamps: true })
export class ChatterCommissionScaleEntity {
  @Prop({ type: String, required: true })
  name!: string; // e.g., "Escala Chatters 2025"

  @Prop({ type: Boolean, default: false })
  isActive!: boolean; // Solo una puede estar activa

  @Prop({ type: Boolean, default: false })
  isDefault!: boolean;

  // Comisión fija para supernumerarios (en porcentaje, ej: 1)
  @Prop({ type: Number, required: true, min: 0, max: 100 })
  supernumerarioPercent!: number;

  // Escalas para chatters principales (AM, PM, Madrugada)
  // Basadas en cumplimiento de meta del grupo
  @Prop({ 
    type: [{ 
      minPercent: { type: Number, required: true, min: 0, max: 100 },
      maxPercent: { type: Number, required: true, min: 0, max: 100 },
      commissionPercent: { type: Number, required: true, min: 0, max: 100 }
    }], 
    required: true 
  })
  performanceRules!: ChatterCommissionRule[];

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  updatedBy?: string;
}

export type ChatterCommissionScaleDocument = HydratedDocument<ChatterCommissionScaleEntity>;
export const ChatterCommissionScaleSchema = SchemaFactory.createForClass(ChatterCommissionScaleEntity);

