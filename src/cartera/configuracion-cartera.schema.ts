import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

/**
 * ConfiguracionCarteraEntity
 * 
 * Configuración global del módulo de cartera.
 * Debe existir solo un documento (singleton) o uno por tenant.
 */
@Schema({ collection: 'cartera_configuracion', timestamps: true })
export class ConfiguracionCarteraEntity {
  // Configuración de facturación
  @Prop({ type: Number, required: true, default: 15, min: 1, max: 90 })
  diasVencimientoFactura!: number; // Días desde emisión hasta vencimiento

  // Configuración de alertas
  @Prop({ type: Number, required: true, default: 5, min: 1, max: 30 })
  diasAntesAlerta1!: number; // Primera alerta (ej: 5 días antes del vencimiento)

  @Prop({ type: Number, required: true, default: 2, min: 1, max: 30 })
  diasAntesAlerta2!: number; // Segunda alerta (ej: 2 días antes del vencimiento)

  @Prop({ type: Number, required: true, default: 3, min: 1, max: 30 })
  diasDespuesAlertaMora!: number; // Alerta de mora (ej: 3 días después del vencimiento)

  @Prop({ type: Number, required: true, default: 7, min: 1, max: 90 })
  diasDespuesAlertaMora2!: number; // Segunda alerta de mora (ej: 7 días después)

  // Configuración de emails
  @Prop({ type: [String], default: [] })
  emailCC?: string[]; // Emails en copia para recordatorios

  @Prop({ type: String, default: 'OnlyTop Cartera <cartera@onlytop.com>' })
  emailFrom?: string;

  // Plantillas de email (nombres de archivo o IDs)
  @Prop({ type: String, default: null })
  plantillaRecordatorioProximo?: string | null;

  @Prop({ type: String, default: null })
  plantillaRecordatorioVencido?: string | null;

  @Prop({ type: String, default: null })
  plantillaConfirmacionPago?: string | null;

  // Configuración de generación automática
  @Prop({ type: Boolean, default: true })
  generacionAutomaticaActiva!: boolean;

  @Prop({ type: Number, default: 1, min: 1, max: 28 })
  diaGeneracionFacturas!: number; // Día del mes para generar facturas automáticamente

  // Configuración de recordatorios automáticos
  @Prop({ type: Boolean, default: true })
  recordatoriosAutomaticosActivos!: boolean;

  @Prop({ type: String, default: '08:00' }) // HH:mm
  horaEjecucionRecordatorios?: string;

  // Estado general
  @Prop({ type: Boolean, default: true })
  activo!: boolean;

  // Configuración de pagos
  @Prop({ type: [String], default: ['jpg', 'jpeg', 'png', 'pdf'] })
  formatosComprobantePermitidos?: string[];

  @Prop({ type: Number, default: 5 * 1024 * 1024 }) // 5MB
  tamanoMaximoComprobante?: number; // En bytes

  // Metadatos adicionales
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type ConfiguracionCarteraDocument = HydratedDocument<ConfiguracionCarteraEntity>;
export const ConfiguracionCarteraSchema = SchemaFactory.createForClass(ConfiguracionCarteraEntity);

// Índices
ConfiguracionCarteraSchema.index({ activo: 1 });
