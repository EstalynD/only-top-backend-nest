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
  ParseBoolPipe,
  DefaultValuePipe
} from '@nestjs/common';
import { EndowmentService } from './endowment.service.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { RequirePermissions } from '../../rbac/rbac.decorators.js';
import { User } from '../../auth/user.decorator.js';
import {
  CreateEndowmentCategoryDto,
  UpdateEndowmentCategoryDto,
  CreateEndowmentItemDto,
  UpdateEndowmentItemDto,
  CreateEndowmentTrackingDto,
  UpdateEndowmentTrackingDto,
  EndowmentTrackingQueryDto,
  EndowmentStatsQueryDto
} from './dto/endowment.dto.js';

@Controller('api/rrhh/endowment')
@UseGuards(AuthGuard)
export class EndowmentController {
  constructor(private readonly endowmentService: EndowmentService) {}

  // ========== CATEGORÍAS ==========

  @Post('categories')
  @RequirePermissions('rrhh:endowment:create')
  async createCategory(@Body() createCategoryDto: CreateEndowmentCategoryDto) {
    return await this.endowmentService.createCategory(createCategoryDto);
  }

  @Get('categories')
  @RequirePermissions('rrhh:endowment:read')
  async findAllCategories(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean
  ) {
    return await this.endowmentService.findAllCategories(includeInactive);
  }

  @Get('categories/:id')
  @RequirePermissions('rrhh:endowment:read')
  async findCategoryById(@Param('id') id: string) {
    return await this.endowmentService.findCategoryById(id);
  }

  @Patch('categories/:id')
  @RequirePermissions('rrhh:endowment:update')
  async updateCategory(
    @Param('id') id: string, 
    @Body() updateCategoryDto: UpdateEndowmentCategoryDto
  ) {
    return await this.endowmentService.updateCategory(id, updateCategoryDto);
  }

  @Delete('categories/:id')
  @RequirePermissions('rrhh:endowment:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string) {
    await this.endowmentService.deleteCategory(id);
  }

  // ========== ELEMENTOS ==========

  @Post('items')
  @RequirePermissions('rrhh:endowment:create')
  async createItem(@Body() createItemDto: CreateEndowmentItemDto) {
    return await this.endowmentService.createItem(createItemDto);
  }

  @Get('items')
  @RequirePermissions('rrhh:endowment:read')
  async findAllItems(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('categoryId') categoryId?: string
  ) {
    return await this.endowmentService.findAllItems(includeInactive, categoryId);
  }

  @Get('items/:id')
  @RequirePermissions('rrhh:endowment:read')
  async findItemById(@Param('id') id: string) {
    return await this.endowmentService.findItemById(id);
  }

  @Patch('items/:id')
  @RequirePermissions('rrhh:endowment:update')
  async updateItem(
    @Param('id') id: string, 
    @Body() updateItemDto: UpdateEndowmentItemDto
  ) {
    return await this.endowmentService.updateItem(id, updateItemDto);
  }

  @Delete('items/:id')
  @RequirePermissions('rrhh:endowment:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteItem(@Param('id') id: string) {
    await this.endowmentService.deleteItem(id);
  }

  // ========== SEGUIMIENTO ==========

  @Post('tracking')
  @RequirePermissions('rrhh:endowment:create')
  async createTracking(
    @Body() createTrackingDto: CreateEndowmentTrackingDto,
    @User() user: any
  ) {
    return await this.endowmentService.createTracking(createTrackingDto, user.id);
  }

  @Get('tracking')
  @RequirePermissions('rrhh:endowment:read')
  async findAllTracking(@Query() query: EndowmentTrackingQueryDto) {
    return await this.endowmentService.findAllTracking(query);
  }

  @Get('tracking/:id')
  @RequirePermissions('rrhh:endowment:read')
  async findTrackingById(@Param('id') id: string) {
    return await this.endowmentService.findTrackingById(id);
  }

  @Get('tracking/empleado/:empleadoId')
  @RequirePermissions('rrhh:endowment:read')
  async findTrackingByEmpleado(@Param('empleadoId') empleadoId: string) {
    return await this.endowmentService.findTrackingByEmpleado(empleadoId);
  }

  @Patch('tracking/:id')
  @RequirePermissions('rrhh:endowment:update')
  async updateTracking(
    @Param('id') id: string, 
    @Body() updateTrackingDto: UpdateEndowmentTrackingDto
  ) {
    return await this.endowmentService.updateTracking(id, updateTrackingDto);
  }

  @Delete('tracking/:id')
  @RequirePermissions('rrhh:endowment:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTracking(@Param('id') id: string) {
    await this.endowmentService.deleteTracking(id);
  }

  // ========== ESTADÍSTICAS ==========

  @Get('stats')
  @RequirePermissions('rrhh:endowment:read')
  async getEndowmentStats(@Query() query: EndowmentStatsQueryDto) {
    return await this.endowmentService.getEndowmentStats(query);
  }

  // ========== ENDPOINTS ESPECÍFICOS PARA EMPLEADOS ==========

  @Get('empleados/:empleadoId/historial')
  @RequirePermissions('rrhh:endowment:read')
  async getEmpleadoHistorial(@Param('empleadoId') empleadoId: string) {
    return await this.endowmentService.findTrackingByEmpleado(empleadoId);
  }

