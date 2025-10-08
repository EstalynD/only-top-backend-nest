import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendanceEntity, AttendanceStatus, AttendanceType } from './attendance.schema.js';
import { AttendanceConfigService } from '../../sistema/attendance-config.service.js';
import type { Shift, TimeSlot, FixedSchedule } from '../../sistema/attendance-config.schema.js';
import { EmpleadosService } from '../empleados.service.js';

export interface MarkAttendanceDto {
  type: AttendanceType;
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
}

export interface AttendanceSummary {
  userId: string;
  empleadoId: string;
  empleadoNombre?: string;
  date: string;
  checkIn?: Date;
  checkOut?: Date;
  breakStart?: Date;
  breakEnd?: Date;
  totalHours: number;
  workedHours: number;
  breakHours: number;
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes?: number;
  overtimeMinutes?: number;
  expectedHours?: number;
  scheduleName?: string;
  areaName?: string;
  cargoName?: string;
}

export interface AssignedScheduleInfo {
  type: 'FIXED' | 'ROTATING' | 'DEFAULT';
  schedule: FixedSchedule | Shift;
  name: string;
  description: string;
}

export interface UserScheduleInfo {
  userId: string;
  scheduleType: 'FIXED' | 'ROTATING' | null;
  assignedSchedule: AssignedScheduleInfo;
  areaId: string;
  cargoId: string;
  toleranceMinutes: number;
  breakDurationMinutes: number;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectModel(AttendanceEntity.name) private readonly attendanceModel: Model<AttendanceEntity>,
    private readonly attendanceConfigService: AttendanceConfigService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  // === MARK ATTENDANCE ===

  async markAttendance(userId: string, dto: MarkAttendanceDto, userInfo?: any) {
    const now = new Date();
    
    // Verify attendance is enabled globally
    await this.attendanceConfigService.ensureAttendanceAllowed(now);
    
    // Get employee info
    const empleado = await this.empleadosService.findEmpleadoById(userId);
    if (!empleado) {
      throw new NotFoundException(`Employee with ID ${userId} not found`);
    }

    // Validate attendance type sequence
    await this.validateAttendanceType(userId, dto.type, now);
    
    // Get user's schedule information
    const scheduleInfo = await this.getUserScheduleInfo(userId, empleado, now);
    
    // Validate that marking is within allowed working hours
    await this.validateWorkingHours(dto.type, now, scheduleInfo);
    
    // Determine status based on schedule
    const status = await this.determineAttendanceStatus(dto.type, now, scheduleInfo);
    
    // Extract area and cargo IDs
    const areaId = typeof empleado.areaId === 'object' && empleado.areaId 
      ? (empleado.areaId as any)._id?.toString() || (empleado.areaId as any).toString()
      : empleado.areaId ? String(empleado.areaId) : undefined;
    const cargoId = typeof empleado.cargoId === 'object' && empleado.cargoId
      ? (empleado.cargoId as any)._id?.toString() || (empleado.cargoId as any).toString()
      : empleado.cargoId ? String(empleado.cargoId) : undefined;

    // Create attendance record
    const attendanceRecord = new this.attendanceModel({
      userId,
      empleadoId: empleado._id,
      type: dto.type,
      timestamp: now,
      status,
      shiftId: scheduleInfo.shiftId,
      areaId,
      cargoId,
      notes: dto.notes,
      location: dto.location,
      deviceInfo: dto.deviceInfo,
      markedBy: userInfo?.username || 'system',
      markedByUserId: userInfo?.id || userId,
      createdBy: userInfo?.username || 'system',
      updatedBy: userInfo?.username || 'system'
    });

    const saved = await attendanceRecord.save();
    
    this.logger.log(`Attendance marked: ${dto.type} for user ${userId} (${empleado.nombre}) at ${now.toISOString()}`);
    
    return {
      id: saved._id.toString(),
      type: saved.type,
      timestamp: saved.timestamp,
      status: saved.status,
      message: this.getAttendanceMessage(dto.type, status, scheduleInfo),
      empleadoNombre: empleado.nombre,
      areaId,
      cargoId
    };
  }

