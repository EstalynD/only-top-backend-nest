import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ collection: 'rrhh_cargos', timestamps: true })
export class CargoEntity {
  // Nombre del cargo
  @Prop({ type: String, required: true, trim: true, index: true })
  name!: string;

  // Código único del cargo para referencias internas
  @Prop({ type: String, required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  // Referencia al área a la que pertenece
  @Prop({ type: SchemaTypes.ObjectId, ref: 'AreaEntity', required: true, index: true })
  areaId!: Types.ObjectId;

  // Descripción del cargo
  @Prop({ type: String, default: null, trim: true })
  description?: string | null;

  // Nivel jerárquico (1 = más alto, mayor número = más bajo)
  @Prop({ type: Number, default: 1, min: 1 })
  hierarchyLevel!: number;


  // Estado activo/inactivo
  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  // Orden para mostrar en listas dentro del área
  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  // Plantilla de contrato específica para este cargo
  @Prop({ type: String, default: null })
  contractTemplateId?: string | null;

  // Información adicional y auditoría
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type CargoDocument = HydratedDocument<CargoEntity>;
export const CargoSchema = SchemaFactory.createForClass(CargoEntity);

// Índices compuestos para optimización
CargoSchema.index({ areaId: 1, isActive: 1, sortOrder: 1 });
CargoSchema.index({ code: 1, isActive: 1 });
CargoSchema.index({ hierarchyLevel: 1, areaId: 1 });
