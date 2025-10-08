import { Controller, Get, Param, Res, HttpStatus, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PdfService } from './pdf.service.js';

@Controller('api/pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * Servir PDF de contrato de modelo con URL personalizada
   * Formato: /api/pdf/contratos-modelo/:contratoId/:size/:filename.pdf
   * Ejemplo: /api/pdf/contratos-modelo/507f1f77bcf86cd799439011/A4/CTMO-2025-00001.pdf
   */
  @Get('contratos-modelo/:contratoId/:size/:filename')
  async getContratoModeloPdf(
    @Param('contratoId') contratoId: string,
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
      const pdfBuffer = await this.pdfService.generateContratoModeloPdf(contratoId);

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
   * Descargar PDF de contrato de modelo
   * Formato: /api/pdf/contratos-modelo/:contratoId/download
   */
  @Get('contratos-modelo/:contratoId/download')
  async downloadContratoModeloPdf(
    @Param('contratoId') contratoId: string,
    @Res() res: Response,
  ) {
    try {
      // Obtener información del contrato para el nombre del archivo
      const { pdfBuffer, filename } = await this.pdfService.generateContratoModeloPdfWithFilename(contratoId);

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
   * Vista previa rápida (thumbnail o información básica)
   * Formato: /api/pdf/contratos-modelo/:contratoId/info
   */
  @Get('contratos-modelo/:contratoId/info')
  async getContratoInfo(@Param('contratoId') contratoId: string) {
    try {
      const info = await this.pdfService.getContratoInfo(contratoId);
      return {
        success: true,
        data: info,
      };
    } catch (error: any) {
      throw new NotFoundException('Contract information not found');
    }
  }
}

