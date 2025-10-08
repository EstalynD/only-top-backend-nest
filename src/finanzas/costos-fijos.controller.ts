import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { CostosFijosService } from './costos-fijos.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import { User } from '../auth/user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  RegistrarGastoDto,
  CrearCategoriaDto,
  ActualizarGastoDto,
  EliminarGastoDto,
  EliminarCategoriaDto,
  ConsolidarCostosDto,
  CostosFijosFormateadoDto,
  ConsolidarCostosRespuestaDto,
} from './dto/costos-fijos.dto.js';

/**
 * CostosFijosController - Endpoints REST para gestión de costos fijos mensuales
 * 
 * Endpoints disponibles:
 * - GET /api/finanzas/costos-fijos/:mes/:anio - Obtener costos del mes
 * - POST /api/finanzas/costos-fijos/gasto - Registrar nuevo gasto
 * - POST /api/finanzas/costos-fijos/categoria - Crear categoría personalizada
 * - PATCH /api/finanzas/costos-fijos/gasto - Actualizar gasto existente
 * - DELETE /api/finanzas/costos-fijos/gasto - Eliminar gasto
 * - DELETE /api/finanzas/costos-fijos/categoria - Eliminar categoría
 * - POST /api/finanzas/costos-fijos/consolidar/:mes/:anio - Consolidar periodo
 * 
 * Permisos requeridos:
 * - finanzas:write - Para operaciones CRUD (excepto consulta)
 * - finanzas:admin - Para consolidación
 */
@Controller('api/finanzas/costos-fijos')
@UseGuards(AuthGuard)
export class CostosFijosController {
  private readonly logger = new Logger(CostosFijosController.name);

  constructor(private readonly costosService: CostosFijosService) {}

  // ========== CONSULTA ==========

  /**
   * GET /api/finanzas/costos-fijos/:mes/:anio
   * Obtiene los costos fijos de un mes específico (o los crea si no existen)
   * 
   * Permisos: finanzas:read
   * 
   * @example
   * GET /api/finanzas/costos-fijos/10/2024
   * 
   * Response:
   * {
   *   mes: 10,
   *   anio: 2024,
   *   periodo: "2024-10",
   *   estado: "ABIERTO",
   *   consolidado: false,
   *   categorias: [
   *     {
   *       nombre: "Administrativos",
   *       gastos: [...],
   *       totalCategoriaUSD: 1500.00,
   *       porcentajeDelTotal: 35.5
   *     }
   *   ],
   *   totalGastosUSD: 4230.50,
   *   totalGastosFormateado: "$4,230.50 USD"
   * }
   */
  @Get(':mes/:anio')
  @RequirePermissions('finanzas:read')
  async obtenerCostosMes(
    @Param('mes', ParseIntPipe) mes: number,
    @Param('anio', ParseIntPipe) anio: number,
  ): Promise<CostosFijosFormateadoDto> {
    this.logger.log(`📊 GET costos-fijos/${mes}/${anio}`);
    return this.costosService.obtenerCostosMes(mes, anio);
  }

  // ========== GESTIÓN DE GASTOS ==========

  /**
   * POST /api/finanzas/costos-fijos/gasto
   * Registra un nuevo gasto en una categoría
   * 
   * Permisos: finanzas:write
   * 
   * @example
   * POST /api/finanzas/costos-fijos/gasto
   * Body: {
   *   mes: 10,
   *   anio: 2024,
   *   nombreCategoria: "Administrativos",
   *   concepto: "Alquiler de oficina",
   *   montoUSD: 1200.00,
   *   notas: "Mes de octubre"
   * }
   */
  @Post('gasto')
  @RequirePermissions('finanzas:write')
  async registrarGasto(
    @Body() body: RegistrarGastoDto & { mes: number; anio: number },
    @User() user: AuthUser,
  ): Promise<CostosFijosFormateadoDto> {
    this.logger.log(
      `💰 POST gasto: "${body.concepto}" - ${body.montoUSD} USD en "${body.nombreCategoria}"`,
    );

    const { mes, anio, ...dto } = body;
    return this.costosService.registrarGasto(mes, anio, dto, user.id);
  }

  /**
   * PATCH /api/finanzas/costos-fijos/gasto
   * Actualiza un gasto existente
   * 
   * Permisos: finanzas:write
   * 
   * @example
   * PATCH /api/finanzas/costos-fijos/gasto
   * Body: {
   *   mes: 10,
   *   anio: 2024,
   *   nombreCategoria: "Administrativos",
   *   indiceGasto: 0,
   *   concepto: "Alquiler de oficina - Actualizado",
   *   montoUSD: 1250.00
   * }
   */
  @Patch('gasto')
  @RequirePermissions('finanzas:write')
  async actualizarGasto(
    @Body() body: ActualizarGastoDto & { mes: number; anio: number },
    @User() user: AuthUser,
  ): Promise<CostosFijosFormateadoDto> {
    this.logger.log(
      `✏️ PATCH gasto: categoría "${body.nombreCategoria}", índice ${body.indiceGasto}`,
    );

    const { mes, anio, ...dto } = body;
    return this.costosService.actualizarGasto(mes, anio, dto, user.id);
  }

