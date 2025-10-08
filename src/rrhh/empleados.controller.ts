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

@Controller('api/rrhh/empleados')
@UseGuards(AuthGuard)
export class EmpleadosController {
  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly cloudinaryService: CloudinaryService
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
      // Subir a Cloudinary
      const result = await this.cloudinaryService.uploadFromBuffer(
        file.buffer,
        file.originalname,
        {
          folder: 'only-top/employee-photos',
          public_id: `employee_${Date.now()}`,
        }
      );

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
}
