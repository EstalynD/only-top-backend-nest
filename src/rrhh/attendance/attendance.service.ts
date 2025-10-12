import { Injectable, Logger, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendanceEntity, AttendanceStatus, AttendanceType } from './attendance.schema.js';
import { AttendanceConfigService } from '../../sistema/attendance-config.service.js';
import type { Shift, TimeSlot, FixedSchedule } from '../../sistema/attendance-config.schema.js';
import { EmpleadosService } from '../empleados.service.js';
import { MemorandumService } from '../memorandum/memorandum.service.js';
import {
  ShiftStatus,
  AnomalyType,
  ShiftStatusInfo,
  AnomalyDetectionResult,
  DEFAULT_TOLERANCE_MINUTES,
  EARLY_DEPARTURE_TOLERANCE_MINUTES,
  CHECK_IN_EARLY_MARGIN_MINUTES,
  CHECK_OUT_LATE_MARGIN_MINUTES,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_DESCRIPTIONS,
  USER_MESSAGES,
  SUPERNUMERARY_CARGO_CODES,
} from './attendance.constants.js';

// Tipo para información de horario del usuario
interface UserScheduleInfoInternal {
  schedule?: AssignedScheduleInfo;
  scheduleType?: 'FIXED' | 'ROTATING';
  shiftId?: string | null;
  areaId?: string | null;
  cargoId?: string | null;
  multipleShifts?: boolean;
  allAssignedShifts?: any[];
}

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
  // NUEVO: lista de modelos asignadas a este turno (para turnos rotativos)
  modelosAsignados?: string[];
}

