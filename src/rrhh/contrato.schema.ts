import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ collection: 'rrhh_contratos', timestamps: true })
export class ContratoEntity {
  // Referencia al empleado
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  empleadoId!: Types.ObjectId;

  // Información del contrato
  @Prop({ type: String, required: true, unique: true, uppercase: true, trim: true })
  numeroContrato!: string;

  @Prop({ type: String, required: true, enum: ['PRESTACION_SERVICIOS', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR', 'APRENDIZAJE'] })
  tipoContrato!: string;

  @Prop({ type: Date, required: true })
  fechaInicio!: Date;

  @Prop({ type: Date, default: null })
  fechaFin?: Date | null;

  // Estado del contrato
  @Prop({ type: String, required: true, enum: ['EN_REVISION', 'APROBADO', 'RECHAZADO', 'TERMINADO'], default: 'EN_REVISION', index: true })
  estado!: string;

  // Contenido del contrato
  @Prop({ type: String, required: true })
  contenidoContrato!: string; // HTML o texto del contrato generado

  // Plantilla utilizada
  @Prop({ type: SchemaTypes.ObjectId, ref: 'PlantillaContratoEntity', required: true })
  plantillaId!: Types.ObjectId;

  // Información de aprobación
  @Prop({ 
    type: {
      aprobadoPor: { type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null },
      fechaAprobacion: { type: Date, default: null },
      comentarios: { type: String, default: null, trim: true }
    },
    default: {}
  })
  aprobacion?: {
    aprobadoPor?: Types.ObjectId | null;
    fechaAprobacion?: Date | null;
    comentarios?: string | null;
  };

  // Metadatos
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type ContratoDocument = HydratedDocument<ContratoEntity>;
export const ContratoSchema = SchemaFactory.createForClass(ContratoEntity);

// Índices
ContratoSchema.index({ empleadoId: 1, estado: 1 });
ContratoSchema.index({ estado: 1, fechaInicio: 1 });
ContratoSchema.index({ tipoContrato: 1, estado: 1 });
