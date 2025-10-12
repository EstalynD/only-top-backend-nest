import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CarteraService } from './cartera.service.js';
import { Public } from '../auth/public.decorator.js';
import { CarteraTokenService } from './cartera-token.service.js';
import { CarteraPdfCoreService } from './cartera-pdf-core.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorators.js';
import {
  CreateFacturaDto,
  UpdateFacturaDto,
  GenerarFacturasPorPeriodoDto,
  RegistrarPagoDto,
  FiltrosFacturasDto,
  FiltrosPagosDto,
  FiltrosRecordatoriosDto,
  ObtenerEstadoCuentaDto,
  UpdateConfiguracionCarteraDto,
  FiltrosDashboardDto,
} from './dto/cartera.dto.js';
import { TipoRecordatorio } from './recordatorio.schema.js';

/**
 * Controlador para el módulo de Cartera (facturación y pagos)
 * 
 * Endpoints:
 * - Gestión de Facturas
 * - Registro y consulta de Pagos
 * - Estado de cuenta por modelo
 * - Recordatorios y alertas
 * - Configuración del módulo
 * - Dashboard y estadísticas
 */
@Controller('api/cartera')
@UseGuards(AuthGuard)
export class CarteraController {
  private readonly logger = new Logger(CarteraController.name);

  constructor(
    private readonly carteraService: CarteraService,
    private readonly tokenService: CarteraTokenService,
    private readonly pdfCoreService: CarteraPdfCoreService,
  ) {}

  // ========== FACTURAS ==========

  /**
   * POST /api/cartera/facturas
   * Crea una factura manual
   */
  @Post('facturas')
  @RequirePermissions('cartera:facturas:create')
  async crearFacturaManual(
    @Body() dto: CreateFacturaDto,
    @Request() req: any,
  ) {
    this.logger.log(`Usuario ${req.user.username} creando factura manual para modelo ${dto.modeloId}`);
    
    const factura = await this.carteraService.crearFacturaManual(dto, req.user.sub);
    
    return {
      success: true,
      message: 'Factura creada exitosamente',
      data: factura,
    };
  }

  /**
   * GET /api/cartera/facturas
   * Lista facturas con filtros y paginación
   */
  @Get('facturas')
  @RequirePermissions('cartera:facturas:read')
  async obtenerFacturas(@Query() filtros: FiltrosFacturasDto) {
    this.logger.log('Consultando facturas con filtros:', JSON.stringify(filtros));
    
    const resultado = await this.carteraService.obtenerFacturas(filtros);
    
    return {
      success: true,
      data: resultado,
    };
  }

  /**
   * GET /api/cartera/facturas/:id
   * Obtiene una factura por ID con detalles completos
   */
  @Get('facturas/:id')
  @RequirePermissions('cartera:facturas:read')
  async obtenerFacturaPorId(@Param('id') id: string) {
    const factura = await this.carteraService.obtenerFacturaPorId(id);
    
    return {
      success: true,
      data: factura,
    };
  }

  /**
   * PUT /api/cartera/facturas/:id
   * Actualiza una factura
   */
  @Put('facturas/:id')
  @RequirePermissions('cartera:facturas:update')
  async actualizarFactura(
    @Param('id') id: string,
    @Body() dto: UpdateFacturaDto,
    @Request() req: any,
  ) {
    this.logger.log(`Usuario ${req.user.username} actualizando factura ${id}`);
    
    const factura = await this.carteraService.actualizarFactura(id, dto, req.user.sub);
    
    return {
      success: true,
      message: 'Factura actualizada exitosamente',
      data: factura,
    };
  }

  /**
   * DELETE /api/cartera/facturas/:id
   * Cancela una factura (soft delete)
   * TODO: Implementar cancelarFactura() en CarteraService
   */
  @Delete('facturas/:id')
  @RequirePermissions('cartera:facturas:delete')
  async cancelarFactura(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    this.logger.log(`Usuario ${req.user.username} cancelando factura ${id}`);
    
    // TODO: await this.carteraService.cancelarFactura(id, req.user.sub);
    
    return {
      success: false,
      message: 'Cancelación de facturas en desarrollo',
    };
  }