export interface UserScheduleInfo {
  userId: string;
  scheduleType: 'FIXED' | 'ROTATING' | null;
  assignedSchedule: AssignedScheduleInfo;
  areaId: string;
  cargoId: string;
  toleranceMinutes: number;
  breakDurationMinutes: number;
  isUsingDefaultSchedule?: boolean;
  configurationMessage?: string;
  // NUEVO: indica si el usuario tiene múltiples turnos rotativos asociados vía modelos
  multipleShifts?: boolean;
  // Lista completa de turnos asignados (cuando multipleShifts=true) ordenados por hora de inicio normalizada
  allAssignedShifts?: AssignedScheduleInfo[];
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectModel(AttendanceEntity.name) private readonly attendanceModel: Model<AttendanceEntity>,
    private readonly attendanceConfigService: AttendanceConfigService,
    private readonly empleadosService: EmpleadosService,
    @InjectModel('ModeloEntity') private readonly modeloModel: Model<any>,
    @Inject(forwardRef(() => MemorandumService))
    private readonly memorandumService: MemorandumService,
  ) {}

  // === MARK ATTENDANCE ===

  async markAttendance(userId: string, dto: MarkAttendanceDto, userInfo?: any) {
    const now = new Date();
    
    // Verify attendance is enabled globally
    await this.attendanceConfigService.ensureAttendanceAllowed(now);
    
    // Get employee info - userId es el ID de la cuenta de usuario
    const empleado = await this.empleadosService.findEmpleadoByUserId(userId);
    if (!empleado) {
      throw new NotFoundException(`Employee for user ID ${userId} not found`);
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

    // Determine if justification is needed
    const needsJustification = status === 'LATE' || status === 'ABSENT';

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
      justificationStatus: needsJustification ? 'PENDING' : undefined,
      markedBy: userInfo?.username || 'system',
      markedByUserId: userInfo?.id || userId,
      createdBy: userInfo?.username || 'system',
      updatedBy: userInfo?.username || 'system'
    });

    const saved = await attendanceRecord.save();
    
    this.logger.log(`Attendance marked: ${dto.type} for user ${userId} (${empleado.nombre}) at ${now.toISOString()}`);
    
    // === AUTOMATIC ANOMALY DETECTION & MEMORANDUM GENERATION ===
    try {
      // Solo detectar anomalías para CHECK_IN y CHECK_OUT
      if (dto.type === 'CHECK_IN' || dto.type === 'CHECK_OUT') {
        // detectAnomaly obtiene el schedule internamente si no se pasa
        const anomaly = await this.detectAnomaly(
          userId,
          dto.type,
          now
        );

        // Si hay anomalía (tardanza o salida anticipada), crear memorando
        if (anomaly.hasAnomaly && anomaly.anomalyType) {
          await this.memorandumService.createMemorandum({
            type: anomaly.anomalyType,
            userId,
            empleadoId: empleado._id.toString(),
            incidentDate: now,
            expectedTime: anomaly.details?.expectedTime,
            actualTime: anomaly.details?.actualTime,
            delayMinutes: anomaly.details?.delayMinutes,
            earlyMinutes: anomaly.details?.earlyMinutes,
            shiftId: scheduleInfo.shiftId?.toString(),
            shiftName: scheduleInfo.schedule?.name,
            attendanceRecordId: saved._id.toString(),
          }, 'SISTEMA_AUTO', userInfo?.id || userId);

          this.logger.log(
            `Memorandum created automatically for ${anomaly.anomalyType}: User ${userId} (${empleado.nombre}), deviation: ${anomaly.details?.delayMinutes || anomaly.details?.earlyMinutes} minutes`
          );
        }
      }
    } catch (error) {
      // Log error pero no fallar el markeo de asistencia
      this.logger.error(
        `Error creating automatic memorandum for user ${userId}: ${error.message}`,
        error.stack
      );
    }
    
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

  /**
   * Marca asistencia usando el ID del empleado directamente (para uso administrativo)
   */
  async markAttendanceByEmployeeId(employeeId: string, dto: MarkAttendanceDto, userInfo?: any) {
    const now = new Date();
    
    // Verify attendance is enabled globally
    await this.attendanceConfigService.ensureAttendanceAllowed(now);
    
    // Get employee info directly by employee ID
    const empleado = await this.empleadosService.findEmpleadoById(employeeId);
    if (!empleado) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    // Get the userId from the employee's user account
    if (!empleado.userAccount) {
      throw new NotFoundException(`Employee ${empleado.nombre} ${empleado.apellido} does not have an associated user account`);
    }

    const userId = empleado.userAccount.id;

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

    // Determine if justification is needed
    const needsJustification = status === 'LATE' || status === 'ABSENT';

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
      justificationStatus: needsJustification ? 'PENDING' : undefined,
      markedBy: userInfo?.username || 'system',
      markedByUserId: userInfo?.id || userId,
      createdBy: userInfo?.username || 'system',
      updatedBy: userInfo?.username || 'system'
    });

    const saved = await attendanceRecord.save();
    
    this.logger.log(`Attendance marked by admin: ${dto.type} for employee ${employeeId} (${empleado.nombre}) at ${now.toISOString()}`);
    
    // === AUTOMATIC ANOMALY DETECTION & MEMORANDUM GENERATION ===
    try {
      // Solo detectar anomalías para CHECK_IN y CHECK_OUT
      if (dto.type === 'CHECK_IN' || dto.type === 'CHECK_OUT') {
        const anomaly = await this.detectAnomaly(
          userId,
          dto.type,
          now
        );

        // Si hay anomalía (tardanza o salida anticipada), crear memorando
        if (anomaly.hasAnomaly && anomaly.anomalyType) {
          await this.memorandumService.createMemorandum({
            type: anomaly.anomalyType,
            userId,
            empleadoId: empleado._id.toString(),
            incidentDate: now,
            expectedTime: anomaly.details?.expectedTime,
            actualTime: anomaly.details?.actualTime,
            delayMinutes: anomaly.details?.delayMinutes,
            earlyMinutes: anomaly.details?.earlyMinutes,
            shiftId: scheduleInfo.shiftId?.toString(),
            shiftName: scheduleInfo.schedule?.name,
            attendanceRecordId: saved._id.toString(),
          }, userInfo?.username || 'ADMIN', userInfo?.id);

          this.logger.log(
            `Memorandum created automatically (by admin) for ${anomaly.anomalyType}: User ${userId} (${empleado.nombre}), deviation: ${anomaly.details?.delayMinutes || anomaly.details?.earlyMinutes} minutes`
          );
        }
      }
    } catch (error) {
      // Log error pero no fallar el markeo de asistencia
      this.logger.error(
        `Error creating automatic memorandum for user ${userId}: ${error.message}`,
        error.stack
      );
    }
    
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
    // Construir query base: buscar por userId O empleadoId (flexible)
    const query: any = {
      $or: [
        { userId },
        { empleadoId: userId }
      ]
    };
    
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

  /**
   * Obtiene registros de asistencia por empleadoId
   * Método específico para búsquedas administrativas por empleado
   */
  async getEmployeeAttendance(empleadoId: string, startDate?: Date, endDate?: Date, populate = false) {
    const query: any = {
      empleadoId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = startDate;
      }
      if (endDate) {
        query.timestamp.$lte = endDate;
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

    // Buscar por userId (ya que ahora pasamos userId desde el frontend)
    const records = await this.attendanceModel
      .find({
        userId: userId, // userId es el userId del empleado
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      })
      .sort({ timestamp: 1 })
      .populate('empleadoId', 'nombre apellido')
      .populate('areaId', 'name')
      .populate('cargoId', 'name')
      .lean();


    // Datos de empleado para el resumen (si no hay registros del día debemos buscarlos igual)
    let empleadoNombre = 'Unknown';
    let areaName = '';
    let cargoName = '';
    let empleadoIdForSummary: string | null = null;

    if (records.length > 0 && records[0].empleadoId) {
      // Tenemos al menos un registro, usamos los datos poblados
      const emp = records[0].empleadoId as any;
      empleadoNombre = emp.nombre || 'Unknown';
      areaName = records[0].areaId ? (records[0].areaId as any).name : '';
      cargoName = records[0].cargoId ? (records[0].cargoId as any).name : '';
      empleadoIdForSummary = emp._id ? String(emp._id) : (records[0] as any).empleadoId;
    } else {
      // No hay marcas hoy: buscamos el empleado por userId (ya que ahora pasamos userId desde el frontend)
      try {
        const empleado = await this.empleadosService.findEmpleadoByUserId(userId); // userId es el userId del empleado
        empleadoNombre = empleado.nombre || 'Unknown';
        empleadoIdForSummary = String(empleado._id);
        if (empleado.areaId && typeof empleado.areaId === 'object') {
          areaName = empleado.areaId.name || '';
        }
        if (empleado.cargoId && typeof empleado.cargoId === 'object') {
          cargoName = empleado.cargoId.name || '';
        }
      } catch (err) {
        this.logger.warn(`No se pudo obtener empleado para resumen (userId ${userId}): ${err instanceof Error ? err.message : err}`);
      }
    }

    // Get schedule info for expected hours - ya tenemos el userId correcto
    const userScheduleInfo = await this.getUserAssignedSchedule(userId, null).catch(() => null);
    const expectedHours = userScheduleInfo ? this.calculateExpectedHours(userScheduleInfo, date) : 8;

    const summary = this.calculateAttendanceSummary(userId, date, records, empleadoNombre, expectedHours, areaName, cargoName, userScheduleInfo?.scheduleType || null);
    if (empleadoIdForSummary) {
      summary.empleadoId = empleadoIdForSummary;
      summary.empleadoNombre = empleadoNombre;
    }
    
    return summary;
  }

  // === SCHEDULE VALIDATION ===

  private async validateAttendanceType(userId: string, type: AttendanceType, timestamp: Date) {
    const todayStart = new Date(timestamp);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(timestamp);
    todayEnd.setHours(23, 59, 59, 999);

    // Buscar por userId O empleadoId (flexible)
    const todayRecords = await this.attendanceModel
      .find({
        $or: [
          { userId, timestamp: { $gte: todayStart, $lte: todayEnd } },
          { empleadoId: userId, timestamp: { $gte: todayStart, $lte: todayEnd } }
        ]
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

  private async validateWorkingHours(type: AttendanceType, timestamp: Date, scheduleInfo: UserScheduleInfoInternal) {
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
        // Mensaje amigable para empleados con múltiples turnos
        if (scheduleInfo.multipleShifts && scheduleInfo.allAssignedShifts && scheduleInfo.allAssignedShifts.length > 1) {
          // Listar todos los turnos disponibles con sus horarios
          const turnosDisponibles = scheduleInfo.allAssignedShifts
            .filter((s: any) => !s.name.includes('(Reemplazo)')) // Solo turnos principales
            .map((s: any) => {
              const shift = s.schedule;
              return `${s.name} (${shift.timeSlot.startTime} - ${shift.timeSlot.endTime})`;
            })
            .join(', ');
          
          throw new BadRequestException(
            `No puedes marcar asistencia fuera de tu horario laboral. ` +
            `Tus turnos asignados son: ${turnosDisponibles}. ` +
            `Tolerancia: ${toleranceMinutes} minutos antes/después del horario.`
          );
        }
        
        // Mensaje para empleado con un solo turno
        const minutesBefore = Math.floor((allowedStart.getTime() - timestamp.getTime()) / (1000 * 60));
        const scheduleTypeName = scheduleInfo.scheduleType === 'ROTATING' && scheduleInfo.schedule
          ? `turno "${scheduleInfo.schedule.name}"` 
          : 'horario fijo';
        throw new BadRequestException(
          `No puedes marcar entrada tan temprano. Tu ${scheduleTypeName} inicia a las ${workStart.toTimeString().substring(0, 5)} (con ${toleranceMinutes} min de tolerancia). ` +
          `Estás intentando marcar ${minutesBefore} minutos antes del horario permitido.`
        );
      }
      if (timestamp > allowedEnd) {
        // Mensaje amigable para empleados con múltiples turnos
        if (scheduleInfo.multipleShifts && scheduleInfo.allAssignedShifts && scheduleInfo.allAssignedShifts.length > 1) {
          const turnosDisponibles = scheduleInfo.allAssignedShifts
            .filter((s: any) => !s.name.includes('(Reemplazo)'))
            .map((s: any) => {
              const shift = s.schedule;
              return `${s.name} (${shift.timeSlot.startTime} - ${shift.timeSlot.endTime})`;
            })
            .join(', ');
          
          throw new BadRequestException(
            `No puedes marcar asistencia fuera de tu horario laboral. ` +
            `Tus turnos asignados son: ${turnosDisponibles}. ` +
            `Si necesitas marcar fuera de horario, contacta a tu supervisor.`
          );
        }
        
        // Mensaje para empleado con un solo turno
        const scheduleTypeName = scheduleInfo.scheduleType === 'ROTATING' && scheduleInfo.schedule
          ? `turno "${scheduleInfo.schedule.name}"` 
          : 'horario fijo';
        throw new BadRequestException(
          `No puedes marcar entrada tan tarde. Tu ${scheduleTypeName} termina a las ${workEnd.toTimeString().substring(0, 5)}. ` +
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
      // userId es el ID de la cuenta de usuario, no del empleado
      empleado = await this.empleadosService.findEmpleadoByUserId(userId).catch(() => null);
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
      schedule: assigned?.assignedSchedule,
      multipleShifts: assigned?.multipleShifts ?? false,
      allAssignedShifts: assigned?.allAssignedShifts ?? []
    };
  }

  private async determineAttendanceStatus(
    type: AttendanceType, 
    timestamp: Date, 
    scheduleInfo: UserScheduleInfoInternal
  ): Promise<AttendanceStatus> {
    if (type !== 'CHECK_IN') {
      return 'PRESENT';
    }

    const config = await this.attendanceConfigService.getAttendanceConfig();
    const isLate = this.isLateForCheckIn(timestamp, scheduleInfo, config);
    
    return isLate ? 'LATE' : 'PRESENT';
  }

  private isLateForCheckIn(timestamp: Date, scheduleInfo: UserScheduleInfoInternal, config: any): boolean {
    const toleranceMinutes = config.toleranceMinutes || 15;
    
    let expectedStartTime: Date | null = null;
    let shiftEndTime: Date | null = null;

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
          const [startHours, startMinutes] = rotatingShift.timeSlot.startTime.split(':').map(Number);
          const [endHours, endMinutes] = rotatingShift.timeSlot.endTime.split(':').map(Number);
          
          expectedStartTime = new Date(timestamp);
          expectedStartTime.setHours(startHours, startMinutes, 0, 0);
          
          shiftEndTime = new Date(timestamp);
          shiftEndTime.setHours(endHours, endMinutes, 0, 0);
          
          // CASO: Turno cruza medianoche (ej: 22:00 - 06:00)
          if (endHours < startHours) {
            const checkInHour = timestamp.getHours();
            
            // Si el CHECK_IN es en la madrugada (antes de la hora de fin)
            // entonces el turno inició ayer
            if (checkInHour < 12) {
              // Ejemplo: CHECK_IN a las 00:07, turno 22:00 - 06:00
              // expectedStartTime debe ser 22:00 de AYER
              expectedStartTime.setDate(expectedStartTime.getDate() - 1);
              // shiftEndTime es 06:00 de HOY (ya está correcto)
            } else {
              // Si el CHECK_IN es por la tarde/noche (después de las 12:00)
              // entonces el turno termina mañana
              shiftEndTime.setDate(shiftEndTime.getDate() + 1);
            }
          }
        }
      }
    }

    if (!expectedStartTime) {
      // Default to 9:00 AM
      expectedStartTime = new Date(timestamp);
      expectedStartTime.setHours(9, 0, 0, 0);
    }

    const diffMinutes = (timestamp.getTime() - expectedStartTime.getTime()) / (1000 * 60);
    
    this.logger.debug(
      `[isLateForCheckIn] timestamp: ${timestamp.toISOString()}, ` +
      `expectedStart: ${expectedStartTime.toISOString()}, ` +
      `diffMinutes: ${diffMinutes.toFixed(2)}, ` +
      `tolerance: ${toleranceMinutes}, ` +
      `isLate: ${diffMinutes > toleranceMinutes}`
    );
    
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
      checkIn: checkIn?.timestamp ? checkIn.timestamp.toISOString() : undefined,
      checkOut: checkOut?.timestamp ? checkOut.timestamp.toISOString() : undefined,
      breakStart: breakStarts[0]?.timestamp ? breakStarts[0].timestamp.toISOString() : undefined,
      breakEnd: breakEnds[0]?.timestamp ? breakEnds[0].timestamp.toISOString() : undefined,
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

  /**
   * Determina el turno activo actual basándose en la hora
   * Retorna el turno que está activo en este momento
   */
  private getCurrentActiveShift(config: any, currentTime: Date = new Date()): any | null {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const activeShifts = (config.rotatingShifts || []).filter((shift: any) => shift.isActive);

    for (const shift of activeShifts) {
      const startTime = shift.timeSlot.startTime;
      const endTime = shift.timeSlot.endTime;
      
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      
      const startMinutes = startH * 60 + startM;
      let endMinutes = endH * 60 + endM;

      // Turno nocturno que cruza medianoche
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
        const adjustedCurrentMinutes = currentMinutes < startMinutes ? currentMinutes + 24 * 60 : currentMinutes;
        
        if (adjustedCurrentMinutes >= startMinutes && adjustedCurrentMinutes < endMinutes) {
          return shift;
        }
      } else {
        // Turno normal
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          return shift;
        }
      }
    }

    return null;
  }

  /**
   * Obtiene el empleado principal asignado a un turno específico
   * Busca en las modelos activas el empleado asignado al turno
   */
  private async getPrimaryEmployeeForShift(shiftType: string, shiftId: string): Promise<any | null> {
    try {
      // Mapeo de tipos de turno a campos en el modelo
      const shiftFieldMap: Record<string, string> = {
        'AM': 'equipoChatters.turnoAM',
        'PM': 'equipoChatters.turnoPM',
        'MADRUGADA': 'equipoChatters.turnoMadrugada'
      };

      const fieldPath = shiftFieldMap[shiftType];
      if (!fieldPath) {
        this.logger.warn(`Shift type ${shiftType} not mapped to modelo field`);
        return null;
      }

      // Buscar modelo activa con empleado asignado a este turno
      const modelo = await this.modeloModel
        .findOne({ 
          [fieldPath]: { $exists: true, $ne: null },
          estado: 'ACTIVO'
        })
        .populate(fieldPath, 'nombre apellido correoElectronico')
        .lean();

      if (!modelo) {
        this.logger.warn(`No active modelo found with employee in shift ${shiftType}`);
        return null;
      }

      // Extraer el empleado del path anidado
      const employee = fieldPath.split('.').reduce((obj: any, key: string) => obj?.[key], modelo);
      
      return employee || null;
    } catch (error) {
      this.logger.error(`Error getting primary employee for shift ${shiftType}:`, error);
      return null;
    }
  }

  /**
   * Calcula el estado actual de un turno basándose en la hora actual
   * @param shift - El turno a evaluar
   * @param now - Fecha/hora actual (por defecto new Date())
   * @returns ShiftStatus - Estado del turno (EN_CURSO, FUTURO, FINALIZADO)
   */
  private getShiftStatus(shift: any, now: Date = new Date()): ShiftStatus {
    if (!shift || !shift.timeSlot) {
      return ShiftStatus.NO_AUTORIZADO;
    }

    const { startTime, endTime } = shift.timeSlot;
    if (!startTime || !endTime) {
      return ShiftStatus.NO_AUTORIZADO;
    }

    // Parsear hora de inicio y fin
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    // Crear objetos Date para comparación
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const shiftStartMinutes = startHour * 60 + startMinute;
    const shiftEndMinutes = endHour * 60 + endMinute;

    // Determinar estado
    if (currentMinutes < shiftStartMinutes) {
      return ShiftStatus.FUTURO;
    } else if (currentMinutes > shiftEndMinutes) {
      return ShiftStatus.FINALIZADO;
    } else {
      return ShiftStatus.EN_CURSO;
    }
  }

  /**
   * Método público para calcular el estado de un turno (usado por admin endpoints)
   */
  private calculateCurrentShiftStatus(shift: any, now: Date = new Date()): string {
    // Manejar tanto turnos de config (con timeSlot) como turnos de modelo (con startTime/endTime directos)
    const timeSlot = shift.timeSlot || { startTime: shift.startTime, endTime: shift.endTime };
    
    if (!timeSlot || !timeSlot.startTime || !timeSlot.endTime) {
      return 'NO_AUTORIZADO';
    }

    // Parsear hora de inicio y fin
    const [startHour, startMinute] = timeSlot.startTime.split(':').map(Number);
    const [endHour, endMinute] = timeSlot.endTime.split(':').map(Number);

    // Crear objetos Date para comparación
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const shiftStartMinutes = startHour * 60 + startMinute;
    const shiftEndMinutes = endHour * 60 + endMinute;

    // Determinar estado
    if (currentMinutes < shiftStartMinutes) {
      return 'FUTURO';
    } else if (currentMinutes > shiftEndMinutes) {
      return 'FINALIZADO';
    } else {
      return 'EN_CURSO';
    }
  }

  /**
   * Determina si un empleado es supernumerario basándose en su código de cargo
   * Los códigos de supernumerario son: SLS_CHS (Chatter Supernumerario)
   * En el futuro se pueden agregar más códigos si hay supernumerarios en otras áreas
   */
  private async isSupernumerary(empleado: any): Promise<boolean> {
    try {
      // Si el cargo ya está populado como objeto
      if (empleado.cargoId && typeof empleado.cargoId === 'object' && empleado.cargoId.code) {
        const isSuper = SUPERNUMERARY_CARGO_CODES.includes(empleado.cargoId.code);
        this.logger.debug(`Checking if employee is supernumerary (populated): ${empleado.cargoId.code} -> ${isSuper}`);
        return isSuper;
      }
      
      // Si es un ID string, necesitamos hacer populate
      if (empleado.cargoId && typeof empleado.cargoId === 'string') {
        const empleadoCompleto = await this.empleadosService.findEmpleadoById(String(empleado._id));
        if (empleadoCompleto && empleadoCompleto.cargoId) {
          const cargoCode = typeof empleadoCompleto.cargoId === 'object' 
            ? empleadoCompleto.cargoId.code 
            : null;
          
          if (cargoCode) {
            const isSuper = SUPERNUMERARY_CARGO_CODES.includes(cargoCode);
            this.logger.debug(`Checking if employee is supernumerary (loaded): ${cargoCode} -> ${isSuper}`);
            return isSuper;
          }
        }
      }
      
      this.logger.warn(`Could not determine cargo code for employee ${empleado._id}`);
      return false;
    } catch (error) {
      this.logger.error(`Error determining if employee is supernumerary: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Obtiene el horario asignado para un supernumerario según su modalidad configurada
   * REPLACEMENT: puede cubrir cualquiera de los turnos permitidos (AM, PM, MADRUGADA)
   * FIXED_SCHEDULE: usa el mismo fixedSchedule de la configuración general
   */
  private async getSupernumerarySchedule(config: any, empleado: any): Promise<{
    assignedSchedule: AssignedScheduleInfo | null;
    scheduleType: 'FIXED' | 'ROTATING' | null;
    allMatchedShifts?: AssignedScheduleInfo[];
  }> {
    const mode = config.supernumeraryMode || 'REPLACEMENT';

    if (mode === 'FIXED_SCHEDULE') {
      // Usa el mismo horario fijo de la configuración general
      if (!config.fixedSchedule || !config.fixedScheduleEnabled) {
        throw new BadRequestException(
          'Configuración de supernumerario incompleta. El horario fijo no está configurado o habilitado. Contacta a RRHH.'
        );
      }

      return {
        assignedSchedule: {
          type: 'FIXED',
          schedule: config.fixedSchedule,
          name: 'Horario Fijo - Supernumerario',
          description: 'Horario fijo de la configuración general'
        },
        scheduleType: 'FIXED'
      };
    }

    // Modo REPLACEMENT: puede cubrir turnos específicos
    const allowedShiftIds = config.allowedReplacementShifts || [];
    
    if (allowedShiftIds.length === 0) {
      throw new BadRequestException(
        'Configuración de supernumerario incompleta. No hay turnos permitidos configurados. Contacta a RRHH para configurar los turnos en modo REPLACEMENT.'
      );
    }

    const availableShifts = (config.rotatingShifts || []).filter((shift: any) => 
      shift.isActive && allowedShiftIds.includes(shift.id)
    );

    if (availableShifts.length === 0) {
      throw new BadRequestException(
        'Configuración de supernumerario incompleta. Ninguno de los turnos permitidos está activo. Contacta a RRHH para activar los turnos en modo REPLACEMENT.'
      );
    }

    // Ordenar por hora de inicio
    const normalizeStartMinutes = (ts: any) => {
      const start = ts.startTime || ts.timeSlot?.startTime;
      if (!start) return 0;
      const [h, mi] = start.split(':').map(Number);
      return h * 60 + mi;
    };

    availableShifts.sort((a: any, b: any) => {
      const aTs = a.timeSlot || {};
      const bTs = b.timeSlot || {};
      return normalizeStartMinutes(aTs) - normalizeStartMinutes(bTs);
    });

    const assignedShifts = availableShifts.map((shift: any) => ({
      type: 'ROTATING' as const,
      schedule: shift,
      name: shift.name,
      description: shift.description || `Turno ${shift.type} - Disponible para reemplazo`
    }));

    return {
      assignedSchedule: assignedShifts[0],
      scheduleType: 'ROTATING',
      allMatchedShifts: assignedShifts
    };
  }

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
    let empleadoId: string | null = null;
    if (!userAreaId || !userCargoId || !userInfo?.empleadoId) {
      try {
        const empleado = await this.empleadosService.findEmpleadoByUserId(userId);
        empleadoId = String(empleado._id);
        userAreaId = userAreaId || normalizeId(empleado.areaId);
        userCargoId = userCargoId || normalizeId(empleado.cargoId);
        userInfo = { ...userInfo, empleadoId };
      } catch (err) {
        this.logger.warn(`Could not get employee for user ${userId} for schedule: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      empleadoId = normalizeId(userInfo.empleadoId);
    }
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
    
    // ========== VERIFICAR SI ES SUPERNUMERARIO ==========
    let empleado: any = null;
    if (empleadoId) {
      try {
        empleado = await this.empleadosService.findEmpleadoById(empleadoId);
      } catch (err) {
        this.logger.warn(`Could not load employee details for ${empleadoId}: ${err}`);
      }
    }

    const isSupernum = empleado ? await this.isSupernumerary(empleado) : false;
    
    if (isSupernum) {
      this.logger.log(`User ${userId} is a supernumerary, applying special schedule logic`);
      const supernumSchedule = await this.getSupernumerarySchedule(config, empleado);
      
      if (supernumSchedule.assignedSchedule) {
        const now = new Date();
        
        const result: UserScheduleInfo = {
          userId,
          scheduleType: supernumSchedule.scheduleType,
          assignedSchedule: supernumSchedule.assignedSchedule,
          areaId: userAreaId!,
          cargoId: userCargoId!,
          toleranceMinutes: config.toleranceMinutes || 15,
          breakDurationMinutes: config.breakDurationMinutes || 30,
          isUsingDefaultSchedule: false
        };

        // Si tiene múltiples turnos disponibles (modo REPLACEMENT)
        if (supernumSchedule.allMatchedShifts && supernumSchedule.allMatchedShifts.length > 1) {
          result.multipleShifts = true;
          // Agregar estado a cada turno
          result.allAssignedShifts = supernumSchedule.allMatchedShifts.map(shift => {
            const status = this.getShiftStatus(shift.schedule, now);
            return {
              ...shift,
              status,
              statusLabel: SHIFT_STATUS_LABELS[status],
              statusDescription: SHIFT_STATUS_DESCRIPTIONS[status]
            };
          });
        }

        return result;
      } else {
        throw new BadRequestException(
          'Configuración de supernumerario incompleta. Contacta a RRHH para configurar tu horario (modo REPLACEMENT o FIXED_SCHEDULE).'
        );
      }
    }

    // ========== LÓGICA NORMAL PARA EMPLEADOS NO SUPERNUMERARIOS ==========
    let assignedSchedule: AssignedScheduleInfo | null = null;
    let scheduleType: 'FIXED' | 'ROTATING' | null = null;
    if (config.fixedScheduleEnabled && config.fixedSchedule) {
      const fixedAssignments = config.fixedSchedule.assignedAreas || [];
      const fixedCargoAssignments = config.fixedSchedule.assignedCargos || [];
      const matchesFixedArea = userAreaId ? fixedAssignments.includes(userAreaId) : false;
      const matchesFixedCargo = userCargoId ? fixedCargoAssignments.includes(userCargoId) : false;
      if (matchesFixedArea || matchesFixedCargo) {
        assignedSchedule = { type: 'FIXED', schedule: config.fixedSchedule, name: 'Horario Fijo', description: 'Horario fijo de lunes a viernes' };
        scheduleType = 'FIXED';
      } else if (fixedAssignments.length === 0 && fixedCargoAssignments.length === 0) {
        this.logger.debug('Horario fijo configurado pero sin asignaciones explícitas: no se aplicará como global.');
      }
    }
    let allMatchedRotating: AssignedScheduleInfo[] = [];
    if (config.rotatingShiftsEnabled && config.rotatingShifts) {
      // Primero obtener turnos basados en modelos (estos son los específicos)
      const modelBased = await this.collectShiftsFromModels(userId, config.rotatingShifts);
      
      // Si tiene asignaciones específicas en modelos, SOLO usar esas (ignorar área/cargo genéricos)
      // Esto evita que empleados con turnos específicos vean todos los turnos del área
      let merged: AssignedScheduleInfo[] = [];
      if (modelBased.length > 0) {
        // Solo usar asignaciones basadas en modelos
        merged = [...modelBased];
        this.logger.debug(`Employee has ${modelBased.length} model-based shift assignments, ignoring area/cargo matches`);
      } else {
        // Si NO tiene asignaciones en modelos, usar área/cargo (empleados genéricos)
        const directMatches = config.rotatingShifts.filter(shift => {
          if (!shift.isActive) return false;
          const areaMatch = userAreaId ? (shift.assignedAreas && shift.assignedAreas.includes(userAreaId)) : false;
          const cargoMatch = userCargoId ? (shift.assignedCargos && shift.assignedCargos.includes(userCargoId)) : false;
          return Boolean(areaMatch || cargoMatch);
        }).map(shift => ({ type: 'ROTATING' as const, schedule: shift, name: shift.name, description: shift.description || `Turno ${shift.type}` }));
        merged = [...directMatches];
        this.logger.debug(`Employee has no model assignments, using ${directMatches.length} area/cargo matches`);
      }
      const normalizeStartMinutes = (ts: any) => {
        const start = ts.startTime || ts.timeSlot?.startTime;
        if (!start) return 0;
        const [h, mi] = start.split(':').map(Number);
        return h * 60 + mi;
      };
      merged.sort((a, b) => {
        const aTs: any = (a.schedule as any).timeSlot || {};
        const bTs: any = (b.schedule as any).timeSlot || {};
        return normalizeStartMinutes(aTs) - normalizeStartMinutes(bTs);
      });
      allMatchedRotating = merged;
      if (!assignedSchedule && merged.length === 1) {
        assignedSchedule = merged[0];
        scheduleType = 'ROTATING';
      } else if (!assignedSchedule && merged.length > 1) {
        assignedSchedule = merged[0];
        scheduleType = 'ROTATING';
      }
    }
    if (!assignedSchedule) {
      // Diferenciar si no tiene modelos vs no hay asignación
      let hasModels = false;
      if (empleadoId) {
        hasModels = !!(await this.modeloModel.exists({
          $or: [
            { 'equipoChatters.turnoAM': empleadoId },
            { 'equipoChatters.turnoPM': empleadoId },
            { 'equipoChatters.turnoMadrugada': empleadoId },
            { 'equipoChatters.supernumerario': empleadoId },
          ]
        }));
      }
      const baseMsg = hasModels
        ? 'Tus modelos asociados no tienen turnos configurados en la configuración global.'
        : 'No estás asignado a ningún modelo actualmente, por lo cual no tienes horario laboral.';
      this.logger.error(`No schedule assignment for user ${userId}: ${baseMsg}`);
      throw new BadRequestException(baseMsg + ' Contacta a RRHH para tu asignación.');
    }
    
    const now = new Date();
    const result: UserScheduleInfo = {
      userId,
      scheduleType,
      assignedSchedule,
      areaId: userAreaId!,
      cargoId: userCargoId!,
      toleranceMinutes: config.toleranceMinutes || 15,
      breakDurationMinutes: config.breakDurationMinutes || 30,
      isUsingDefaultSchedule: false
    };
    if (allMatchedRotating.length > 1) {
      result.multipleShifts = true;
      // Agregar estado a cada turno
      result.allAssignedShifts = allMatchedRotating.map(shift => {
        const status = this.getShiftStatus(shift.schedule, now);
        return {
          ...shift,
          status,
          statusLabel: SHIFT_STATUS_LABELS[status],
          statusDescription: SHIFT_STATUS_DESCRIPTIONS[status]
        };
      });
    }
    return result;
  }

  private async collectShiftsFromModels(userId: string, rotatingShifts: any[]): Promise<AssignedScheduleInfo[]> {
    let empleado: any;
    try {
      empleado = await this.empleadosService.findEmpleadoByUserId(userId);
    } catch {
      return [];
    }
    
    const empleadoId = empleado._id;
    
    // Buscar modelos donde el empleado está asignado con populate para obtener nombres
    const modelos = await this.modeloModel.find({
      $or: [
        { 'equipoChatters.turnoAM': empleadoId },
        { 'equipoChatters.turnoPM': empleadoId },
        { 'equipoChatters.turnoMadrugada': empleadoId },
        { 'equipoChatters.supernumerario': empleadoId },
      ],
      estado: 'ACTIVA' // Solo modelos activas
    }).select('nombreCompleto equipoChatters').lean();
    
    this.logger.debug(`[collectShiftsFromModels] Found ${modelos.length} modelos for employee ${empleadoId}`);
    if (modelos.length > 0) {
      this.logger.debug(`[collectShiftsFromModels] First modelo equipoChatters: ${JSON.stringify(modelos[0].equipoChatters)}`);
    }
    
    if (!modelos.length) return [];
    
    // Mapear turnos con sus modelos asignadas
    const turnoModelosMap = new Map<string, { modelos: string[], isPrimary: boolean }>();
    
    for (const modelo of modelos) {
      const empleadoIdStr = String(empleadoId);
      
      // Agregar turnos específicos (estos son PRIMARY - turnos principales del empleado)
      if (modelo.equipoChatters?.turnoAM && String(modelo.equipoChatters.turnoAM) === empleadoIdStr) {
        if (!turnoModelosMap.has('shift_am')) {
          turnoModelosMap.set('shift_am', { modelos: [], isPrimary: true });
        }
        turnoModelosMap.get('shift_am')!.modelos.push(modelo.nombreCompleto);
      }
      
      if (modelo.equipoChatters?.turnoPM && String(modelo.equipoChatters.turnoPM) === empleadoIdStr) {
        if (!turnoModelosMap.has('shift_pm')) {
          turnoModelosMap.set('shift_pm', { modelos: [], isPrimary: true });
        }
        turnoModelosMap.get('shift_pm')!.modelos.push(modelo.nombreCompleto);
      }
      
      if (modelo.equipoChatters?.turnoMadrugada && String(modelo.equipoChatters.turnoMadrugada) === empleadoIdStr) {
        if (!turnoModelosMap.has('shift_madrugada')) {
          turnoModelosMap.set('shift_madrugada', { modelos: [], isPrimary: true });
        }
        turnoModelosMap.get('shift_madrugada')!.modelos.push(modelo.nombreCompleto);
      }
      
      // Agregar turnos de supernumerario (estos son SECONDARY - turnos de reemplazo)
      if (modelo.equipoChatters?.supernumerario && String(modelo.equipoChatters.supernumerario) === empleadoIdStr) {
        for (const shift of rotatingShifts) {
          if (shift.isActive) {
            const existingTurno = turnoModelosMap.get(shift.id);
            
            // Si el turno ya existe como PRIMARY, solo agregamos la modelo sin el label de reemplazo
            if (existingTurno && existingTurno.isPrimary) {
              if (!existingTurno.modelos.includes(modelo.nombreCompleto)) {
                existingTurno.modelos.push(modelo.nombreCompleto);
              }
            } else {
              // Si el turno no existe, crearlo como SECONDARY (reemplazo)
              if (!turnoModelosMap.has(shift.id)) {
                turnoModelosMap.set(shift.id, { modelos: [], isPrimary: false });
              }
              // Agregar la modelo con el label de disponible para reemplazo
              const turnoData = turnoModelosMap.get(shift.id)!;
              if (!turnoData.modelos.includes(modelo.nombreCompleto)) {
                turnoData.modelos.push(modelo.nombreCompleto);
              }
            }
          }
        }
      }
    }
    
    if (!turnoModelosMap.size) return [];
    
    // Construir los turnos asignados con sus modelos
    // Ordenar: primero turnos principales, luego turnos de reemplazo
    const assignedShifts: AssignedScheduleInfo[] = [];
    const primaryShifts: AssignedScheduleInfo[] = [];
    const secondaryShifts: AssignedScheduleInfo[] = [];
    
    for (const [shiftId, turnoData] of turnoModelosMap) {
      const shift = rotatingShifts.find(s => s.id === shiftId && s.isActive);
      if (shift) {
        // Eliminar duplicados
        const uniqueModelos = [...new Set(turnoData.modelos)];
        
        const shiftInfo: AssignedScheduleInfo = {
          type: 'ROTATING' as const,
          schedule: shift,
          name: turnoData.isPrimary ? shift.name : `${shift.name} (Reemplazo)`,
          description: turnoData.isPrimary 
            ? shift.description || `Turno ${shift.type}` 
            : `Disponible para reemplazar en ${shift.description || `Turno ${shift.type}`}`,
          modelosAsignados: uniqueModelos
        };
        
        if (turnoData.isPrimary) {
          primaryShifts.push(shiftInfo);
        } else {
          secondaryShifts.push(shiftInfo);
        }
      }
    }
    
    // Retornar primero los turnos principales, luego los de reemplazo
    return [...primaryShifts, ...secondaryShifts];
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

  // === CURRENT STATUS ===

  /**
   * Obtiene información del turno activo y el empleado principal a reemplazar
   * Solo aplica para supernumerarios en modo REPLACEMENT
   */
  async getReplacementInfo(userId: string) {
    const config = await this.attendanceConfigService.getAttendanceConfig();
    const empleado = await this.empleadosService.findEmpleadoByUserId(userId);
    
    if (!empleado) {
      throw new NotFoundException(`Employee for user ID ${userId} not found`);
    }

    // Verificar si es supernumerario
    const isSupernum = await this.isSupernumerary(empleado);
    if (!isSupernum) {
      return {
        isSupernumerary: false,
        replacementMode: false
      };
    }

    // Verificar modalidad
    const mode = config.supernumeraryMode || 'REPLACEMENT';
    if (mode !== 'REPLACEMENT') {
      return {
        isSupernumerary: true,
        replacementMode: false
      };
    }

    // Obtener turno activo
    const activeShift = this.getCurrentActiveShift(config);
    if (!activeShift) {
      return {
        isSupernumerary: true,
        replacementMode: true,
        currentShift: null,
        primaryEmployee: null,
        message: 'No hay un turno activo en este momento'
      };
    }

    // Obtener empleado principal del turno
    const primaryEmployee = await this.getPrimaryEmployeeForShift(activeShift.type, activeShift.id);

    return {
      isSupernumerary: true,
      replacementMode: true,
      currentShift: {
        id: activeShift.id,
        name: activeShift.name,
        type: activeShift.type,
        timeSlot: activeShift.timeSlot,
        description: activeShift.description
      },
      primaryEmployee: primaryEmployee ? {
        id: primaryEmployee._id?.toString(),
        nombre: primaryEmployee.nombre,
        apellido: primaryEmployee.apellido,
        nombreCompleto: `${primaryEmployee.nombre} ${primaryEmployee.apellido}`,
        correoElectronico: primaryEmployee.correoElectronico
      } : null
    };
  }

  /**
   * Obtiene el estado actual de asistencia del empleado para el día de hoy
   * Retorna la última marca realizada y el próximo tipo de marca esperado
   */
  async getCurrentAttendanceStatus(userId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Obtener todos los registros del día - buscar por userId O empleadoId (flexible)
    const todayRecords = await this.attendanceModel
      .find({
        $or: [
          { userId, timestamp: { $gte: todayStart, $lte: todayEnd } },
          { empleadoId: userId, timestamp: { $gte: todayStart, $lte: todayEnd } }
        ]
      })
      .sort({ timestamp: -1 })
      .populate('empleadoId', 'nombre apellido')
      .lean();

    // Determinar el último registro
    const lastRecord = todayRecords.length > 0 ? todayRecords[0] : null;

    // Determinar el próximo tipo de marca esperado
    let nextExpectedType: AttendanceType | null = null;
    const hasCheckIn = todayRecords.some(r => r.type === 'CHECK_IN');
    const hasCheckOut = todayRecords.some(r => r.type === 'CHECK_OUT');
    const breakRecords = todayRecords.filter(r => r.type === 'BREAK_START' || r.type === 'BREAK_END');
    const lastBreak = breakRecords.length > 0 ? breakRecords[0] : null;

    if (!hasCheckIn) {
      nextExpectedType = 'CHECK_IN';
    } else if (!hasCheckOut) {
      if (!lastBreak || lastBreak.type === 'BREAK_END') {
        // Puede hacer CHECK_OUT o BREAK_START
        nextExpectedType = 'CHECK_OUT'; // Por defecto sugerimos CHECK_OUT
      } else if (lastBreak.type === 'BREAK_START') {
        nextExpectedType = 'BREAK_END';
      }
    }

    // Obtener información del horario
    const scheduleInfo = await this.getUserAssignedSchedule(userId, null).catch(() => null);

    // Calcular resumen del día
    const summary = await this.getAttendanceSummary(userId, now);

    return {
      lastRecord: lastRecord ? {
        id: (lastRecord as any)._id.toString(),
        type: lastRecord.type,
        timestamp: lastRecord.timestamp,
        status: lastRecord.status,
        notes: lastRecord.notes
      } : null,
      nextExpectedType,
      todayRecords: todayRecords.map(r => ({
        id: (r as any)._id.toString(),
        type: r.type,
        timestamp: r.timestamp,
        status: r.status
      })),
      summary,
      scheduleInfo,
      canMarkAttendance: nextExpectedType !== null,
      allowedTypes: this.getAllowedAttendanceTypes(hasCheckIn, hasCheckOut, lastBreak)
    };
  }

  /**
   * Determina los tipos de asistencia permitidos según el estado actual
   */
  private getAllowedAttendanceTypes(
    hasCheckIn: boolean,
    hasCheckOut: boolean,
    lastBreak: any | null
  ): AttendanceType[] {
    const allowed: AttendanceType[] = [];

    if (!hasCheckIn) {
      allowed.push('CHECK_IN');
      return allowed;
    }

    if (hasCheckOut) {
      return []; // Ya hizo check-out, no puede marcar más hoy
    }

    // Tiene check-in pero no check-out
    if (!lastBreak || lastBreak.type === 'BREAK_END') {
      allowed.push('BREAK_START');
      allowed.push('CHECK_OUT');
    } else if (lastBreak.type === 'BREAK_START') {
      allowed.push('BREAK_END');
    }

    return allowed;
  }

  // === JUSTIFICATION METHODS ===

  /**
   * Permite a un empleado justificar su propio registro de asistencia
   */
  async justifyMyAttendance(userId: string, recordId: string, dto: { justification: string }) {
    const record = await this.attendanceModel.findOne({
      _id: recordId,
      userId
    });

    if (!record) {
      throw new NotFoundException('Registro de asistencia no encontrado');
    }

    // Verificar que el registro necesita justificación
    if (!record.justificationStatus || record.justificationStatus !== 'PENDING') {
      throw new BadRequestException('Este registro no requiere justificación');
    }

    // Verificar que no sea muy antiguo (máximo 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    if (record.timestamp < sevenDaysAgo) {
      throw new BadRequestException('No se puede justificar un registro de más de 7 días');
    }

    // Actualizar el registro
    record.justification = dto.justification;
    record.justificationStatus = 'JUSTIFIED';
    record.justifiedBy = 'self';
    record.justifiedByUserId = userId;
    record.justifiedAt = new Date();
    record.updatedBy = 'self';

    const updated = await record.save();
    
    this.logger.log(`Attendance justified by employee: ${recordId} for user ${userId}`);
    
    return {
      id: updated._id.toString(),
      justification: updated.justification,
      justificationStatus: updated.justificationStatus,
      justifiedAt: updated.justifiedAt,
      message: 'Justificación agregada correctamente'
    };
  }

  /**
   * Permite a un admin justificar cualquier registro de asistencia
   */
  async adminJustifyAttendance(recordId: string, dto: { justification: string; status: 'JUSTIFIED' | 'REJECTED' }, adminInfo: any) {
    const record = await this.attendanceModel.findById(recordId);

    if (!record) {
      throw new NotFoundException('Registro de asistencia no encontrado');
    }

    // Actualizar el registro
    record.justification = dto.justification;
    record.justificationStatus = dto.status;
    record.justifiedBy = adminInfo.username || 'admin';
    record.justifiedByUserId = adminInfo.id || adminInfo.userId;
    record.justifiedAt = new Date();
    record.updatedBy = adminInfo.username || 'admin';

    const updated = await record.save();
    
    this.logger.log(`Attendance justified by admin: ${recordId} by ${adminInfo.username}`);
    
    return {
      id: updated._id.toString(),
      justification: updated.justification,
      justificationStatus: updated.justificationStatus,
      justifiedBy: updated.justifiedBy,
      justifiedAt: updated.justifiedAt,
      message: `Justificación ${dto.status === 'JUSTIFIED' ? 'aprobada' : 'rechazada'} correctamente`
    };
  }

  // === ADMIN: GET ALL EMPLOYEES WITH SCHEDULE ===

  /**
   * Endpoint administrativo profesional para obtener todos los empleados con su horario
   * Optimizado para evitar llamadas repetitivas y consultas innecesarias
   * 
   * @returns Lista de empleados con su información completa de horario
   */
  async adminGetAllEmployeesWithSchedule() {
    this.logger.log('Admin: Getting all employees with schedule information');

    try {
      // 1. Obtener configuración global una sola vez
      const config = await this.attendanceConfigService.getAttendanceConfig();

      // 2. Obtener todos los empleados activos con sus relaciones (área y cargo)
      const empleados = await this.empleadosService.findAllEmpleados(false); // false = solo activos

      // 3. Obtener todas las modelos activas en una sola consulta
      const modelosActivas = await this.modeloModel
        .find({ estado: 'ACTIVA' })
        .select('nombreCompleto equipoChatters')
        .lean();

      // 4. Obtener registros de asistencia de hoy para todos los empleados en una sola consulta
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayAttendanceRecords = await this.attendanceModel
        .find({
          timestamp: { $gte: todayStart, $lte: todayEnd }
        })
        .sort({ timestamp: 1 })
        .lean();

      // 5. Crear un mapa de empleadoId -> registros de hoy para búsqueda O(1)
      const empleadoAttendanceMap = new Map<string, any[]>();
      for (const record of todayAttendanceRecords) {
        const empleadoId = String(record.empleadoId);
        if (!empleadoAttendanceMap.has(empleadoId)) {
          empleadoAttendanceMap.set(empleadoId, []);
        }
        empleadoAttendanceMap.get(empleadoId)!.push(record);
      }

      // 6. Crear un mapa de empleadoId -> turnos asignados para búsqueda O(1)
      const empleadoToShiftsMap = new Map<string, { shift: any, modelo: string, isPrimary: boolean }[]>();
      
      for (const modelo of modelosActivas) {
        if (!modelo.equipoChatters) continue;
        
        const equipo = modelo.equipoChatters;
        
        // Mapear turnos específicos (PRIMARY)
        if (equipo.turnoAM) {
          const empleadoIdStr = String(equipo.turnoAM);
          const shift = config.rotatingShifts?.find((s: any) => s.type === 'AM' && s.isActive);
          if (shift) {
            if (!empleadoToShiftsMap.has(empleadoIdStr)) {
              empleadoToShiftsMap.set(empleadoIdStr, []);
            }
            empleadoToShiftsMap.get(empleadoIdStr)!.push({
              shift,
              modelo: modelo.nombreCompleto,
              isPrimary: true
            });
          }
        }
        
        if (equipo.turnoPM) {
          const empleadoIdStr = String(equipo.turnoPM);
          const shift = config.rotatingShifts?.find((s: any) => s.type === 'PM' && s.isActive);
          if (shift) {
            if (!empleadoToShiftsMap.has(empleadoIdStr)) {
              empleadoToShiftsMap.set(empleadoIdStr, []);
            }
            empleadoToShiftsMap.get(empleadoIdStr)!.push({
              shift,
              modelo: modelo.nombreCompleto,
              isPrimary: true
            });
          }
        }
        
        if (equipo.turnoMadrugada) {
          const empleadoIdStr = String(equipo.turnoMadrugada);
          const shift = config.rotatingShifts?.find((s: any) => s.type === 'MADRUGADA' && s.isActive);
          if (shift) {
            if (!empleadoToShiftsMap.has(empleadoIdStr)) {
              empleadoToShiftsMap.set(empleadoIdStr, []);
            }
            empleadoToShiftsMap.get(empleadoIdStr)!.push({
              shift,
              modelo: modelo.nombreCompleto,
              isPrimary: true
            });
          }
        }
        
        // Mapear supernumerarios (SECONDARY - reemplazo)
        if (equipo.supernumerario) {
          const empleadoIdStr = String(equipo.supernumerario);
          const allowedShiftIds = config.allowedReplacementShifts || [];
          const availableShifts = (config.rotatingShifts || [])
            .filter((s: any) => allowedShiftIds.includes(s.id) && s.isActive);
          
          for (const shift of availableShifts) {
            if (!empleadoToShiftsMap.has(empleadoIdStr)) {
              empleadoToShiftsMap.set(empleadoIdStr, []);
            }
            empleadoToShiftsMap.get(empleadoIdStr)!.push({
              shift,
              modelo: modelo.nombreCompleto,
              isPrimary: false
            });
          }
        }
      }

      // 7. Procesar cada empleado y construir la respuesta
      const employeesWithSchedule = await Promise.all(
        empleados.map(async (empleado: any) => {
          const empleadoId = String(empleado._id);
          const cargoCode = empleado.cargoId?.code || '';
          const areaCode = empleado.areaId?.code || '';

          // Determinar si es supernumerario
          const isSupernumerary = SUPERNUMERARY_CARGO_CODES.includes(cargoCode);

          // Obtener registros de asistencia de hoy
          const todayRecords = empleadoAttendanceMap.get(empleadoId) || [];
          const hasCheckIn = todayRecords.some(r => r.type === 'CHECK_IN');
          const hasCheckOut = todayRecords.some(r => r.type === 'CHECK_OUT');
          const breakRecords = todayRecords.filter(r => r.type === 'BREAK_START' || r.type === 'BREAK_END');
          const lastBreak = breakRecords.length > 0 ? breakRecords[breakRecords.length - 1] : null;
          const hasActiveBreak = lastBreak && lastBreak.type === 'BREAK_START';

          // Calcular status de asistencia basado en los registros
          let attendanceStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' = 'ABSENT';
          let isLate = false;
          let lateMinutes: number | undefined = undefined;
          let checkInTime: string | undefined = undefined;
          let checkOutTime: string | undefined = undefined;

          if (hasCheckIn) {
            const checkInRecord = todayRecords.find(r => r.type === 'CHECK_IN');
            if (checkInRecord) {
              attendanceStatus = checkInRecord.status as 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
              isLate = checkInRecord.status === 'LATE';
              checkInTime = checkInRecord.timestamp;
              
              // Calcular minutos de tardanza si es necesario
              if (isLate) {
                // Aquí podrías calcular los minutos de tardanza basándote en el horario esperado
                // Por ahora, usamos un valor por defecto
                lateMinutes = 0; // Se puede calcular más precisamente si es necesario
              }
            }
          }

          if (hasCheckOut) {
            const checkOutRecord = todayRecords.find(r => r.type === 'CHECK_OUT');
            if (checkOutRecord) {
              checkOutTime = checkOutRecord.timestamp;
            }
          }

          // Determinar botones permitidos
          const allowedTypes = this.getAllowedAttendanceTypes(hasCheckIn, hasCheckOut, lastBreak);

          // Obtener horario asignado
          let scheduleInfo: any = {
            type: 'FIXED',
            schedule: config.fixedSchedule,
            name: 'Horario Fijo',
            description: 'Horario estándar de la empresa',
            isSupernumerary,
            hasMultipleShifts: false,
            activeShifts: [],
            toleranceMinutes: config.toleranceMinutes || 15,
            breakDurationMinutes: config.breakDurationMinutes || 30
          };

          if (isSupernumerary) {
            // Supernumerarios tienen lógica especial
            const supernumMode = config.supernumeraryMode;
            
            if (supernumMode === 'REPLACEMENT') {
              // Modo reemplazo: puede cubrir turnos permitidos
              const allowedShiftIds = config.allowedReplacementShifts || [];
              const availableShifts = (config.rotatingShifts || [])
                .filter((s: any) => allowedShiftIds.includes(s.id) && s.isActive);

              scheduleInfo = {
                type: 'ROTATING',
                schedule: availableShifts[0] || null,
                name: 'Supernumerario - Modo Reemplazo',
                description: `Puede cubrir ${availableShifts.length} turnos disponibles`,
                isSupernumerary: true,
                hasMultipleShifts: true,
                activeShifts: availableShifts.map((shift: any) => ({
                  shiftId: shift.id,
                  name: shift.name,
                  type: shift.type,
                  startTime: shift.timeSlot.startTime,
                  endTime: shift.timeSlot.endTime,
                  status: this.calculateCurrentShiftStatus(shift, new Date())
                })),
                toleranceMinutes: config.toleranceMinutes || 15,
                breakDurationMinutes: config.breakDurationMinutes || 30
              };
            } else if (supernumMode === 'FIXED_SCHEDULE' && config.supernumeraryFixedSchedule) {
              // Modo horario fijo específico
              scheduleInfo = {
                type: 'FIXED',
                schedule: config.supernumeraryFixedSchedule,
                name: 'Supernumerario - Horario Fijo',
                description: 'Horario específico para supernumerarios',
                isSupernumerary: true,
                hasMultipleShifts: false,
                activeShifts: [],
                toleranceMinutes: config.toleranceMinutes || 15,
                breakDurationMinutes: config.breakDurationMinutes || 30
              };
            }
          } else {
            // Empleados regulares: buscar en el mapa de turnos
            const userShifts = empleadoToShiftsMap.get(empleadoId) || [];

            if (userShifts.length > 0) {
              // Tiene turnos rotativos asignados
              const primaryShifts = userShifts.filter(s => s.isPrimary);
              const secondaryShifts = userShifts.filter(s => !s.isPrimary);
              
              // Usar el primer turno principal como turno principal
              const mainShift = primaryShifts[0] || secondaryShifts[0];
              
              scheduleInfo = {
                type: 'ROTATING',
                schedule: mainShift?.shift || null,
                name: mainShift?.shift?.name || 'Turno Asignado',
                description: 'Horario rotativo asignado',
                isSupernumerary: false,
                hasMultipleShifts: userShifts.length > 1,
                activeShifts: userShifts.map(({ shift, modelo, isPrimary }) => ({
                  shiftId: shift.id,
                  name: isPrimary ? shift.name : `${shift.name} (Reemplazo)`,
                  type: shift.type,
                  startTime: shift.timeSlot.startTime,
                  endTime: shift.timeSlot.endTime,
                  status: this.calculateCurrentShiftStatus(shift, new Date()),
                  modelo: modelo,
                  isPrimary
                })),
                toleranceMinutes: config.toleranceMinutes || 15,
                breakDurationMinutes: config.breakDurationMinutes || 30
              };
            }
          }

          // Construir objeto de respuesta
          return {
            _id: empleado._id,
            userId: empleado.userId || null,
            empleadoId: empleadoId,
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            correoElectronico: empleado.correoElectronico,
            numeroIdentificacion: empleado.numeroIdentificacion,
            telefono: empleado.telefono,
            
            // Información laboral
            area: {
              _id: empleado.areaId?._id,
              name: empleado.areaId?.name,
              code: empleado.areaId?.code,
              color: empleado.areaId?.color
            },
            cargo: {
              _id: empleado.cargoId?._id,
              name: empleado.cargoId?.name,
              code: empleado.cargoId?.code,
              hierarchyLevel: empleado.cargoId?.hierarchyLevel
            },
            
            // Información de horario
            schedule: scheduleInfo,
            
            // Estado actual de asistencia
            currentAttendance: {
              hasCheckIn,
              hasCheckOut,
              hasActiveBreak,
              allowedTypes,
              todayRecords: todayRecords.map(r => ({
                id: r._id.toString(),
                type: r.type,
                timestamp: r.timestamp,
                status: r.status
              }))
            },
            
            // Información de status de asistencia calculada
            attendanceStatus: {
              status: attendanceStatus,
              isLate,
              lateMinutes,
              checkIn: checkInTime,
              checkOut: checkOutTime
            },
            
            // Configuración de asistencia
            attendanceConfig: {
              toleranceMinutes: config.toleranceMinutes || 15,
              breakDurationMinutes: config.breakDurationMinutes || 30,
              enabledFrom: config.attendanceEnabledFrom || null
            },
            
            // Metadatos
            estado: empleado.estado,
            fechaInicio: empleado.fechaInicio,
            fotoPerfil: empleado.fotoPerfil
          };
        })
      );

      this.logger.log(`Successfully retrieved ${employeesWithSchedule.length} employees with schedules`);

      return {
        success: true,
        total: employeesWithSchedule.length,
        employees: employeesWithSchedule,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error getting employees with schedule:', error);
      throw new Error(`Failed to get employees with schedule: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Obtiene registros pendientes de justificación para vista admin
   */
  async getPendingJustifications(filters: any = {}) {
    const query: any = {
      justificationStatus: 'PENDING'
    };

    // Aplicar filtros
    if (filters.areaId) {
      query.areaId = filters.areaId;
    }
    if (filters.cargoId) {
      query.cargoId = filters.cargoId;
    }
    if (filters.userId) {
      query.userId = filters.userId;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.timestamp.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    const records = await this.attendanceModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .sort({ timestamp: -1 })
      .lean();

    return records;
  }

  /**
   * Obtiene registros pendientes de justificación para un empleado específico
   */
  async getMyPendingJustifications(userId: string) {
    // Buscar por userId O empleadoId (flexible)
    const records = await this.attendanceModel
      .find({
        $or: [
          { userId, justificationStatus: 'PENDING' },
          { empleadoId: userId, justificationStatus: 'PENDING' }
        ]
      })
      .populate('empleadoId', 'nombre apellido')
      .populate('areaId', 'name')
      .populate('cargoId', 'name')
      .sort({ timestamp: -1 })
      .lean();

    return records;
  }

  /**
   * Obtiene historial de justificaciones con filtros
   */
  async getJustificationsHistory(filters: any = {}) {
    const query: any = {
      justificationStatus: { $in: ['JUSTIFIED', 'REJECTED'] }
    };

    // Aplicar filtros similares a getPendingJustifications
    if (filters.areaId) {
      query.areaId = filters.areaId;
    }
    if (filters.cargoId) {
      query.cargoId = filters.cargoId;
    }
    if (filters.userId) {
      query.userId = filters.userId;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.justificationStatus) {
      query.justificationStatus = filters.justificationStatus;
    }
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        query.timestamp.$gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    const records = await this.attendanceModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .sort({ timestamp: -1 })
      .lean();

    return records;
  }

  // === SHIFT STATUS VALIDATION ===

  /**
   * Obtiene el estado actual de los turnos para un usuario
   * Retorna información detallada sobre qué turnos están activos, futuros o finalizados
   */
  async getUserShiftStatus(userId: string, at: Date = new Date()): Promise<ShiftStatusInfo[]> {
    this.logger.log(`Getting shift status for user ${userId} at ${at.toISOString()}`);

    // Obtener información del horario del usuario
    const scheduleInfo = await this.getUserAssignedSchedule(userId, null);
    
    if (!scheduleInfo) {
      throw new NotFoundException('No se encontró configuración de horario para el usuario');
    }

    const results: ShiftStatusInfo[] = [];

    // Si el usuario tiene múltiples turnos rotativos
    if (scheduleInfo.multipleShifts && scheduleInfo.allAssignedShifts) {
      for (const assignedShift of scheduleInfo.allAssignedShifts) {
        const shift = assignedShift.schedule as Shift;
        const status = this.determineShiftStatus(shift.timeSlot, at, scheduleInfo.toleranceMinutes);
        
        results.push({
          status: status.status,
          label: SHIFT_STATUS_LABELS[status.status],
          description: SHIFT_STATUS_DESCRIPTIONS[status.status],
          canCheckIn: status.canCheckIn,
          canCheckOut: status.canCheckOut,
          currentShift: status.status === ShiftStatus.EN_CURSO ? {
            id: shift.id,
            name: shift.name,
            startTime: shift.timeSlot.startTime,
            endTime: shift.timeSlot.endTime,
          } : undefined,
          nextShift: status.status === ShiftStatus.FUTURO ? {
            id: shift.id,
            name: shift.name,
            startTime: shift.timeSlot.startTime,
            startsInMinutes: status.startsInMinutes || 0,
          } : undefined,
        });
      }
    } else {
      // Usuario con un solo turno (fijo o rotativo único)
      const schedule = scheduleInfo.assignedSchedule.schedule;
      let timeSlot: TimeSlot;

      if (scheduleInfo.scheduleType === 'FIXED') {
        // Obtener el slot del día actual
        const fixedSchedule = schedule as FixedSchedule;
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][at.getDay()];
        timeSlot = fixedSchedule[dayOfWeek as keyof FixedSchedule] as TimeSlot;

        if (!timeSlot) {
          // No hay horario configurado para este día
          results.push({
            status: ShiftStatus.NO_AUTORIZADO,
            label: SHIFT_STATUS_LABELS[ShiftStatus.NO_AUTORIZADO],
            description: 'No tienes horario asignado para este día.',
            canCheckIn: false,
            canCheckOut: false,
          });
          return results;
        }
      } else {
        // Turno rotativo único
        const shift = schedule as Shift;
        timeSlot = shift.timeSlot;
      }

      const status = this.determineShiftStatus(timeSlot, at, scheduleInfo.toleranceMinutes);
      
      results.push({
        status: status.status,
        label: SHIFT_STATUS_LABELS[status.status],
        description: SHIFT_STATUS_DESCRIPTIONS[status.status],
        canCheckIn: status.canCheckIn,
        canCheckOut: status.canCheckOut,
        currentShift: status.status === ShiftStatus.EN_CURSO ? {
          id: scheduleInfo.scheduleType === 'ROTATING' ? (schedule as Shift).id : 'fixed',
          name: scheduleInfo.assignedSchedule.name,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
        } : undefined,
        nextShift: status.status === ShiftStatus.FUTURO ? {
          id: scheduleInfo.scheduleType === 'ROTATING' ? (schedule as Shift).id : 'fixed',
          name: scheduleInfo.assignedSchedule.name,
          startTime: timeSlot.startTime,
          startsInMinutes: status.startsInMinutes || 0,
        } : undefined,
      });
    }

    return results;
  }

  /**
   * Determina el estado de un turno específico
   */
  private determineShiftStatus(
    timeSlot: TimeSlot,
    currentTime: Date,
    toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
  ): {
    status: ShiftStatus;
    canCheckIn: boolean;
    canCheckOut: boolean;
    startsInMinutes?: number;
  } {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startHour, startMinute] = timeSlot.startTime.split(':').map(Number);
    const [endHour, endMinute] = timeSlot.endTime.split(':').map(Number);
    
    let startMinutes = startHour * 60 + startMinute;
    let endMinutes = endHour * 60 + endMinute;

    // Manejar turnos que cruzan medianoche
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    // Definir ventanas de tiempo
    const checkInWindowStart = startMinutes - CHECK_IN_EARLY_MARGIN_MINUTES;
    const checkInWindowEnd = startMinutes + toleranceMinutes;
    const checkOutWindowStart = endMinutes - EARLY_DEPARTURE_TOLERANCE_MINUTES;
    const checkOutWindowEnd = endMinutes + CHECK_OUT_LATE_MARGIN_MINUTES;

    // Turno aún no ha iniciado
    if (currentMinutes < checkInWindowStart) {
      const startsInMinutes = startMinutes - currentMinutes;
      return {
        status: ShiftStatus.FUTURO,
        canCheckIn: false,
        canCheckOut: false,
        startsInMinutes,
      };
    }

    // Ventana de check-in activa (antes o durante el inicio con tolerancia)
    if (currentMinutes >= checkInWindowStart && currentMinutes <= checkInWindowEnd) {
      return {
        status: ShiftStatus.EN_CURSO,
        canCheckIn: true,
        canCheckOut: false,
      };
    }

    // Turno en curso (después de la ventana de check-in, antes de la salida)
    if (currentMinutes > checkInWindowEnd && currentMinutes < checkOutWindowStart) {
      return {
        status: ShiftStatus.EN_CURSO,
        canCheckIn: false, // Ya pasó la ventana de entrada
        canCheckOut: false, // Aún no es hora de salir
      };
    }

    // Ventana de check-out activa
    if (currentMinutes >= checkOutWindowStart && currentMinutes <= checkOutWindowEnd) {
      return {
        status: ShiftStatus.EN_CURSO,
        canCheckIn: false,
        canCheckOut: true,
      };
    }

    // Turno finalizado
    return {
      status: ShiftStatus.FINALIZADO,
      canCheckIn: false,
      canCheckOut: false,
    };
  }

  /**
   * Detecta anomalías en una marcación de asistencia
   * Retorna información sobre el tipo de anomalía y detalles específicos
   */
  async detectAnomaly(
    userId: string,
    type: AttendanceType,
    timestamp: Date,
    scheduleInfo?: UserScheduleInfo
  ): Promise<AnomalyDetectionResult> {
    if (!scheduleInfo) {
      scheduleInfo = await this.getUserAssignedSchedule(userId, null) || undefined;
    }

    if (!scheduleInfo) {
      return { hasAnomaly: false };
    }

    // Obtener el timeSlot correspondiente
    let timeSlot: TimeSlot | undefined;
    let shiftName = '';

    if (scheduleInfo.scheduleType === 'FIXED') {
      const fixedSchedule = scheduleInfo.assignedSchedule.schedule as FixedSchedule;
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][timestamp.getDay()];
      timeSlot = fixedSchedule[dayOfWeek as keyof FixedSchedule] as TimeSlot;
      shiftName = 'Horario Fijo';
    } else if (scheduleInfo.multipleShifts && scheduleInfo.allAssignedShifts) {
      // Buscar el turno activo en el momento de la marcación
      for (const assignedShift of scheduleInfo.allAssignedShifts) {
        const shift = assignedShift.schedule as Shift;
        const status = this.determineShiftStatus(shift.timeSlot, timestamp, scheduleInfo.toleranceMinutes);
        
        if (status.status === ShiftStatus.EN_CURSO) {
          timeSlot = shift.timeSlot;
          shiftName = shift.name;
          break;
        }
      }
    } else {
      const shift = scheduleInfo.assignedSchedule.schedule as Shift;
      timeSlot = shift.timeSlot;
      shiftName = shift.name;
    }

    if (!timeSlot) {
      // No hay horario para el día/momento actual
      return {
        hasAnomaly: true,
        anomalyType: AnomalyType.AUSENCIA,
        details: {
          message: 'No hay horario configurado para este momento.',
        },
      };
    }

    const currentMinutes = timestamp.getHours() * 60 + timestamp.getMinutes();
    const [startHour, startMinute] = timeSlot.startTime.split(':').map(Number);
    const [endHour, endMinute] = timeSlot.endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // === DETECCIÓN DE LLEGADA TARDÍA ===
    if (type === 'CHECK_IN') {
      const lateThreshold = startMinutes + scheduleInfo.toleranceMinutes;
      
      if (currentMinutes > lateThreshold) {
        const delayMinutes = currentMinutes - startMinutes;
        const expectedTime = new Date(timestamp);
        expectedTime.setHours(startHour, startMinute, 0, 0);

        return {
          hasAnomaly: true,
          anomalyType: AnomalyType.LLEGADA_TARDE,
          details: {
            expectedTime,
            actualTime: timestamp,
            delayMinutes,
            message: USER_MESSAGES.LATE_ARRIVAL_WARNING(delayMinutes),
          },
        };
      }
    }

    // === DETECCIÓN DE SALIDA ANTICIPADA ===
    if (type === 'CHECK_OUT') {
      const earlyThreshold = endMinutes - EARLY_DEPARTURE_TOLERANCE_MINUTES;
      
      if (currentMinutes < earlyThreshold) {
        const earlyMinutes = endMinutes - currentMinutes;
        const expectedTime = new Date(timestamp);
        expectedTime.setHours(endHour, endMinute, 0, 0);

        return {
          hasAnomaly: true,
          anomalyType: AnomalyType.SALIDA_ANTICIPADA,
          details: {
            expectedTime,
            actualTime: timestamp,
            earlyMinutes,
            message: USER_MESSAGES.EARLY_DEPARTURE_WARNING(earlyMinutes),
          },
        };
      }
    }

    return { hasAnomaly: false };
  }

  /**
   * Verifica si un usuario tuvo inasistencia en una fecha específica
   * Se ejecuta típicamente al final del día para detectar ausencias
   */
  async detectAbsence(userId: string, date: Date): Promise<AnomalyDetectionResult> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Verificar si existe algún registro de CHECK_IN para ese día - buscar por userId O empleadoId (flexible)
    const checkInRecord = await this.attendanceModel.findOne({
      $or: [
        { userId, type: 'CHECK_IN', timestamp: { $gte: startOfDay, $lte: endOfDay } },
        { empleadoId: userId, type: 'CHECK_IN', timestamp: { $gte: startOfDay, $lte: endOfDay } }
      ]
    }).lean();

    if (!checkInRecord) {
      // Obtener información del horario para verificar si debía trabajar ese día
      const scheduleInfo = await this.getUserAssignedSchedule(userId, null);
      
      if (!scheduleInfo) {
        return { hasAnomaly: false };
      }

      // Verificar si tenía horario asignado para ese día
      if (scheduleInfo.scheduleType === 'FIXED') {
        const fixedSchedule = scheduleInfo.assignedSchedule.schedule as FixedSchedule;
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const timeSlot = fixedSchedule[dayOfWeek as keyof FixedSchedule] as TimeSlot;

        if (timeSlot) {
          // Tenía horario pero no marcó asistencia
          return {
            hasAnomaly: true,
            anomalyType: AnomalyType.AUSENCIA,
            details: {
              message: `No se registró asistencia para el día ${date.toLocaleDateString('es-PE')}.`,
            },
          };
        }
      } else if (scheduleInfo.scheduleType === 'ROTATING') {
        // Para turnos rotativos, verificar si tenía algún turno asignado
        // Esto podría mejorarse con lógica adicional de asignación de turnos por día
        return {
          hasAnomaly: true,
          anomalyType: AnomalyType.AUSENCIA,
          details: {
            message: `No se registró asistencia para el día ${date.toLocaleDateString('es-PE')}.`,
          },
        };
      }
    }

    // Verificar si hizo CHECK_IN pero no CHECK_OUT
    if (checkInRecord) {
      const checkOutRecord = await this.attendanceModel.findOne({
        userId,
        type: 'CHECK_OUT',
        timestamp: { $gte: startOfDay, $lte: endOfDay },
      }).lean();

      if (!checkOutRecord) {
        return {
          hasAnomaly: true,
          anomalyType: AnomalyType.SALIDA_SIN_REGISTRO,
          details: {
            actualTime: checkInRecord.timestamp,
            message: 'Registraste entrada pero no la salida.',
          },
        };
      }
    }

    return { hasAnomaly: false };
  }
}
