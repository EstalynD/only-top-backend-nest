import { Body, Controller, Get, Post, Put, Delete, Query, UseGuards, Req, Param } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, Roles } from '../rbac/rbac.decorators.js';
import { SistemaService } from './sistema.service.js';
import { EmailConfigService } from './email-config.service.js';
import { FinanceConfigService } from './finance-config.service.js';
import { InternalCommissionService } from './internal-commission.service.js';
import { AttendanceConfigService } from './attendance-config.service.js';
import type { Shift } from './attendance-config.schema.js';
import { 
  CreateTrmDto, 
  ListTrmQueryDto, 
  UpdateCurrencyDto, 
  UpdateTimezoneDto, 
  EmailConfigDto, 
  TestEmailDto,
  CreatePaymentProcessorDto,
  UpdatePaymentProcessorDto,
  CreateCommissionScaleDto,
  UpdateCommissionScaleDto,
  UpdateInternalCommissionsDto,
  UpdateAttendanceConfigDto,
  ShiftType,
  TimeSlotDto
} from './dto.js';
import type { CurrencyCode } from './dto.js';

@Controller('sistema')
@UseGuards(AuthGuard)
export class SistemaController {
  constructor(
    private readonly sistema: SistemaService,
    private readonly emailConfig: EmailConfigService,
    private readonly financeConfig: FinanceConfigService,
    private readonly internalCommission: InternalCommissionService,
    private readonly attendanceConfig: AttendanceConfigService,
  ) {}

  @Get('admin-area')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  adminArea(@Req() req: any) {
    return { ok: true, user: req.user, area: 'admin' };
  }

  @Get('perfil')
  @Permissions('sistema.perfil.ver')
  perfil(@Req() req: any) {
    return { ok: true, user: req.user, area: 'perfil' };
  }

  // Monedas soportadas y ejemplos de formato
  @Get('currencies')
  @Permissions('sistema.config.ver')
  currencies() {
    return this.sistema.getCurrencies();
  }

  // Actualizar configuración de moneda
  @Put('currencies/:code')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  updateCurrency(@Param('code') code: CurrencyCode, @Body() dto: UpdateCurrencyDto) {
    return this.sistema.updateCurrency(code, dto);
  }

  // Zonas horarias disponibles
  @Get('timezones/available')
  @Permissions('sistema.config.ver')
  availableTimezones() {
    return this.sistema.getAvailableTimezones();
  }

  // Zona horaria seleccionada
  @Get('timezones/selected')
  @Permissions('sistema.config.ver')
  selectedTimezone() {
    return this.sistema.getSelectedTimezone();
  }

  // Actualizar zona horaria seleccionada
  @Put('timezones')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  updateTimezone(@Body() dto: UpdateTimezoneDto) {
    return this.sistema.updateTimezone(dto);
  }

  // Crear TRM manual con vigencia y auditoría
  @Post('trm')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  createTrm(@Body() dto: CreateTrmDto) {
    return this.sistema.createTrm(dto);
  }

  // TRM vigente a una fecha (por defecto ahora)
  @Get('trm/current')
  @Permissions('sistema.config.ver')
  currentTrm(@Query('at') at?: string) {
    const when = at ? new Date(at) : undefined;
    return this.sistema.getCurrentTrm(when);
  }

  // Historial de TRM
  @Get('trm')
  @Permissions('sistema.config.ver')
  listTrm(@Query() query: ListTrmQueryDto) {
    return this.sistema.listTrm(query);
  }

  // === EMAIL CONFIGURATION ENDPOINTS ===

  // Obtener configuración de email (con credenciales enmascaradas)
  @Get('email/config')
  @Permissions('sistema.config.ver')
  getEmailConfig() {
    return this.emailConfig.getRedactedConfig();
  }

  // Guardar configuración de email
  @Put('email/config')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  saveEmailConfig(@Body() dto: EmailConfigDto, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.emailConfig.saveConfig(dto, updatedBy);
  }

  // Verificar configuración de email
  @Post('email/verify')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  verifyEmailConfig() {
    return this.emailConfig.verifyConfig();
  }

  // Obtener estado habilitado/deshabilitado
  @Get('email/enabled')
  @Permissions('sistema.config.ver')
  getEmailEnabled() {
    return this.emailConfig.isEnabled().then(enabled => ({ enabled }));
  }

  // Habilitar/deshabilitar email
  @Put('email/enabled')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  setEmailEnabled(@Body() body: { enabled: boolean }, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.emailConfig.setEnabled(body.enabled, updatedBy).then(enabled => ({ enabled }));
  }

  // Enviar email de prueba
  @Post('email/test')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  testEmail(@Body() dto: TestEmailDto) {
    return this.emailConfig.testEmail(dto.to);
  }

  // === FINANCE CONFIGURATION ENDPOINTS ===

  // === PAYMENT PROCESSORS ===

