import { Controller, Get, Param, Res, HttpStatus, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { CarteraPdfCoreService } from './cartera-pdf-core.service.js';
import { Public } from '../auth/public.decorator.js';

/**
 * Controlador PÚBLICO para servir PDFs del módulo de Cartera
 * 
 * Similar a pdf.controller.ts para contratos-modelo
 * No requiere autenticación - acceso público via URL directa
 * 
 * Endpoints:
 * - /api/cartera-pdf/facturas/:id/A4/:filename.pdf (inline view)
 * - /api/cartera-pdf/facturas/:id/download (download)
 * - /api/cartera-pdf/estado-cuenta/:modeloId/A4/:filename.pdf (inline view)
 * - /api/cartera-pdf/estado-cuenta/:modeloId/download (download)
 */
@Controller('api/cartera-pdf')
@Public() // Todo el controlador es público
export class CarteraPdfController {
  constructor(private readonly pdfCoreService: CarteraPdfCoreService) {}

  // ========== FACTURAS INDIVIDUALES ==========

  /**
   * Servir PDF de factura con URL personalizada (PÚBLICO - sin auth)
   * Formato: /api/cartera-pdf/facturas/:facturaId/A4/:filename.pdf
   * Ejemplo: /api/cartera-pdf/facturas/68e5ff1690ce8d21950fe427/A4/FACT-2025-00001.pdf
   */
  @Get('facturas/:facturaId/:size/:filename')
  async getFacturaPdf(
    @Param('facturaId') facturaId: string,
    @Param('size') size: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      // Validar tamaño (solo A4 por ahora)
      if (size !== 'A4') {
        throw new NotFoundException('PDF size not supported');
      }

      // Generar el PDF
      const pdfBuffer = await this.pdfCoreService.generateFacturaPdf(facturaId);

      // Configurar headers para servir el PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
      res.setHeader('X-PDF-Generated-At', new Date().toISOString());

      // Enviar el PDF
      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('PDF not found or could not be generated');
    }
  }

  /**
   * Descargar PDF de factura (PÚBLICO - sin auth)
   * Formato: /api/cartera-pdf/facturas/:facturaId/download
   */
  @Get('facturas/:facturaId/download')
  async downloadFacturaPdf(
    @Param('facturaId') facturaId: string,
    @Res() res: Response,
  ) {
    try {
      // Obtener información de la factura para el nombre del archivo
      const { pdfBuffer, filename } = await this.pdfCoreService.generateFacturaPdfWithFilename(facturaId);

      // Configurar headers para descarga
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Enviar el PDF
      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('PDF not found or could not be generated');
    }
  }

  /**
   * Vista previa rápida de factura (información básica)
   * Formato: /api/cartera-pdf/facturas/:facturaId/info
   */
  @Get('facturas/:facturaId/info')
  async getFacturaInfo(@Param('facturaId') facturaId: string) {
    try {
      const info = await this.pdfCoreService.getFacturaInfo(facturaId);
      return {
        success: true,
        data: info,
      };
    } catch (error: any) {
      throw new NotFoundException('Factura information not found');
    }
  }

  // ========== ESTADO DE CUENTA ==========

  /**
   * Servir PDF de estado de cuenta con URL personalizada (PÚBLICO - sin auth)
   * Formato: /api/cartera-pdf/estado-cuenta/:modeloId/A4/:filename.pdf
   * Ejemplo: /api/cartera-pdf/estado-cuenta/507f1f77bcf86cd799439011/A4/ESTADO-CUENTA-MODELO-123.pdf
   */
  @Get('estado-cuenta/:modeloId/:size/:filename')
  async getEstadoCuentaPdf(
    @Param('modeloId') modeloId: string,
    @Param('size') size: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      // Validar tamaño (solo A4 por ahora)
      if (size !== 'A4') {
        throw new NotFoundException('PDF size not supported');
      }

      // Generar el PDF
      const pdfBuffer = await this.pdfCoreService.generateEstadoCuentaPdf(modeloId);

      // Configurar headers para servir el PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
      res.setHeader('X-PDF-Generated-At', new Date().toISOString());

      // Enviar el PDF
      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('PDF not found or could not be generated');
    }
  }

  /**
   * Descargar PDF de estado de cuenta (PÚBLICO - sin auth)
   * Formato: /api/cartera-pdf/estado-cuenta/:modeloId/download
   */
  @Get('estado-cuenta/:modeloId/download')
  async downloadEstadoCuentaPdf(
    @Param('modeloId') modeloId: string,
    @Res() res: Response,
  ) {
    try {
      // Obtener información del modelo para el nombre del archivo
      const { pdfBuffer, filename } = await this.pdfCoreService.generateEstadoCuentaPdfWithFilename(modeloId);

      // Configurar headers para descarga
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Enviar el PDF
      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('PDF not found or could not be generated');
    }
  }

  /**
   * Vista previa rápida de estado de cuenta (información básica)
   * Formato: /api/cartera-pdf/estado-cuenta/:modeloId/info
   */
  @Get('estado-cuenta/:modeloId/info')
  async getEstadoCuentaInfo(@Param('modeloId') modeloId: string) {
    try {
      const info = await this.pdfCoreService.getEstadoCuentaInfo(modeloId);
      return {
        success: true,
        data: info,
      };
    } catch (error: any) {
      throw new NotFoundException('Estado de cuenta information not found');
    }
  }
}