  // === GET ATTENDANCE RECORDS ===

  async getUserAttendance(userId: string, startDate?: Date, endDate?: Date, populate = false) {
    const query: any = { userId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.timestamp.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    let queryBuilder = this.attendanceModel
      .find(query)
      .sort({ timestamp: -1 });

    if (populate) {
      queryBuilder = queryBuilder
        .populate('empleadoId', 'nombre apellido correoElectronico')
        .populate('areaId', 'name code')
        .populate('cargoId', 'name code');
    }

    const records = await queryBuilder.lean();
    return records;
  }

  async getAttendanceSummary(userId: string, date: Date): Promise<AttendanceSummary> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const records = await this.attendanceModel
      .find({
        userId,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      })
      .sort({ timestamp: 1 })
      .populate('empleadoId', 'nombre apellido')
      .populate('areaId', 'name')
      .populate('cargoId', 'name')
      .lean();

    // Get employee info for summary
    let empleadoNombre = 'Unknown';
    let areaName = '';
    let cargoName = '';
    
    if (records.length > 0 && records[0].empleadoId) {
      const emp = records[0].empleadoId as any;
      empleadoNombre = emp.nombre || 'Unknown';
      areaName = records[0].areaId ? (records[0].areaId as any).name : '';
      cargoName = records[0].cargoId ? (records[0].cargoId as any).name : '';
    }

    // Get schedule info for expected hours
    const userScheduleInfo = await this.getUserAssignedSchedule(userId, null).catch(() => null);
    const expectedHours = userScheduleInfo ? this.calculateExpectedHours(userScheduleInfo, date) : 8;

    return this.calculateAttendanceSummary(userId, date, records, empleadoNombre, expectedHours, areaName, cargoName, userScheduleInfo?.scheduleType || null);
  }

  // === SCHEDULE VALIDATION ===

  private async validateAttendanceType(userId: string, type: AttendanceType, timestamp: Date) {
    const todayStart = new Date(timestamp);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(timestamp);
    todayEnd.setHours(23, 59, 59, 999);

    const todayRecords = await this.attendanceModel
      .find({
        userId,
        timestamp: { $gte: todayStart, $lte: todayEnd }
      })
      .sort({ timestamp: 1 })
      .lean();

    const hasCheckIn = todayRecords.some(r => r.type === 'CHECK_IN');
    const hasCheckOut = todayRecords.some(r => r.type === 'CHECK_OUT');
    const activeBreaks = todayRecords.filter(r => r.type === 'BREAK_START' || r.type === 'BREAK_END');
    const hasActiveBreak = activeBreaks.length > 0 && activeBreaks[activeBreaks.length - 1].type === 'BREAK_START';

    switch (type) {
      case 'CHECK_IN':
        if (hasCheckIn) {
          throw new BadRequestException('Ya has marcado entrada hoy');
        }
        break;
      case 'CHECK_OUT':
        if (!hasCheckIn) {
          throw new BadRequestException('Debes marcar entrada antes de marcar salida');
        }
        if (hasCheckOut) {
          throw new BadRequestException('Ya has marcado salida hoy');
        }
        if (hasActiveBreak) {
          throw new BadRequestException('Debes finalizar el descanso antes de marcar salida');
        }
        break;
      case 'BREAK_START':
        if (!hasCheckIn) {
          throw new BadRequestException('Debes marcar entrada antes de iniciar descanso');
        }
        if (hasCheckOut) {
          throw new BadRequestException('No puedes iniciar un descanso después de marcar salida');
        }
        if (hasActiveBreak) {
          throw new BadRequestException('Ya tienes un descanso activo');
        }
        break;
      case 'BREAK_END':
        if (!hasActiveBreak) {
          throw new BadRequestException('No tienes un descanso activo para finalizar');
        }
        break;
    }
  }

