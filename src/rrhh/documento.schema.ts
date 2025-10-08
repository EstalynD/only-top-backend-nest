import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ collection: 'rrhh_documentos', timestamps: true })
export class DocumentoEntity {
  // Referencia al empleado
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  empleadoId!: Types.ObjectId;

  // Referencia al contrato (opcional, algunos documentos no están asociados a contratos)
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ContratoEntity', default: null, index: true })
  contratoId?: Types.ObjectId | null;

  // Información del documento
  @Prop({ type: String, required: true, trim: true })
  nombre!: string;

  @Prop({ type: String, required: true, trim: true })
  nombreOriginal!: string;

  @Prop({ 
    type: String, 
    required: true, 
    enum: [
      'CEDULA_IDENTIDAD',
      'RUT',
      'DIPLOMA',
      'CERTIFICADO_ACADEMICO',
      'CERTIFICADO_LABORAL',
      'CERTIFICADO_MEDICO',
      'CERTIFICADO_PENALES',
      'CERTIFICADO_POLICIA',
      'CONTRATO_LABORAL',
      'HOJA_VIDA',
      'FOTO_PERFIL',
      'OTRO'
    ],
    index: true
  })
  tipoDocumento!: string;

  @Prop({ type: String, required: true, trim: true })
  descripcion!: string;

  // Información del archivo
  @Prop({ type: String, required: true })
  urlArchivo!: string; // URL de Cloudinary

  @Prop({ type: String, required: true })
  publicId!: string; // ID público de Cloudinary

  @Prop({ type: String, required: true })
  formato!: string; // PDF, JPG, PNG, etc.

  @Prop({ type: Number, required: true, min: 0 })
  tamañoBytes!: number;

  @Prop({ type: String, required: true })
  mimeType!: string;

  // Fechas importantes del documento
  @Prop({ type: Date, required: true })
  fechaEmision!: Date;

  @Prop({ type: Date, default: null })
  fechaVencimiento?: Date | null;

  @Prop({ type: Date, default: null })
  fechaSubida!: Date;

  // Estado del documento
  @Prop({ 
    type: String, 
    required: true, 
    enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'RENOVADO'], 
    default: 'PENDIENTE',
    index: true
  })
  estado!: string;

  // Información de validación
  @Prop({ 
    type: {
      validadoPor: { type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null },
      fechaValidacion: { type: Date, default: null },
      observaciones: { type: String, default: null, trim: true },
      esValido: { type: Boolean, default: false }
    },
    default: {}
  })
  validacion?: {
    validadoPor?: Types.ObjectId | null;
    fechaValidacion?: Date | null;
    observaciones?: string | null;
    esValido?: boolean;
  };

  // Información de renovación
  @Prop({ 
    type: {
      requiereRenovacion: { type: Boolean, default: false },
      diasAntesVencimiento: { type: Number, default: 30 },
      notificado: { type: Boolean, default: false },
      documentoAnterior: { type: SchemaTypes.ObjectId, ref: 'DocumentoEntity', default: null }
    },
    default: {}
  })
  renovacion?: {
    requiereRenovacion?: boolean;
    diasAntesVencimiento?: number;
    notificado?: boolean;
    documentoAnterior?: Types.ObjectId | null;
  };

  // Metadatos adicionales
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadatos?: Record<string, any>;

  // Información de seguridad
  @Prop({ type: Boolean, default: false })
  esConfidencial!: boolean;

  @Prop({ type: [String], default: [] })
  tags!: string[];
}

export type DocumentoDocument = HydratedDocument<DocumentoEntity>;
export const DocumentoSchema = SchemaFactory.createForClass(DocumentoEntity);

// Índices para optimización de consultas
DocumentoSchema.index({ empleadoId: 1, tipoDocumento: 1 });
DocumentoSchema.index({ empleadoId: 1, estado: 1 });
DocumentoSchema.index({ contratoId: 1, tipoDocumento: 1 });
DocumentoSchema.index({ fechaVencimiento: 1, estado: 1 });
DocumentoSchema.index({ 'renovacion.requiereRenovacion': 1, fechaVencimiento: 1 });
DocumentoSchema.index({ esConfidencial: 1, empleadoId: 1 });
