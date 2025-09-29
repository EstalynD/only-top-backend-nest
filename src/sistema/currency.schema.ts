import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'currencies', timestamps: true })
export class CurrencyEntity {
  @Prop({ type: String, required: true, unique: true, index: true })
  code!: string; // 'USD' | 'COP'

  @Prop({ type: String, required: true })
  symbol!: string; // '$'

  @Prop({ type: Number, required: true, min: 0, max: 4 })
  minimumFractionDigits!: number;

  @Prop({ type: Number, required: true, min: 0, max: 4 })
  maximumFractionDigits!: number;

  @Prop({ type: String, required: true })
  displayFormat!: string; // 'CODE_SYMBOL' | 'SYMBOL_ONLY'

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;
}

export type CurrencyDocument = HydratedDocument<CurrencyEntity>;
export const CurrencySchema = SchemaFactory.createForClass(CurrencyEntity);
