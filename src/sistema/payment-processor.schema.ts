import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CommissionType = 'PERCENTAGE' | 'FIXED_USD' | 'FIXED_COP';

@Schema({ collection: 'payment_processors', timestamps: true })
export class PaymentProcessorEntity {
  @Prop({ type: String, required: true })
  name!: string; // e.g., "PayPal", "Stripe", "Bancolombia"

  @Prop({ type: String, enum: ['PERCENTAGE', 'FIXED_USD', 'FIXED_COP'], required: true })
  commissionType!: CommissionType;

  @Prop({ type: Number, required: true, min: 0 })
  commissionValue!: number; // Percentage (0-100) or fixed amount

  @Prop({ type: Date, required: true })
  effectiveDate!: Date; // When this commission rate becomes effective

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: String })
  description?: string; // Optional notes about the processor

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>; // Additional processor-specific data

  @Prop({ type: String })
  updatedBy?: string; // User who last updated
}

export type PaymentProcessorDocument = HydratedDocument<PaymentProcessorEntity>;
export const PaymentProcessorSchema = SchemaFactory.createForClass(PaymentProcessorEntity);
