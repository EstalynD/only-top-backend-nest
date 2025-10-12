import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

// Estados del memorando según especificación
export type MemorandumStatus = 
  | 'PENDIENTE'      // Generado automáticamente, esperando acción del empleado
  | 'SUBSANADO'      // Empleado proporcionó justificación
  | 'EN_REVISIÓN'    // Siendo evaluado por RRHH
  | 'APROBADO'       // RRHH aceptó la justificación
  | 'RECHAZADO'      // RRHH rechazó la justificación
  | 'CERRADO'        // Proceso finalizado
  | 'EXPIRADO';      // Plazo vencido sin respuesta

// Tipos de anomalías que generan memorandos
export type MemorandumType = 
  | 'AUSENCIA'            // No se registró asistencia
  | 'LLEGADA_TARDE'       // Check-in después del horario
  | 'SALIDA_ANTICIPADA'   // Check-out antes del horario
  | 'SALIDA_SIN_REGISTRO'; // No registró check-out

export interface MemorandumAttachment {
  filename: string;
  url: string;
  uploadedAt: Date;
  mimeType: string;
  size: number;
}

export interface MemorandumStatusHistory {
  status: MemorandumStatus;
  changedBy: string;           // Username
  changedByUserId: string;      // User ID
  changedAt: Date;
  comments?: string;
  action?: string;              // Descripción de la acción realizada
}

@Schema({ collection: 'memorandums', timestamps: true })
export class MemorandumEntity {
  // === INFORMACIÓN BÁSICA ===
  
  @Prop({ type: String, required: true, unique: true, index: true })
  code!: string; // Código único del memorando (ej: MEM-2025-0001)

  @Prop({ type: String, required: true, enum: ['AUSENCIA', 'LLEGADA_TARDE', 'SALIDA_ANTICIPADA', 'SALIDA_SIN_REGISTRO'] })
  type!: MemorandumType;

  @Prop({ type: String, required: true, enum: ['PENDIENTE', 'SUBSANADO', 'EN_REVISIÓN', 'APROBADO', 'RECHAZADO', 'CERRADO', 'EXPIRADO'], default: 'PENDIENTE', index: true })
  status!: MemorandumStatus;

  // === INFORMACIÓN DEL EMPLEADO ===

  @Prop({ type: String, required: true, index: true })
  userId!: string; // ID del usuario en el sistema

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  empleadoId!: string; // ID del empleado

  @Prop({ type: String, required: true })
  empleadoNombre!: string; // Nombre completo del empleado

  @Prop({ type: String, required: true })
  empleadoCargo!: string; // Cargo del empleado

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AreaEntity' })
  areaId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CargoEntity' })
  cargoId?: string;

  // === INFORMACIÓN DE LA ANOMALÍA ===

  @Prop({ type: Date, required: true, index: true })
  incidentDate!: Date; // Fecha del incidente

  @Prop({ type: Date })
  expectedTime?: Date; // Hora esperada (ej: 07:00 AM para inicio de turno)

  @Prop({ type: Date })
  actualTime?: Date; // Hora real registrada (si aplica)

  @Prop({ type: String })
  shiftId?: string; // ID del turno afectado (si aplica)

  @Prop({ type: String })
  shiftName?: string; // Nombre del turno (ej: "Turno Mañana")

  @Prop({ type: Number })
  delayMinutes?: number; // Minutos de retraso (para llegadas tarde)

  @Prop({ type: Number })
  earlyMinutes?: number; // Minutos de salida anticipada

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AttendanceEntity' })
  attendanceRecordId?: string; // ID del registro de asistencia relacionado

  // === SUBSANACIÓN ===

  @Prop({ type: String })
  employeeJustification?: string; // Justificación proporcionada por el empleado

  @Prop({ type: [{ 
    filename: String, 
    url: String, 
    uploadedAt: Date, 
    mimeType: String, 
    size: Number 
  }], default: [] })
  attachments!: MemorandumAttachment[]; // Documentos adjuntos

  @Prop({ type: Date })
  subsanedAt?: Date; // Fecha en que el empleado subsanó

  @Prop({ type: Date })
  subsanationDeadline?: Date; // Fecha límite para subsanar

