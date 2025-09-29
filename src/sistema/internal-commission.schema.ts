import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export interface PerformanceScale {
  fromPercent: number; // e.g., 0, 80, 100
  toPercent?: number; // e.g., 79.99, 99.99 (undefined means infinity)
  commissionPercent: number; // e.g., 0.5, 1, 2
}

@Schema({ collection: 'internal_commissions', timestamps: true })
export class InternalCommissionEntity {
  @Prop({ type: String, required: true, default: 'internal_commissions' })
  key!: string; // Single document key for configuration

  // Sales Closer Configuration
  @Prop({ type: Number, required: true, default: 2, min: 0, max: 100 })
  salesCloserPercent!: number;

  @Prop({ type: Number, required: true, default: 2, min: 1 })
  salesCloserMonths!: number; // Applicable months

  // Trafficker Configuration
  @Prop({ type: Number, required: true, default: 2, min: 0, max: 100 })
  traffickerPercent!: number; // On net subscriptions attributable to traffic

  // Chatters Configuration
  @Prop({ type: Number, required: true, default: 0.5, min: 0, max: 100 })
  chattersMinPercent!: number;

  @Prop({ type: Number, required: true, default: 2, min: 0, max: 100 })
  chattersMaxPercent!: number;

  // Performance Scale for Chatters
  @Prop({ 
    type: [{ 
      fromPercent: { type: Number, required: true, min: 0 },
      toPercent: { type: Number, min: 0 },
      commissionPercent: { type: Number, required: true, min: 0, max: 100 }
    }], 
    required: true,
    default: [
      { fromPercent: 0, toPercent: 79.99, commissionPercent: 0.5 },
      { fromPercent: 80, toPercent: 99.99, commissionPercent: 1 },
      { fromPercent: 100, commissionPercent: 2 }
    ]
  })
  chattersPerformanceScale!: PerformanceScale[];

  @Prop({ type: String })
  description?: string; // Optional description

  @Prop({ type: String })
  updatedBy?: string; // User who last updated
}

export type InternalCommissionDocument = HydratedDocument<InternalCommissionEntity>;
export const InternalCommissionSchema = SchemaFactory.createForClass(InternalCommissionEntity);
