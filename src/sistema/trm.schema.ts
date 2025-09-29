import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

@Schema({ collection: 'trm', timestamps: true })
export class TrmEntity {
  // Fecha de vigencia del TRM (inicio del día en UTC o explícito con zona)
  @Prop({ type: Date, required: true, index: true })
  effectiveAt!: Date;

  // Valor de TRM en COP por 1 USD
  @Prop({ type: Number, required: true, min: 0 })
  copPerUsd!: number;

  // Meta opcional para auditoría (quién lo creó, comentarios, etc.)
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type TrmDocument = HydratedDocument<TrmEntity>;
export const TrmSchema = SchemaFactory.createForClass(TrmEntity);


