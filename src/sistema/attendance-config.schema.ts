import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AttendanceType = 'FIXED' | 'ROTATING';
export type ShiftType = 'AM' | 'PM' | 'MADRUGADA' | 'CUSTOM';

export interface TimeSlot {
  startTime: string; // Format: "HH:mm" (24-hour format)
  endTime: string;   // Format: "HH:mm" (24-hour format)
}

export interface Shift {
  id: string;
  name: string;
  type: ShiftType;
  timeSlot: TimeSlot;
  description?: string;
  isActive: boolean;
  assignedAreas?: string[]; // IDs de áreas asignadas al turno
  assignedCargos?: string[]; // IDs de cargos asignados al turno
}

export interface FixedSchedule {
  monday: TimeSlot;
  tuesday: TimeSlot;
  wednesday: TimeSlot;
  thursday: TimeSlot;
  friday: TimeSlot;
  saturday?: TimeSlot; // Optional weekend
  sunday?: TimeSlot;   // Optional weekend
  // Configuración global de almuerzo para horario fijo
  lunchBreakEnabled?: boolean;
  lunchBreak?: TimeSlot; // Intervalo de almuerzo (HH:mm - HH:mm)
  assignedAreas?: string[]; // IDs de áreas asignadas al horario fijo
  assignedCargos?: string[]; // IDs de cargos asignados al horario fijo
}

@Schema({ collection: 'attendance_configs', timestamps: true })
export class AttendanceConfigEntity {
  @Prop({ type: String, required: true, default: 'attendance_config' })
  key!: string; // Single document key for configuration

  // Both configurations are always available - no exclusive selection
  @Prop({ type: Boolean, default: true })
  fixedScheduleEnabled!: boolean; // Whether fixed schedule configuration is enabled

  @Prop({ type: Boolean, default: true })
  rotatingShiftsEnabled!: boolean; // Whether rotating shifts configuration is enabled

  // Fixed Schedule Configuration
  @Prop({ 
    type: {
      monday: { startTime: String, endTime: String },
      tuesday: { startTime: String, endTime: String },
      wednesday: { startTime: String, endTime: String },
      thursday: { startTime: String, endTime: String },
      friday: { startTime: String, endTime: String },
      saturday: { startTime: String, endTime: String },
      sunday: { startTime: String, endTime: String },
      lunchBreakEnabled: { type: Boolean, default: false },
      lunchBreak: { startTime: String, endTime: String },
      assignedAreas: { type: [String], default: [] },
      assignedCargos: { type: [String], default: [] }
    },
    default: {
      monday: { startTime: '09:00', endTime: '18:00' },
      tuesday: { startTime: '09:00', endTime: '18:00' },
      wednesday: { startTime: '09:00', endTime: '18:00' },
      thursday: { startTime: '09:00', endTime: '18:00' },
      friday: { startTime: '09:00', endTime: '18:00' },
      saturday: { startTime: '09:00', endTime: '14:00' },
      sunday: null,
      lunchBreakEnabled: false,
      lunchBreak: { startTime: '13:00', endTime: '14:00' },
      assignedAreas: [],
      assignedCargos: []
    }
  })
  fixedSchedule?: FixedSchedule;

  // Rotating Shifts Configuration
  @Prop({ 
    type: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      type: { type: String, enum: ['AM', 'PM', 'MADRUGADA', 'CUSTOM'], required: true },
      timeSlot: {
        startTime: { type: String, required: true },
        endTime: { type: String, required: true }
      },
      description: { type: String },
      isActive: { type: Boolean, default: true },
      assignedAreas: { type: [String], default: [] },
      assignedCargos: { type: [String], default: [] }
    }],
    default: [
      {
        id: 'shift_am',
        name: 'Turno Mañana',
        type: 'AM',
        timeSlot: { startTime: '06:00', endTime: '14:00' },
        description: 'Turno de mañana - 6:00 am a 2:00 pm',
        isActive: true,
        assignedAreas: [],
        assignedCargos: []
      },
      {
        id: 'shift_pm',
        name: 'Turno Tarde',
        type: 'PM',
        timeSlot: { startTime: '14:00', endTime: '22:00' },
        description: 'Turno de tarde - 2:00 pm a 10:00 pm',
        isActive: true,
        assignedAreas: [],
        assignedCargos: []
      },
      {
        id: 'shift_madrugada',
        name: 'Turno Madrugada',
        type: 'MADRUGADA',
        timeSlot: { startTime: '22:00', endTime: '06:00' },
        description: 'Turno de madrugada - 10:00 pm a 6:00 am',
        isActive: true,
        assignedAreas: [],
        assignedCargos: []
      }
    ]
  })
  rotatingShifts!: Shift[];

  // General Configuration
  @Prop({ type: Number, default: 30 })
  breakDurationMinutes!: number; // Break duration in minutes

  @Prop({ type: Number, default: 15 })
  toleranceMinutes!: number; // Tolerance for late arrival in minutes

  @Prop({ type: Boolean, default: true })
  weekendEnabled!: boolean; // Whether weekend attendance is enabled

  @Prop({ type: Boolean, default: false })
  overtimeEnabled!: boolean; // Whether overtime tracking is enabled

  @Prop({ type: String })
  timezone?: string; // Timezone for attendance (e.g., 'America/Bogota')

  @Prop({ type: String })
  description?: string; // Optional description

  @Prop({ type: String })
  updatedBy?: string; // User who last updated

  // Fecha/hora global desde la cual se permite registrar asistencia en el sistema
  // Si es null/undefined, no se restringe por fecha de habilitación
  @Prop({ type: Date })
  attendanceEnabledFrom?: Date;
}

export type AttendanceConfigDocument = HydratedDocument<AttendanceConfigEntity>;
export const AttendanceConfigSchema = SchemaFactory.createForClass(AttendanceConfigEntity);
