import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmpleadosService } from './empleados.service.js';
import { CreateEmpleadoDto } from './dto/create-empleado.dto.js';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto.js';
import { AprobarContratoDto } from './dto/create-contrato.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { User } from '../auth/user.decorator.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { BirthdayEmailService } from './birthday-email.service.js';
import { BirthdayScheduler } from './birthday.scheduler.js';
import { AssignTemplatesMigration } from './contract-templates/assign-templates.migration.js';

@Controller('api/rrhh/empleados')
@UseGuards(AuthGuard)
export class EmpleadosController {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly birthdayEmailService: BirthdayEmailService,
    private readonly birthdayScheduler: BirthdayScheduler,
    private readonly assignTemplatesMigration: AssignTemplatesMigration
  ) {}

  // ========== EMPLEADOS ==========

  @Post()
  @RequirePermissions('rrhh:empleados:create')
  async createEmpleado(@Body() createEmpleadoDto: CreateEmpleadoDto) {
    return await this.empleadosService.createEmpleado(createEmpleadoDto);
  }

  @Get()
  @RequirePermissions('rrhh:empleados:read')
  async findAllEmpleados(
    @Query('includeInactive') includeInactive?: string,
    @Query('areaId') areaId?: string,
    @Query('cargoId') cargoId?: string
  ) {
    const include = includeInactive === 'true';
    return await this.empleadosService.findAllEmpleados(include, areaId, cargoId);
  }

  @Get('stats')
  @RequirePermissions('rrhh:empleados:read')
  async getEmpleadosStats() {
    return await this.empleadosService.getEmpleadosStats();
  }

  @Get(':id')
  @RequirePermissions('rrhh:empleados:read')
  async findEmpleadoById(@Param('id') id: string) {
    return await this.empleadosService.findEmpleadoById(id);
  }

  @Patch(':id')
  @RequirePermissions('rrhh:empleados:update')
  async updateEmpleado(@Param('id') id: string, @Body() updateEmpleadoDto: UpdateEmpleadoDto) {
    return await this.empleadosService.updateEmpleado(id, updateEmpleadoDto);
  }

  @Delete(':id')
  @RequirePermissions('rrhh:empleados:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEmpleado(@Param('id') id: string) {
    await this.empleadosService.deleteEmpleado(id);
  }

  // ========== CONTRATOS ==========

  @Get(':id/contratos')
  @RequirePermissions('rrhh:contratos:read')
  async findContratosByEmpleado(@Param('id') empleadoId: string) {
    return await this.empleadosService.findContratosByEmpleado(empleadoId);
  }

  @Patch('contratos/:contratoId/aprobar')
  @RequirePermissions('rrhh:contratos:approve')
  async aprobarContrato(
    @Param('contratoId') contratoId: string,
    @Body() aprobarDto: AprobarContratoDto,
    @User() user: any
  ) {
    return await this.empleadosService.aprobarContrato(contratoId, aprobarDto, user.id);
  }

  // ========== FOTOS ==========

  @Post('upload-photo')
  @RequirePermissions('rrhh:empleados:update')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(@UploadedFile() file: any) {
    if (!file) {
      throw new Error('No se proporcionó ningún archivo');
    }

    // Validar archivo
    const validation = this.cloudinaryService.validateImageFile(file);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      // Subir a Cloudinary usando uploadBuffer para URLs más simples
      const result = await this.cloudinaryService.uploadBuffer(file.buffer, {
        folder: 'only-top/employee-photos',
        public_id: `employee_${Date.now()}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      });

      if (!result.success || !result.data) {
        throw new Error(result.message || 'Error al subir la foto');
      }

      return {
        success: true,
        data: {
          url: result.data.url,
          publicId: result.data.publicId,
        },
      };
    } catch (error: any) {
      throw new Error(`Error al subir la foto: ${error.message}`);
    }
  }

  // ========== CREAR CUENTA DE USUARIO ==========

  @Post(':id/crear-cuenta')
  @RequirePermissions('sistema.empleados.crear_cuenta')
  async crearCuentaParaEmpleado(@Param('id') empleadoId: string) {
    return await this.empleadosService.crearCuentaParaEmpleado(empleadoId);
  }

  @Post(':id/reset-password')
  @RequirePermissions('sistema.empleados.crear_cuenta')
  async resetPasswordEmpleado(@Param('id') empleadoId: string) {
    return await this.empleadosService.resetPasswordEmpleado(empleadoId);
  }

  @Patch(':id/editar-cuenta')
  @RequirePermissions('sistema.empleados.crear_cuenta')
  async editarCuentaEmpleado(@Param('id') empleadoId: string, @Body() updateData: { username?: string; email?: string; displayName?: string }) {
    return await this.empleadosService.editarCuentaEmpleado(empleadoId, updateData);
  }

  // ========== PLANTILLAS DE CUMPLEAÑOS ==========

  @Get('birthday-templates')
  @RequirePermissions('rrhh:empleados:read')
  async getBirthdayTemplates() {
    return await this.birthdayEmailService.getActiveTemplates();
  }

  @Get('birthday-templates/default')
  @RequirePermissions('rrhh:empleados:read')
  async getDefaultBirthdayTemplate() {
    return await this.birthdayEmailService.getDefaultTemplate();
  }

  @Post('birthday-templates/create-defaults')
  @RequirePermissions('rrhh:empleados:create')
  async createDefaultBirthdayTemplates() {
    await this.birthdayEmailService.createDefaultTemplates();
    return { message: 'Plantillas predeterminadas creadas exitosamente' };
  }

  @Get('birthday-stats')
  @RequirePermissions('rrhh:empleados:read')
  async getBirthdayStats() {
    return await this.birthdayScheduler.getBirthdayStats();
  }

  @Post('birthday-check')
  @RequirePermissions('rrhh:empleados:read')
  async manualBirthdayCheck(@Query('days') days?: string) {
    const daysBefore = days ? parseInt(days) : 2;
    return await this.birthdayScheduler.manualBirthdayCheck(daysBefore);
  }

  // ========== CONTRATOS LABORALES ==========

  @Get(':id/contrato-laboral')
  @RequirePermissions('rrhh:contratos:read')
  async generateLaborContract(@Param('id') empleadoId: string) {
    const pdfBuffer = await this.empleadosService.generateLaborContract(empleadoId);
    
    // Obtener información del empleado para el nombre del archivo
    const empleado = await this.empleadosService.findEmpleadoById(empleadoId);
    const filename = `contrato_laboral_${empleado.nombre}_${empleado.apellido}.pdf`;
    
    return {
      success: true,
      data: {
        pdfBuffer: pdfBuffer.toString('base64'),
        filename,
        mimeType: 'application/pdf',
      },
    };
  }

  @Get(':id/contrato-laboral/info')
  @RequirePermissions('rrhh:contratos:read')
  async getLaborContractInfo(@Param('id') empleadoId: string) {
    return await this.empleadosService.getLaborContractInfo(empleadoId);
  }

  @Get('contratos/plantillas')
  @RequirePermissions('rrhh:contratos:read')
  async getAvailableContractTemplates() {
    const templates = await this.empleadosService.getAvailableContractTemplates();
    console.log('Controller returning templates:', templates);
    return templates;
  }

  @Get('contratos/plantillas/area/:areaCode')
  @RequirePermissions('rrhh:contratos:read')
  async getContractTemplatesByArea(@Param('areaCode') areaCode: string) {
    return await this.empleadosService.getContractTemplatesByArea(areaCode);
  }

  @Get('contratos/plantillas/cargo/:cargoCode')
  @RequirePermissions('rrhh:contratos:read')
  async getContractTemplatesByCargo(@Param('cargoCode') cargoCode: string) {
    return await this.empleadosService.getContractTemplatesByCargo(cargoCode);
  }

  @Get(':id/contrato-laboral/validar')
  @RequirePermissions('rrhh:contratos:read')
  async validateContractTemplateExists(@Param('id') empleadoId: string) {
    const empleado = await this.empleadosService.findEmpleadoById(empleadoId);
    const exists = await this.empleadosService.validateContractTemplateExists(empleadoId);
    
    if (exists) {
      // Obtener información de la plantilla
      const areaCode = (empleado.areaId as any)?.code;
      const cargoCode = (empleado.cargoId as any)?.code;
      
      // Buscar la plantilla específica
      const templates = await this.empleadosService.getAvailableContractTemplates();
      const template = templates.find(t => t.areaCode === areaCode && t.cargoCode === cargoCode);
      
      return {
        tienePlantilla: true,
        templateId: template?.templateId,
        templateName: template?.name,
        areaCode,
        cargoCode,
        message: 'Plantilla de contrato disponible',
      };
    }
    
    return {
      tienePlantilla: false,
      message: 'No hay plantilla disponible para este empleado',
    };
  }

  // ========== MIGRACIÓN DE PLANTILLAS ==========

  @Post('contratos/plantillas/asignar')
  @RequirePermissions('rrhh:contratos:create')
  async assignContractTemplates() {
    await this.assignTemplatesMigration.assignContractTemplates();
    return { message: 'Plantillas de contratos asignadas exitosamente' };
  }

  @Get('contratos/plantillas/verificar')
  @RequirePermissions('rrhh:contratos:read')
  async verifyTemplateAssignments() {
    return await this.assignTemplatesMigration.verifyTemplateAssignments();
  }

  @Delete('contratos/plantillas/limpiar')
  @RequirePermissions('rrhh:contratos:delete')
  async clearTemplateAssignments() {
    await this.assignTemplatesMigration.clearTemplateAssignments();
    return { message: 'Asignaciones de plantillas limpiadas exitosamente' };
  }

  // ========== DOTACIÓN ==========

  @Get(':id/dotacion/historial')
  @RequirePermissions('rrhh:endowment:read')
  async getEmpleadoDotacionHistorial(@Param('id') empleadoId: string) {
    return await this.empleadosService.getEmpleadoDotacionHistorial(empleadoId);
  }

  @Get(':id/dotacion/activa')
  @RequirePermissions('rrhh:endowment:read')
  async getEmpleadoDotacionActiva(@Param('id') empleadoId: string) {
    return await this.empleadosService.getEmpleadoDotacionActiva(empleadoId);
  }

  @Get(':id/dotacion/resumen')
  @RequirePermissions('rrhh:endowment:read')
  async getEmpleadoDotacionResumen(@Param('id') empleadoId: string) {
    return await this.empleadosService.getEmpleadoDotacionResumen(empleadoId);
  }
}
