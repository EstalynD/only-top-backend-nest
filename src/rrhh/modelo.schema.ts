import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Tipo de documento de identificación
export enum TipoDocumento {
  CEDULA_CIUDADANIA = 'CEDULA_CIUDADANIA',
  CEDULA_EXTRANJERIA = 'CEDULA_EXTRANJERIA',
  PASAPORTE = 'PASAPORTE',
  PPT = 'PPT', // Permiso de Protección Temporal
  ID_EXTRANJERO = 'ID_EXTRANJERO',
  OTRO = 'OTRO',
}

// Plataformas de contenido
export enum PlataformaContenido {
  ONLYFANS = 'ONLYFANS',
  FANSLY = 'FANSLY',
  MANYVIDS = 'MANYVIDS',
  F2F = 'F2F',
  JUSTFORFANS = 'JUSTFORFANS',
  FANCENTRO = 'FANCENTRO',
  OTRAS = 'OTRAS',
}

// Tipos de tráfico
export enum TipoTrafico {
  REDDIT_ORGANICO = 'REDDIT_ORGANICO',
  REDDIT_ADS = 'REDDIT_ADS',
  PAUTA_RRSS = 'PAUTA_RRSS',
  RRSS_ORGANICO = 'RRSS_ORGANICO',
  DATING_APPS = 'DATING_APPS',
}

// Schema para cuentas de plataforma
@Schema({ _id: false })
export class CuentaPlataforma {
  @Prop({ type: String, required: true, enum: Object.values(PlataformaContenido) })
  plataforma!: PlataformaContenido;

  @Prop({ type: [String], required: true })
  links!: string[]; // Permite múltiples links (ej: OnlyFans VIP y Free)

  @Prop({ type: String, default: null })
  notas?: string | null;
}

export const CuentaPlataformaSchema = SchemaFactory.createForClass(CuentaPlataforma);

// Schema para redes sociales
@Schema({ _id: false })
export class RedSocial {
  @Prop({ type: String, required: true }) // Instagram, Twitter, TikTok, Telegram, etc.
  plataforma!: string;

  @Prop({ type: String, required: true })
  link!: string;

  @Prop({ type: String, default: null })
  username?: string | null;
}

export const RedSocialSchema = SchemaFactory.createForClass(RedSocial);

// Schema para fuentes de tráfico con inversión
@Schema({ _id: false })
export class FuenteTrafico {
  @Prop({ type: String, required: true, enum: Object.values(TipoTrafico) })
  tipo!: TipoTrafico;

  @Prop({ type: Boolean, default: true })
  activo!: boolean;

  @Prop({ type: Number, default: 0, min: 0 }) // Inversión en USD para tráfico pago
  inversionUSD?: number;

  @Prop({ type: Number, default: 0, min: 0, max: 100 }) // Porcentaje de atribución
  porcentaje?: number;

  @Prop({ type: String, default: null })
  notas?: string | null;
}

export const FuenteTraficoSchema = SchemaFactory.createForClass(FuenteTrafico);

// Schema para facturación mensual
@Schema({ _id: false })
export class FacturacionMensual {
  @Prop({ type: Number, required: true, min: 1, max: 12 })
  mes!: number; // 1-12

  @Prop({ type: Number, required: true })
  anio!: number;

  @Prop({ type: Number, required: true, min: 0 })
  monto!: number; // En USD

  @Prop({ type: String, default: 'USD' })
  moneda!: string;
}

export const FacturacionMensualSchema = SchemaFactory.createForClass(FacturacionMensual);

// Schema para equipo de chatters asignado
@Schema({ _id: false })
export class EquipoChatters {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true })
  turnoAM!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true })
  turnoPM!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true })
  turnoMadrugada!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true })
  supernumerario!: Types.ObjectId;
}

export const EquipoChattersSchema = SchemaFactory.createForClass(EquipoChatters);

// Schema principal de Modelo
@Schema({ collection: 'rrhh_modelos', timestamps: true })
export class ModeloEntity {
  // Información básica
  @Prop({ type: String, required: true, trim: true, index: true })
  nombreCompleto!: string;

