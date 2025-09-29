import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

export interface CommissionRule {
  minUsd: number;
  maxUsd?: number; // null/undefined means "and above"
  percentage: number; // 0-100
}

@Schema({ collection: 'commission_scales', timestamps: true })
export class CommissionScaleEntity {
  @Prop({ type: String, required: true })
  name!: string; // e.g., "Default", "Premium Clients"

  @Prop({ type: Boolean, default: false })
  isActive!: boolean; // Only one can be active at a time

  @Prop({ type: Boolean, default: false })
  isDefault!: boolean; // Mark as default preset

  @Prop({ 
    type: [{ 
      minUsd: { type: Number, required: true, min: 0 },
      maxUsd: { type: Number, min: 0 },
      percentage: { type: Number, required: true, min: 0, max: 100 }
    }], 
    required: true 
  })
  rules!: CommissionRule[];

  @Prop({ type: String })
  description?: string; // Optional description of the scale

  @Prop({ type: String })
  updatedBy?: string; // User who last updated
}

export type CommissionScaleDocument = HydratedDocument<CommissionScaleEntity>;
export const CommissionScaleSchema = SchemaFactory.createForClass(CommissionScaleEntity);