  // Obtener todos los procesadores de pago
  @Get('finance/payment-processors')
  @Permissions('sistema.config.ver')
  getPaymentProcessors(@Query('active') activeOnly?: string) {
    const active = activeOnly === 'true';
    return this.financeConfig.getPaymentProcessors(active);
  }

  // Obtener un procesador específico
  @Get('finance/payment-processors/:id')
  @Permissions('sistema.config.ver')
  getPaymentProcessor(@Param('id') id: string) {
    return this.financeConfig.getPaymentProcessor(id);
  }

  // Crear procesador de pago
  @Post('finance/payment-processors')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  createPaymentProcessor(@Body() dto: CreatePaymentProcessorDto, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.financeConfig.createPaymentProcessor(dto, updatedBy);
  }

  // Actualizar procesador de pago
  @Put('finance/payment-processors/:id')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  updatePaymentProcessor(@Param('id') id: string, @Body() dto: UpdatePaymentProcessorDto, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.financeConfig.updatePaymentProcessor(id, dto, updatedBy);
  }

  // Eliminar procesador de pago
  @Delete('finance/payment-processors/:id')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  deletePaymentProcessor(@Param('id') id: string) {
    return this.financeConfig.deletePaymentProcessor(id);
  }

  // === COMMISSION SCALES ===

  // Obtener todas las escalas de comisión
  @Get('finance/commission-scales')
  @Permissions('sistema.config.ver')
  getCommissionScales() {
    return this.financeConfig.getCommissionScales();
  }

  // Obtener una escala específica
  @Get('finance/commission-scales/:id')
  @Permissions('sistema.config.ver')
  getCommissionScale(@Param('id') id: string) {
    return this.financeConfig.getCommissionScale(id);
  }

  // Obtener escala activa
  @Get('finance/commission-scales/active/current')
  @Permissions('sistema.config.ver')
  getActiveCommissionScale() {
    return this.financeConfig.getActiveCommissionScale();
  }

  // Crear escala de comisión
  @Post('finance/commission-scales')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  createCommissionScale(@Body() dto: CreateCommissionScaleDto, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.financeConfig.createCommissionScale(dto, updatedBy);
  }

  // Actualizar escala de comisión
  @Put('finance/commission-scales/:id')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  updateCommissionScale(@Param('id') id: string, @Body() dto: UpdateCommissionScaleDto, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.financeConfig.updateCommissionScale(id, dto, updatedBy);
  }

  // Eliminar escala de comisión
  @Delete('finance/commission-scales/:id')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  deleteCommissionScale(@Param('id') id: string) {
    return this.financeConfig.deleteCommissionScale(id);
  }

  // Activar escala de comisión
  @Post('finance/commission-scales/:id/activate')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  activateCommissionScale(@Param('id') id: string, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.financeConfig.setActiveCommissionScale(id, updatedBy);
  }

  // Calcular comisión para un monto
  @Post('finance/calculate-commission')
  @Permissions('sistema.config.ver')
  calculateCommission(@Body() body: { amountUsd: number }) {
    return this.financeConfig.calculateCommission(body.amountUsd);
  }

  // Crear escala por defecto
  @Post('finance/commission-scales/default')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  createDefaultCommissionScale(@Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.financeConfig.createDefaultCommissionScale(updatedBy);
  }

  // === INTERNAL COMMISSIONS ENDPOINTS ===

  // Obtener configuración de comisiones internas
  @Get('finance/internal-commissions')
  @Permissions('sistema.config.ver')
  getInternalCommissions() {
    return this.internalCommission.getInternalCommissions();
  }

  // Actualizar configuración de comisiones internas
  @Put('finance/internal-commissions')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  updateInternalCommissions(@Body() dto: UpdateInternalCommissionsDto, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.internalCommission.updateInternalCommissions(dto, updatedBy);
  }

  // Calcular comisión de Sales Closer
  @Post('finance/internal-commissions/calculate/sales-closer')
  @Permissions('sistema.config.ver')
  calculateSalesCloserCommission(@Body() body: { subscriptionAmount: number; monthsActive: number }) {
    return this.internalCommission.calculateSalesCloserCommission(body.subscriptionAmount, body.monthsActive);
  }

  // Calcular comisión de Trafficker
  @Post('finance/internal-commissions/calculate/trafficker')
  @Permissions('sistema.config.ver')
  calculateTraffickerCommission(@Body() body: { netSubscriptionAmount: number }) {
    return this.internalCommission.calculateTraffickerCommission(body.netSubscriptionAmount);
  }

  // Calcular comisión de Chatters
  @Post('finance/internal-commissions/calculate/chatters')
  @Permissions('sistema.config.ver')
  calculateChattersCommission(@Body() body: { goalCompletionPercent: number; baseAmount: number }) {
    return this.internalCommission.calculateChattersCommission(body.goalCompletionPercent, body.baseAmount);
  }

