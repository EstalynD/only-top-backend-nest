import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

/**
 * GastoFijoQuincenalEntity - Registro de gastos fijos discriminados por quincena
 * 
 * Este schema almacena:
 * - Gastos operativos fijos de la empresa
 * - Discriminados por quincena (1ra: 1-15, 2da: 16-fin de mes)
 * - Nómina vinculada desde módulo RRHH (empleados)
 * - Otros gastos categorizados (alquiler, servicios, etc.)
 * 
 * Los montos se almacenan como BigInt escalados por 100,000 (5 decimales)
 * usando el patrón de MoneyService.
 */
@Schema({ collection: 'gastos_fijos_quincenales', timestamps: true })
export class GastoFijoQuincenalEntity {
  // Período del gasto
  @Prop({ type: Number, required: true, min: 1, max: 12, index: true })
  mes!: number; // 1-12

  @Prop({ type: Number, required: true, index: true })
  anio!: number;

  @Prop({ 
    type: String, 
    required: true, 
    enum: ['PRIMERA_QUINCENA', 'SEGUNDA_QUINCENA'],
    index: true 
  })
  quincena!: 'PRIMERA_QUINCENA' | 'SEGUNDA_QUINCENA';

  // Periodo completo (formato: "YYYY-MM-Q1" o "YYYY-MM-Q2")
  @Prop({ type: String, required: true, index: true })
  periodoId!: string; // ej: "2025-10-Q1"

  // ========== CATEGORÍA DEL GASTO ==========
  
  @Prop({ 
    type: String, 
    required: true, 
    enum: [
      'NOMINA',           // Salarios de empleados (vinculado a RRHH)
      'ALQUILER',         // Arriendo de oficina/espacios
      'SERVICIOS',        // Agua, luz, internet, teléfono
      'MARKETING',        // Publicidad y marketing
      'TECNOLOGIA',       // Software, licencias, hosting
      'TRANSPORTE',       // Combustible, transporte
      'MANTENIMIENTO',    // Mantenimiento de equipos/instalaciones
      'LEGAL',            // Asesoría legal, impuestos
      'OTROS'             // Otros gastos misceláneos
    ],
    index: true 
  })
  categoria!: string;

  // ========== VINCULACIÓN CON RRHH ==========
  
  // Si es categoría NOMINA, referencia al empleado
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', default: null, index: true })
  empleadoId?: Types.ObjectId | null;

  // ========== MONTO Y MONEDA ==========

  @Prop({
    type: BigInt,
    required: true,
    default: 0n,
  })
  montoUSD!: bigint;

  // ========== INFORMACIÓN DESCRIPTIVA ==========

  @Prop({ type: String, required: true, trim: true })
  concepto!: string; // Descripción del gasto

  @Prop({ type: String, default: null, trim: true })
  proveedor?: string | null; // Nombre del proveedor/beneficiario

  @Prop({ type: Date, required: true, index: true })
  fechaPago!: Date; // Fecha real del pago

  // ========== COMPROBANTES ==========

  @Prop({ type: String, default: null })
  numeroFactura?: string | null;

  @Prop({ type: String, default: null })
  archivoComprobante?: string | null; // URL del comprobante (PDF, imagen)

  // ========== ESTADO Y APROBACIÓN ==========

  @Prop({ 
    type: String, 
    required: true, 
    enum: ['PENDIENTE', 'APROBADO', 'PAGADO', 'RECHAZADO'],
    default: 'PENDIENTE',
    index: true 
  })
  estado!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  aprobadoPor?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  fechaAprobacion?: Date | null;

  // ========== AUDITORÍA ==========

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', required: true })
  registradoPor!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  fechaRegistro!: Date;

  @Prop({ type: String, default: null, trim: true })
  notas?: string | null;

  // ========== METADATOS ==========

  @Prop({
    type: SchemaTypes.Mixed,
    default: {},
  })
  meta?: {
    metodosPago?: string; // Transferencia, efectivo, cheque, etc.
    frecuencia?: string; // Único, mensual, quincenal
    [key: string]: any;
  };
}

export type GastoFijoQuincenalDocument = HydratedDocument<GastoFijoQuincenalEntity>;
export const GastoFijoQuincenalSchema = SchemaFactory.createForClass(GastoFijoQuincenalEntity);

// Índices compuestos para optimización
GastoFijoQuincenalSchema.index({ anio: -1, mes: -1, quincena: 1 });
GastoFijoQuincenalSchema.index({ periodoId: 1, categoria: 1 });
GastoFijoQuincenalSchema.index({ categoria: 1, estado: 1 });
GastoFijoQuincenalSchema.index({ empleadoId: 1, anio: -1, mes: -1 });
GastoFijoQuincenalSchema.index({ estado: 1, fechaPago: -1 });

// Validación: Si es NOMINA, debe tener empleadoId
GastoFijoQuincenalSchema.pre('save', function (next) {
  if (this.categoria === 'NOMINA' && !this.empleadoId) {
    next(new Error('Los gastos de NOMINA deben estar vinculados a un empleado'));
  } else {
    next();
  }
});
