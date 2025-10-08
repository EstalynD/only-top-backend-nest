import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { TurnoChatter } from './chatter-sale.schema.js';

export enum CommissionStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  PAGADA = 'PAGADA',
  CANCELADA = 'CANCELADA',
}

export enum CommissionType {
  SUPERNUMERARIO = 'SUPERNUMERARIO', // 1% fijo
  ESCALABLE = 'ESCALABLE', // Según cumplimiento de meta
}

// Detalle de ventas incluidas en la comisión
@Schema({ _id: false })
export class CommissionSalesDetail {
  @Prop({ type: Number, required: true })
  totalVentas!: number; // Cantidad de ventas

  @Prop({ type: Number, required: true })
  montoTotal!: number; // Monto total en USD

  @Prop({ type: String, enum: Object.values(TurnoChatter), required: true })
  turno!: TurnoChatter;
}

// Schema principal para comisiones de chatters
@Schema({ collection: 'chatter_commissions', timestamps: true })
export class ChatterCommissionEntity {
  // Chatter al que pertenece la comisión
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  chatterId!: Types.ObjectId;

  // Modelo/Grupo al que pertenece
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ModeloEntity', required: true, index: true })
  modeloId!: Types.ObjectId;

  // Meta asociada (si aplica)
  @Prop({ type: SchemaTypes.ObjectId, ref: 'ChatterGoalEntity', default: null })
  goalId?: Types.ObjectId | null;

  // Periodo de cálculo
  @Prop({ type: Date, required: true, index: true })
  fechaInicio!: Date;

  @Prop({ type: Date, required: true, index: true })
  fechaFin!: Date;

  // Tipo de comisión
  @Prop({ 
    type: String, 
    enum: Object.values(CommissionType), 
    required: true 
  })
  tipoComision!: CommissionType;

  // Turno del chatter
  @Prop({ type: String, enum: Object.values(TurnoChatter), required: true })
  turno!: TurnoChatter;

  // Ventas del chatter en el periodo
  @Prop({ type: Number, required: true, min: 0 })
  totalVentas!: number; // Cantidad de ventas

  @Prop({ type: Number, required: true, min: 0 })
  montoVentas!: number; // Monto total vendido en USD

  // Información de la meta del grupo (si aplica)
  @Prop({ type: Number, default: null })
  metaGrupo?: number | null;

  @Prop({ type: Number, default: null })
  ventasGrupo?: number | null;

  @Prop({ type: Number, default: null })
  porcentajeCumplimientoGrupo?: number | null;

  // Cálculo de comisión
  @Prop({ type: Number, required: true, min: 0 })
  porcentajeComision!: number; // 0.5, 1, 1.5, 2, etc.

  @Prop({ type: Number, required: true, min: 0 })
  montoComision!: number; // Monto en USD

  @Prop({ type: String, default: 'USD', uppercase: true })
  moneda!: string;

  // Configuración de escala aplicada
  @Prop({ type: SchemaTypes.ObjectId, ref: 'CommissionScaleEntity', default: null })
  commissionScaleId?: Types.ObjectId | null;

  // Detalle de ventas
  @Prop({ type: CommissionSalesDetail, default: null })
  detalleVentas?: CommissionSalesDetail | null;

  // Estado de la comisión
  @Prop({ 
    type: String, 
    enum: Object.values(CommissionStatus), 
    default: CommissionStatus.PENDIENTE,
    index: true 
  })
  estado!: CommissionStatus;

  // Información de aprobación
  @Prop({ type: Date, default: null })
  fechaAprobacion?: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  aprobadoPor?: Types.ObjectId | null;

  // Información de pago
  @Prop({ type: Date, default: null })
  fechaPago?: Date | null;

  @Prop({ type: String, default: null })
  referenciaPago?: string | null; // Número de transferencia, etc.

  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  pagadoPor?: Types.ObjectId | null;

  // Notas y observaciones
  @Prop({ type: String, default: null })
  notas?: string | null;

  @Prop({ type: String, default: null })
  observaciones?: string | null;

  // Usuario que generó la comisión
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null })
  generadoPor?: Types.ObjectId | null;

  // Metadatos adicionales
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type ChatterCommissionDocument = HydratedDocument<ChatterCommissionEntity>;
export const ChatterCommissionSchema = SchemaFactory.createForClass(ChatterCommissionEntity);

// Índices compuestos
ChatterCommissionSchema.index({ chatterId: 1, fechaInicio: -1 });
ChatterCommissionSchema.index({ modeloId: 1, fechaInicio: -1 });
ChatterCommissionSchema.index({ goalId: 1 });
ChatterCommissionSchema.index({ estado: 1, fechaInicio: -1 });
ChatterCommissionSchema.index({ chatterId: 1, estado: 1 });
ChatterCommissionSchema.index({ fechaInicio: 1, fechaFin: 1 });

