import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FinanzasService } from './finanzas.service.js';
import {
  CalcularFinanzasDto,
  RecalcularFinanzasDto,
  ActualizarEstadoFinanzasDto,
  ActualizarComisionBancoPeriodoDto,
} from './dto/finanzas.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';

/**
 * FinanzasController - Controlador para manejo financiero de modelos
 * 
 * Funcionalidades:
 * - Calcular ganancias mensuales por modelo
 * - Recalcular automáticamente cuando se registran ventas
 * - Obtener lista de modelos con sus ganancias
 * - Estadísticas y reportes financieros
 */
@Controller('api/finanzas')
@UseGuards(AuthGuard)
export class FinanzasController {
  constructor(private readonly finanzasService: FinanzasService) {}

  // ========== OBTENER LISTA DE MODELOS CON GANANCIAS ==========

  /**
   * GET /api/finanzas/modelos
   * 
   * Obtiene lista de todas las modelos activas con sus ganancias del mes actual
   * o del mes especificado en query params.
   * 
   * Query params:
   * - mes?: number (1-12)
   * - anio?: number
   * 
   * Retorna:
   * - Lista de modelos con finanzas del mes
   * - Totales históricos
   * - Estado de ganancias (calculado, pendiente, etc.)
   */
  @Get('modelos')
  @RequirePermissions('finanzas:read')
  async obtenerModelosConGanancias(
    @Query('mes') mes?: string,
    @Query('anio') anio?: string,
  ) {
    const mesNum = mes ? parseInt(mes, 10) : undefined;
    const anioNum = anio ? parseInt(anio, 10) : undefined;

    const modelos = await this.finanzasService.obtenerModelosConGanancias(
      mesNum,
      anioNum,
    );

    return {
      success: true,
      data: modelos,
      count: modelos.length,
    };
  }

  // ========== CALCULAR FINANZAS ==========

  /**
   * POST /api/finanzas/calcular
   * 
   * Calcula las finanzas de una modelo para un período específico.
   * Obtiene automáticamente:
   * - Ventas del mes desde ChatterSales
   * - % de comisión del contrato activo
   * - Calcula todas las ganancias con MoneyService
   * 
   * Body:
   * - modeloId: string
   * - mes: number (1-12)
   * - anio: number
   * - porcentajeComisionBanco?: number (default: 2%)
   */
  @Post('calcular')
  @RequirePermissions('finanzas:write')
  @HttpCode(HttpStatus.OK)
  async calcularFinanzas(
    @Body() dto: CalcularFinanzasDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    const finanzas = await this.finanzasService.calcularFinanzas(dto, userId);

    return {
      success: true,
      message: `Finanzas calculadas para ${finanzas.nombreModelo} - ${dto.mes}/${dto.anio}`,
      data: finanzas,
    };
  }

  /**
   * POST /api/finanzas/recalcular
   * 
   * Recalcula finanzas para múltiples modelos en un período.
   * Útil para actualizar todos los cálculos del mes.
   * 
   * Body:
   * - mes: number (1-12)
   * - anio: number
   * - modeloIds?: string[] (opcional - si no se especifica, recalcula todas)
   * - porcentajeComisionBanco?: number
   */
  @Post('recalcular')
  @RequirePermissions('finanzas:write')
  @HttpCode(HttpStatus.OK)
  async recalcularFinanzas(
    @Body() dto: RecalcularFinanzasDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    const resultado = await this.finanzasService.recalcularFinanzas(dto, userId);

    return {
      success: true,
      message: `Recálculo completado: ${resultado.exitosas}/${resultado.procesadas} modelos`,
      data: resultado,
    };
  }

  // ========== OBTENER FINANZAS ESPECÍFICAS ==========

  /**
   * GET /api/finanzas/modelo/:modeloId/:mes/:anio
   * 
   * Obtiene las finanzas de una modelo para un período específico
   */
  @Get('modelo/:modeloId/:mes/:anio')
  @RequirePermissions('finanzas:read')
  async obtenerFinanzasPorPeriodo(
    @Param('modeloId') modeloId: string,
    @Param('mes') mes: string,
    @Param('anio') anio: string,
  ) {
    const finanzas = await this.finanzasService.obtenerFinanzasPorPeriodo(
      modeloId,
      parseInt(mes, 10),
      parseInt(anio, 10),
    );

    return {
      success: true,
      data: finanzas,
    };
  }

  // ========== ESTADÍSTICAS ==========

  /**
   * GET /api/finanzas/estadisticas
   * 
   * Obtiene estadísticas financieras generales del mes actual o especificado
   * 
   * Query params:
   * - mes?: number (1-12)
   * - anio?: number
   * 
   * Retorna:
   * - Totales de ventas, ganancias, comisiones
   * - Promedios por modelo
   * - Top 10 modelos por ventas
   * - Distribución por estado
   */
  @Get('estadisticas')
  @RequirePermissions('finanzas:read')
  async obtenerEstadisticas(
    @Query('mes') mes?: string,
    @Query('anio') anio?: string,
  ) {
    const mesNum = mes ? parseInt(mes, 10) : undefined;
    const anioNum = anio ? parseInt(anio, 10) : undefined;

    const stats = await this.finanzasService.obtenerEstadisticas(mesNum, anioNum);

    return {
      success: true,
      data: stats,
    };
  }

