import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Tipos de recordatorio
export enum TipoRecordatorio {
  PROXIMO_VENCIMIENTO = 'PROXIMO_VENCIMIENTO', // Factura próxima a vencer
  VENCIDO = 'VENCIDO',                         // Factura vencida
  MORA = 'MORA',                               // Factura en mora (varios días vencida)
  CONFIRMACION_PAGO = 'CONFIRMACION_PAGO',     // Confirmación de pago recibido
}

// Estado del envío de recordatorio
export enum EstadoRecordatorio {
  PENDIENTE = 'PENDIENTE',
  ENVIADO = 'ENVIADO',
  ERROR = 'ERROR',
}

// Schema principal de Recordatorio
@Schema({ collection: 'cartera_recordatorios', timestamps: true })
export class RecordatorioEntity {
  // Relación con factura
  @Prop({ type: SchemaTypes.ObjectId, ref: 'FacturaEntity', required: true, index: true })
  facturaId!: Types.ObjectId;

  // Tipo de recordatorio
  @Prop({ 
    type: String, 
    required: true, 
    enum: Object.values(TipoRecordatorio),
    index: true
  })
  tipo!: TipoRecordatorio;

  // Información del envío
  @Prop({ type: Date, required: true, index: true })
  fechaEnvio!: Date;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  emailDestino!: string;

  @Prop({ type: String, required: true, trim: true })
  asunto!: string;

  @Prop({ type: String, required: true })
  contenidoHTML!: string; // Contenido del email en HTML

  // Estado del envío
  @Prop({ 
    type: String, 
    required: true, 
    enum: Object.values(EstadoRecordatorio),
    default: EstadoRecordatorio.PENDIENTE,
    index: true
  })
  estado!: EstadoRecordatorio;

  @Prop({ type: String, default: null })
  errorMensaje?: string | null; // Mensaje de error si falló el envío

  // Información adicional
  @Prop({ type: [String], default: [] })
  emailsCC?: string[]; // Copias del email

  @Prop({ type: String, default: null, trim: true })
  notasInternas?: string | null;

  // Auditoría
  @Prop({ 
    type: SchemaTypes.Mixed, 
    default: 'SISTEMA'
  })
  enviadoPor!: Types.ObjectId | 'SISTEMA'; // Puede ser un usuario o el sistema automático

  // Metadatos
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type RecordatorioDocument = HydratedDocument<RecordatorioEntity>;
export const RecordatorioSchema = SchemaFactory.createForClass(RecordatorioEntity);

// Índices compuestos para optimización
RecordatorioSchema.index({ facturaId: 1, tipo: 1, fechaEnvio: -1 });
RecordatorioSchema.index({ estado: 1, fechaEnvio: -1 });
RecordatorioSchema.index({ tipo: 1, fechaEnvio: -1 });
RecordatorioSchema.index({ emailDestino: 1, fechaEnvio: -1 });
