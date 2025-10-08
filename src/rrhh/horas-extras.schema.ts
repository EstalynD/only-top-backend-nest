import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

// Tipos de horas extras y recargos según legislación colombiana
export enum TipoHoraExtra {
  DIURNA = 'DIURNA', // 25% recargo
  NOCTURNA = 'NOCTURNA', // 75% recargo
  RECARGO_NOCTURNO = 'RECARGO_NOCTURNO', // 35% recargo (trabajo nocturno ordinario)
  DOMINGO = 'DOMINGO', // 75% recargo
  FESTIVO = 'FESTIVO', // 75% recargo
  DOMINGO_NOCTURNO = 'DOMINGO_NOCTURNO', // 110% recargo
  FESTIVO_NOCTURNO = 'FESTIVO_NOCTURNO', // 110% recargo
}

// Recargos porcentuales según legislación colombiana 2025
export const RECARGOS_COLOMBIA = {
  [TipoHoraExtra.DIURNA]: 0.25, // 25%
  [TipoHoraExtra.NOCTURNA]: 0.75, // 75%
  [TipoHoraExtra.RECARGO_NOCTURNO]: 0.35, // 35%
  [TipoHoraExtra.DOMINGO]: 0.75, // 75%
  [TipoHoraExtra.FESTIVO]: 0.75, // 75%
  [TipoHoraExtra.DOMINGO_NOCTURNO]: 1.10, // 110%
  [TipoHoraExtra.FESTIVO_NOCTURNO]: 1.10, // 110%
};

// Subdocumento para cada tipo de hora extra registrada
@Schema({ _id: false })
export class DetalleHoraExtra {
  @Prop({ type: String, required: true, enum: Object.values(TipoHoraExtra) })
  tipo!: TipoHoraExtra;

  @Prop({ type: Number, required: true, min: 0 })
  cantidadHoras!: number;

  @Prop({ type: String, default: null, trim: true })
  observaciones?: string | null;

  @Prop({ type: Date, required: true })
  fechaRegistro!: Date; // Fecha específica en que ocurrió la hora extra

  // Cálculos automáticos (se llenan en el servicio)
  @Prop({ type: BigInt, required: true, default: 0n })
  valorHoraOrdinaria!: bigint; // Valor base de la hora ordinaria × 100 (en la moneda del salario)

  @Prop({ type: Number, required: true, default: 0 })
  recargoPorcentaje!: number; // Recargo aplicado (ej: 0.25 = 25%)

  @Prop({ type: BigInt, required: true, default: 0n })
  valorConRecargo!: bigint; // Valor hora con recargo aplicado × 100 (en la moneda del salario)

  @Prop({ type: BigInt, required: true, default: 0n })
  total!: bigint; // cantidadHoras × valorConRecargo × 100 (en la moneda del salario)
}

export const DetalleHoraExtraSchema = SchemaFactory.createForClass(DetalleHoraExtra);

// Transformar BigInt a string en subdocumento
DetalleHoraExtraSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.valorHoraOrdinaria !== undefined) {
      ret.valorHoraOrdinaria = ret.valorHoraOrdinaria.toString() as any;
    }
    if (ret.valorConRecargo !== undefined) {
      ret.valorConRecargo = ret.valorConRecargo.toString() as any;
    }
    if (ret.total !== undefined) {
      ret.total = ret.total.toString() as any;
    }
    return ret;
  }
});

// Documento principal: Registro quincenal de horas extras por empleado
@Schema({ collection: 'rrhh_horas_extras', timestamps: true })
export class HorasExtrasEntity {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  empleadoId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 2020, max: 2100, index: true })
  anio!: number;

  @Prop({ type: Number, required: true, min: 1, max: 12, index: true })
  mes!: number;

  @Prop({ type: Number, required: true, enum: [1, 2] })
  quincena!: number; // 1 = primera quincena, 2 = segunda quincena

  @Prop({ type: String, required: true, index: true })
  periodo!: string; // Formato: "2025-03-Q1" o "2025-03-Q2"

  // Array de detalles por cada tipo de hora extra
  @Prop({ type: [DetalleHoraExtraSchema], default: [] })
  detalles!: DetalleHoraExtra[];

  // Información del salario base del empleado en el momento del registro
  @Prop({ 
    type: {
      monto: { type: Number, required: true, min: 0 },
      moneda: { type: String, required: true, default: 'COP', uppercase: true }
    },
    required: true
  })
  salarioBase!: {
    monto: number;
    moneda: string;
  };

  @Prop({ type: Number, required: true, default: 220 })
  horasLaboralesMes!: number; // Horas legales al mes (44h/semana × 5 = 220h/mes en Colombia 2025)

  @Prop({ type: BigInt, required: true, default: 0n })
  valorHoraOrdinaria!: bigint; // salarioBase.monto / horasLaboralesMes × 100 (en la moneda del salario)

  // Totales calculados
  @Prop({ type: Number, required: true, default: 0 })
  totalHoras!: number; // Suma de todas las horas extras del periodo

  @Prop({ type: BigInt, required: true, default: 0n })
  totalRecargo!: bigint; // Total a pagar por horas extras × 100 (en la moneda del salario)

  @Prop({ type: String, required: true, enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO'], default: 'PENDIENTE', index: true })
  estado!: string;

  // Aprobación
  @Prop({
    type: {
      aprobadoPor: { type: SchemaTypes.ObjectId, ref: 'UserEntity', default: null },
      fechaAprobacion: { type: Date, default: null },
      comentarios: { type: String, default: null, trim: true }
    },
    default: null
  })
  aprobacion?: {
    aprobadoPor?: Types.ObjectId | null;
    fechaAprobacion?: Date | null;
    comentarios?: string | null;
  } | null;

  // Usuario que registró
  @Prop({ type: SchemaTypes.ObjectId, ref: 'UserEntity', required: true })
  registradoPor!: Types.ObjectId;

  // Metadatos adicionales
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  meta?: Record<string, any>;
}

export type HorasExtrasDocument = HydratedDocument<HorasExtrasEntity>;
export const HorasExtrasSchema = SchemaFactory.createForClass(HorasExtrasEntity);

// Transformar BigInt a string para serialización JSON
HorasExtrasSchema.set('toJSON', {
  transform: (doc, ret) => {
    // Convertir BigInt a string en el documento principal
    if (ret.valorHoraOrdinaria !== undefined) {
      ret.valorHoraOrdinaria = ret.valorHoraOrdinaria.toString() as any;
    }
    if (ret.totalRecargo !== undefined) {
      ret.totalRecargo = ret.totalRecargo.toString() as any;
    }
    // Los detalles se transforman automáticamente por su propio schema
    
    return ret;
  }
});

// Índices compuestos para consultas frecuentes
HorasExtrasSchema.index({ empleadoId: 1, periodo: 1, quincena: 1 }, { unique: true });
HorasExtrasSchema.index({ empleadoId: 1, anio: 1, mes: 1, quincena: 1 });
HorasExtrasSchema.index({ estado: 1, periodo: 1 });
HorasExtrasSchema.index({ anio: 1, mes: 1 });
HorasExtrasSchema.index({ registradoPor: 1, createdAt: -1 });
