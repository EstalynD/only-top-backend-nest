import { Body, Controller, Get, Post, Query, UseGuards, Req, Param, Res, Patch, Delete } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../auth/auth.guard.js';
import { Permissions } from '../../rbac/rbac.decorators.js';
import { AttendanceService, MarkAttendanceDto } from './attendance.service.js';
import { AttendanceExportService } from './attendance-export.service.js';
import { AttendanceAutoCloseService } from './attendance-auto-close.service.js';
import { MemorandumService } from '../memorandum/memorandum.service.js';
import type { SubsaneMemorandumDto, ReviewMemorandumDto } from '../memorandum/memorandum.service.js';
import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { JustifyAttendanceDto, AdminJustifyAttendanceDto } from './dto/justification.dto.js';

export class MarkAttendanceRequestDto {
  @IsEnum(['CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END'])
  type!: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  @IsOptional()
  @IsObject()
  deviceInfo?: {
    userAgent: string;
    ipAddress: string;
    platform: string;
  };
}

@Controller(['rrhh/attendance', 'api/rrhh/attendance'])
@UseGuards(AuthGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly attendanceExportService: AttendanceExportService,
    private readonly memorandumService: MemorandumService,
    private readonly attendanceAutoCloseService: AttendanceAutoCloseService
  ) {}

  // === MARK ATTENDANCE ===

  @Post('mark')
  @Permissions('rrhh.attendance.marcar')
  async markAttendance(@Body() dto: MarkAttendanceRequestDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const normalizedIp = this.getNormalizedIp(req);

    const deviceInfoServer = {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: normalizedIp,
      platform: this.detectPlatform(req.headers['user-agent'] || '')
    } as const;

    const attendanceDto: MarkAttendanceDto = {
      ...dto,
      deviceInfo: {
        userAgent: dto.deviceInfo?.userAgent || deviceInfoServer.userAgent,
        ipAddress: dto.deviceInfo?.ipAddress && dto.deviceInfo.ipAddress.trim() !== ''
          ? dto.deviceInfo.ipAddress
          : deviceInfoServer.ipAddress,
        platform: dto.deviceInfo?.platform || deviceInfoServer.platform,
      }
    };

    return this.attendanceService.markAttendance(userId, attendanceDto, req.user);
  }

  // === EMPLEADO ENDPOINTS (AUTOSERVICIO) ===

  /**
   * Endpoint para que un empleado marque su propia asistencia
   * Solo puede marcar la asistencia del usuario autenticado
   * NO requiere permisos especiales - cualquier usuario autenticado puede marcar su asistencia
   */
  @Post('empleado/marcar')
  async empleadoMarcarAsistencia(@Body() dto: MarkAttendanceRequestDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const normalizedIp = this.getNormalizedIp(req);

    const deviceInfoServer = {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: normalizedIp,
      platform: this.detectPlatform(req.headers['user-agent'] || '')
    } as const;

    const attendanceDto: MarkAttendanceDto = {
      ...dto,
      deviceInfo: {
        userAgent: dto.deviceInfo?.userAgent || deviceInfoServer.userAgent,
        ipAddress: dto.deviceInfo?.ipAddress && dto.deviceInfo.ipAddress.trim() !== ''
          ? dto.deviceInfo.ipAddress
          : deviceInfoServer.ipAddress,
        platform: dto.deviceInfo?.platform || deviceInfoServer.platform,
      }
    };

    // Marcar asistencia del usuario autenticado
    return this.attendanceService.markAttendance(userId, attendanceDto, req.user);
  }

  /**
   * Obtener el resumen de asistencia del día actual para el empleado autenticado
   * NO requiere permisos especiales
   */
  @Get('empleado/mi-resumen')
  async empleadoObtenerMiResumenHoy(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const today = new Date();
    return this.attendanceService.getAttendanceSummary(userId, today);
  }

  /**
   * Obtener el resumen de asistencia de una fecha específica para el empleado autenticado
   * NO requiere permisos especiales
   */
  @Get('empleado/mi-resumen/:date')
  async empleadoObtenerMiResumen(@Req() req: any, @Param('date') date: string) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const targetDate = new Date(date);
    return this.attendanceService.getAttendanceSummary(userId, targetDate);
  }

  /**
   * Obtener todos los registros de asistencia del empleado autenticado
   * NO requiere permisos especiales
   */
  @Get('empleado/mis-registros')
  async empleadoObtenerMisRegistros(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('populate') populate?: string
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const shouldPopulate = populate === 'true';

    return this.attendanceService.getUserAttendance(userId, start, end, shouldPopulate);
  }

  /**
   * Obtener el horario asignado al empleado autenticado
   * NO requiere permisos especiales
   */
  @Get('empleado/mi-horario')
  async empleadoObtenerMiHorario(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const userInfo = {
      id: userId,
      areaId: req.user?.areaId,
      cargoId: req.user?.cargoId,
      username: req.user?.username
    };

    return this.attendanceService.getUserAssignedSchedule(userId, userInfo);
  }

  /**
   * Obtener el estado actual de asistencia del empleado (última marca del día)
   * NO requiere permisos especiales
   */
  @Get('empleado/estado-actual')
  async empleadoObtenerEstadoActual(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.attendanceService.getCurrentAttendanceStatus(userId);
  }

  /**
   * Obtener información de reemplazo (turno activo y empleado principal)
   * Solo aplica para supernumerarios en modo REPLACEMENT
   * NO requiere permisos especiales
   */
  @Get('empleado/info-reemplazo')
  async empleadoObtenerInfoReemplazo(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.attendanceService.getReplacementInfo(userId);
  }

  /**
   * Obtener tiempo restante para check-in del empleado autenticado
   * NO requiere permisos especiales
   */
  @Get('empleado/tiempo-restante')
  async empleadoObtenerTiempoRestante(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.attendanceService.getTimeRemainingForCheckIn(userId);
  }

  /**
   * Obtener reporte de asistencia del empleado autenticado
   * NO requiere permisos especiales
   */
  @Get('empleado/mi-reporte')
  async empleadoObtenerMiReporte(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.attendanceService.getAttendanceReport(userId, start, end);
  }

  /**
   * Justificar un registro de asistencia del empleado autenticado
   * NO requiere permisos especiales
   */
  @Post('empleado/justificar/:recordId')
  async empleadoJustificarAsistencia(
    @Param('recordId') recordId: string,
    @Body() dto: JustifyAttendanceDto,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.attendanceService.justifyMyAttendance(userId, recordId, dto);
  }

  /**
   * Obtener registros pendientes de justificación del empleado autenticado
   * NO requiere permisos especiales
   */
  @Get('empleado/mis-pendientes')
  async empleadoObtenerMisPendientes(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.attendanceService.getMyPendingJustifications(userId);
  }

  // === GET ATTENDANCE RECORDS ===

  @Get('records')
  @Permissions('rrhh.attendance.ver')
  async getUserAttendance(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('populate') populate?: string
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const shouldPopulate = populate === 'true';

    return this.attendanceService.getUserAttendance(userId, start, end, shouldPopulate);
  }

  @Get('summary/:date')
  @Permissions('rrhh.attendance.ver')
  async getAttendanceSummary(@Req() req: any, @Param('date') date: string) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const targetDate = new Date(date);
    return this.attendanceService.getAttendanceSummary(userId, targetDate);
  }

  @Get('summary/today')
  @Permissions('rrhh.attendance.ver')
  async getTodayAttendanceSummary(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const today = new Date();
    return this.attendanceService.getAttendanceSummary(userId, today);
  }

  // === TIME REMAINING ===

  @Get('time-remaining')
  @Permissions('rrhh.attendance.ver')
  async getTimeRemainingForCheckIn(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.attendanceService.getTimeRemainingForCheckIn(userId);
  }

  // === USER SCHEDULE ===

  @Get('user-schedule')
  @Permissions('rrhh.attendance.ver')
  async getUserAssignedSchedule(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const userInfo = {
      id: userId,
      areaId: req.user?.areaId,
      cargoId: req.user?.cargoId,
      username: req.user?.username
    };

    return this.attendanceService.getUserAssignedSchedule(userId, userInfo);
  }

  @Get('user-schedule/:userId')
  @Permissions('rrhh.attendance.ver')
  async getUserAssignedScheduleById(
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const userInfo = {
      id: userId,
      areaId: req.query?.areaId || undefined,
      cargoId: req.query?.cargoId || undefined,
      username: req.user?.username
    };
    return this.attendanceService.getUserAssignedSchedule(userId, userInfo);
  }

  // === REPORTS ===

  @Get('report')
  @Permissions('rrhh.attendance.ver')
  async getAttendanceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.attendanceService.getAttendanceReport(userId, start, end);
  }

  // === ADMIN ENDPOINTS ===

  @Get('admin/records/:userId')
  @Permissions('rrhh.attendance.admin')
  async getAdminUserAttendance(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('populate') populate?: string
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const shouldPopulate = populate === 'true';

    return this.attendanceService.getUserAttendance(userId, start, end, shouldPopulate);
  }

  @Get('admin/records-by-employee/:empleadoId')
  @Permissions('rrhh.attendance.admin')
  async getAdminEmployeeAttendance(
    @Param('empleadoId') empleadoId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('populate') populate?: string
  ) {
    // Parsear YYYY-MM-DD como fecha LOCAL para evitar desfases por zona horaria
    let start: Date | undefined = undefined;
    let end: Date | undefined = undefined;
    if (startDate) {
      const [y, m, d] = startDate.split('-').map((v) => parseInt(v, 10));
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        start = new Date(y, m - 1, d, 0, 0, 0, 0); // medianoche local
      } else {
        start = new Date(startDate);
      }
    }
    if (endDate) {
      const [y, m, d] = endDate.split('-').map((v) => parseInt(v, 10));
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        end = new Date(y, m - 1, d, 23, 59, 59, 999); // fin del día local
      } else {
        end = new Date(endDate);
      }
    }
    const shouldPopulate = populate === 'true';

    return this.attendanceService.getEmployeeAttendance(empleadoId, start, end, shouldPopulate);
  }

  @Get('admin/summary/:userId/:date')
  @Permissions('rrhh.attendance.admin')
  async getAdminAttendanceSummary(
    @Param('userId') userId: string,
    @Param('date') date: string
  ) {
    const targetDate = new Date(date);
    return this.attendanceService.getAttendanceSummary(userId, targetDate);
  }


  @Get('admin/user-schedule/:userId')
  @Permissions('rrhh.attendance.admin')
  async getAdminUserSchedule(
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const userInfo = {
      id: userId,
      areaId: req.query?.areaId || undefined,
      cargoId: req.query?.cargoId || undefined,
      username: req.user?.username || 'admin'
    };
    return this.attendanceService.getUserAssignedSchedule(userId, userInfo);
  }

  @Get('admin/report/:userId')
  @Permissions('rrhh.attendance.admin')
  async getAdminAttendanceReport(
    @Param('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.attendanceService.getAttendanceReport(userId, start, end);
  }

  @Post('admin/mark/:userId')
  @Permissions('rrhh.attendance.admin')
  async adminMarkAttendance(
    @Param('userId') userId: string,
    @Body() dto: MarkAttendanceRequestDto,
    @Req() req: any
  ) {
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: this.getNormalizedIp(req),
      platform: this.detectPlatform(req.headers['user-agent'] || '')
    };

    const attendanceDto: MarkAttendanceDto = {
      ...dto,
      deviceInfo: { ...deviceInfo, ...dto.deviceInfo }
    };

    const adminInfo = {
      id: req.user?.id || req.user?.userId,
      username: req.user?.username || 'admin'
    };

    return this.attendanceService.markAttendance(userId, attendanceDto, adminInfo);
  }

  @Post('admin/mark-employee/:employeeId')
  @Permissions('rrhh.attendance.admin')
  async adminMarkAttendanceByEmployee(
    @Param('employeeId') employeeId: string,
    @Body() dto: MarkAttendanceRequestDto,
    @Req() req: any
  ) {
    const deviceInfo = {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: this.getNormalizedIp(req),
      platform: this.detectPlatform(req.headers['user-agent'] || '')
    };

    const attendanceDto: MarkAttendanceDto = {
      ...dto,
      deviceInfo: { ...deviceInfo, ...dto.deviceInfo }
    };

    const adminInfo = {
      id: req.user?.id || req.user?.userId,
      username: req.user?.username || 'admin'
    };

    return this.attendanceService.markAttendanceByEmployeeId(employeeId, attendanceDto, adminInfo);
  }

  // === STATS ENDPOINTS ===

  @Get('stats/today')
  @Permissions('rrhh.attendance.admin')
  async getTodayStats() {
    // This would require a new service method for aggregated stats
    // For now, return a placeholder
    return {
      message: 'Stats endpoint - to be implemented'
    };
  }

  // === ADMIN: EMPLOYEES WITH SCHEDULE ===

  @Get('admin/employees-with-schedule')
  @Permissions('rrhh.attendance.admin')
  async getAllEmployeesWithSchedule() {
    return await this.attendanceService.adminGetAllEmployeesWithSchedule();
  }

  // === JUSTIFICATION ENDPOINTS ===

  @Post('admin/justificar/:recordId')
  @Permissions('rrhh.attendance.admin')
  async adminJustificarAsistencia(
    @Param('recordId') recordId: string,
    @Body() dto: AdminJustifyAttendanceDto,
    @Req() req: any
  ) {
    const adminInfo = {
      id: req.user?.id || req.user?.userId,
      username: req.user?.username || 'admin'
    };

    return this.attendanceService.adminJustifyAttendance(recordId, dto, adminInfo);
  }

  @Get('admin/pendientes')
  @Permissions('rrhh.attendance.admin')
  async getAdminPendientes(
    @Query('areaId') areaId?: string,
    @Query('cargoId') cargoId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const filters = {
      areaId,
      cargoId,
      userId,
      status,
      startDate,
      endDate
    };

    return this.attendanceService.getPendingJustifications(filters);
  }

  @Get('admin/justificaciones')
  @Permissions('rrhh.attendance.admin')
  async getAdminJustificaciones(
    @Query('areaId') areaId?: string,
    @Query('cargoId') cargoId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('justificationStatus') justificationStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const filters = {
      areaId,
      cargoId,
      userId,
      status,
      justificationStatus,
      startDate,
      endDate
    };

    return this.attendanceService.getJustificationsHistory(filters);
  }

  // === EXPORT ENDPOINTS ===

  @Get('admin/export/excel')
  @Permissions('rrhh.attendance.admin')
  async exportAttendanceExcel(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
    @Query('areaId') areaId?: string,
    @Query('cargoId') cargoId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('hasJustification') hasJustification?: string
  ) {
    const filters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      areaId,
      cargoId,
      userId,
      status,
      hasJustification: hasJustification === 'true' ? true : hasJustification === 'false' ? false : undefined
    };

    const buffer = await this.attendanceExportService.exportAttendanceToExcel(filters);
    
    const filename = `asistencia_${startDate}_${endDate}.xlsx`;
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString()
    });

    res.send(buffer);
  }

  @Get('admin/export/individual/:userId')
  @Permissions('rrhh.attendance.admin')
  async exportIndividualExcel(
    @Param('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response
  ) {
    const buffer = await this.attendanceExportService.exportSummaryToExcel(
      userId,
      new Date(startDate),
      new Date(endDate)
    );
    
    const filename = `asistencia_individual_${userId}_${startDate}_${endDate}.xlsx`;
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString()
    });

    res.send(buffer);
  }

  @Get('admin/export/team')
  @Permissions('rrhh.attendance.admin')
  async exportTeamExcel(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
    @Query('areaId') areaId?: string,
    @Query('cargoId') cargoId?: string
  ) {
    const buffer = await this.attendanceExportService.exportTeamReportToExcel(
      new Date(startDate),
      new Date(endDate),
      areaId,
      cargoId
    );
    
    const teamType = areaId ? 'area' : cargoId ? 'cargo' : 'equipo';
    const filename = `asistencia_${teamType}_${startDate}_${endDate}.xlsx`;
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString()
    });

    res.send(buffer);
  }

  // === MEMORANDOS ENDPOINTS ===

  /**
   * Obtiene el estado actual de los turnos del empleado
   * Muestra qué turnos están activos, próximos o finalizados
   */
  @Get('empleado/estado-turnos')
  async getEmpleadoShiftStatus(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.attendanceService.getUserShiftStatus(userId);
  }

  /**
   * Lista todos los memorandos del empleado autenticado
   */
  @Get('empleado/mis-memorandos')
  async getMisMemorandos(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const filters: any = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
  if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); filters.startDate = s; }
  if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); filters.endDate = e; }

    return this.memorandumService.getUserMemorandums(userId, filters);
  }

  /**
   * Obtiene un memorando específico del empleado
   */
  @Get('empleado/mis-memorandos/:id')
  async getMiMemorandum(@Req() req: any, @Param('id') memorandumId: string) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const memorandum = await this.memorandumService.getMemorandumById(memorandumId);
    
    // Verificar que el memorando pertenece al usuario
    if (memorandum.userId !== userId) {
      throw new Error('No tienes permiso para ver este memorando');
    }

    return memorandum;
  }

  /**
   * Permite al empleado subsanar un memorando pendiente
   */
  @Patch('empleado/subsanar-memorando/:id')
  async subsanarMemorandum(
    @Req() req: any,
    @Param('id') memorandumId: string,
    @Body() dto: SubsaneMemorandumDto
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.memorandumService.subsanarMemorandum(memorandumId, userId, dto);
  }

  /**
   * Obtiene estadísticas de memorandos del empleado
   */
  @Get('empleado/mis-memorandos-stats')
  async getMisMemorandosStats(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    const filters: any = { userId };
  if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); filters.startDate = s; }
  if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); filters.endDate = e; }

    return this.memorandumService.getMemorandumStats(filters);
  }

  // === ADMIN MEMORANDOS ENDPOINTS ===

  /**
   * Lista memorandos pendientes de revisión (para RRHH)
   */
  @Get('admin/memorandos/pendientes')
  @Permissions('rrhh.attendance.admin')
  async getMemorandosPendientes(
    @Query('type') type?: string,
    @Query('areaId') areaId?: string,
    @Query('cargoId') cargoId?: string
  ) {
    const filters: any = {};
    if (type) filters.type = type;
    if (areaId) filters.areaId = areaId;
    if (cargoId) filters.cargoId = cargoId;

    return this.memorandumService.getPendingReviewMemorandums(filters);
  }

  /**
   * Lista TODOS los memorandos del sistema (admin)
   * A diferencia de /pendientes, este endpoint retorna memorandos en cualquier estado
   */
  @Get('admin/memorandos/todos')
  @Permissions('rrhh.attendance.admin')
  async getTodosMemorandos(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('areaId') areaId?: string,
    @Query('cargoId') cargoId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (areaId) filters.areaId = areaId;
    if (cargoId) filters.cargoId = cargoId;
    if (userId) filters.userId = userId;
  if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); filters.startDate = s; }
  if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); filters.endDate = e; }

    return this.memorandumService.getAllMemorandums(filters);
  }

  /**
   * Obtiene un memorando específico (admin)
   */
  @Get('admin/memorandos/:id')
  @Permissions('rrhh.attendance.admin')
  async getMemorandumById(@Param('id') memorandumId: string) {
    return this.memorandumService.getMemorandumById(memorandumId);
  }

  /**
   * Revisa y aprueba/rechaza un memorando
   */
  @Patch('admin/memorandos/:id/revisar')
  @Permissions('rrhh.attendance.admin')
  async reviewMemorandum(
    @Req() req: any,
    @Param('id') memorandumId: string,
    @Body() dto: ReviewMemorandumDto
  ) {
    const reviewedBy = req.user?.username || 'Admin';
    const reviewedByUserId = req.user?.id || req.user?.userId;

    return this.memorandumService.reviewMemorandum(
      memorandumId,
      reviewedBy,
      reviewedByUserId,
      dto
    );
  }

  /**
   * Lista todos los memorandos de un usuario específico (admin)
   */
  @Get('admin/memorandos/usuario/:userId')
  @Permissions('rrhh.attendance.admin')
  async getMemorandosUsuario(
    @Param('userId') userId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); filters.startDate = s; }
    if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); filters.endDate = e; }

    return this.memorandumService.getUserMemorandums(userId, filters);
  }

  /**
   * Lista todos los memorandos de un empleado por empleadoId (admin)
   */
  @Get('admin/memorandos/empleado/:empleadoId')
  @Permissions('rrhh.attendance.admin')
  async getMemorandosEmpleado(
    @Param('empleadoId') empleadoId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); filters.startDate = s; }
    if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); filters.endDate = e; }

    return this.memorandumService.getEmployeeMemorandums(empleadoId, filters);
  }

  /**
   * Obtiene estadísticas generales de memorandos (admin)
   */
  @Get('admin/memorandos-stats')
  @Permissions('rrhh.attendance.admin')
  async getMemorandosStats(
    @Query('areaId') areaId?: string,
    @Query('cargoId') cargoId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const filters: any = {};
    if (areaId) filters.areaId = areaId;
    if (cargoId) filters.cargoId = cargoId;
    if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); filters.startDate = s; }
    if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); filters.endDate = e; }

    return this.memorandumService.getMemorandumStats(filters);
  }


  /**
   * Expira memorandos vencidos manualmente
   */
  @Post('admin/memorandos/expirar-vencidos')
  @Permissions('rrhh.attendance.admin')
  async expirarMemorandosVencidos() {
    const count = await this.memorandumService.autoExpireMemorandums();
    return {
      success: true,
      message: `Se expiraron ${count} memorandos`,
      count,
    };
  }

  /**
   * Ejecuta manualmente el cierre automático de jornadas
   * Solo para administradores - útil para pruebas o ejecución bajo demanda
   */
  @Post('admin/auto-close')
  @Permissions('rrhh.attendance.admin')
  async manualAutoCloseShifts() {
    try {
      const resultado = await this.attendanceAutoCloseService.manualAutoClose();
      return {
        success: true,
        message: 'Cierre automático ejecutado',
        ...resultado
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
        closed: 0,
        skipped: 0,
        errors: 0,
      };
    }
  }

  // === UTILITY METHODS ===

  private detectPlatform(userAgent: string): string {
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux';
    return 'Unknown';
  }

  private getNormalizedIp(req: any): string {
    const ipFromHeaders = ((): string | undefined => {
      const xf = req.headers['x-forwarded-for'];
      if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0].trim();
      if (Array.isArray(xf) && xf.length > 0) return String(xf[0]).split(',')[0].trim();
      return undefined;
    })();

    let rawIp: string = ipFromHeaders 
      || req.ip 
      || req.socket?.remoteAddress 
      || req.connection?.remoteAddress 
      || '';

    if (typeof rawIp !== 'string') rawIp = String(rawIp || '');
    if (rawIp.startsWith('::ffff:')) rawIp = rawIp.replace('::ffff:', '');
    if (rawIp === '::1' || rawIp === '0:0:0:0:0:0:0:1') rawIp = '127.0.0.1';
    if (!rawIp || rawIp.trim() === '') rawIp = '127.0.0.1';
    return rawIp;
  }
}
