import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AttendanceEntity, AttendanceType } from './attendance.schema.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceConfigService } from '../../sistema/attendance-config.service.js';
import { EmpleadosService } from '../empleados.service.js';

/**
 * Servicio para el cierre automático de jornadas de asistencia
 * 
 * Se ejecuta periódicamente para detectar empleados que:
 * 1. Han marcado CHECK_IN
 * 2. NO han marcado CHECK_OUT
 * 3. Su turno ha finalizado (hora actual > hora fin + tolerancia)
 * 
 * Aplica tanto para horarios fijos como rotativos (incluyendo supernumerarios)
 */
@Injectable()
export class AttendanceAutoCloseService {
  private readonly logger = new Logger(AttendanceAutoCloseService.name);

  constructor(
    @InjectModel(AttendanceEntity.name) private readonly attendanceModel: Model<AttendanceEntity>,
    private readonly attendanceService: AttendanceService,
    private readonly attendanceConfigService: AttendanceConfigService,
    private readonly empleadosService: EmpleadosService,
  ) {}

  /**
   * Cron job que se ejecuta cada 15 minutos para cerrar jornadas automáticamente
   * Horario: Cada 15 minutos (00, 15, 30, 45)
   */
  @Cron('0,15,30,45 * * * *', {
    name: 'auto-close-shifts',
    timeZone: 'America/Bogota'
  })
  async autoCloseExpiredShifts() {
    this.logger.log('🔄 Iniciando verificación de jornadas para cierre automático...');
    
    try {
      const result = await this.processAutoClose();
      
      if (result.closed > 0) {
        this.logger.log(
          `✅ Cierre automático completado: ${result.closed} jornadas cerradas, ${result.skipped} omitidas, ${result.errors} errores`
        );
      } else {
        this.logger.debug('ℹ️ No hay jornadas pendientes de cierre automático');
      }
    } catch (error) {
      this.logger.error('❌ Error en el proceso de cierre automático:', error);
    }
  }

  /**
   * Procesa el cierre automático de jornadas
   * @returns Estadísticas del proceso
   */
  async processAutoClose() {
    const now = new Date();
    const stats = {
      closed: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ userId: string; empleadoNombre: string; shiftEnd: string; reason: string }>
    };

    // Buscar jornadas abiertas (tienen CHECK_IN pero no CHECK_OUT del mismo día)
    const openShifts = await this.findOpenShifts(now);

    this.logger.debug(`📋 Encontradas ${openShifts.length} jornadas abiertas para evaluar`);

