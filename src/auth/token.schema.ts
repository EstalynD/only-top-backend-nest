import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'tokens', timestamps: false })
export class TokenEntity {
  @Prop({ required: true, index: true, unique: true })
  token!: string;

  @Prop({ type: Object, required: true })
  user!: { id: string; username: string; roles: string[]; permissions: string[] };

  @Prop({ required: true })
  issuedAt!: number; // seconds

  @Prop({ required: true, index: true })
  expiresAt!: number; // seconds

  @Prop({ required: true, default: false })
  revoked!: boolean;
}

export type TokenDocument = HydratedDocument<TokenEntity>;
export const TokenSchema = SchemaFactory.createForClass(TokenEntity);
