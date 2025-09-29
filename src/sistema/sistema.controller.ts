import { Body, Controller, Get, Post, Put, Query, UseGuards, Req, Param } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, Roles } from '../rbac/rbac.decorators.js';
import { SistemaService } from './sistema.service.js';
import { EmailConfigService } from './email-config.service.js';
import { CreateTrmDto, ListTrmQueryDto, UpdateCurrencyDto, UpdateTimezoneDto, EmailConfigDto, TestEmailDto } from './dto.js';
import type { CurrencyCode } from './dto.js';

@Controller('sistema')
@UseGuards(AuthGuard)
export class SistemaController {
  constructor(
    private readonly sistema: SistemaService,
    private readonly emailConfig: EmailConfigService,
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
}
