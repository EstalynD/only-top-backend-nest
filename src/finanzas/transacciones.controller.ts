import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { User } from '../auth/user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { TransaccionesService } from './transacciones.service.js';
import { BankOnlyTopService } from './bank-onlytop.service.js';
import {
  FiltrarTransaccionesDto,
  TransaccionesPaginadasDto,
  ResumenTransaccionesPeriodoDto,
  SaldoMovimientoDto,
  FlujoCajaDetalladoDto,
  ComparativaTransaccionesDto,
  TransaccionFormateadaDto,
} from './transacciones.dto.js';

/**
 * TransaccionesController - Endpoints para consulta de transacciones y flujo de caja
 * 
 * Funcionalidades:
 * - Listar transacciones con filtros avanzados
 * - Obtener resumen por periodo
 * - Calcular saldo en movimiento
 * - Generar reportes de flujo de caja
 * - Comparativas entre periodos
 * - Revertir transacciones
 * 
 * Permisos:
 * - finanzas:read - Para consultas y reportes
 * - finanzas:write - Para reversiones
 */
@Controller('api/finanzas/transacciones')
@UseGuards(AuthGuard)
export class TransaccionesController {
  constructor(
    private readonly transaccionesService: TransaccionesService,
    private readonly bankService: BankOnlyTopService,
  ) {}

  // ========== CONSULTAS ==========

  /**
   * GET /api/finanzas/transacciones
   * Lista transacciones con filtros
   * 
   * Query params:
   * - periodo?: string (YYYY-MM)
   * - mes?: number (1-12)
   * - anio?: number
   * - tipo?: INGRESO | EGRESO
   * - origen?: GANANCIA_MODELO | COSTO_FIJO | etc.
   * - estado?: EN_MOVIMIENTO | CONSOLIDADO | REVERTIDO
   * - modeloId?: string
   * - referenciaId?: string
   * - fechaDesde?: string (ISO)
   * - fechaHasta?: string (ISO)
   * - limite?: number (paginación)
   * - saltar?: number (paginación)
   */
  @Get()
  @RequirePermissions('finanzas:read')
  async listarTransacciones(
    @Query() filtros: FiltrarTransaccionesDto,
  ): Promise<TransaccionesPaginadasDto> {
    return this.transaccionesService.obtenerTransacciones(filtros);
  }

  /**
   * GET /api/finanzas/transacciones/:id
   * Obtiene una transacción específica por ID
   */
  @Get(':id')
  @RequirePermissions('finanzas:read')
  async obtenerTransaccion(@Param('id') id: string): Promise<TransaccionFormateadaDto> {
    return this.transaccionesService.obtenerTransaccionPorId(id);
  }

  /**
   * GET /api/finanzas/transacciones/resumen/:mes/:anio
   * Obtiene resumen de transacciones de un periodo
   * 
   * Retorna:
   * - Totales de ingresos y egresos
   * - Cantidad de transacciones
   * - Desglose por origen
   * - Estado del periodo (ABIERTO/CONSOLIDADO)
   */
  @Get('resumen/:mes/:anio')
  @RequirePermissions('finanzas:read')
  async obtenerResumenPeriodo(
    @Param('mes', ParseIntPipe) mes: number,
    @Param('anio', ParseIntPipe) anio: number,
  ): Promise<ResumenTransaccionesPeriodoDto> {
    return this.transaccionesService.obtenerResumenPeriodo(mes, anio);
  }

  /**
   * GET /api/finanzas/transacciones/saldo/movimiento
   * Obtiene el saldo actual en movimiento
   * 
   * Query params:
   * - periodo?: string (YYYY-MM, default: periodo actual)
   * 
   * Retorna:
   * - Dinero en movimiento
   * - Dinero consolidado
   * - Total
   * - Cantidad de transacciones activas
   * - Última transacción
   */
  @Get('saldo/movimiento')
  @RequirePermissions('finanzas:read')
  async obtenerSaldoMovimiento(
    @Query('periodo') periodo?: string,
  ): Promise<SaldoMovimientoDto> {
    return this.transaccionesService.obtenerSaldoMovimiento(periodo);
  }

  // ========== REPORTES ==========

  /**
   * GET /api/finanzas/transacciones/flujo-caja/:mes/:anio
   * Genera reporte detallado de flujo de caja del periodo
   * 
   * Retorna:
   * - Saldo inicial
   * - Ingresos desglosados por tipo
   * - Egresos desglosados por tipo
   * - Saldo final
   * - Cambio absoluto y relativo
   * - Estado de consolidación
   */
  @Get('flujo-caja/:mes/:anio')
  @RequirePermissions('finanzas:read')
  async generarFlujoCaja(
    @Param('mes', ParseIntPipe) mes: number,
    @Param('anio', ParseIntPipe) anio: number,
  ): Promise<FlujoCajaDetalladoDto> {
    return this.transaccionesService.generarFlujoCaja(mes, anio);
  }

  /**
   * POST /api/finanzas/transacciones/comparativa
   * Compara múltiples periodos
   * 
   * Body:
   * - periodos: string[] (["2025-10", "2025-11", ...])
   * 
   * Retorna:
   * - Datos de cada periodo (ingresos, egresos, saldo)
   * - Promedios
   * - Mejor y peor periodo
   * - Tendencia (CRECIENTE/ESTABLE/DECRECIENTE)
   */
  @Post('comparativa')
  @RequirePermissions('finanzas:read')
  @HttpCode(HttpStatus.OK)
  async generarComparativa(
    @Body('periodos') periodos: string[],
  ): Promise<ComparativaTransaccionesDto> {
    if (!periodos || periodos.length === 0) {
      throw new Error('Debe proporcionar al menos un periodo');
    }
    return this.transaccionesService.generarComparativa(periodos);
  }

  // ========== ESTADO DEL BANCO ==========

  /**
   * GET /api/finanzas/transacciones/bank/estado
   * Obtiene el estado completo del banco OnlyTop
   * 
   * Retorna:
   * - Dinero consolidado
   * - Dinero en movimiento
   * - Total
   * - Periodo actual
   * - Última consolidación
   * - Contadores globales
   */
  @Get('bank/estado')
  @RequirePermissions('finanzas:read')
  async obtenerEstadoBank() {
    return this.bankService.getEstado();
  }

  // ========== REVERSIONES ==========

  /**
   * DELETE /api/finanzas/transacciones/:id/revertir
   * Revierte una transacción (solo si está EN_MOVIMIENTO)
   * 
   * Body:
   * - motivo: string (obligatorio)
   * 
   * Crea una transacción inversa y marca la original como REVERTIDO
   */
  @Delete(':id/revertir')
  @RequirePermissions('finanzas:write')
  @HttpCode(HttpStatus.OK)
  async revertirTransaccion(
    @Param('id') id: string,
    @Body('motivo') motivo: string,
    @User() user: AuthUser,
  ) {
    if (!motivo) {
      throw new Error('El motivo de reversión es obligatorio');
    }

    const transaccionInversa = await this.transaccionesService.revertirTransaccion(
      id,
      motivo,
      user.id,
    );

    return {
      message: 'Transacción revertida exitosamente',
      transaccionOriginal: id,
      transaccionInversa: (transaccionInversa as any)._id.toString(),
    };
  }
}