    for (const shift of openShifts) {
      try {
        const shouldClose = await this.shouldCloseShift(shift, now);
        
        // Detectar si hubo un error en el análisis
        if (shouldClose.reason.startsWith('Error:')) {
          stats.errors++;
          continue; // Saltar al siguiente turno
        }
        
        if (shouldClose.shouldClose) {
          // Registrar CHECK_OUT automático
          await this.registerAutoCheckOut(shift, now, shouldClose.reason);
          stats.closed++;
          stats.details.push({
            userId: shift.userId,
            empleadoNombre: shift.empleadoNombre,
            shiftEnd: shouldClose.shiftEndTime || 'N/A',
            reason: shouldClose.reason
          });
        } else {
          stats.skipped++;
        }
      } catch (error) {
        this.logger.error(`❌ Error procesando cierre para usuario ${shift.userId}:`, error);
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Encuentra todas las jornadas abiertas (con CHECK_IN pero sin CHECK_OUT)
   */
  private async findOpenShifts(now: Date) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Para turnos de madrugada que cruzan medianoche, también revisar el día anterior
    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    // Buscar todos los CHECK_IN del día actual y día anterior
    const checkIns = await this.attendanceModel
      .find({
        type: 'CHECK_IN',
        timestamp: { $gte: startOfYesterday }
      })
      .populate('empleadoId', 'nombre apellido')
      .lean();

    const openShifts: Array<{
      userId: string;
      empleadoId: string;
      empleadoNombre: string;
      checkInTime: Date;
      shiftId?: string;
      areaId?: string;
      cargoId?: string;
    }> = [];

    // Verificar cuáles no tienen CHECK_OUT correspondiente
    for (const checkIn of checkIns) {
      const checkInDate = new Date(checkIn.timestamp);
      const dayStart = new Date(checkInDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkInDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Buscar CHECK_OUT del mismo día y mismo usuario
      const checkOut = await this.attendanceModel.findOne({
        $or: [
          { userId: checkIn.userId },
          { empleadoId: checkIn.empleadoId }
        ],
        type: 'CHECK_OUT',
        timestamp: { $gte: checkInDate } // CHECK_OUT debe ser después del CHECK_IN
      }).lean();

      if (!checkOut) {
        const empleado = checkIn.empleadoId as any;
        openShifts.push({
          userId: checkIn.userId,
          empleadoId: String(checkIn.empleadoId),
          empleadoNombre: empleado ? `${empleado.nombre} ${empleado.apellido}` : 'Desconocido',
          checkInTime: checkInDate,
          shiftId: checkIn.shiftId,
          areaId: checkIn.areaId as string,
          cargoId: checkIn.cargoId as string,
        });
      }
    }

    return openShifts;
  }

  /**
   * Determina si una jornada debe cerrarse automáticamente
   */
  private async shouldCloseShift(shift: any, now: Date): Promise<{
    shouldClose: boolean;
    reason: string;
    shiftEndTime?: string;
  }> {
    try {
      // Obtener información del horario del empleado
      const scheduleInfo = await this.attendanceService.getUserAssignedSchedule(shift.userId, null);

      if (!scheduleInfo) {
        return {
          shouldClose: false,
          reason: 'No se pudo obtener información del horario'
        };
      }

      const config = await this.attendanceConfigService.getAttendanceConfig();
      const toleranceMinutes = config?.toleranceMinutes || 15;

      // CASO 1: HORARIO ROTATIVO (Chatters y Supernumerarios)
      if (scheduleInfo.scheduleType === 'ROTATING') {
        // Si tiene shiftId específico, usar ese turno
        if (shift.shiftId) {
          const rotatingShift = config?.rotatingShifts?.find(s => s.id === shift.shiftId);
          if (rotatingShift) {
            const shiftEnd = this.parseTimeToDate(rotatingShift.timeSlot.endTime, shift.checkInTime);
            const closeThreshold = new Date(shiftEnd.getTime() + toleranceMinutes * 60000);

            if (now >= closeThreshold) {
              return {
                shouldClose: true,
                reason: `Turno ${rotatingShift.name} finalizado`,
                shiftEndTime: rotatingShift.timeSlot.endTime
              };
            } else {
              // Turno aún no ha finalizado
              return {
                shouldClose: false,
                reason: `Turno ${rotatingShift.name} aún no ha finalizado (cierra a las ${rotatingShift.timeSlot.endTime})`,
                shiftEndTime: rotatingShift.timeSlot.endTime
              };
            }
          }
        }

        // Si no tiene shiftId o no se encontró el turno, determinar turno por hora de CHECK_IN
        const checkInHour = shift.checkInTime.getHours();
        const checkInMinute = shift.checkInTime.getMinutes();
        const checkInTimeMinutes = checkInHour * 60 + checkInMinute;

        for (const rotatingShift of config?.rotatingShifts || []) {
          const [startHour, startMin] = rotatingShift.timeSlot.startTime.split(':').map(Number);
          const [endHour, endMin] = rotatingShift.timeSlot.endTime.split(':').map(Number);
          
          let startMinutes = startHour * 60 + startMin;
          let endMinutes = endHour * 60 + endMin;

          // Manejar turnos que cruzan medianoche (ej: 22:00 - 06:00)
          if (endMinutes < startMinutes) {
            // Si el CHECK_IN fue después de las startTime, el fin es al día siguiente
            if (checkInTimeMinutes >= startMinutes) {
              endMinutes += 24 * 60; // Agregar 24 horas
            }
          }

          // Verificar si el CHECK_IN está dentro del rango del turno (con tolerancia)
          const earlyMargin = 30; // 30 minutos antes
          if (checkInTimeMinutes >= (startMinutes - earlyMargin) && checkInTimeMinutes <= (endMinutes + toleranceMinutes)) {
            const shiftEnd = this.parseTimeToDate(rotatingShift.timeSlot.endTime, shift.checkInTime);
            const closeThreshold = new Date(shiftEnd.getTime() + toleranceMinutes * 60000);

            if (now >= closeThreshold) {
              return {
                shouldClose: true,
                reason: `Turno ${rotatingShift.name} finalizado (detectado por hora de entrada)`,
                shiftEndTime: rotatingShift.timeSlot.endTime
              };
            }
          }
        }

        return {
          shouldClose: false,
          reason: 'Turno aún no ha finalizado'
        };
      }

      // CASO 2: HORARIO FIJO
      if (scheduleInfo.scheduleType === 'FIXED') {
        const fixedSchedule = scheduleInfo.assignedSchedule.schedule as any;
        const checkInDate = shift.checkInTime;
        const dayOfWeek = this.getDayName(checkInDate.getDay());
        
        const daySchedule = fixedSchedule[dayOfWeek];
        if (!daySchedule || !daySchedule.endTime) {
          return {
            shouldClose: false,
            reason: `No hay horario configurado para ${dayOfWeek}`
          };
        }

        const shiftEnd = this.parseTimeToDate(daySchedule.endTime, checkInDate);
        const closeThreshold = new Date(shiftEnd.getTime() + toleranceMinutes * 60000);

        if (now >= closeThreshold) {
          return {
            shouldClose: true,
            reason: `Horario fijo finalizado (${dayOfWeek})`,
            shiftEndTime: daySchedule.endTime
          };
        }

        return {
          shouldClose: false,
          reason: 'Horario fijo aún no ha finalizado'
        };
      }

      return {
        shouldClose: false,
        reason: 'Tipo de horario no soportado'
      };

    } catch (error) {
      this.logger.error(`Error evaluando cierre para usuario ${shift.userId}:`, error);
      return {
        shouldClose: false,
        reason: `Error: ${error instanceof Error ? error.message : 'Desconocido'}`
      };
    }
  }

  /**
   * Registra un CHECK_OUT automático
   */
  private async registerAutoCheckOut(shift: any, now: Date, reason: string) {
    this.logger.log(
      `🔒 Registrando CHECK_OUT automático para ${shift.empleadoNombre} (${shift.userId}). Razón: ${reason}`
    );

    const checkOutRecord = new this.attendanceModel({
      userId: shift.userId,
      empleadoId: shift.empleadoId,
      type: 'CHECK_OUT' as AttendanceType,
      timestamp: now,
      status: 'PRESENT', // Estado normal, no es tardanza
      shiftId: shift.shiftId,
      areaId: shift.areaId,
      cargoId: shift.cargoId,
      notes: `CHECK_OUT automático: ${reason}`,
      markedBy: 'SYSTEM_AUTO_CLOSE',
      markedByUserId: 'SYSTEM',
      createdBy: 'SYSTEM_AUTO_CLOSE',
      updatedBy: 'SYSTEM_AUTO_CLOSE'
    });

    await checkOutRecord.save();

    this.logger.log(
      `✅ CHECK_OUT automático registrado exitosamente para ${shift.empleadoNombre}`
    );
  }

  /**
   * Convierte una hora en formato "HH:MM" a un objeto Date basado en una fecha de referencia
   */
  private parseTimeToDate(timeString: string, referenceDate: Date): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const result = new Date(referenceDate);
    result.setHours(hours, minutes, 0, 0);

    // Manejar turnos que cruzan medianoche
    const checkInHour = referenceDate.getHours();
    if (hours < 12 && checkInHour >= 18) {
      // Si el turno termina en la madrugada (ej: 06:00) pero el CHECK_IN fue por la noche (ej: 22:00)
      result.setDate(result.getDate() + 1);
    }

    return result;
  }

  /**
   * Obtiene el nombre del día en formato compatible con el schema
   */
  private getDayName(dayIndex: number): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
  }

  /**
   * Método manual para pruebas o ejecución bajo demanda
   */
  async manualAutoClose() {
    this.logger.log('🔧 Ejecución manual de cierre automático solicitada');
    return await this.processAutoClose();
  }
}