  @Prop({ type: Boolean, default: false })
  isSubsanedBeforeFormal?: boolean; // Si se subsanó antes de emisión formal

  // === REVISIÓN DE RRHH ===

  @Prop({ type: String })
  reviewedBy?: string; // Username del administrador que revisó

  @Prop({ type: String })
  reviewedByUserId?: string; // User ID del administrador

  @Prop({ type: Date })
  reviewedAt?: Date; // Fecha de revisión

  @Prop({ type: String })
  reviewComments?: string; // Comentarios del revisor

  @Prop({ type: String })
  rejectionReason?: string; // Razón de rechazo (si aplica)

  // === GENERACIÓN Y CIERRE ===

  @Prop({ type: String })
  generatedBy!: string; // Username (puede ser 'SISTEMA' para automáticos)

  @Prop({ type: String })
  generatedByUserId?: string; // User ID

  @Prop({ type: Date, default: Date.now })
  generatedAt!: Date; // Fecha de generación del memorando

  @Prop({ type: Date })
  closedAt?: Date; // Fecha de cierre del proceso

  @Prop({ type: String })
  closedBy?: string; // Usuario que cerró el proceso

  @Prop({ type: String })
  closedByUserId?: string;

  // === TRAZABILIDAD ===

  @Prop({ 
    type: [{
      status: { type: String, required: true },
      changedBy: { type: String, required: true },
      changedByUserId: { type: String, required: true },
      changedAt: { type: Date, required: true },
      comments: String,
      action: String
    }], 
    default: [] 
  })
  statusHistory!: MemorandumStatusHistory[]; // Historial completo de cambios

  // === NOTIFICACIONES ===

  @Prop({ type: Boolean, default: false })
  employeeNotified!: boolean; // Si el empleado fue notificado

  @Prop({ type: Date })
  employeeNotifiedAt?: Date;

  @Prop({ type: Boolean, default: false })
  rrhhNotified!: boolean; // Si RRHH fue notificado

  @Prop({ type: Date })
  rrhhNotifiedAt?: Date;

  // === METADATA ===

  @Prop({ type: String })
  pdfUrl?: string; // URL del PDF generado del memorando

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  meta?: Record<string, any>; // Metadata adicional

  @Prop({ type: Boolean, default: false, index: true })
  affectsRecord!: boolean; // Si afecta el historial disciplinario
}

export type MemorandumDocument = HydratedDocument<MemorandumEntity>;
export const MemorandumSchema = SchemaFactory.createForClass(MemorandumEntity);

// === ÍNDICES COMPUESTOS ===
MemorandumSchema.index({ userId: 1, status: 1 });
MemorandumSchema.index({ userId: 1, incidentDate: -1 });
MemorandumSchema.index({ status: 1, subsanationDeadline: 1 }); // Para job de expiración
MemorandumSchema.index({ empleadoId: 1, type: 1 });
MemorandumSchema.index({ incidentDate: 1, type: 1 });
MemorandumSchema.index({ status: 1, generatedAt: -1 });

// === MÉTODOS DE INSTANCIA ===

// Verifica si el memorando está vencido
MemorandumSchema.methods.isExpired = function(this: MemorandumDocument): boolean {
  if (this.status !== 'PENDIENTE' || !this.subsanationDeadline) {
    return false;
  }
  return new Date() > this.subsanationDeadline;
};

// Verifica si se puede subsanar
MemorandumSchema.methods.canBeSubsaned = function(this: MemorandumDocument): boolean {
  if (this.status !== 'PENDIENTE' || !this.subsanationDeadline) {
    return false;
  }
  return new Date() <= this.subsanationDeadline;
};

// Verifica si puede ser revisado por RRHH
MemorandumSchema.methods.canBeReviewed = function(this: MemorandumDocument): boolean {
  return this.status === 'SUBSANADO' || this.status === 'EN_REVISIÓN';
};

// Agrega entrada al historial
MemorandumSchema.methods.addToHistory = function(
  this: MemorandumDocument,
  status: MemorandumStatus,
  changedBy: string,
  changedByUserId: string,
  comments?: string,
  action?: string
): void {
  this.statusHistory.push({
    status,
    changedBy,
    changedByUserId,
    changedAt: new Date(),
    comments,
    action
  });
};