  private async validateWorkingHours(type: AttendanceType, timestamp: Date, scheduleInfo: { schedule?: AssignedScheduleInfo; scheduleType?: 'FIXED' | 'ROTATING' }) {
    // Validar solo para CHECK_IN y CHECK_OUT, los breaks pueden ser más flexibles
    if (type !== 'CHECK_IN' && type !== 'CHECK_OUT') {
      return;
    }

    const config = await this.attendanceConfigService.getAttendanceConfig();
    const toleranceMinutes = config.toleranceMinutes || 15;
    
    let workStart: Date | null = null;
    let workEnd: Date | null = null;

    if (scheduleInfo.schedule) {
      const assignedSchedule = scheduleInfo.schedule;
      const schedule = assignedSchedule.schedule;
      
      if (scheduleInfo.scheduleType === 'FIXED' && assignedSchedule.type === 'FIXED') {
        // Fixed schedule
        const fixedSchedule = schedule as FixedSchedule;
        const dayOfWeek = timestamp.getDay();
        const dayKeys: Array<keyof FixedSchedule> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = dayKeys[dayOfWeek];
        const daySchedule = fixedSchedule[dayKey] as TimeSlot | undefined;
        
        if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
          const [startHours, startMinutes] = daySchedule.startTime.split(':').map(Number);
          const [endHours, endMinutes] = daySchedule.endTime.split(':').map(Number);
          
          workStart = new Date(timestamp);
          workStart.setHours(startHours, startMinutes, 0, 0);
          
          workEnd = new Date(timestamp);
          workEnd.setHours(endHours, endMinutes, 0, 0);
          
          // Si el horario cruza medianoche
          if (workEnd < workStart) {
            if (timestamp.getHours() < 12) {
              // Estamos en la madrugada del día siguiente
              workStart.setDate(workStart.getDate() - 1);
            } else {
              // Estamos en la tarde/noche del día anterior
              workEnd.setDate(workEnd.getDate() + 1);
            }
          }
        }
      } else if (scheduleInfo.scheduleType === 'ROTATING' && assignedSchedule.type === 'ROTATING') {
        // Rotating shift
        const rotatingShift = schedule as Shift;
        if (rotatingShift.timeSlot) {
          const [startHours, startMinutes] = rotatingShift.timeSlot.startTime.split(':').map(Number);
          const [endHours, endMinutes] = rotatingShift.timeSlot.endTime.split(':').map(Number);
          
          workStart = new Date(timestamp);
          workStart.setHours(startHours, startMinutes, 0, 0);
          
          workEnd = new Date(timestamp);
          workEnd.setHours(endHours, endMinutes, 0, 0);
          
          // Si el horario cruza medianoche
          if (workEnd < workStart) {
            if (timestamp.getHours() < 12) {
              workStart.setDate(workStart.getDate() - 1);
            } else {
              workEnd.setDate(workEnd.getDate() + 1);
            }
          }
        }
      }
    }

    // Si no hay horario definido, no validamos (permitimos marcación)
    if (!workStart || !workEnd) {
      this.logger.warn(`No work schedule found for validation at ${timestamp.toISOString()}`);
      return;
    }

    // Aplicar tolerancia
    const allowedStart = new Date(workStart.getTime() - toleranceMinutes * 60 * 1000);
    const allowedEnd = new Date(workEnd.getTime() + toleranceMinutes * 60 * 1000);

    // Validar CHECK_IN
    if (type === 'CHECK_IN') {
      if (timestamp < allowedStart) {
        const minutesBefore = Math.floor((allowedStart.getTime() - timestamp.getTime()) / (1000 * 60));
        throw new BadRequestException(
          `No puedes marcar entrada tan temprano. El horario laboral inicia a las ${workStart.toTimeString().substring(0, 5)} (con ${toleranceMinutes} min de tolerancia). ` +
          `Estás intentando marcar ${minutesBefore} minutos antes del horario permitido.`
        );
      }
      if (timestamp > allowedEnd) {
        throw new BadRequestException(
          `No puedes marcar entrada tan tarde. El horario laboral termina a las ${workEnd.toTimeString().substring(0, 5)}. ` +
          `Por favor contacta a tu supervisor.`
        );
      }
    }

