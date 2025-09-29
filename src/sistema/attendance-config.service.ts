import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendanceConfigEntity, type Shift, type TimeSlot, type FixedSchedule } from './attendance-config.schema.js';
import { UpdateAttendanceConfigDto } from './dto.js';

const ATTENDANCE_CONFIG_KEY = 'attendance_config';

@Injectable()
export class AttendanceConfigService {
  private readonly logger = new Logger(AttendanceConfigService.name);

  constructor(
    @InjectModel(AttendanceConfigEntity.name) private readonly attendanceConfigModel: Model<AttendanceConfigEntity>,
  ) {}

  async getAttendanceConfig() {
    let config = await this.attendanceConfigModel.findOne({ key: ATTENDANCE_CONFIG_KEY }).lean();
    
    // Create default configuration if it doesn't exist
    if (!config) {
      config = await this.createDefaultConfiguration();
    }
    
    return config;
  }

  async updateAttendanceConfig(dto: UpdateAttendanceConfigDto, updatedBy?: string) {
    // Validate time slots and shifts if provided
    if (dto.fixedSchedule) {
      this.validateFixedSchedule(dto.fixedSchedule);
    }
    
    // Normalize and validate rotating shifts if provided (DTO -> Entity)
    let normalizedShifts: Shift[] | undefined;
    if (dto.rotatingShifts) {
      normalizedShifts = dto.rotatingShifts.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        timeSlot: {
          startTime: s.timeSlot.startTime,
          endTime: s.timeSlot.endTime,
        },
        description: s.description,
        isActive: s.isActive ?? true,
      }));
      this.validateRotatingShifts(normalizedShifts);
    }

    const updated = await this.attendanceConfigModel.findOneAndUpdate(
      { key: ATTENDANCE_CONFIG_KEY },
      {
        ...dto,
        ...(normalizedShifts ? { rotatingShifts: normalizedShifts } : {}),
        updatedBy,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    if (!updated) {
      throw new BadRequestException('Failed to update attendance configuration');
    }

    return updated.toObject();
  }

  // === SHIFT MANAGEMENT ===

  async addShift(shift: Omit<Shift, 'id'>, updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    // Generate unique ID
    const shiftId = `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newShift: Shift = {
      ...shift,
      id: shiftId,
      isActive: shift.isActive ?? true
    };

    // Validate the new shift
    this.validateShift(newShift);
    
    // Check for conflicts with existing shifts
    this.checkShiftConflicts(newShift, config.rotatingShifts);

    const updatedShifts = [...config.rotatingShifts, newShift];

    return this.updateAttendanceConfig({ rotatingShifts: updatedShifts }, updatedBy);
  }

  async updateShift(shiftId: string, shiftData: Partial<Omit<Shift, 'id'>>, updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    const shiftIndex = config.rotatingShifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    const updatedShift: Shift = {
      ...config.rotatingShifts[shiftIndex],
      ...shiftData
    };

    // Validate the updated shift
    this.validateShift(updatedShift);
    
    // Check for conflicts with other shifts (excluding itself)
    const otherShifts = config.rotatingShifts.filter(s => s.id !== shiftId);
    this.checkShiftConflicts(updatedShift, otherShifts);

    const updatedShifts = config.rotatingShifts.map(s => 
      s.id === shiftId ? updatedShift : s
    );

    return this.updateAttendanceConfig({ rotatingShifts: updatedShifts }, updatedBy);
  }

  async deleteShift(shiftId: string, updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    const shiftExists = config.rotatingShifts.some(s => s.id === shiftId);
    if (!shiftExists) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    // Don't allow deletion if it's the last active shift
    const activeShifts = config.rotatingShifts.filter(s => s.isActive);
    if (activeShifts.length <= 1 && activeShifts[0]?.id === shiftId) {
      throw new BadRequestException('Cannot delete the last active shift. At least one shift must remain active.');
    }

    const updatedShifts = config.rotatingShifts.filter(s => s.id !== shiftId);

    return this.updateAttendanceConfig({ rotatingShifts: updatedShifts }, updatedBy);
  }

  async toggleShiftStatus(shiftId: string, updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    const shift = config.rotatingShifts.find(s => s.id === shiftId);
    if (!shift) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    // Don't allow deactivating if it's the last active shift
    if (shift.isActive) {
      const activeShifts = config.rotatingShifts.filter(s => s.isActive);
      if (activeShifts.length <= 1) {
        throw new BadRequestException('Cannot deactivate the last active shift. At least one shift must remain active.');
      }
    }

    return this.updateShift(shiftId, { isActive: !shift.isActive }, updatedBy);
  }

  // === UTILITY METHODS ===

  async calculateShiftDuration(timeSlot: TimeSlot): Promise<number> {
    const startMinutes = this.timeToMinutes(timeSlot.startTime);
    const endMinutes = this.timeToMinutes(timeSlot.endTime);
    
    // Handle overnight shifts (e.g., 22:00 to 06:00)
    if (endMinutes <= startMinutes) {
      return (24 * 60) - startMinutes + endMinutes;
    }
    
    return endMinutes - startMinutes;
  }

  async getActiveShifts() {
    const config = await this.getAttendanceConfig();
    return config.rotatingShifts.filter(shift => shift.isActive);
  }

  async getShiftByType(shiftType: string) {
    const config = await this.getAttendanceConfig();
    return config.rotatingShifts.find(shift => shift.type === shiftType && shift.isActive);
  }

  // === VALIDATION METHODS ===

  private validateFixedSchedule(schedule: FixedSchedule) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of days) {
      const timeSlot = schedule[day as keyof FixedSchedule];
      if (timeSlot) {
        this.validateTimeSlot(timeSlot, `Fixed schedule ${day}`);
      }
    }
  }

  private validateRotatingShifts(shifts: Shift[]) {
    if (!shifts || shifts.length === 0) {
      throw new BadRequestException('At least one rotating shift is required');
    }

    // Validate each shift
    shifts.forEach((shift, index) => {
      this.validateShift(shift, `Shift ${index + 1}`);
    });

    // Check for conflicts between shifts
    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        this.checkShiftConflict(shifts[i], shifts[j]);
      }
    }

    // Ensure at least one active shift
    const activeShifts = shifts.filter(s => s.isActive);
    if (activeShifts.length === 0) {
      throw new BadRequestException('At least one shift must be active');
    }
  }

  private validateShift(shift: Shift, context?: string) {
    const prefix = context ? `${context}: ` : '';
    
    if (!shift.id || !shift.name || !shift.type) {
      throw new BadRequestException(`${prefix}Shift must have id, name, and type`);
    }
    
    if (!shift.timeSlot) {
      throw new BadRequestException(`${prefix}Shift must have a time slot`);
    }
    
    this.validateTimeSlot(shift.timeSlot, `${prefix}${shift.name}`);
  }

  private validateTimeSlot(timeSlot: TimeSlot, context?: string) {
    const prefix = context ? `${context}: ` : '';
    
    if (!this.isValidTimeFormat(timeSlot.startTime)) {
      throw new BadRequestException(`${prefix}Invalid start time format. Use HH:mm format (e.g., "09:30")`);
    }
    
    if (!this.isValidTimeFormat(timeSlot.endTime)) {
      throw new BadRequestException(`${prefix}Invalid end time format. Use HH:mm format (e.g., "17:30")`);
    }
    
    // Additional validation for same-day shifts
    const startMinutes = this.timeToMinutes(timeSlot.startTime);
    const endMinutes = this.timeToMinutes(timeSlot.endTime);
    
    // Allow overnight shifts but ensure minimum duration
    const duration = endMinutes <= startMinutes 
      ? (24 * 60) - startMinutes + endMinutes 
      : endMinutes - startMinutes;
    
    if (duration < 60) { // Minimum 1 hour
      throw new BadRequestException(`${prefix}Shift duration must be at least 1 hour`);
    }
    
    if (duration > 12 * 60) { // Maximum 12 hours
      throw new BadRequestException(`${prefix}Shift duration cannot exceed 12 hours`);
    }
  }

  private checkShiftConflicts(newShift: Shift, existingShifts: Shift[]) {
    const activeShifts = existingShifts.filter(s => s.isActive);
    
    for (const existingShift of activeShifts) {
      this.checkShiftConflict(newShift, existingShift);
    }
  }

  private checkShiftConflict(shift1: Shift, shift2: Shift) {
    if (!shift1.isActive || !shift2.isActive) return;
    
    const start1 = this.timeToMinutes(shift1.timeSlot.startTime);
    const end1 = this.timeToMinutes(shift1.timeSlot.endTime);
    const start2 = this.timeToMinutes(shift2.timeSlot.startTime);
    const end2 = this.timeToMinutes(shift2.timeSlot.endTime);
    
    // Handle overnight shifts
    const isOvernight1 = end1 <= start1;
    const isOvernight2 = end2 <= start2;
    
    if (isOvernight1 || isOvernight2) {
      // Complex overnight shift conflict detection
      if (this.doOvernightShiftsOverlap(start1, end1, start2, end2, isOvernight1, isOvernight2)) {
        throw new BadRequestException({
          code: 'SHIFT_CONFLICT',
          message: `Shift conflict detected between "${shift1.name}" and "${shift2.name}"`,
          details: { a: shift1.name, b: shift2.name },
        });
      }
    } else {
      // Simple same-day shift conflict detection
      if (!(end1 <= start2 || end2 <= start1)) {
        throw new BadRequestException({
          code: 'SHIFT_CONFLICT',
          message: `Shift conflict detected between "${shift1.name}" and "${shift2.name}"`,
          details: { a: shift1.name, b: shift2.name },
        });
      }
    }
  }

  private doOvernightShiftsOverlap(start1: number, end1: number, start2: number, end2: number, isOvernight1: boolean, isOvernight2: boolean): boolean {
    // Convert overnight shifts to 24+ hour format for easier comparison
    const normalizeEnd = (start: number, end: number, isOvernight: boolean) => 
      isOvernight ? end + 24 * 60 : end;
    
    const normalizedEnd1 = normalizeEnd(start1, end1, isOvernight1);
    const normalizedEnd2 = normalizeEnd(start2, end2, isOvernight2);
    
    // Check for overlap in the normalized timeline
    return !(normalizedEnd1 <= start2 || normalizedEnd2 <= start1);
  }

  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private async createDefaultConfiguration(updatedBy?: string) {
    const defaultConfig: Omit<AttendanceConfigEntity, '_id' | 'createdAt' | 'updatedAt'> = {
      key: ATTENDANCE_CONFIG_KEY,
      fixedScheduleEnabled: true,
      rotatingShiftsEnabled: true,
      fixedSchedule: {
        monday: { startTime: '09:00', endTime: '18:00' },
        tuesday: { startTime: '09:00', endTime: '18:00' },
        wednesday: { startTime: '09:00', endTime: '18:00' },
        thursday: { startTime: '09:00', endTime: '18:00' },
        friday: { startTime: '09:00', endTime: '18:00' },
        saturday: { startTime: '09:00', endTime: '14:00' },
        sunday: undefined
      },
      rotatingShifts: [
        {
          id: 'shift_am',
          name: 'Turno Mañana',
          type: 'AM',
          timeSlot: { startTime: '06:00', endTime: '14:00' },
          description: 'Turno de mañana - 6:00 am a 2:00 pm',
          isActive: true
        },
        {
          id: 'shift_pm',
          name: 'Turno Tarde',
          type: 'PM',
          timeSlot: { startTime: '14:00', endTime: '22:00' },
          description: 'Turno de tarde - 2:00 pm a 10:00 pm',
          isActive: true
        },
        {
          id: 'shift_madrugada',
          name: 'Turno Madrugada',
          type: 'MADRUGADA',
          timeSlot: { startTime: '22:00', endTime: '06:00' },
          description: 'Turno de madrugada - 10:00 pm a 6:00 am',
          isActive: true
        }
      ],
      breakDurationMinutes: 30,
      toleranceMinutes: 15,
      weekendEnabled: true,
      overtimeEnabled: false,
      timezone: 'America/Bogota',
      description: 'Configuración de asistencia con horarios fijos y turnos rotativos disponibles',
      updatedBy: updatedBy || 'system'
    };

    const created = await this.attendanceConfigModel.create(defaultConfig);
    return created.toObject();
  }

  // === CONFIGURATION ENABLE/DISABLE ===

  async toggleFixedSchedule(enabled: boolean, updatedBy?: string) {
    const updated = await this.updateAttendanceConfig({ fixedScheduleEnabled: enabled }, updatedBy);
    return updated;
  }

  async toggleRotatingShifts(enabled: boolean, updatedBy?: string) {
    const updated = await this.updateAttendanceConfig({ rotatingShiftsEnabled: enabled }, updatedBy);
    return updated;
  }
}