  // Calcular todas las comisiones internas
  @Post('finance/internal-commissions/calculate/all')
  @Permissions('sistema.config.ver')
  calculateAllInternalCommissions(@Body() body: {
    subscriptionAmount: number;
    monthsActive: number;
    netSubscriptionAmount: number;
    goalCompletionPercent: number;
    baseAmountForChatters: number;
  }) {
    return this.internalCommission.calculateAllCommissions(body);
  }

  // === ATTENDANCE CONFIGURATION ENDPOINTS ===

  // Obtener configuración de asistencia
  @Get('attendance/config')
  @Permissions('sistema.config.ver')
  getAttendanceConfig() {
    return this.attendanceConfig.getAttendanceConfig();
  }

  // Actualizar configuración de asistencia
  @Put('attendance/config')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  updateAttendanceConfig(@Body() dto: UpdateAttendanceConfigDto, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    // Sanitizar posibles _id que vengan del cliente en nested objects
    const sanitize = (obj: any) => {
      if (obj && typeof obj === 'object') {
        if ('_id' in obj) delete obj._id;
        for (const key of Object.keys(obj)) sanitize(obj[key]);
      }
    };
    const dtoCopy = JSON.parse(JSON.stringify(dto));
    sanitize(dtoCopy);
    return this.attendanceConfig.updateAttendanceConfig(dtoCopy, updatedBy);
  }

  // Obtener turnos activos
  @Get('attendance/shifts/active')
  @Permissions('sistema.config.ver')
  getActiveShifts() {
    return this.attendanceConfig.getActiveShifts();
  }

  // Obtener turno por tipo
  @Get('attendance/shifts/by-type/:type')
  @Permissions('sistema.config.ver')
  getShiftByType(@Param('type') type: string) {
    return this.attendanceConfig.getShiftByType(type);
  }

  // Agregar nuevo turno
  @Post('attendance/shifts')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  addShift(@Body() body: { 
    name: string; 
    type: ShiftType; 
    timeSlot: TimeSlotDto; 
    description?: string; 
    isActive?: boolean; 
  }, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    const payload: Omit<Shift, 'id'> = {
      name: body.name,
      type: body.type,
      timeSlot: { startTime: body.timeSlot.startTime, endTime: body.timeSlot.endTime },
      description: body.description,
      isActive: body.isActive ?? true,
    };
    return this.attendanceConfig.addShift(payload, updatedBy);
  }

  // Actualizar turno
  @Put('attendance/shifts/:shiftId')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  updateShift(@Param('shiftId') shiftId: string, @Body() body: {
    name?: string;
    type?: ShiftType;
    timeSlot?: TimeSlotDto;
    description?: string;
    isActive?: boolean;
  }, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    const data: Partial<Omit<Shift, 'id'>> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.timeSlot !== undefined) {
      data.timeSlot = { startTime: body.timeSlot.startTime, endTime: body.timeSlot.endTime };
    }
    if (body.description !== undefined) data.description = body.description;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    return this.attendanceConfig.updateShift(shiftId, data, updatedBy);
  }

  // Eliminar turno
  @Delete('attendance/shifts/:shiftId')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  deleteShift(@Param('shiftId') shiftId: string, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.attendanceConfig.deleteShift(shiftId, updatedBy);
  }

  // Activar/desactivar turno
  @Post('attendance/shifts/:shiftId/toggle')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  toggleShiftStatus(@Param('shiftId') shiftId: string, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.attendanceConfig.toggleShiftStatus(shiftId, updatedBy);
  }

  // Calcular duración de turno
  @Post('attendance/calculate-duration')
  @Permissions('sistema.config.ver')
  async calculateShiftDuration(@Body() body: { startTime: string; endTime: string }) {
    const minutes = await this.attendanceConfig.calculateShiftDuration(body);
    const response = {
      durationMinutes: minutes,
      durationHours: Math.round((minutes / 60) * 100) / 100,
      isOvernight: this.isOvernight(body.startTime, body.endTime),
      formattedDuration: this.minutesToTimeLabel(minutes),
    };
    return response;
  }

  private isOvernight(start: string, end: string) {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const s = toMinutes(start);
    const e = toMinutes(end);
    return e <= s;
  }

  private minutesToTimeLabel(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  // Toggle fixed schedule
  @Post('attendance/fixed-schedule/toggle')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  toggleFixedSchedule(@Body() body: { enabled: boolean }, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.attendanceConfig.toggleFixedSchedule(body.enabled, updatedBy);
  }

  // Toggle rotating shifts
  @Post('attendance/rotating-shifts/toggle')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  toggleRotatingShifts(@Body() body: { enabled: boolean }, @Req() req: any) {
    const updatedBy = req.user?.username || 'system';
    return this.attendanceConfig.toggleRotatingShifts(body.enabled, updatedBy);
  }
}