  /**
   * DELETE /api/finanzas/costos-fijos/gasto
   * Elimina un gasto específico
   * 
   * Permisos: finanzas:write
   * 
   * @example
   * DELETE /api/finanzas/costos-fijos/gasto
   * Body: {
   *   mes: 10,
   *   anio: 2024,
   *   nombreCategoria: "Administrativos",
   *   indiceGasto: 0
   * }
   */
  @Delete('gasto')
  @RequirePermissions('finanzas:write')
  async eliminarGasto(
    @Body() body: EliminarGastoDto & { mes: number; anio: number },
    @User() user: AuthUser,
  ): Promise<CostosFijosFormateadoDto> {
    this.logger.log(
      `🗑️ DELETE gasto: categoría "${body.nombreCategoria}", índice ${body.indiceGasto}`,
    );

    const { mes, anio, ...dto } = body;
    return this.costosService.eliminarGasto(mes, anio, dto, user.id);
  }

  // ========== GESTIÓN DE CATEGORÍAS ==========

  /**
   * POST /api/finanzas/costos-fijos/categoria
   * Crea una nueva categoría personalizada
   * 
   * Permisos: finanzas:write
   * 
   * @example
   * POST /api/finanzas/costos-fijos/categoria
   * Body: {
   *   mes: 10,
   *   anio: 2024,
   *   nombre: "Tecnología",
   *   descripcion: "Software, licencias, servidores",
   *   color: "#3b82f6"
   * }
   */
  @Post('categoria')
  @RequirePermissions('finanzas:write')
  async crearCategoria(
    @Body() body: CrearCategoriaDto & { mes: number; anio: number },
    @User() user: AuthUser,
  ): Promise<CostosFijosFormateadoDto> {
    this.logger.log(`📁 POST categoría: "${body.nombre}"`);

    const { mes, anio, ...dto } = body;
    return this.costosService.crearCategoria(mes, anio, dto, user.id);
  }

  /**
   * DELETE /api/finanzas/costos-fijos/categoria
   * Elimina una categoría (solo si no tiene gastos)
   * 
   * Permisos: finanzas:write
   * 
   * @example
   * DELETE /api/finanzas/costos-fijos/categoria
   * Body: {
   *   mes: 10,
   *   anio: 2024,
   *   nombreCategoria: "Tecnología"
   * }
   */
  @Delete('categoria')
  @RequirePermissions('finanzas:write')
  async eliminarCategoria(
    @Body() body: EliminarCategoriaDto & { mes: number; anio: number },
    @User() user: AuthUser,
  ): Promise<CostosFijosFormateadoDto> {
    this.logger.log(`🗑️ DELETE categoría: "${body.nombreCategoria}"`);

    const { mes, anio, ...dto } = body;
    return this.costosService.eliminarCategoria(mes, anio, dto, user.id);
  }

  // ========== CONSOLIDACIÓN ==========

  /**
   * POST /api/finanzas/costos-fijos/consolidar/:mes/:anio
   * Consolida los costos fijos del mes
   * - Marca el documento como consolidado (no se pueden hacer más cambios)
   * - Resta el total de gastos del bank_onlytop
   * - Vincula con el periodo consolidado si existe
   * 
   * Permisos: finanzas:admin
   * 
   * @example
   * POST /api/finanzas/costos-fijos/consolidar/10/2024
   * Body: {
   *   notasCierre: "Cierre mensual - Octubre 2024"
   * }
   * 
   * Response:
   * {
   *   periodo: "2024-10",
   *   totalGastosUSD: 4230.50,
   *   totalGastosFormateado: "$4,230.50 USD",
   *   categorias: 5,
   *   gastos: 23,
   *   consolidado: true,
   *   fechaConsolidacion: "2024-10-31T23:59:59.000Z",
   *   message: "Costos fijos de 2024-10 consolidados exitosamente"
   * }
   */
  @Post('consolidar/:mes/:anio')
  @RequirePermissions('finanzas:admin')
  async consolidarCostos(
    @Param('mes', ParseIntPipe) mes: number,
    @Param('anio', ParseIntPipe) anio: number,
    @Body() body: { notasCierre?: string },
    @User() user: AuthUser,
  ): Promise<ConsolidarCostosRespuestaDto> {
    this.logger.log(`🔒 POST consolidar: ${mes}/${anio}`);

    const dto: ConsolidarCostosDto = {
      mes,
      anio,
      notasCierre: body.notasCierre,
    };

    return this.costosService.consolidarCostos(dto, user.id);
  }
}
