import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { GastosFijosQuincenalesService } from './gastos-fijos-quincenales.service.js';
import {
  RegistrarGastoFijoDto,
  ActualizarGastoFijoDto,
  AprobarGastoDto,
  ConsolidarResumenMensualDto,
  GenerarNominaQuincenalDto,
  QuincenaEnum,
} from './dto/gastos-fijos.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';

/**
 * GastosFijosController - Controlador para gestión de gastos fijos quincenales
 * 
 * Endpoints:
 * - Registro de gastos discriminados por quincena
 * - Resúmenes quincenales y mensuales
 * - Utilidad neta y comparativas mes a mes
 * - Generación automática de nómina
 * - Aprobación de gastos
 */
@Controller('api/finanzas/gastos-fijos')
@UseGuards(AuthGuard)
export class GastosFijosQuincenalesController {
  constructor(
    private readonly gastosService: GastosFijosQuincenalesService,
  ) {}

  // ========== CRUD DE GASTOS ==========

  /**
   * POST /api/finanzas/gastos-fijos/registrar
   * 
   * Registra un nuevo gasto fijo quincenal
   */
  @Post('registrar')
  @RequirePermissions('finanzas:gastos:write')
  @HttpCode(HttpStatus.OK)
  async registrarGasto(
    @Body() dto: RegistrarGastoFijoDto,
    @Req() req: any,
  ) {
    const gasto = await this.gastosService.registrarGasto(dto, req.user.id);
    return {
      success: true,
      message: 'Gasto registrado exitosamente',
      data: gasto,
    };
  }

  /**
   * PATCH /api/finanzas/gastos-fijos/:id
   * 
   * Actualiza un gasto existente
   */
  @Patch(':id')
  @RequirePermissions('finanzas:gastos:write')
  async actualizarGasto(
    @Param('id') id: string,
    @Body() dto: ActualizarGastoFijoDto,
  ) {
    const gasto = await this.gastosService.actualizarGasto(id, dto);
    return {
      success: true,
      message: 'Gasto actualizado exitosamente',
      data: gasto,
    };
  }

  /**
   * PATCH /api/finanzas/gastos-fijos/:id/aprobar
   * 
   * Aprueba o rechaza un gasto
   */
  @Patch(':id/aprobar')
  @RequirePermissions('finanzas:gastos:approve')
  async aprobarGasto(
    @Param('id') id: string,
    @Body() dto: AprobarGastoDto,
    @Req() req: any,
  ) {
    const gasto = await this.gastosService.aprobarGasto(id, dto, req.user.id);
    return {
      success: true,
      message: `Gasto ${dto.estado.toLowerCase()} exitosamente`,
      data: gasto,
    };
  }

  /**
   * DELETE /api/finanzas/gastos-fijos/:id
   * 
   * Elimina (soft delete) un gasto
   */
  @Delete(':id')
  @RequirePermissions('finanzas:gastos:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarGasto(@Param('id') id: string) {
    await this.gastosService.eliminarGasto(id);
  }

  // ========== RESÚMENES Y CONSULTAS ==========

  /**
   * GET /api/finanzas/gastos-fijos/resumen-quincenal
   * 
   * Obtiene resumen de gastos de una quincena específica
   * 
   * Query params:
   * - mes: number (1-12)
   * - anio: number
   * - quincena: 'PRIMERA_QUINCENA' | 'SEGUNDA_QUINCENA'
   */
  @Get('resumen-quincenal')
  @RequirePermissions('finanzas:gastos:read')
  async obtenerResumenQuincenal(
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @Query('quincena') quincena: QuincenaEnum,
  ) {
    const mesNum = parseInt(mes, 10);
    const anioNum = parseInt(anio, 10);
    
    const resumen = await this.gastosService.obtenerResumenQuincenal(
      mesNum,
      anioNum,
      quincena,
    );
    
    return {
      success: true,
      data: resumen,
    };
  }

  /**
   * GET /api/finanzas/gastos-fijos/resumen-mensual
   * 
   * Obtiene resumen mensual consolidado con utilidad neta y comparativa
   * 
   * Query params:
   * - mes: number (1-12)
   * - anio: number
   */
  @Get('resumen-mensual')
  @RequirePermissions('finanzas:gastos:read')
  async obtenerResumenMensual(
    @Query('mes') mes: string,
    @Query('anio') anio: string,
  ) {
    const mesNum = parseInt(mes, 10);
    const anioNum = parseInt(anio, 10);
    
    const resumen = await this.gastosService.obtenerResumenMensual(mesNum, anioNum);
    
    return {
      success: true,
      data: resumen,
    };
  }

  /**
   * POST /api/finanzas/gastos-fijos/consolidar
   * 
   * Consolida el resumen mensual (cierra el periodo)
   */
  @Post('consolidar')
  @RequirePermissions('finanzas:admin')
  @HttpCode(HttpStatus.OK)
  async consolidarResumenMensual(
    @Body() dto: ConsolidarResumenMensualDto,
    @Req() req: any,
  ) {
    const resumen = await this.gastosService.consolidarResumenMensual(dto, req.user.id);
    
    return {
      success: true,
      message: 'Resumen mensual consolidado exitosamente',
      data: resumen,
    };
  }

  /**
   * GET /api/finanzas/gastos-fijos/comparativa
   * 
   * Obtiene comparativa de múltiples meses
   * 
   * Query params:
   * - anio: number
   * - cantidadMeses?: number (default: 12)
   */
  @Get('comparativa')
  @RequirePermissions('finanzas:gastos:read')
  async obtenerComparativaMensual(
    @Query('anio') anio: string,
    @Query('cantidadMeses') cantidadMeses?: string,
  ) {
    const anioNum = parseInt(anio, 10);
    const cantidad = cantidadMeses ? parseInt(cantidadMeses, 10) : 12;
    
    const comparativa = await this.gastosService.obtenerComparativaMensual(
      anioNum,
      cantidad,
    );
    
    return {
      success: true,
      data: comparativa,
    };
  }

  // ========== GENERACIÓN AUTOMÁTICA ==========

  /**
   * POST /api/finanzas/gastos-fijos/generar-nomina
   * 
   * Genera automáticamente los gastos de nómina desde empleados RRHH
   */
  @Post('generar-nomina')
  @RequirePermissions('finanzas:gastos:write')
  @HttpCode(HttpStatus.OK)
  async generarNominaQuincenal(
    @Body() dto: GenerarNominaQuincenalDto,
    @Req() req: any,
  ) {
    const resultado = await this.gastosService.generarNominaQuincenal(dto, req.user.id);
    
    return {
      success: true,
      message: `Nómina generada: ${resultado.generados} empleados`,
      data: resultado,
    };
  }
}