  @Prop({ type: String, required: true, trim: true })
  numeroIdentificacion!: string;

  @Prop({ type: String, required: true, enum: Object.values(TipoDocumento) })
  tipoDocumento!: TipoDocumento;

  @Prop({ type: String, required: true, trim: true })
  telefono!: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  correoElectronico!: string;

  @Prop({ type: Date, required: true })
  fechaNacimiento!: Date;

  @Prop({ type: String, required: true, trim: true })
  paisResidencia!: string;

  @Prop({ type: String, required: true, trim: true })
  ciudadResidencia!: string;

  // Plataformas de contenido
  @Prop({ type: [CuentaPlataformaSchema], default: [] })
  plataformas!: CuentaPlataforma[];

  // Redes sociales
  @Prop({ type: [RedSocialSchema], default: [] })
  redesSociales!: RedSocial[];

  // Facturación
  @Prop({ type: [FacturacionMensualSchema], default: [] })
  facturacionHistorica!: FacturacionMensual[];

  @Prop({ type: Number, default: 0, min: 0 })
  promedioFacturacionMensual!: number; // Calculado automáticamente

  // Fuentes de tráfico
  @Prop({ type: [FuenteTraficoSchema], default: [] })
  fuentesTrafico!: FuenteTrafico[];

  // Asignaciones de equipo
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  salesCloserAsignado!: Types.ObjectId;

  @Prop({ type: EquipoChattersSchema, required: true })
  equipoChatters!: EquipoChatters;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  traffickerAsignado!: Types.ObjectId;

  // Información adicional
  @Prop({ type: String, default: null })
  linkFormularioRegistro?: string | null;

  @Prop({ type: String, default: null })
  fotoPerfil?: string | null; // URL de Cloudinary

  @Prop({ type: String, default: null })
  fotoPerfilPublicId?: string | null; // Public ID de Cloudinary

  // Estado
  @Prop({ 
    type: String, 
    required: true, 
    enum: ['ACTIVA', 'INACTIVA', 'SUSPENDIDA', 'TERMINADA'], 
    default: 'ACTIVA', 
    index: true 
  })
  estado!: string;

  // Fechas importantes
  @Prop({ type: Date, default: () => new Date(), index: true })
  fechaRegistro!: Date;

  @Prop({ type: Date, default: null })
  fechaInicio?: Date | null; // Fecha de inicio de trabajo con la agencia

  @Prop({ type: Date, default: null })
  fechaTerminacion?: Date | null;

  // Notas y metadatos
  @Prop({ type: String, default: null })
  notasInternas?: string | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type ModeloDocument = HydratedDocument<ModeloEntity>;
export const ModeloSchema = SchemaFactory.createForClass(ModeloEntity);

// Índices compuestos para optimización
ModeloSchema.index({ nombreCompleto: 1, estado: 1 });
ModeloSchema.index({ salesCloserAsignado: 1, estado: 1 });
ModeloSchema.index({ traffickerAsignado: 1, estado: 1 });
ModeloSchema.index({ 'equipoChatters.turnoAM': 1 });
ModeloSchema.index({ 'equipoChatters.turnoPM': 1 });
ModeloSchema.index({ 'equipoChatters.turnoMadrugada': 1 });
ModeloSchema.index({ 'equipoChatters.supernumerario': 1 });
ModeloSchema.index({ fechaRegistro: -1 });
ModeloSchema.index({ correoElectronico: 1 }, { unique: true });
ModeloSchema.index({ numeroIdentificacion: 1 }, { unique: true });

// Middleware para calcular promedio de facturación antes de guardar
ModeloSchema.pre('save', function (next) {
  if (this.facturacionHistorica && this.facturacionHistorica.length > 0) {
    const total = this.facturacionHistorica.reduce((sum, fact) => sum + fact.monto, 0);
    this.promedioFacturacionMensual = total / this.facturacionHistorica.length;
  } else {
    this.promedioFacturacionMensual = 0;
  }
  next();
});

