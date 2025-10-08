import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ collection: 'rrhh_plantillas_contrato', timestamps: true })
export class PlantillaContratoEntity {
  // Información básica de la plantilla
  @Prop({ type: String, required: true, trim: true })
  nombre!: string;

  @Prop({ type: String, default: null, trim: true })
  descripcion?: string | null;

  // Asociación con área y cargo
  @Prop({ type: SchemaTypes.ObjectId, ref: 'AreaEntity', required: true, index: true })
  areaId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'CargoEntity', required: true, index: true })
  cargoId!: Types.ObjectId;

  // Tipo de contrato para el que aplica
  @Prop({ type: String, required: true, enum: ['PRESTACION_SERVICIOS', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR', 'APRENDIZAJE'] })
  tipoContrato!: string;

  // Contenido de la plantilla (con variables para reemplazar)
  @Prop({ type: String, required: true })
  contenidoPlantilla!: string; // HTML con variables como {{nombre}}, {{salario}}, etc.

  // Variables disponibles en la plantilla
  @Prop({ type: [String], default: [] })
  variables!: string[]; // ['nombre', 'apellido', 'salario', 'fechaInicio', etc.]

  // Estado de la plantilla
  @Prop({ type: Boolean, default: true, index: true })
  activa!: boolean;

  // Versión de la plantilla
  @Prop({ type: Number, default: 1, min: 1 })
  version!: number;

  // Metadatos
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type PlantillaContratoDocument = HydratedDocument<PlantillaContratoEntity>;
export const PlantillaContratoSchema = SchemaFactory.createForClass(PlantillaContratoEntity);

// Índices compuestos
PlantillaContratoSchema.index({ areaId: 1, cargoId: 1, tipoContrato: 1, activa: 1 });
PlantillaContratoSchema.index({ activa: 1, version: -1 });