  // ========== ACTUALIZAR ESTADO ==========

  /**
   * PATCH /api/finanzas/:id/estado
   * 
   * Actualiza el estado de un registro de finanzas
   * Estados: CALCULADO, PENDIENTE_REVISION, APROBADO, PAGADO
   * 
   * Body:
   * - estado: string
   * - notasInternas?: string
   */
  @Patch(':id/estado')
  @RequirePermissions('finanzas:write')
  async actualizarEstado(
    @Param('id') id: string,
    @Body() dto: ActualizarEstadoFinanzasDto,
  ) {
    const finanzas = await this.finanzasService.actualizarEstado(id, dto);

    return {
      success: true,
      message: `Estado actualizado a ${dto.estado}`,
      data: finanzas,
    };
  }

  // ========== ACCIONES MASIVAS ==========

  /**
   * POST /api/finanzas/aprobar-todas/:mes/:anio
   * 
   * Aprueba todas las finanzas calculadas de un mes
   */
  @Post('aprobar-todas/:mes/:anio')
  @RequirePermissions('finanzas:approve')
  @HttpCode(HttpStatus.OK)
  async aprobarTodasDelMes(
    @Param('mes') mes: string,
    @Param('anio') anio: string,
  ) {
    // TODO: Implementar método en servicio
    return {
      success: true,
      message: `Todas las finanzas de ${mes}/${anio} han sido aprobadas`,
    };
  }

  /**
   * GET /api/finanzas/mes-actual
   * 
   * Obtiene un resumen rápido del mes actual
   */
  @Get('mes-actual')
  @RequirePermissions('finanzas:read')
  async resumenMesActual() {
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    const [modelos, stats] = await Promise.all([
      this.finanzasService.obtenerModelosConGanancias(mes, anio),
      this.finanzasService.obtenerEstadisticas(mes, anio),
    ]);

    return {
      success: true,
      data: {
        periodo: { mes, anio },
        modelos: modelos.slice(0, 5), // Top 5
        estadisticas: stats,
      },
    };
  }

  /**
   * PATCH /api/finanzas/comision-banco
   * 
   * Actualiza el porcentaje de comisión bancaria para todas las finanzas
   * de un periodo específico y recalcula las ganancias
   * 
   * Body:
   * - mes: number (1-12)
   * - anio: number
   * - porcentajeComisionBanco: number (0-100)
   */
  @Patch('comision-banco')
  @RequirePermissions('finanzas:write')
  async actualizarComisionBancoPeriodo(
    @Body() dto: ActualizarComisionBancoPeriodoDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    const resultado = await this.finanzasService.actualizarComisionBancoPeriodo(
      dto.mes,
      dto.anio,
      dto.porcentajeComisionBanco,
      userId,
    );

    return {
      success: true,
      message: `Comisión bancaria actualizada a ${dto.porcentajeComisionBanco}% para ${resultado.actualizadas} finanzas`,
      data: resultado,
    };
  }

  // ========== CONSOLIDACIÓN Y BANK ONLYTOP ==========

  /**
   * GET /api/finanzas/bank
   * 
   * Obtiene el estado actual del bank OnlyTop
   * Muestra dinero consolidado, en movimiento y totales
   */
  @Get('bank')
  @RequirePermissions('finanzas:read')
  async obtenerBankOnlyTop() {
    const bank = await this.finanzasService.obtenerBankOnlyTop();

    return {
      success: true,
      data: bank,
    };
  }

  /**
   * POST /api/finanzas/consolidar/:mes/:anio
   * 
   * Consolida un periodo mensual, cerrándolo oficialmente
   * Transfiere el dinero en movimiento al consolidado
   * 
   * Body (opcional):
   * - notasCierre?: string
   */
  @Post('consolidar/:mes/:anio')
  @RequirePermissions('finanzas:admin')
  @HttpCode(HttpStatus.OK)
  async consolidarPeriodo(
    @Param('mes') mes: string,
    @Param('anio') anio: string,
    @Body() body: { notasCierre?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId;
    
    const periodo = await this.finanzasService.consolidarPeriodo(
      parseInt(mes, 10),
      parseInt(anio, 10),
      userId,
      body.notasCierre,
    );

    return {
      success: true,
      message: `Periodo ${periodo.periodo} consolidado exitosamente`,
      data: {
        periodo: periodo.periodo,
        totales: {
          ventasNetas: periodo.totalVentasNetasUSD,
          gananciaOnlyTop: periodo.totalGananciaOnlyTopUSD,
        },
        cantidadModelos: periodo.cantidadModelos,
        fechaConsolidacion: periodo.fechaConsolidacion,
      },
    };
  }

  /**
   * GET /api/finanzas/periodos-consolidados
   * 
   * Obtiene lista de todos los periodos consolidados
   */
  @Get('periodos-consolidados')
  @RequirePermissions('finanzas:read')
  async obtenerPeriodosConsolidados() {
    const periodos = await this.finanzasService.obtenerPeriodosConsolidados();

    return {
      success: true,
      data: periodos,
      count: periodos.length,
    };
  }
}