  /**
   * GET /api/cartera/facturas/:id/pdf
   * Genera y descarga el PDF de una factura individual
   * 
   * Query params:
   * - download: 'true' para forzar descarga (opcional)
   */
  @Get('facturas/:id/pdf')
  @RequirePermissions('cartera:facturas:read')
  async descargarFacturaPdf(
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Generando PDF de factura: ${id}`);

      // Usar servicio centralizado
      const { pdfBuffer, filename } = await this.pdfCoreService.generateFacturaPdfWithFilename(id);

      // Configurar headers
      const disposition = download === 'true' ? 'attachment' : 'inline';
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error: any) {
      this.logger.error(`Error generando PDF de factura ${id}: ${error.message}`, error.stack);
      
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Error al generar el PDF de la factura',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/cartera/factura/token/:token/pdf
   * Acceso público al PDF de una factura individual con token temporal (desde email)
   *
   * Este endpoint NO requiere autenticación, solo un token válido generado
   * por CarteraTokenService con tipo = 'FACTURA_INDIVIDUAL'.
   *
   * Query params:
   * - download: 'true' para forzar descarga (opcional)
   */
  @Public()
  @Get('factura/token/:token/pdf')
  async accederFacturaConToken(
    @Param('token') token: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    try {
      // Validar token
      const payload = this.tokenService.validateToken(token);

      if (!payload.facturaId) {
        throw new UnauthorizedException('Token inválido: falta facturaId');
      }
      if (payload.tipo !== 'FACTURA_INDIVIDUAL') {
        throw new UnauthorizedException('Token inválido para factura individual');
      }

      this.logger.log(
        `Acceso con token al PDF de factura - Factura: ${payload.facturaId}, Email: ${payload.email}`,
      );

      // Usar servicio centralizado
      const { pdfBuffer, filename } = await this.pdfCoreService.generateFacturaPdfWithFilename(
        payload.facturaId,
      );

      const disposition = download === 'true' ? 'attachment' : 'inline';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('X-Token-Expira', new Date(payload.expiraEn).toISOString());

      return res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error: any) {
      this.logger.error(`Error en acceso con token a factura: ${error.message}`);

      if (error instanceof UnauthorizedException) {
        return res.status(HttpStatus.UNAUTHORIZED).send(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Enlace Expirado o Inválido - OnlyTop</title>
            <style>
              body { font-family: Arial, sans-serif; background: #f5f7fb; margin: 0; padding: 40px; }
              .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
              h1 { margin: 0 0 12px; font-size: 22px; color: #111827; }
              p { margin: 0 0 16px; color: #4b5563; line-height: 1.6; }
              .hint { font-size: 14px; color: #6b7280; }
              a { color: #3b82f6; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Enlace expirado o inválido</h1>
              <p>El enlace para acceder al PDF de la factura ha expirado o no es válido.</p>
              <p class="hint">Si necesitas un nuevo enlace, por favor contáctanos en <a href="mailto:finanzas@onlytop.com">finanzas@onlytop.com</a>.</p>
            </div>
          </body>
          </html>
        `);
      }

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Error al generar el PDF de la factura',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/cartera/facturas/:id/pdf/link
   * Genera un enlace público (con token temporal) para ver/descargar el PDF de una factura
   * Requiere autenticación, pero el enlace resultante es público hasta su expiración
   */
  @Get('facturas/:id/pdf/link')
  @RequirePermissions('cartera:facturas:read')
  async generarLinkPublicoFactura(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // Obtener factura con datos de la modelo
    const factura = await this.carteraService.obtenerFacturaPorId(id);
    const modelo: any = factura.modeloId;

    if (!modelo?.correoElectronico) {
      throw new BadRequestException('La factura no tiene un email de modelo asociado');
    }

    // Generar token temporal
    const token = this.tokenService.generateToken({
      modeloId: (modelo._id || modelo.id || modelo)?.toString?.() || modelo,
      facturaId: id,
      tipo: 'FACTURA_INDIVIDUAL',
      email: modelo.correoElectronico,
      expiresInDays: 7,
    });

    // Construir URLs
    const viewUrl = this.tokenService.generateFacturaUrl(token);
    const downloadUrl = `${viewUrl}?download=true`;

    this.logger.log(
      `Usuario ${req.user?.username || req.user?.sub} generó link público para factura ${id}`,
    );

    return {
      success: true,
      data: {
        token,
        viewUrl,
        downloadUrl,
        expiresAt: new Date(this.tokenService.decodeTokenUnsafe(token)!.expiraEn).toISOString(),
      },
    };
  }

  /**
   * POST /api/cartera/facturas/periodo
   * Genera facturas automáticas para un periodo
   */
  @Post('facturas/periodo')
  @RequirePermissions('cartera:facturas:generate')
  async generarFacturasPorPeriodo(
    @Body() dto: GenerarFacturasPorPeriodoDto,
    @Request() req: any,
  ) {
    this.logger.log(`Usuario ${req.user.username} generando facturas para periodo ${dto.anio}-${dto.mes}`);
    
    const resultado = await this.carteraService.generarFacturasPorPeriodo(dto, req.user.sub);
    
    return {
      success: true,
      message: `Se generaron ${resultado.generadas} facturas exitosamente (${resultado.errores} errores)`,
      data: resultado,
    };
  }

  /**
   * POST /api/cartera/facturas/:modeloId/generar
   * Genera una factura automática para una modelo en un periodo específico
   */
  @Post('facturas/:modeloId/generar')
  @RequirePermissions('cartera:facturas:generate')
  async generarFacturaAutomatica(
    @Param('modeloId') modeloId: string,
    @Body() dto: { anio: number; mes: number; quincena?: number },
    @Request() req: any,
  ) {
    this.logger.log(`Usuario ${req.user.username} generando factura automática para modelo ${modeloId}`);
    
    const factura = await this.carteraService.generarFacturaAutomatica(
      modeloId,
      { anio: dto.anio, mes: dto.mes, quincena: dto.quincena },
      req.user.sub,
    );
    
    return {
      success: true,
      message: 'Factura generada exitosamente',
      data: factura,
    };
  }

  /**
   * GET /api/cartera/facturas/totales
   * Calcula totales de cartera por estado
   */
  @Get('totales')
  @RequirePermissions('cartera:facturas:read')
  async calcularTotalCartera() {
    const totales = await this.carteraService.calcularTotalCartera();
    
    return {
      success: true,
      data: totales,
    };
  }

  // ========== PAGOS ==========

  /**
   * POST /api/cartera/pagos
   * Registra un pago con comprobante opcional
   */
  @Post('pagos')
  @RequirePermissions('cartera:pagos:create')
  @UseInterceptors(FileInterceptor('file'))
  async registrarPago(
    @Body() dto: RegistrarPagoDto,
    @UploadedFile() file: any,
    @Request() req: any,
  ) {
    this.logger.log(`Usuario ${req.user.username} registrando pago para factura ${dto.facturaId}`);
    
    // Validar archivo si existe
    if (file) {
      const formatosPermitidos = ['jpg', 'jpeg', 'png', 'pdf'];
      const extension = file.originalname.split('.').pop()?.toLowerCase();
      
      if (!extension || !formatosPermitidos.includes(extension)) {
        throw new BadRequestException(
          `Formato de archivo no permitido. Formatos aceptados: ${formatosPermitidos.join(', ')}`
        );
      }
    }
    
    const pago = await this.carteraService.registrarPago(dto, file, req.user.sub);
    
    return {
      success: true,
      message: 'Pago registrado exitosamente',
      data: pago,
    };
  }

  /**
   * GET /api/cartera/pagos
   * Lista pagos con filtros
   */
  @Get('pagos')
  @RequirePermissions('cartera:pagos:read')
  async obtenerPagos(@Query() filtros: FiltrosPagosDto) {
    const resultado = await this.carteraService.obtenerPagos(filtros);
    
    return {
      success: true,
      data: resultado,
    };
  }

  /**
   * GET /api/cartera/pagos/:id
   * Obtiene un pago por ID
   */
  @Get('pagos/:id')
  @RequirePermissions('cartera:pagos:read')
  async obtenerPagoPorId(@Param('id') id: string) {
    const pago = await this.carteraService.obtenerPagoPorId(id);
    
    return {
      success: true,
      data: pago,
    };
  }

  /**
   * GET /api/cartera/facturas/:facturaId/pagos
   * Obtiene todos los pagos de una factura
   */
  @Get('facturas/:facturaId/pagos')
  @RequirePermissions('cartera:pagos:read')
  async obtenerPagosPorFactura(@Param('facturaId') facturaId: string) {
    const pagos = await this.carteraService.obtenerPagosPorFactura(facturaId);
    
    return {
      success: true,
      data: pagos,
    };
  }

  // ========== ESTADO DE CUENTA ==========

  /**
   * GET /api/cartera/estado-cuenta/:modeloId
   * Obtiene el estado de cuenta de una modelo
   */
  @Get('estado-cuenta/:modeloId')
  @RequirePermissions('cartera:estado-cuenta:read')
  async obtenerEstadoCuentaModelo(
    @Param('modeloId') modeloId: string,
    @Query() dto: ObtenerEstadoCuentaDto,
  ) {
    const estadoCuenta = await this.carteraService.obtenerEstadoCuentaModelo(modeloId, dto);
    
    return {
      success: true,
      data: estadoCuenta,
    };
  }

  /**
   * GET /api/cartera/estado-cuenta/:modeloId/pdf
   * Exporta el estado de cuenta de una modelo en PDF
   */
  @Get('estado-cuenta/:modeloId/pdf')
  @RequirePermissions('cartera:export:pdf')
  async exportarEstadoCuentaPDF(
    @Param('modeloId') modeloId: string,
    @Query() dto: ObtenerEstadoCuentaDto,
    @Res() res: Response,
  ) {
    this.logger.log(`Exportando estado de cuenta PDF para modelo ${modeloId}`);
    
    // Usar servicio centralizado
    const { pdfBuffer, filename } = await this.pdfCoreService.generateEstadoCuentaPdfWithFilename(
      modeloId,
    );
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    
    res.send(pdfBuffer);
  }

  /**
   * GET /api/cartera/estado-cuenta/token/:token/pdf
   * Acceso público al estado de cuenta con token temporal (desde email)
   * 
   * Este endpoint NO requiere autenticación, solo el token válido.
   * El token contiene: modeloId, email, tipo, fecha de generación y expiración.
   * 
   * Casos de uso:
   * - Enlace directo en emails de recordatorio
   * - Acceso temporal para modelos sin cuenta en el sistema
   * 
   * Seguridad:
   * - Token firmado con HMAC-SHA256
   * - Expira en 7 días por defecto
   * - Auditoría: se registra cada acceso
   */
  @Public()
  @Get('estado-cuenta/token/:token/pdf')
  async accederEstadoCuentaConToken(
    @Param('token') token: string,
    @Query() query: { download?: string },
    @Res() res: Response,
  ) {
    try {
      // Validar token y extraer payload
      const payload = this.tokenService.validateToken(token);
      
      this.logger.log(
        `Acceso con token al estado de cuenta - Modelo: ${payload.modeloId}, Email: ${payload.email}`
      );

      // Usar servicio centralizado
      const { pdfBuffer, filename } = await this.pdfCoreService.generateEstadoCuentaPdfWithFilename(
        payload.modeloId,
      );
      
      // Determinar si es descarga o visualización inline
      const disposition = query.download === 'true' ? 'attachment' : 'inline';

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Token-Expira': new Date(payload.expiraEn).toISOString(),
      });

      res.send(pdfBuffer);
    } catch (error: any) {
      this.logger.error(`Error en acceso con token: ${error.message}`);
      
      // Si el token es inválido o expiró, retornar página HTML amigable
      if (error instanceof UnauthorizedException) {
        return res.status(HttpStatus.UNAUTHORIZED).send(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Enlace Expirado - OnlyTop</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
              }
              .container {
                background: white;
                border-radius: 12px;
                padding: 40px;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              }
              .icon {
                font-size: 64px;
                margin-bottom: 20px;
              }
              h1 {
                color: #333;
                margin: 0 0 15px;
                font-size: 24px;
              }
              p {
                color: #666;
                line-height: 1.6;
                margin: 0 0 25px;
              }
              .contact {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin-top: 25px;
              }
              .contact a {
                color: #667eea;
                text-decoration: none;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">🔒</div>
              <h1>Enlace Expirado</h1>
              <p>
                El enlace que intentas acceder ha expirado o es inválido.
                Los enlaces de acceso a estado de cuenta tienen una validez de 7 días.
              </p>
              <div class="contact">
                <p style="margin: 0; font-size: 14px;">
                  <strong>¿Necesitas acceder a tu estado de cuenta?</strong><br>
                  Contáctanos en <a href="mailto:finanzas@onlytop.com">finanzas@onlytop.com</a>
                  y te enviaremos un nuevo enlace.
                </p>
              </div>
            </div>
          </body>
          </html>
        `);
      }

      // Error genérico
      throw error;
    }
  }

  // ========== RECORDATORIOS ==========

  /**
   * POST /api/cartera/recordatorios/:facturaId
   * Envía un recordatorio de pago manual
   * 
   * Body (opcional):
   * {
   *   "tipo": "PROXIMO_VENCIMIENTO" | "VENCIDO" | "MORA"
   * }
   */
  @Post('recordatorios/:facturaId')
  @RequirePermissions('cartera:recordatorios:send')
  async enviarRecordatorioPago(
    @Param('facturaId') facturaId: string,
    @Body() body: { tipo?: TipoRecordatorio },
    @Request() req: any,
  ) {
    this.logger.log(`Usuario ${req.user.username} enviando recordatorio para factura ${facturaId}`);
    
    const recordatorio = await this.carteraService.enviarRecordatorioPago(
      facturaId,
      body.tipo || TipoRecordatorio.PROXIMO_VENCIMIENTO,
      req.user.sub,
    );
    
    return {
      success: true,
      message: 'Recordatorio de pago enviado exitosamente',
      data: recordatorio,
    };
  }

  /**
   * GET /api/cartera/recordatorios
   * Lista recordatorios con filtros
   */
  @Get('recordatorios')
  @RequirePermissions('cartera:recordatorios:read')
  async obtenerHistorialRecordatorios(@Query() filtros: FiltrosRecordatoriosDto) {
    const resultado = await this.carteraService.obtenerHistorialRecordatorios(filtros);
    
    return {
      success: true,
      data: resultado,
    };
  }

  /**
   * GET /api/cartera/facturas-proximas-vencer
   * Obtiene facturas próximas a vencer
   */
  @Get('facturas-proximas-vencer')
  @RequirePermissions('cartera:facturas:read')
  async obtenerFacturasProximasVencer(@Query('diasAntes') diasAntes: number = 5) {
    const facturas = await this.carteraService.obtenerFacturasProximasVencer(diasAntes);
    
    return {
      success: true,
      data: facturas,
    };
  }

  /**
   * GET /api/cartera/facturas-vencidas
   * Obtiene facturas vencidas (y las marca como tal)
   */
  @Get('facturas-vencidas')
  @RequirePermissions('cartera:facturas:read')
  async obtenerFacturasVencidas() {
    const facturas = await this.carteraService.obtenerFacturasVencidas();
    
    return {
      success: true,
      data: facturas,
    };
  }

  // ========== CONFIGURACIÓN ==========

  /**
   * GET /api/cartera/configuracion
   * Obtiene la configuración actual del módulo
   */
  @Get('configuracion')
  @RequirePermissions('cartera:config:read')
  async obtenerConfiguracion() {
    const config = await this.carteraService.obtenerConfiguracionPublica();
    return { success: true, data: config };
  }

  /**
   * PUT /api/cartera/configuracion
   * Actualiza la configuración del módulo
   */
  @Put('configuracion')
  @RequirePermissions('cartera:config:update')
  async actualizarConfiguracion(
    @Body() dto: UpdateConfiguracionCarteraDto,
    @Request() req: any,
  ) {
    this.logger.log(`Usuario ${req.user.username} actualizando configuración de cartera`);
    const config = await this.carteraService.actualizarConfiguracion(dto, req.user.sub);
    return { success: true, data: config };
  }

  // ========== DASHBOARD Y ESTADÍSTICAS ==========

  /**
   * GET /api/cartera/dashboard
   * Obtiene estadísticas y métricas de cartera
   */
  @Get('dashboard')
  @RequirePermissions('cartera:dashboard:read')
  async obtenerDashboard(@Query() filtros: FiltrosDashboardDto) {
    this.logger.log('Generando dashboard de cartera');
    
    // TODO: Implementar método obtenerDashboard() en CarteraService
    // Debe retornar:
    // - Total facturado en periodo
    // - Total recaudado
    // - Cartera pendiente
    // - Cartera vencida
    // - Top modelos con mayor facturación
    // - Gráfico de pagos por mes
    // - Tasa de cobranza
    // - Días promedio de pago
    
    return {
      success: false,
      message: 'Dashboard en desarrollo.',
    };
  }

  /**
   * GET /api/cartera/estadisticas
   * Obtiene estadísticas generales de cartera
   */
  @Get('estadisticas')
  @RequirePermissions('cartera:dashboard:read')
  async obtenerEstadisticas() {
    const totales = await this.carteraService.calcularTotalCartera();
    
    return {
      success: true,
      data: {
        totales,
        // TODO: Agregar más estadísticas
        // - Modelos con mayor deuda
        // - Modelos con mejor historial de pago
        // - Promedio de días para pago
        // - Tendencias mensuales
      },
    };
  }
}
