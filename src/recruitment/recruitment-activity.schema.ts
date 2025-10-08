import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Estado de la modelo cerrada
export enum EstadoModeloCerrada {
  EN_ESPERA = 'EN_ESPERA', // Esperando registro completo o firma
  REGISTRADA = 'REGISTRADA', // Ya existe en el sistema como modelo
  FIRMADA = 'FIRMADA', // Ya firmó contrato
}

// Schema para modelo cerrada individual
@Schema({ _id: false })
export class ModeloCerrada {
  @Prop({ type: String, required: true, trim: true })
  nombreModelo!: string;

  @Prop({ type: String, required: true, trim: true })
  perfilInstagram!: string; // URL o username

  // Facturación de los últimos 3 meses (en USD)
  @Prop({ type: [Number], required: true, validate: { validator: (v: number[]) => v.length === 3 } })
  facturacionUltimosTresMeses!: number[]; // [mes1, mes2, mes3]

  @Prop({ type: Number, required: true, min: 0 })
  promedioFacturacion!: number; // Se calcula automáticamente

  @Prop({ type: Date, required: true })
  fechaCierre!: Date;

  @Prop({ type: String, required: true, enum: Object.values(EstadoModeloCerrada), default: EstadoModeloCerrada.EN_ESPERA })
  estado!: EstadoModeloCerrada;

  // Referencia a la modelo en el sistema (opcional, solo cuando está registrada)
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', default: null })
  modeloId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  notas?: string | null;
}

export const ModeloCerradaSchema = SchemaFactory.createForClass(ModeloCerrada);

// Schema para números de contacto obtenidos
@Schema({ _id: false })
export class ContactoObtenido {
  @Prop({ type: String, required: true, trim: true })
  numero!: string;

  @Prop({ type: String, default: null, trim: true })
  perfilInstagram?: string | null; // Link o username opcional

  @Prop({ type: String, default: null, trim: true })
  nombreProspecto?: string | null;

  @Prop({ type: Date, default: () => new Date() })
  fechaObtencion!: Date;
}

export const ContactoObtenidoSchema = SchemaFactory.createForClass(ContactoObtenido);

// Schema principal de actividad de recruitment
@Schema({ collection: 'recruitment_activities', timestamps: true })
export class RecruitmentActivityEntity {
  // Fecha de la actividad
  @Prop({ type: Date, required: true, index: true })
  fechaActividad!: Date;

  // Sales Closer responsable
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  salesCloserId!: Types.ObjectId;

  // Métricas de prospección en Instagram
  @Prop({ type: Number, required: true, min: 0, default: 0 })
  cuentasTexteadas!: number; // Cantidad de DMs enviados

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  likesRealizados!: number; // Likes dados en publicaciones

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  comentariosRealizados!: number; // Comentarios dejados en posts

  // Contactos y reuniones
  @Prop({ type: [ContactoObtenidoSchema], default: [] })
  contactosObtenidos!: ContactoObtenido[]; // Array de contactos obtenidos

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  reunionesAgendadas!: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  reunionesRealizadas!: number;

  // Modelos cerradas
  @Prop({ type: [ModeloCerradaSchema], default: [] })
  modelosCerradas!: ModeloCerrada[];

  // Notas generales del día
  @Prop({ type: String, default: null })
  notasDia?: string | null;

  // Auditoría
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  creadoPor?: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type RecruitmentActivityDocument = HydratedDocument<RecruitmentActivityEntity>;
export const RecruitmentActivitySchema = SchemaFactory.createForClass(RecruitmentActivityEntity);

// Índices compuestos
RecruitmentActivitySchema.index({ salesCloserId: 1, fechaActividad: -1 });
RecruitmentActivitySchema.index({ fechaActividad: -1 });
RecruitmentActivitySchema.index({ 'modelosCerradas.estado': 1 });
RecruitmentActivitySchema.index({ 'modelosCerradas.modeloId': 1 });

// Middleware para calcular promedio de facturación
RecruitmentActivitySchema.pre('save', function (next) {
  if (this.modelosCerradas && this.modelosCerradas.length > 0) {
    this.modelosCerradas.forEach(modelo => {
      if (modelo.facturacionUltimosTresMeses && modelo.facturacionUltimosTresMeses.length === 3) {
        const total = modelo.facturacionUltimosTresMeses.reduce((sum, val) => sum + val, 0);
        modelo.promedioFacturacion = total / 3;
      }
    });
  }
  next();
});

