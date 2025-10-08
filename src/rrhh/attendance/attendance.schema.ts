import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';

export interface AttendanceRecord {
  id: string;
  userId: string;
  empleadoId: string;
  type: AttendanceType;
  timestamp: Date;
  status: AttendanceStatus;
  shiftId?: string;
  areaId?: string;
  cargoId?: string;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  deviceInfo?: {
    userAgent: string;
    ipAddress: string;
    platform: string;
  };
  markedBy?: string;
  markedByUserId?: string;
}

@Schema({ collection: 'attendance_records', timestamps: true })
export class AttendanceEntity {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'EmpleadoEntity', required: true, index: true })
  empleadoId!: string;

  @Prop({ type: String, required: true, enum: ['CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END'] })
  type!: AttendanceType;

  @Prop({ type: Date, required: true, default: Date.now })
  timestamp!: Date;

  @Prop({ type: String, required: true, enum: ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] })
  status!: AttendanceStatus;

  @Prop({ type: String, index: true })
  shiftId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AreaEntity', index: true })
  areaId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CargoEntity', index: true })
  cargoId?: string;

  @Prop({ type: String })
  notes?: string;

  @Prop({
    type: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String }
    }
  })
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  @Prop({
    type: {
      userAgent: { type: String, required: true },
      ipAddress: { type: String, required: true },
      platform: { type: String, required: true }
    }
  })
  deviceInfo?: {
    userAgent: string;
    ipAddress: string;
    platform: string;
  };

  // Audit fields
  @Prop({ type: String })
  markedBy?: string; // Username who marked

  @Prop({ type: String })
  markedByUserId?: string; // User ID who marked

  @Prop({ type: String })
  createdBy?: string;

  @Prop({ type: String })
  updatedBy?: string;
}

export type AttendanceDocument = HydratedDocument<AttendanceEntity>;
export const AttendanceSchema = SchemaFactory.createForClass(AttendanceEntity);

// Compound indexes for efficient queries
AttendanceSchema.index({ userId: 1, timestamp: -1 });
AttendanceSchema.index({ empleadoId: 1, timestamp: -1 });
AttendanceSchema.index({ userId: 1, type: 1, timestamp: -1 });
AttendanceSchema.index({ empleadoId: 1, type: 1, timestamp: -1 });
AttendanceSchema.index({ shiftId: 1, timestamp: -1 });
AttendanceSchema.index({ areaId: 1, timestamp: -1 });
AttendanceSchema.index({ cargoId: 1, timestamp: -1 });
// Date-only index for daily queries
AttendanceSchema.index({ timestamp: 1 });
