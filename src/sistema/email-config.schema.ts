import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'email_config', timestamps: true })
export class EmailConfigEntity {
  @Prop({ type: String, required: true, default: 'system.email' })
  key!: string;

  @Prop({ type: String, required: true, default: 'brevo-smtp' })
  provider!: string;

  @Prop({ type: String, required: true, default: 'smtp-relay.brevo.com' })
  host!: string;

  @Prop({ type: Number, required: true, default: 587 })
  port!: number;

  @Prop({ type: Boolean, required: true, default: false })
  secure!: boolean;

  @Prop({ type: String, required: true })
  authUser!: string; // SMTP login/user

  @Prop({ type: String, required: true })
  authPassEncrypted!: string; // Encrypted SMTP password/API key

  @Prop({ type: String, required: true })
  from!: string; // Verified sender email in Brevo

  @Prop({ type: String })
  fromName?: string; // Optional display name

  @Prop({ type: String })
  replyTo?: string; // Optional reply-to address

  @Prop({ type: Boolean, default: false })
  enabled!: boolean;

  @Prop({ type: Object, default: {} })
  headers?: Record<string, string>; // Additional SMTP headers

  @Prop({ type: String })
  updatedBy?: string; // User who last updated
}

export type EmailConfigDocument = HydratedDocument<EmailConfigEntity>;
export const EmailConfigSchema = SchemaFactory.createForClass(EmailConfigEntity);
