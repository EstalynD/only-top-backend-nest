import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModelosService } from './modelos.service.js';
import { CreateModeloDto } from './dto/create-modelo.dto.js';
import { UpdateModeloDto } from './dto/update-modelo.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

@Controller('api/rrhh/modelos')
@UseGuards(AuthGuard)
export class ModelosController {
  constructor(
    private readonly modelosService: ModelosService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ========== CRUD DE MODELOS ==========

  @Post()
  @RequirePermissions('clientes:modelos:create')
  async createModelo(@Body() createModeloDto: CreateModeloDto) {
    return await this.modelosService.createModelo(createModeloDto);
  }

  @Get()
  @RequirePermissions('clientes:modelos:read')
  async findAllModelos(
    @Query('includeInactive') includeInactive?: string,
    @Query('salesCloserId') salesCloserId?: string,
    @Query('traffickerId') traffickerId?: string,
  ) {
    const include = includeInactive === 'true';
    return await this.modelosService.findAllModelos(include, salesCloserId, traffickerId);
  }

  @Get('stats')
  @RequirePermissions('clientes:modelos:read')
  async getModelosStats() {
    return await this.modelosService.getModelosStats();
  }

  @Get(':id')
  @RequirePermissions('clientes:modelos:read')
  async findModeloById(@Param('id') id: string) {
    return await this.modelosService.findModeloById(id);
  }

  @Patch(':id')
  @RequirePermissions('clientes:modelos:update')
  async updateModelo(@Param('id') id: string, @Body() updateModeloDto: UpdateModeloDto) {
    return await this.modelosService.updateModelo(id, updateModeloDto);
  }

  @Delete(':id')
  @RequirePermissions('clientes:modelos:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteModelo(@Param('id') id: string) {
    await this.modelosService.deleteModelo(id);
  }

  // ========== FOTOS DE PERFIL ==========

  @Post('upload-photo')
  @RequirePermissions('clientes:modelos:update')
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
        folder: 'only-top/model-photos',
        public_id: `model_${Date.now()}`,
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

  // ========== EMPLEADOS DISPONIBLES POR CARGO ==========

  @Get('disponibles/sales-closers')
  @RequirePermissions('clientes:modelos:read')
  async getSalesClosersDisponibles() {
    return await this.modelosService.getEmpleadosPorCargo('REC_SC');
  }

  @Get('disponibles/chatters')
  @RequirePermissions('clientes:modelos:read')
  async getChattersDisponibles() {
    const chatters = await this.modelosService.getEmpleadosPorCargo('SLS_CHT');
    const supernumerarios = await this.modelosService.getEmpleadosPorCargo('SLS_CHS');
    
    return {
      chatters,
      supernumerarios,
      todos: [...chatters, ...supernumerarios],
    };
  }

  @Get('disponibles/traffickers')
  @RequirePermissions('clientes:modelos:read')
  async getTraffickersDisponibles() {
    return await this.modelosService.getEmpleadosPorCargo('TRF_TRF');
  }

  // ========== MÓDULO DE VENTAS DE MODELOS ==========

  /**
   * Obtener ventas de una modelo con filtros avanzados
   * GET /api/rrhh/modelos/:id/ventas
   */
  @Get(':id/ventas')
  @RequirePermissions('ventas:modelos:read')
  async getModeloSales(
    @Param('id') id: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('chatterId') chatterId?: string,
    @Query('turno') turno?: string,
    @Query('tipoVenta') tipoVenta?: string,
    @Query('plataforma') plataforma?: string,
  ) {
    return await this.modelosService.getModeloSales(id, {
      fechaInicio,
      fechaFin,
      chatterId,
      turno,
      tipoVenta,
      plataforma,
    });
  }

  /**
   * Obtener estadísticas de ventas de una modelo
   * GET /api/rrhh/modelos/:id/ventas/estadisticas
   */
  @Get(':id/ventas/estadisticas')
  @RequirePermissions('ventas:modelos:read')
  async getModeloSalesStatistics(
    @Param('id') id: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.modelosService.getModeloSalesStatistics(id, fechaInicio, fechaFin);
  }

  /**
   * Comparar ventas entre múltiples modelos
   * POST /api/rrhh/modelos/ventas/comparar
   */
  @Post('ventas/comparar')
  @RequirePermissions('ventas:modelos:read')
  async compareModelosSales(
    @Body() body: { modeloIds: string[]; fechaInicio?: string; fechaFin?: string },
  ) {
    return await this.modelosService.compareModelosSales(
      body.modeloIds,
      body.fechaInicio,
      body.fechaFin,
    );
  }

  /**
   * Obtener ventas agrupadas por diferentes criterios
   * GET /api/rrhh/modelos/ventas/agrupadas
   */
  @Get('ventas/agrupadas')
  @RequirePermissions('ventas:modelos:read')
  async getModelosSalesGrouped(
    @Query('groupBy') groupBy: 'salesCloser' | 'trafficker' | 'estado' | 'mes',
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.modelosService.getModelosSalesGrouped(groupBy, fechaInicio, fechaFin);
  }

  /**
   * Dashboard general de ventas (todas las modelos)
   * GET /api/rrhh/modelos/ventas/dashboard
   */
  @Get('ventas/dashboard')
  @RequirePermissions('ventas:modelos:read')
  async getGeneralSalesDashboard(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.modelosService.getGeneralSalesDashboard(fechaInicio, fechaFin);
  }

  /**
   * Obtener indicadores completos de ventas y rentabilidad
   * GET /api/rrhh/modelos/ventas/indicadores
   */
  @Get('ventas/indicadores')
  @RequirePermissions('ventas:modelos:read')
  async getIndicadoresVentas(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return await this.modelosService.getIndicadoresVentas(fechaInicio, fechaFin);
  }

  /**
   * Exportar ventas a Excel
   * GET /api/rrhh/modelos/ventas/exportar/excel
   */
  @Get('ventas/exportar/excel')
  @RequirePermissions('ventas:modelos:export')
  async exportVentasExcel(
    @Res() res: any,
    @Query('modeloId') modeloId?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('chatterId') chatterId?: string,
    @Query('turno') turno?: string,
    @Query('tipoVenta') tipoVenta?: string,
  ) {
    const buffer = await this.modelosService.exportVentasToExcel({
      modeloId,
      fechaInicio,
      fechaFin,
      chatterId,
      turno,
      tipoVenta,
    });

    const filename = `ventas_modelos_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    return res.send(buffer);
  }

  /**
   * Exportar ventas a PDF
   * GET /api/rrhh/modelos/ventas/exportar/pdf
   */
  @Get('ventas/exportar/pdf')
  @RequirePermissions('ventas:modelos:export')
  async exportVentasPdf(
    @Res() res: any,
    @Query('modeloId') modeloId?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('chatterId') chatterId?: string,
    @Query('turno') turno?: string,
    @Query('tipoVenta') tipoVenta?: string,
  ) {
    const buffer = await this.modelosService.exportVentasToPdf({
      modeloId,
      fechaInicio,
      fechaFin,
      chatterId,
      turno,
      tipoVenta,
    });

    const filename = `ventas_modelos_${new Date().toISOString().split('T')[0]}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    return res.send(buffer);
  }
}

