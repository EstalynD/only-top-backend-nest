import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'users', timestamps: true })
export class UserEntity {
  @Prop({ required: true, unique: true, index: true })
  username!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ type: [String], default: [] })
  roles!: string[];

  @Prop({ type: [String], default: [] })
  permissions!: string[];
}

export type UserDocument = HydratedDocument<UserEntity>;
export const UserSchema = SchemaFactory.createForClass(UserEntity);
