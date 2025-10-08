import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

@Schema({ collection: 'rrhh_empleados', timestamps: true })
export class EmpleadoEntity {
  // Información personal básica
  @Prop({ type: String, required: true, trim: true, index: true })
  nombre!: string;

  @Prop({ type: String, required: true, trim: true, index: true })
  apellido!: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  correoElectronico!: string;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  correoPersonal?: string | null;

  @Prop({ type: String, default: null, lowercase: true, trim: true })
  correoCorporativo?: string | null;

  @Prop({ type: String, required: true, trim: true })
  telefono!: string;

  // Información laboral
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CargoEntity', required: true, index: true })
  cargoId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AreaEntity', required: true, index: true })
  areaId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', default: null, index: true })
  jefeInmediatoId?: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true })
  fechaInicio!: Date;

  @Prop({ 
    type: {
      monto: { type: Number, required: true, min: 0 },
      moneda: { type: String, required: true, default: 'COP', uppercase: true }
    },
    required: true
  })
  salario!: {
    monto: number;
    moneda: string;
  };

  @Prop({ type: String, required: true, enum: ['PRESTACION_SERVICIOS', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR', 'APRENDIZAJE'] })
  tipoContrato!: string;

  // Información de identificación
  @Prop({ type: String, required: true, unique: true, trim: true })
  numeroIdentificacion!: string;

  @Prop({ type: String, required: true, trim: true })
  direccion!: string;

  @Prop({ type: String, required: true, trim: true })
  ciudad!: string;

  @Prop({ type: String, required: true, trim: true, default: 'Colombia' })
  pais!: string;

  // Contacto de emergencia
  @Prop({ 
    type: {
      nombre: { type: String, required: true, trim: true },
      telefono: { type: String, required: true, trim: true },
      relacion: { type: String, default: null, trim: true }
    },
    required: true
  })
  contactoEmergencia!: {
    nombre: string;
    telefono: string;
    relacion?: string;
  };

  @Prop({ type: Date, required: true })
  fechaNacimiento!: Date;

  @Prop({ type: String, required: true, enum: ['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'TERMINADO'], default: 'ACTIVO', index: true })
  estado!: string;

  // Información bancaria
  @Prop({ 
    type: {
      nombreBanco: { type: String, required: true, trim: true },
      numeroCuenta: { type: String, required: true, trim: true },
      tipoCuenta: { type: String, required: true, enum: ['AHORROS', 'CORRIENTE'] }
    },
    required: true
  })
  informacionBancaria!: {
    nombreBanco: string;
    numeroCuenta: string;
    tipoCuenta: string;
  };

  // Foto de perfil
  @Prop({ type: String, default: null })
  fotoPerfil?: string | null;

  // Metadatos y auditoría
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type EmpleadoDocument = HydratedDocument<EmpleadoEntity>;
export const EmpleadoSchema = SchemaFactory.createForClass(EmpleadoEntity);

// Índices compuestos para optimización
EmpleadoSchema.index({ areaId: 1, estado: 1 });
EmpleadoSchema.index({ cargoId: 1, estado: 1 });
EmpleadoSchema.index({ jefeInmediatoId: 1, estado: 1 });
EmpleadoSchema.index({ fechaInicio: 1, estado: 1 });
EmpleadoSchema.index({ nombre: 1, apellido: 1 });
