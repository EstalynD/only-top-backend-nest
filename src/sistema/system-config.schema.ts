import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'system_config', timestamps: true })
export class SystemConfigEntity {
  @Prop({ type: String, required: true, unique: true, index: true })
  key!: string;

  @Prop({ type: String, required: true })
  value!: string;

  @Prop({ type: String })
  description?: string;
}

export type SystemConfigDocument = HydratedDocument<SystemConfigEntity>;
export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfigEntity);