  @Get('empleados/:empleadoId/items-activos')
  @RequirePermissions('rrhh:endowment:read')
  async getEmpleadoItemsActivos(@Param('empleadoId') empleadoId: string) {
    // Obtener todos los seguimientos del empleado
    const tracking = await this.endowmentService.findAllTracking({ empleadoId });
    
    // Filtrar solo entregas activas (sin devolución correspondiente)
    const entregasActivas = tracking.filter(t => {
      if (t.action !== 'ENTREGA') return false;
      
      // Buscar si hay una devolución posterior para este elemento
      const devolucion = tracking.find(d => 
        d.itemId._id === t.itemId._id && 
        d.action === 'DEVOLUCION' && 
        new Date(d.actionDate) > new Date(t.actionDate)
      );
      
      return !devolucion;
    });

    return entregasActivas;
  }

  @Get('empleados/:empleadoId/resumen')
  @RequirePermissions('rrhh:endowment:read')
  async getEmpleadoResumen(@Param('empleadoId') empleadoId: string) {
    const tracking = await this.endowmentService.findAllTracking({ empleadoId });
    
    const resumen = {
      totalEntregas: tracking.filter(t => t.action === 'ENTREGA').length,
      totalDevoluciones: tracking.filter(t => t.action === 'DEVOLUCION').length,
      totalMantenimientos: tracking.filter(t => t.action === 'MANTENIMIENTO').length,
      totalReparaciones: tracking.filter(t => t.action === 'REPARACION').length,
      totalReemplazos: tracking.filter(t => t.action === 'REEMPLAZO').length,
      itemsActivos: 0,
      categorias: new Set<string>(),
      valorTotalEstimado: 0
    };

    // Calcular items activos y categorías
    const entregasActivas = tracking.filter(t => {
      if (t.action !== 'ENTREGA') return false;
      
      const devolucion = tracking.find(d => 
        d.itemId._id === t.itemId._id && 
        d.action === 'DEVOLUCION' && 
        new Date(d.actionDate) > new Date(t.actionDate)
      );
      
      return !devolucion;
    });

    resumen.itemsActivos = entregasActivas.length;
    
    entregasActivas.forEach(entrega => {
      resumen.categorias.add(entrega.categoryId.name);
      if (entrega.itemId.estimatedValue) {
        resumen.valorTotalEstimado += entrega.itemId.estimatedValue.monto;
      }
    });

    return {
      ...resumen,
      categorias: Array.from(resumen.categorias)
    };
  }

  // ========== ENDPOINTS PARA ÁREAS ==========

  @Get('areas/:areaId/estadisticas')
  @RequirePermissions('rrhh:endowment:read')
  async getAreaEstadisticas(@Param('areaId') areaId: string) {
    return await this.endowmentService.getEndowmentStats({ areaId });
  }

  @Get('areas/:areaId/empleados-con-dotacion')
  @RequirePermissions('rrhh:endowment:read')
  async getAreaEmpleadosConDotacion(@Param('areaId') areaId: string) {
    // Obtener todos los empleados del área
    const empleados = await this.endowmentService['empleadoModel']
      .find({ areaId: areaId, estado: 'ACTIVO' })
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .exec();

    // Para cada empleado, obtener su resumen de dotación
    const empleadosConDotacion = await Promise.all(
      empleados.map(async (empleado) => {
        const resumen = await this.getEmpleadoResumen(empleado._id.toString());
        return {
          empleado: {
            _id: empleado._id,
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            correoElectronico: empleado.correoElectronico,
            areaId: empleado.areaId,
            cargoId: empleado.cargoId
          },
          dotacion: resumen
        };
      })
    );

    // Filtrar solo empleados que tienen dotación activa
    return empleadosConDotacion.filter(e => e.dotacion.itemsActivos > 0);
  }

  // ========== ENDPOINTS PARA REPORTES ==========

  @Get('reportes/entregas-pendientes')
  @RequirePermissions('rrhh:endowment:read')
  async getEntregasPendientes() {
    const tracking = await this.endowmentService.findAllTracking({});
    
    // Filtrar entregas que no tienen devolución
    const entregasPendientes = tracking.filter(t => {
      if (t.action !== 'ENTREGA') return false;
      
      const devolucion = tracking.find(d => 
        d.itemId._id === t.itemId._id && 
        d.empleadoId._id === t.empleadoId._id &&
        d.action === 'DEVOLUCION' && 
        new Date(d.actionDate) > new Date(t.actionDate)
      );
      
      return !devolucion;
    });

    return {
      total: entregasPendientes.length,
      entregas: entregasPendientes
    };
  }

  @Get('reportes/items-mas-entregados')
  @RequirePermissions('rrhh:endowment:read')
  async getItemsMasEntregados(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    const stats = await this.endowmentService.getEndowmentStats({});
    
    return {
      items: stats.topDeliveredItems.slice(0, limitNum)
    };
  }

  @Get('reportes/valor-total-dotacion')
  @RequirePermissions('rrhh:endowment:read')
  async getValorTotalDotacion() {
    const stats = await this.endowmentService.getEndowmentStats({});
    
    const valorTotal = stats.itemsByCategory.reduce((total, category) => {
      return total + category.totalValue;
    }, 0);

    return {
      valorTotal,
      desglosePorCategoria: stats.itemsByCategory
    };
  }
}
