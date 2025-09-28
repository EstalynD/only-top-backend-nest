import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'roles', timestamps: true })
export class RoleEntity {
  @Prop({ required: true, unique: true, index: true })
  key!: string; // ej: ADMIN_GLOBAL

  @Prop({ required: true })
  name!: string; // ej: Administrador Global

  @Prop({ type: [String], default: [] })
  permissions!: string[]; // keys de permisos

  @Prop({ type: Object, default: {} })
  meta?: Record<string, any>;
}

export type RoleDocument = HydratedDocument<RoleEntity>;
export const RoleSchema = SchemaFactory.createForClass(RoleEntity);
