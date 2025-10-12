import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ collection: 'rrhh_birthday_templates', timestamps: true })
export class BirthdayTemplateEntity {
  @Prop({ type: String, required: true, unique: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true })
  description!: string;

  @Prop({ type: String, required: true, enum: ['CORPORATE', 'FESTIVE'], default: 'CORPORATE' })
  type!: string;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false })
  isDefault!: boolean;

  // Configuración de envío
  @Prop({ type: Number, required: true, default: 2, min: 1, max: 30 })
  daysBeforeBirthday!: number;

  @Prop({ type: Boolean, default: true })
  sendToEmployee!: boolean;

  @Prop({ type: Boolean, default: true })
  sendToBoss!: boolean;

  // Plantillas HTML
  @Prop({ 
    type: {
      subject: { type: String, required: true },
      html: { type: String, required: true },
      text: { type: String, required: true }
    },
    required: true
  })
  employeeTemplate!: {
    subject: string;
    html: string;
    text: string;
  };

  @Prop({ 
    type: {
      subject: { type: String, required: true },
      html: { type: String, required: true },
      text: { type: String, required: true }
    },
    required: true
  })
  bossTemplate!: {
    subject: string;
    html: string;
    text: string;
  };

  // Metadatos
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;

  @Prop({ type: Date, default: null })
  lastUsed?: Date | null;

  @Prop({ type: Number, default: 0 })
  usageCount!: number;
}

export type BirthdayTemplateDocument = HydratedDocument<BirthdayTemplateEntity>;
export const BirthdayTemplateSchema = SchemaFactory.createForClass(BirthdayTemplateEntity);

// Índices para optimización
BirthdayTemplateSchema.index({ isActive: 1, isDefault: 1 });
BirthdayTemplateSchema.index({ type: 1, isActive: 1 });
BirthdayTemplateSchema.index({ name: 1 });