    // Validar CHECK_OUT
    if (type === 'CHECK_OUT') {
      if (timestamp < workStart) {
        throw new BadRequestException(
          `No puedes marcar salida antes del inicio del horario laboral (${workStart.toTimeString().substring(0, 5)}).`
        );
      }
      // Permitimos marcar salida después del fin con la tolerancia
      // pero registramos si es muy temprano para el memorando de salida anticipada
    }
  }

  private async getUserScheduleInfo(userId: string, empleado: any, timestamp: Date) {
    // Use provided employee or fetch it
    if (!empleado) {
      empleado = await this.empleadosService.findEmpleadoById(userId).catch(() => null);
    }

    const assigned = await this.getUserAssignedSchedule(userId, empleado ? {
      areaId: typeof empleado.areaId === 'object' ? (empleado.areaId as any)._id?.toString() : empleado.areaId?.toString(),
      cargoId: typeof empleado.cargoId === 'object' ? (empleado.cargoId as any)._id?.toString() : empleado.cargoId?.toString(),
      username: empleado.nombre
    } : undefined);

    const shiftId = assigned?.scheduleType === 'ROTATING' && assigned.assignedSchedule?.schedule
      ? ((assigned.assignedSchedule.schedule as any).id ?? (assigned.assignedSchedule.schedule as any)._id ?? null)
      : null;

    return {
      shiftId,
      areaId: assigned?.areaId ?? null,
      cargoId: assigned?.cargoId ?? null,
      scheduleType: (assigned?.scheduleType ?? 'FIXED') as 'FIXED' | 'ROTATING',
      schedule: assigned?.assignedSchedule
    };
  }

  private async determineAttendanceStatus(
    type: AttendanceType, 
    timestamp: Date, 
    scheduleInfo: { schedule?: AssignedScheduleInfo; scheduleType?: 'FIXED' | 'ROTATING' }
  ): Promise<AttendanceStatus> {
    if (type !== 'CHECK_IN') {
      return 'PRESENT';
    }

    const config = await this.attendanceConfigService.getAttendanceConfig();
    const isLate = this.isLateForCheckIn(timestamp, scheduleInfo, config);
    
    return isLate ? 'LATE' : 'PRESENT';
  }

  private isLateForCheckIn(timestamp: Date, scheduleInfo: { schedule?: AssignedScheduleInfo; scheduleType?: 'FIXED' | 'ROTATING' }, config: any): boolean {
    const toleranceMinutes = config.toleranceMinutes || 15;
    
    let expectedStartTime: Date | null = null;

    if (scheduleInfo.schedule) {
      const assignedSchedule = scheduleInfo.schedule;
      const schedule = assignedSchedule.schedule;
      
      if (scheduleInfo.scheduleType === 'FIXED' && assignedSchedule.type === 'FIXED') {
        // Fixed schedule
        const fixedSchedule = schedule as FixedSchedule;
        const dayOfWeek = timestamp.getDay();
        const dayKeys: Array<keyof FixedSchedule> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = dayKeys[dayOfWeek];
        const daySchedule = fixedSchedule[dayKey] as TimeSlot | undefined;
        
        if (daySchedule && daySchedule.startTime) {
          const [hours, minutes] = daySchedule.startTime.split(':').map(Number);
          expectedStartTime = new Date(timestamp);
          expectedStartTime.setHours(hours, minutes, 0, 0);
        }
      } else if (scheduleInfo.scheduleType === 'ROTATING' && assignedSchedule.type === 'ROTATING') {
        // Rotating shift
        const rotatingShift = schedule as Shift;
        if (rotatingShift.timeSlot) {
          const [hours, minutes] = rotatingShift.timeSlot.startTime.split(':').map(Number);
          expectedStartTime = new Date(timestamp);
          expectedStartTime.setHours(hours, minutes, 0, 0);
        }
      }
    }

    if (!expectedStartTime) {
      // Default to 9:00 AM
      expectedStartTime = new Date(timestamp);
      expectedStartTime.setHours(9, 0, 0, 0);
    }

    const diffMinutes = (timestamp.getTime() - expectedStartTime.getTime()) / (1000 * 60);
    return diffMinutes > toleranceMinutes;
  }

  private calculateAttendanceSummary(
    userId: string, 
    date: Date, 
    records: any[],
    empleadoNombre: string,
    expectedHours: number,
    areaName: string,
    cargoName: string,
    scheduleType: 'FIXED' | 'ROTATING' | null
  ): AttendanceSummary {
    const checkIn = records.find(r => r.type === 'CHECK_IN');
    const checkOut = records.find(r => r.type === 'CHECK_OUT');
    const breakStarts = records.filter(r => r.type === 'BREAK_START');
    const breakEnds = records.filter(r => r.type === 'BREAK_END');

    let totalHours = 0;
    let breakHours = 0;
    let isLate = false;
    let lateMinutes = 0;
    let overtimeMinutes = 0;

    // Calculate work hours
    if (checkIn && checkOut) {
      const startTime = new Date(checkIn.timestamp);
      const endTime = new Date(checkOut.timestamp);
      totalHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      // Calculate break time
      for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
        const breakStart = new Date(breakStarts[i].timestamp);
        const breakEnd = new Date(breakEnds[i].timestamp);
        breakHours += (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
      }

      // Calculate overtime
      const workedHours = totalHours - breakHours;
      if (workedHours > expectedHours) {
        overtimeMinutes = Math.round((workedHours - expectedHours) * 60);
      }
    }

    // Check if late
    if (checkIn && checkIn.status === 'LATE') {
      isLate = true;
      // Calculate actual late minutes based on expected time
      const expectedStart = new Date(checkIn.timestamp);
      expectedStart.setHours(9, 0, 0, 0); // Default, should use schedule
      lateMinutes = Math.max(0, Math.round((new Date(checkIn.timestamp).getTime() - expectedStart.getTime()) / (1000 * 60)));
    }

    const workedHours = totalHours - breakHours;

    return {
      userId,
      empleadoId: records[0]?.empleadoId?._id || records[0]?.empleadoId || userId,
      empleadoNombre,
      date: date.toISOString().split('T')[0],
      checkIn: checkIn?.timestamp,
      checkOut: checkOut?.timestamp,
      breakStart: breakStarts[0]?.timestamp,
      breakEnd: breakEnds[0]?.timestamp,
      totalHours: Math.round(totalHours * 100) / 100,
      workedHours: Math.round(workedHours * 100) / 100,
      breakHours: Math.round(breakHours * 100) / 100,
      status: checkIn?.status || 'ABSENT',
      isLate,
      lateMinutes: isLate ? lateMinutes : undefined,
      overtimeMinutes: overtimeMinutes > 0 ? overtimeMinutes : undefined,
      expectedHours,
      scheduleName: scheduleType || 'DEFAULT',
      areaName,
      cargoName
    };
  }

  private getAttendanceMessage(type: AttendanceType, status: AttendanceStatus, scheduleInfo: any): string {
    const messages = {
      'CHECK_IN': {
        'PRESENT': 'Entrada registrada correctamente',
        'LATE': 'Entrada registrada (con retraso)',
        'ABSENT': 'Entrada no registrada',
        'EXCUSED': 'Entrada registrada (justificada)'
      },
      'CHECK_OUT': {
        'PRESENT': 'Salida registrada correctamente',
        'LATE': 'Salida registrada',
        'ABSENT': 'Salida no registrada',
        'EXCUSED': 'Salida registrada (justificada)'
      },
      'BREAK_START': {
        'PRESENT': 'Descanso iniciado',
        'LATE': 'Descanso iniciado',
        'ABSENT': 'Descanso no iniciado',
        'EXCUSED': 'Descanso iniciado (justificado)'
      },
      'BREAK_END': {
        'PRESENT': 'Descanso finalizado',
        'LATE': 'Descanso finalizado',
        'ABSENT': 'Descanso no finalizado',
        'EXCUSED': 'Descanso finalizado (justificado)'
      }
    };

    return messages[type][status] || 'Registro de asistencia procesado';
  }

  private calculateExpectedHours(scheduleInfo: UserScheduleInfo, date: Date): number {
    if (!scheduleInfo.assignedSchedule) return 8;

    const assignedSchedule = scheduleInfo.assignedSchedule;
    const schedule = assignedSchedule.schedule;

    if (scheduleInfo.scheduleType === 'FIXED' && assignedSchedule.type === 'FIXED') {
      const fixedSchedule = schedule as FixedSchedule;
      const dayOfWeek = date.getDay();
      const dayKeys: Array<keyof FixedSchedule> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayKey = dayKeys[dayOfWeek];
      const daySchedule = fixedSchedule[dayKey] as TimeSlot | undefined;

      if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
        const startMinutes = this.timeToMinutes(daySchedule.startTime);
        const endMinutes = this.timeToMinutes(daySchedule.endTime);
        const duration = endMinutes > startMinutes ? endMinutes - startMinutes : (24 * 60 - startMinutes + endMinutes);
        
        // Subtract lunch break if enabled
        if (fixedSchedule.lunchBreakEnabled && fixedSchedule.lunchBreak) {
          const lunchStart = this.timeToMinutes(fixedSchedule.lunchBreak.startTime);
          const lunchEnd = this.timeToMinutes(fixedSchedule.lunchBreak.endTime);
          const lunchDuration = lunchEnd > lunchStart ? lunchEnd - lunchStart : 0;
          return Math.round((duration - lunchDuration) / 60 * 100) / 100;
        }
        
        return Math.round(duration / 60 * 100) / 100;
      }
    } else if (scheduleInfo.scheduleType === 'ROTATING' && assignedSchedule.type === 'ROTATING') {
      const rotatingShift = schedule as Shift;
      if (rotatingShift.timeSlot) {
        const startMinutes = this.timeToMinutes(rotatingShift.timeSlot.startTime);
        const endMinutes = this.timeToMinutes(rotatingShift.timeSlot.endTime);
        const duration = endMinutes > startMinutes ? endMinutes - startMinutes : (24 * 60 - startMinutes + endMinutes);
        return Math.round(duration / 60 * 100) / 100;
      }
    }

    return 8; // Default
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // === CONFIGURATION ===

  async getAttendanceConfig() {
    return this.attendanceConfigService.getAttendanceConfig();
  }

  // === USER SCHEDULE INFORMATION ===

  async getUserAssignedSchedule(userId: string, userInfo?: any): Promise<UserScheduleInfo | null> {
    const config = await this.attendanceConfigService.getAttendanceConfig();
    
    const normalizeId = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        if (val._id) return String(val._id);
        if (val.id) return String(val.id);
      }
      return null;
    };

    let userAreaId = normalizeId(userInfo?.areaId);
    let userCargoId = normalizeId(userInfo?.cargoId);

    // Fetch from database if not provided
    if (!userAreaId || !userCargoId) {
      try {
        const empleado = await this.empleadosService.findEmpleadoById(userId);
        userAreaId = userAreaId || normalizeId(empleado.areaId);
        userCargoId = userCargoId || normalizeId(empleado.cargoId);
      } catch (err) {
        this.logger.warn(`Could not get employee ${userId} for schedule: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Fallback: get from last attendance record
    if (!userAreaId || !userCargoId) {
      const lastRecord = await this.attendanceModel
        .findOne({ userId })
        .sort({ timestamp: -1 })
        .select({ areaId: 1, cargoId: 1 })
        .lean();
      if (lastRecord) {
        userAreaId = userAreaId || normalizeId(lastRecord.areaId);
        userCargoId = userCargoId || normalizeId(lastRecord.cargoId);
      }
    }

    this.logger.log(`Getting schedule for user ${userId}, area: ${userAreaId}, cargo: ${userCargoId}`);
    
    let assignedSchedule: AssignedScheduleInfo | null = null;
    let scheduleType: 'FIXED' | 'ROTATING' | null = null;
    
    // Check fixed schedule assignment
    if (config.fixedScheduleEnabled && config.fixedSchedule) {
      const fixedAssignments = config.fixedSchedule.assignedAreas || [];
      const fixedCargoAssignments = config.fixedSchedule.assignedCargos || [];
      const appliesToAll = fixedAssignments.length === 0 && fixedCargoAssignments.length === 0;
      
      const matchesFixedArea = userAreaId ? fixedAssignments.includes(userAreaId) : false;
      const matchesFixedCargo = userCargoId ? fixedCargoAssignments.includes(userCargoId) : false;

      if (appliesToAll || matchesFixedArea || matchesFixedCargo) {
        assignedSchedule = {
          type: 'FIXED',
          schedule: config.fixedSchedule,
          name: 'Horario Fijo',
          description: 'Horario fijo de lunes a viernes'
        };
        scheduleType = 'FIXED';
      }
    }
    
    // Check rotating shifts assignment
    if (!assignedSchedule && config.rotatingShiftsEnabled && config.rotatingShifts) {
      const userShifts = config.rotatingShifts.filter(shift => {
        if (!shift.isActive) return false;
        const areaMatch = userAreaId ? (shift.assignedAreas && shift.assignedAreas.includes(userAreaId)) : false;
        const cargoMatch = userCargoId ? (shift.assignedCargos && shift.assignedCargos.includes(userCargoId)) : false;
        return Boolean(areaMatch || cargoMatch);
      });
      
      if (userShifts.length > 0) {
        const activeShift = userShifts[0];
        assignedSchedule = {
          type: 'ROTATING',
          schedule: activeShift,
          name: activeShift.name,
          description: activeShift.description || `Turno ${activeShift.type}`
        };
        scheduleType = 'ROTATING';
      }
    }
    
    // Default schedule if no assignment
    if (!assignedSchedule) {
      assignedSchedule = {
        type: 'DEFAULT',
        schedule: {
          monday: { startTime: '09:00', endTime: '18:00' },
          tuesday: { startTime: '09:00', endTime: '18:00' },
          wednesday: { startTime: '09:00', endTime: '18:00' },
          thursday: { startTime: '09:00', endTime: '18:00' },
          friday: { startTime: '09:00', endTime: '18:00' },
          saturday: { startTime: '09:00', endTime: '14:00' },
          sunday: null
        } as any,
        name: 'Horario Estándar',
        description: 'Horario estándar de oficina'
      };
      scheduleType = 'FIXED';
    }
    
    return {
      userId,
      scheduleType,
      assignedSchedule,
      areaId: userAreaId!,
      cargoId: userCargoId!,
      toleranceMinutes: config.toleranceMinutes || 15,
      breakDurationMinutes: config.breakDurationMinutes || 30
    };
  }

  // === TIME REMAINING CALCULATIONS ===

  async getTimeRemainingForCheckIn(userId: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayCheckIn = await this.attendanceModel.findOne({
      userId,
      type: 'CHECK_IN',
      timestamp: { $gte: today }
    });

    if (todayCheckIn) {
      return null;
    }

    const scheduleInfo = await this.getUserScheduleInfo(userId, null, now);
    const config = await this.attendanceConfigService.getAttendanceConfig();
    
    const toleranceMinutes = config.toleranceMinutes || 15;
    const deadline = new Date(today);
    deadline.setHours(9, toleranceMinutes, 0, 0);
    
    const timeRemaining = deadline.getTime() - now.getTime();
    
    if (timeRemaining <= 0) {
      return null;
    }

    return {
      minutesRemaining: Math.ceil(timeRemaining / (1000 * 60)),
      deadline: deadline,
      isUrgent: timeRemaining <= 15 * 60 * 1000
    };
  }

  // === ATTENDANCE REPORTS ===

  async getAttendanceReport(userId: string, startDate: Date, endDate: Date): Promise<AttendanceSummary[]> {
    const dailySummaries: AttendanceSummary[] = [];
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const summary = await this.getAttendanceSummary(userId, new Date(currentDate));
      dailySummaries.push(summary);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailySummaries;
  }
}
