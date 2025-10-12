import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

@Schema({ collection: 'rrhh_areas', timestamps: true })
export class AreaEntity {
  // Nombre del área (Marketing, Traffic, Sales, etc.)
  @Prop({ type: String, required: true, trim: true, index: true })
  name!: string;

  // Código único del área para referencias internas
  @Prop({ type: String, required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  // Descripción del área
  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  // Color para identificación visual (hex)
  @Prop({ type: String, default: '#6B7280', match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/ })
  color!: string;

  // Estado activo/inactivo
  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  // Orden para mostrar en listas
  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  // Plantilla de contrato por defecto para esta área
  @Prop({ type: String, default: null })
  defaultContractTemplateId?: string | null;

  // Información adicional y auditoría
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type AreaDocument = HydratedDocument<AreaEntity>;
export const AreaSchema = SchemaFactory.createForClass(AreaEntity);

// Índices compuestos para optimización
AreaSchema.index({ isActive: 1, sortOrder: 1 });
AreaSchema.index({ code: 1, isActive: 1 });
