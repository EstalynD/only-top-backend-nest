import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { HorasExtrasService } from './horas-extras.service.js';
import { CreateHorasExtrasDto, UpdateHorasExtrasDto, AprobarHorasExtrasDto, FiltrosHorasExtrasDto, AprobarHorasExtrasLoteDto } from './dto/horas-extras.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { User } from '../auth/user.decorator.js';

@Controller('api/rrhh/horas-extras')
@UseGuards(AuthGuard)
export class HorasExtrasController {
  constructor(private readonly horasExtrasService: HorasExtrasService) {}

  // ========== CRUD BÁSICO ==========

  @Post()
  @RequirePermissions('rrhh:horas_extras:create')
  async create(@Body() createDto: CreateHorasExtrasDto, @User() user: any) {
    return await this.horasExtrasService.create(createDto, user.id);
  }

  @Get()
  @RequirePermissions('rrhh:horas_extras:read')
  async findAll(@Query() filtros: FiltrosHorasExtrasDto) {
    return await this.horasExtrasService.findAll(filtros);
  }

  @Get(':id')
  @RequirePermissions('rrhh:horas_extras:read')
  async findById(@Param('id') id: string) {
    return await this.horasExtrasService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('rrhh:horas_extras:update')
  async update(@Param('id') id: string, @Body() updateDto: UpdateHorasExtrasDto) {
    return await this.horasExtrasService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('rrhh:horas_extras:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.horasExtrasService.delete(id);
  }

  // ========== CONSULTAS ESPECÍFICAS ==========

  @Get('empleado/:empleadoId/periodo/:anio/:mes')
  @RequirePermissions('rrhh:horas_extras:read')
  async findByEmpleadoAndPeriodo(
    @Param('empleadoId') empleadoId: string,
    @Param('anio') anio: string,
    @Param('mes') mes: string
  ) {
    return await this.horasExtrasService.findByEmpleadoAndPeriodo(
      empleadoId,
      parseInt(anio, 10),
      parseInt(mes, 10)
    );
  }

  // ========== APROBACIÓN Y PAGO ==========

  @Patch(':id/aprobar')
  @RequirePermissions('rrhh:horas_extras:approve')
  async aprobar(
    @Param('id') id: string,
    @Body() aprobarDto: AprobarHorasExtrasDto,
    @User() user: any
  ) {
    return await this.horasExtrasService.aprobar(id, aprobarDto, user.id);
  }

  // Estado PAGADO eliminado: flujo de pago se integra ahora vía Finanzas al aprobar

  // ========== ESTADÍSTICAS Y REPORTES ==========

  @Get('resumen/empleado/:empleadoId/:anio/:mes')
  @RequirePermissions('rrhh:horas_extras:stats')
  async obtenerResumenPorEmpleado(
    @Param('empleadoId') empleadoId: string,
    @Param('anio') anio: string,
    @Param('mes') mes: string
  ) {
    return await this.horasExtrasService.obtenerResumenPorEmpleado(
      empleadoId,
      parseInt(anio, 10),
      parseInt(mes, 10)
    );
  }

  @Get('estadisticas/:anio/:mes')
  @RequirePermissions('rrhh:horas_extras:stats')
  async obtenerEstadisticasGenerales(
    @Param('anio') anio: string,
    @Param('mes') mes: string
  ) {
    return await this.horasExtrasService.obtenerEstadisticasGenerales(
      parseInt(anio, 10),
      parseInt(mes, 10)
    );
  }

  // ========== LOTE Y LISTADOS DE SOPORTE ==========

  @Get('pendientes/periodo')
  @RequirePermissions('rrhh:horas_extras:read')
  async listarPendientesPorPeriodo(
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Query('quincena') quincena?: string,
  ) {
    return await this.horasExtrasService.listarPendientesPorPeriodo(parseInt(anio, 10), parseInt(mes, 10), quincena ? parseInt(quincena, 10) : undefined);
  }

  @Patch('aprobar-lote')
  @RequirePermissions('rrhh:horas_extras:approve')
  async aprobarLote(@Body() dto: AprobarHorasExtrasLoteDto, @User() user: any) {
    return await this.horasExtrasService.aprobarLote(dto, user.id);
  }
}
