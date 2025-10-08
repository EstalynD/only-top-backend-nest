import { Body, Controller, Get, Post, Query, UseGuards, Req, Param } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard.js';
import { Permissions } from '../../rbac/rbac.decorators.js';
import { AttendanceService, MarkAttendanceDto } from './attendance.service.js';
import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';

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
  constructor(private readonly attendanceService: AttendanceService) {}

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
