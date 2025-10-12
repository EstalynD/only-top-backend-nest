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
    // Cargar config actual para poder realizar merge (preservar asignaciones)
    const existing = await this.attendanceConfigModel.findOne({ key: ATTENDANCE_CONFIG_KEY }).lean();

    // Validate time slots and shifts if provided
    if (dto.fixedSchedule) {
      this.validateFixedSchedule(dto.fixedSchedule);
    }
    // Normalize attendanceEnabledFrom to Date if present
    let attendanceEnabledFrom: Date | undefined;
    if (dto.attendanceEnabledFrom !== undefined) {
      if (dto.attendanceEnabledFrom === null as any) {
        attendanceEnabledFrom = undefined;
      } else {
        const d = new Date(dto.attendanceEnabledFrom as unknown as string);
        if (isNaN(d.getTime())) {
          throw new BadRequestException('Invalid attendanceEnabledFrom date');
        }
        attendanceEnabledFrom = d;
      }
    }
    
    // Normalize and validate rotating shifts if provided (DTO -> Entity)
    let normalizedShifts: Shift[] | undefined;
    if (dto.rotatingShifts) {
      // Hacemos merge shift por shift: si existe en config previa y no vienen arrays de asignaciones, preservamos.
      const previousShifts = Array.isArray(existing?.rotatingShifts) ? existing!.rotatingShifts : [];
      normalizedShifts = dto.rotatingShifts.map((s) => {
        const prev = previousShifts.find(ps => ps.id === s.id);
        const providedAreas = (s as any).assignedAreas;
        const providedCargos = (s as any).assignedCargos;
        const assignedAreas = Array.isArray(providedAreas)
          ? Array.from(new Set(providedAreas))
          : (prev?.assignedAreas ? [...prev.assignedAreas] : []);
        const assignedCargos = Array.isArray(providedCargos)
          ? Array.from(new Set(providedCargos))
          : (prev?.assignedCargos ? [...prev.assignedCargos] : []);
        return {
          id: s.id,
            name: s.name,
            type: s.type,
            timeSlot: {
              startTime: s.timeSlot.startTime,
              endTime: s.timeSlot.endTime,
            },
            description: s.description,
            isActive: s.isActive ?? (prev ? prev.isActive : true),
            assignedAreas,
            assignedCargos,
        } as Shift;
      });
      this.validateRotatingShifts(normalizedShifts);
    }

    // Merge para fixedSchedule: si dto.fixedSchedule existe pero no incluye assignedAreas/assignedCargos, mantener las existentes
    let mergedFixedSchedule: FixedSchedule | undefined;
    if (dto.fixedSchedule) {
      const prevFixed = existing?.fixedSchedule;
      mergedFixedSchedule = {
        ...prevFixed, // base previa
        ...dto.fixedSchedule, // override campos enviados
        assignedAreas: Array.isArray((dto.fixedSchedule as any).assignedAreas)
          ? Array.from(new Set((dto.fixedSchedule as any).assignedAreas))
          : (prevFixed?.assignedAreas || []),
        assignedCargos: Array.isArray((dto.fixedSchedule as any).assignedCargos)
          ? Array.from(new Set((dto.fixedSchedule as any).assignedCargos))
          : (prevFixed?.assignedCargos || []),
      } as FixedSchedule;
    }

    const updatePayload: any = {
      ...dto,
      ...(normalizedShifts ? { rotatingShifts: normalizedShifts } : {}),
      ...(mergedFixedSchedule ? { fixedSchedule: mergedFixedSchedule } : {}),
      ...(attendanceEnabledFrom !== undefined ? { attendanceEnabledFrom } : {}),
      updatedBy,
      updatedAt: new Date()
    };
    // Si no se mandó fixedSchedule en dto NO tocar fixedSchedule existente
    if (!mergedFixedSchedule && 'fixedSchedule' in updatePayload) {
      delete updatePayload.fixedSchedule;
    }
    const updated = await this.attendanceConfigModel.findOneAndUpdate(
      { key: ATTENDANCE_CONFIG_KEY },
      updatePayload,
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
      isActive: shift.isActive ?? true,
      assignedAreas: shift.assignedAreas ?? [],
      assignedCargos: shift.assignedCargos ?? []
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
      if (timeSlot && typeof timeSlot === 'object' && 'startTime' in timeSlot && 'endTime' in timeSlot) {
        this.validateTimeSlot(timeSlot as TimeSlot, `Fixed schedule ${day}`);
      }
    }
    
    // Validación de almuerzo (opcional): si hay rango, se valida; si no hay rango pero está habilitado, se permite como "flexible"
    if (schedule.lunchBreakEnabled && schedule.lunchBreak) {
      this.validateTimeSlot(schedule.lunchBreak, 'Horario de almuerzo');

      // El almuerzo (si se define un rango) debe estar contenido dentro del horario de cada día activo
      const referenceDays = days.filter(d => (schedule as any)[d]);
      for (const d of referenceDays) {
        const daySlot = (schedule as any)[d] as TimeSlot;
        if (!daySlot) continue;
        const s1 = this.timeToMinutes(schedule.lunchBreak.startTime);
        const e1 = this.timeToMinutes(schedule.lunchBreak.endTime);
        const s2 = this.timeToMinutes(daySlot.startTime);
        const e2 = this.timeToMinutes(daySlot.endTime);
        // Si el día no cruza medianoche, exigimos contención; si cruza, omitimos esta restricción
        if (e2 > s2) {
          if (!(s2 <= s1 && e1 <= e2)) {
            throw new Error(`El almuerzo (${schedule.lunchBreak.startTime}-${schedule.lunchBreak.endTime}) debe estar dentro del horario de ${d} (${daySlot.startTime}-${daySlot.endTime})`);
          }
        }
        const lunchDuration = e1 <= s1 ? (24*60 - s1 + e1) : (e1 - s1);
        if (lunchDuration < 15) {
          throw new Error('La duración del almuerzo debe ser al menos 15 minutos');
        }
        if (lunchDuration > 180) {
          throw new Error('La duración del almuerzo no puede exceder 180 minutos');
        }
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

  // === ENABLED-FROM MANAGEMENT ===

  async getAttendanceEnabledFrom(): Promise<Date | undefined> {
    const config = await this.getAttendanceConfig();
    return config.attendanceEnabledFrom as any;
  }

  async setAttendanceEnabledFrom(isoDate: string | null, updatedBy?: string) {
    let attendanceEnabledFrom: Date | undefined;
    if (isoDate) {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) throw new BadRequestException('Invalid date');
      attendanceEnabledFrom = d;
    }
    return this.updateAttendanceConfig({ attendanceEnabledFrom: attendanceEnabledFrom ? attendanceEnabledFrom.toISOString() : undefined }, updatedBy);
  }

  isAttendanceAllowed(at: Date = new Date(), enabledFrom?: Date | undefined): boolean {
    const from = enabledFrom ?? undefined;
    if (!from) return true;
    return at.getTime() >= from.getTime();
  }

  async ensureAttendanceAllowed(at: Date = new Date()) {
    const from = await this.getAttendanceEnabledFrom();
    if (!this.isAttendanceAllowed(at, from || undefined)) {
      throw new BadRequestException('Attendance marking is not allowed before the configured start date/time');
    }
  }

  private async createDefaultConfiguration(updatedBy?: string) {
    const defaultConfig: Omit<AttendanceConfigEntity, '_id' | 'createdAt' | 'updatedAt'> = {
      key: ATTENDANCE_CONFIG_KEY,
      fixedScheduleEnabled: true,
      rotatingShiftsEnabled: true,
      attendanceEnabledFrom: undefined,
      fixedSchedule: {
        monday: { startTime: '09:00', endTime: '18:00' },
        tuesday: { startTime: '09:00', endTime: '18:00' },
        wednesday: { startTime: '09:00', endTime: '18:00' },
        thursday: { startTime: '09:00', endTime: '18:00' },
        friday: { startTime: '09:00', endTime: '18:00' },
        saturday: { startTime: '09:00', endTime: '14:00' },
        sunday: undefined,
        assignedAreas: [],
        assignedCargos: []
      },
      rotatingShifts: [
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
      ],
      breakDurationMinutes: 30,
      toleranceMinutes: 15,
      weekendEnabled: true,
      overtimeEnabled: false,
      timezone: 'America/Bogota',
      description: 'Configuración de asistencia con horarios fijos y turnos rotativos disponibles',
      supernumeraryMode: 'REPLACEMENT',
      allowedReplacementShifts: ['shift_am', 'shift_pm', 'shift_madrugada'],
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

  // === AREA AND CARGO ASSIGNMENTS ===

  async assignAreasToShift(shiftId: string, areaIds: string[], updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    const shiftIndex = config.rotatingShifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    // Validate area IDs (basic validation)
    if (!Array.isArray(areaIds)) {
      throw new BadRequestException('Area IDs must be an array');
    }

    const updatedShifts = config.rotatingShifts.map((shift, index) => 
      index === shiftIndex 
        ? { ...shift, assignedAreas: [...new Set(areaIds)] } // Remove duplicates
        : shift
    );

    return this.updateAttendanceConfig({ rotatingShifts: updatedShifts }, updatedBy);
  }

  async assignCargosToShift(shiftId: string, cargoIds: string[], updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    const shiftIndex = config.rotatingShifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    // Validate cargo IDs (basic validation)
    if (!Array.isArray(cargoIds)) {
      throw new BadRequestException('Cargo IDs must be an array');
    }

    const updatedShifts = config.rotatingShifts.map((shift, index) => 
      index === shiftIndex 
        ? { ...shift, assignedCargos: [...new Set(cargoIds)] } // Remove duplicates
        : shift
    );

    return this.updateAttendanceConfig({ rotatingShifts: updatedShifts }, updatedBy);
  }

  async removeAreaFromShift(shiftId: string, areaId: string, updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    const shiftIndex = config.rotatingShifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    const shift = config.rotatingShifts[shiftIndex];
    const updatedAreas = shift.assignedAreas?.filter(id => id !== areaId) || [];

    const updatedShifts = config.rotatingShifts.map((s, index) => 
      index === shiftIndex 
        ? { ...s, assignedAreas: updatedAreas }
        : s
    );

    return this.updateAttendanceConfig({ rotatingShifts: updatedShifts }, updatedBy);
  }

  async removeCargoFromShift(shiftId: string, cargoId: string, updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    const shiftIndex = config.rotatingShifts.findIndex(s => s.id === shiftId);
    if (shiftIndex === -1) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    const shift = config.rotatingShifts[shiftIndex];
    const updatedCargos = shift.assignedCargos?.filter(id => id !== cargoId) || [];

    const updatedShifts = config.rotatingShifts.map((s, index) => 
      index === shiftIndex 
        ? { ...s, assignedCargos: updatedCargos }
        : s
    );

    return this.updateAttendanceConfig({ rotatingShifts: updatedShifts }, updatedBy);
  }

  async getShiftsByArea(areaId: string) {
    const config = await this.getAttendanceConfig();
    return config.rotatingShifts.filter(shift => 
      shift.assignedAreas?.includes(areaId)
    );
  }

  async getShiftsByCargo(cargoId: string) {
    const config = await this.getAttendanceConfig();
    return config.rotatingShifts.filter(shift => 
      shift.assignedCargos?.includes(cargoId)
    );
  }

  async getShiftAssignments(shiftId: string) {
    const config = await this.getAttendanceConfig();
    const shift = config.rotatingShifts.find(s => s.id === shiftId);
    
    if (!shift) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    return {
      assignedAreas: shift.assignedAreas || [],
      assignedCargos: shift.assignedCargos || []
    };
  }

  // === FIXED SCHEDULE ASSIGNMENTS ===

  async assignAreasToFixedSchedule(areaIds: string[], updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    if (!config.fixedSchedule) {
      throw new BadRequestException('Fixed schedule is not configured');
    }

    // Validate area IDs (basic validation)
    if (!Array.isArray(areaIds)) {
      throw new BadRequestException('Area IDs must be an array');
    }

    const updatedFixedSchedule = {
      ...config.fixedSchedule,
      assignedAreas: [...new Set(areaIds)] // Remove duplicates
    };

    return this.updateAttendanceConfig({ fixedSchedule: updatedFixedSchedule }, updatedBy);
  }

  async assignCargosToFixedSchedule(cargoIds: string[], updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    if (!config.fixedSchedule) {
      throw new BadRequestException('Fixed schedule is not configured');
    }

    // Validate cargo IDs (basic validation)
    if (!Array.isArray(cargoIds)) {
      throw new BadRequestException('Cargo IDs must be an array');
    }

    const updatedFixedSchedule = {
      ...config.fixedSchedule,
      assignedCargos: [...new Set(cargoIds)] // Remove duplicates
    };

    return this.updateAttendanceConfig({ fixedSchedule: updatedFixedSchedule }, updatedBy);
  }

  async removeAreaFromFixedSchedule(areaId: string, updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    if (!config.fixedSchedule) {
      throw new BadRequestException('Fixed schedule is not configured');
    }

    const updatedAreas = config.fixedSchedule.assignedAreas?.filter(id => id !== areaId) || [];
    const updatedFixedSchedule = {
      ...config.fixedSchedule,
      assignedAreas: updatedAreas
    };

    return this.updateAttendanceConfig({ fixedSchedule: updatedFixedSchedule }, updatedBy);
  }

  async removeCargoFromFixedSchedule(cargoId: string, updatedBy?: string) {
    const config = await this.getAttendanceConfig();
    
    if (!config.fixedSchedule) {
      throw new BadRequestException('Fixed schedule is not configured');
    }

    const updatedCargos = config.fixedSchedule.assignedCargos?.filter(id => id !== cargoId) || [];
    const updatedFixedSchedule = {
      ...config.fixedSchedule,
      assignedCargos: updatedCargos
    };

    return this.updateAttendanceConfig({ fixedSchedule: updatedFixedSchedule }, updatedBy);
  }

  async getFixedScheduleAssignments() {
    const config = await this.getAttendanceConfig();
    
    if (!config.fixedSchedule) {
      throw new BadRequestException('Fixed schedule is not configured');
    }

    return {
      assignedAreas: config.fixedSchedule.assignedAreas || [],
      assignedCargos: config.fixedSchedule.assignedCargos || []
    };
  }

  // === UNIFIED ASSIGNMENT METHODS ===

  async getAssignmentsByScheduleType(scheduleType: 'FIXED' | 'ROTATING', shiftId?: string) {
    if (scheduleType === 'FIXED') {
      return this.getFixedScheduleAssignments();
    } else if (scheduleType === 'ROTATING' && shiftId) {
      return this.getShiftAssignments(shiftId);
    } else {
      throw new BadRequestException('Shift ID is required for rotating schedule assignments');
    }
  }

  async assignAreasByScheduleType(scheduleType: 'FIXED' | 'ROTATING', areaIds: string[], shiftId?: string, updatedBy?: string) {
    if (scheduleType === 'FIXED') {
      return this.assignAreasToFixedSchedule(areaIds, updatedBy);
    } else if (scheduleType === 'ROTATING' && shiftId) {
      return this.assignAreasToShift(shiftId, areaIds, updatedBy);
    } else {
      throw new BadRequestException('Shift ID is required for rotating schedule assignments');
    }
  }

  async assignCargosByScheduleType(scheduleType: 'FIXED' | 'ROTATING', cargoIds: string[], shiftId?: string, updatedBy?: string) {
    if (scheduleType === 'FIXED') {
      return this.assignCargosToFixedSchedule(cargoIds, updatedBy);
    } else if (scheduleType === 'ROTATING' && shiftId) {
      return this.assignCargosToShift(shiftId, cargoIds, updatedBy);
    } else {
      throw new BadRequestException('Shift ID is required for rotating schedule assignments');
    }
  }
}
