import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type * as PDFKit from 'pdfkit';

// ========== CONSTANTES ==========
const PDF_CONFIG = {
  SIZE: 'A4' as const,
  MARGIN: 50,
  PAGE_WIDTH: 595.28,
  PAGE_HEIGHT: 841.89,
  CONTENT_WIDTH: 495,
} as const;

const COLORS = {
  PRIMARY: '#1e40af',
  SECONDARY: '#3b82f6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  DANGER: '#ef4444',
  INFO: '#06b6d4',
  PURPLE: '#8b5cf6',
  GRAY: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
} as const;

const FONT_SIZES = {
  TITLE: 24,
  SECTION_TITLE: 14,
  SUBSECTION: 12,
  BODY: 10,
  SMALL: 9,
  TINY: 8,
  MICRO: 7,
} as const;

@Injectable()
export class ChatterPdfService {
  private readonly logger = new Logger(ChatterPdfService.name);
  private currentGeneratedAt?: Date;
  private onPageAdded?: () => void;

  // ========== REPORTE DE VENTAS POR GRUPO ==========

  async generateGroupSalesReport(data: any): Promise<Buffer> {
    try {
      this.currentGeneratedAt = new Date();
      const doc = this.createPdfDocument('Reporte de Ventas por Grupo');
      const pdfBuffer = await this.generatePdfBuffer(doc, () => this.buildGroupSalesContent(doc, data));
      this.logger.log(`PDF de reporte por grupo generado: ${data.modelo.nombreCompleto}`);
      return pdfBuffer;
    } catch (error) {
      this.logger.error('Error generando PDF de reporte por grupo', error);
      throw new Error(`No se pudo generar el PDF: ${error.message}`);
    }
  }

  // ========== REPORTE DE VENTAS POR CHATTER ==========

  async generateChatterStatsReport(data: any): Promise<Buffer> {
    try {
      this.currentGeneratedAt = new Date();
      const doc = this.createPdfDocument('Estadísticas de Chatter');
      const pdfBuffer = await this.generatePdfBuffer(doc, () => this.buildChatterStatsContent(doc, data));
      this.logger.log(`PDF de estadísticas de chatter generado: ${data.chatter.nombre}`);
      return pdfBuffer;
    } catch (error) {
      this.logger.error('Error generando PDF de estadísticas de chatter', error);
      throw new Error(`No se pudo generar el PDF: ${error.message}`);
    }
  }

  // ========== REPORTE COMPARATIVO DE GRUPOS ==========

  async generateGroupComparisonReport(data: any): Promise<Buffer> {
    try {
      this.currentGeneratedAt = new Date();
      const doc = this.createPdfDocument('Comparación de Grupos');
      const pdfBuffer = await this.generatePdfBuffer(doc, () => this.buildGroupComparisonContent(doc, data));
      this.logger.log(`PDF de comparación de grupos generado`);
      return pdfBuffer;
    } catch (error) {
      this.logger.error('Error generando PDF de comparación de grupos', error);
      throw new Error(`No se pudo generar el PDF: ${error.message}`);
    }
  }

  // ========== REPORTE GENERAL DE VENTAS ==========

  async generateGeneralStatsReport(data: any): Promise<Buffer> {
    try {
      this.currentGeneratedAt = new Date();
      const doc = this.createPdfDocument('Reporte General de Ventas - Chatters');
      const pdfBuffer = await this.generatePdfBuffer(doc, () => this.buildGeneralStatsContent(doc, data));
      this.logger.log(`PDF de estadísticas generales generado`);
      return pdfBuffer;
    } catch (error) {
      this.logger.error('Error generando PDF de estadísticas generales', error);
      throw new Error(`No se pudo generar el PDF: ${error.message}`);
    }
  }

  // ========== MÉTODOS PRINCIPALES ==========

  private createPdfDocument(title: string): PDFKit.PDFDocument {
    return new PDFDocument({
      size: PDF_CONFIG.SIZE,
      margin: PDF_CONFIG.MARGIN,
      bufferPages: true,
      info: {
        Title: title,
        Author: 'OnlyTop',
        Subject: 'Reporte de Ventas - Chatters',
        Creator: 'OnlyTop Sistema de Gestión',
        Producer: 'OnlyTop PDF Generator v2.0',
        CreationDate: new Date(),
      },
    });
  }

  private async generatePdfBuffer(
    doc: PDFKit.PDFDocument,
    buildContent: () => void,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        buildContent();
        this.drawFooters(doc);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ========== CONTENIDO: REPORTE POR GRUPO ==========

  private buildGroupSalesContent(doc: PDFKit.PDFDocument, data: any): void {
    this.addHeader(doc, 'REPORTE DE VENTAS POR GRUPO DE CHATTERS');
    this.addDivider(doc);
    doc.moveDown(0.3);

    // Información de la modelo
    this.addSectionTitle(doc, 'INFORMACIÓN DE LA MODELO');
    this.addModeloInfo(doc, data.modelo);
    this.addDivider(doc);

    // Periodo del reporte
    this.addPeriodoInfo(doc, data.periodo);
    this.addDivider(doc);

    // Resumen general del grupo
    this.addSectionTitle(doc, 'RESUMEN GENERAL DEL GRUPO');
    this.addGroupSummary(doc, data);
    this.addDivider(doc);

    // Ventas por chatter
    this.addSectionTitle(doc, 'VENTAS POR CHATTER');
    this.addChatterSalesBreakdown(doc, data.grupo);
    this.addDivider(doc);

    // Desglose detallado de ventas
    if (data.grupo) {
      this.addSectionTitle(doc, 'DESGLOSE DETALLADO DE VENTAS');
      this.addDetailedSalesBreakdown(doc, data.grupo);
    }
  }

  // ========== CONTENIDO: ESTADÍSTICAS POR CHATTER ==========

  private buildChatterStatsContent(doc: PDFKit.PDFDocument, data: any): void {
    this.addHeader(doc, 'ESTADÍSTICAS DE VENTAS - CHATTER');
    this.addDivider(doc);
    doc.moveDown(0.3);

    // Información del chatter
    this.addSectionTitle(doc, 'INFORMACIÓN DEL CHATTER');
    this.addChatterInfo(doc, data.chatter);
    this.addDivider(doc);

    // Periodo del reporte
    this.addPeriodoInfo(doc, data.periodo);
    this.addDivider(doc);

    // Estadísticas generales
    this.addSectionTitle(doc, 'ESTADÍSTICAS GENERALES');
    this.addChatterGeneralStats(doc, data.estadisticas);
    this.addDivider(doc);

    // Ventas por tipo
    this.addSectionTitle(doc, 'VENTAS POR TIPO');
    this.addVentasPorTipo(doc, data.estadisticas.ventasPorTipo);
    this.addDivider(doc);

    // Ventas por modelo
    if (data.estadisticas.ventasPorModelo && data.estadisticas.ventasPorModelo.length > 0) {
      this.addSectionTitle(doc, 'VENTAS POR MODELO');
      this.addVentasPorModelo(doc, data.estadisticas.ventasPorModelo);
    }
  }

  // ========== CONTENIDO: COMPARACIÓN DE GRUPOS ==========

  private buildGroupComparisonContent(doc: PDFKit.PDFDocument, data: any): void {
    this.addHeader(doc, 'COMPARACIÓN DE GRUPOS DE CHATTERS');
    this.addDivider(doc);
    doc.moveDown(0.3);

    // Periodo del reporte
    this.addPeriodoInfo(doc, data.periodo);
    this.addDivider(doc);

    // Resumen de comparación
    this.addSectionTitle(doc, 'RESUMEN DE COMPARACIÓN');
    this.addComparisonSummary(doc, data);
    this.addDivider(doc);

    // Ranking de grupos
    this.addSectionTitle(doc, 'RANKING DE GRUPOS POR VENTAS');
    this.addGroupRanking(doc, data.comparaciones);
    this.addDivider(doc);

    // Detalles por grupo
    for (let i = 0; i < data.comparaciones.length; i++) {
      const grupo = data.comparaciones[i];
      this.addSectionTitle(doc, `GRUPO #${i + 1}: ${grupo.modelo.nombreCompleto}`);
      this.addGroupDetail(doc, grupo);
      
      if (i < data.comparaciones.length - 1) {
        this.addDivider(doc);
      }
    }
  }

  // ========== CONTENIDO: ESTADÍSTICAS GENERALES ==========

  private buildGeneralStatsContent(doc: PDFKit.PDFDocument, data: any): void {
    this.addHeader(doc, 'REPORTE GENERAL DE VENTAS - CHATTERS');
    this.addDivider(doc);
    doc.moveDown(0.3);

    // Periodo del reporte
    this.addPeriodoInfo(doc, data.periodo);
    this.addDivider(doc);

    // Estadísticas generales
    this.addSectionTitle(doc, 'ESTADÍSTICAS GENERALES');
    this.addGeneralStatsSummary(doc, data);
    this.addDivider(doc);

    // Top Chatters
    if (data.topChatters && data.topChatters.length > 0) {
      this.addSectionTitle(doc, 'TOP 10 CHATTERS POR VENTAS');
      this.addTopChattersTable(doc, data.topChatters);
      this.addDivider(doc);
    }

    // Top Modelos
    if (data.topModelos && data.topModelos.length > 0) {
      this.addSectionTitle(doc, 'TOP 10 MODELOS POR VENTAS');
      this.addTopModelosTable(doc, data.topModelos);
    }
  }

  // ========== SECCIONES ESPECÍFICAS ==========

  private addModeloInfo(doc: PDFKit.PDFDocument, modelo: any): void {
    const fields = [
      { label: 'Nombre Completo', value: modelo.nombreCompleto },
      { label: 'Email', value: modelo.correoElectronico },
    ];
    this.addTwoColumnFields(doc, fields);
  }

  private addChatterInfo(doc: PDFKit.PDFDocument, chatter: any): void {
    const fields = [
      { label: 'Nombre', value: chatter.nombre },
      { label: 'Email', value: chatter.correoElectronico },
    ];
    this.addTwoColumnFields(doc, fields);
  }

  private addPeriodoInfo(doc: PDFKit.PDFDocument, periodo: any): void {
    if (!periodo || (!periodo.fechaInicio && !periodo.fechaFin)) {
      this.addInfoBox(doc, 'Periodo: Todos los registros disponibles', COLORS.INFO);
      return;
    }

    const fechaInicio = periodo.fechaInicio ? this.formatDate(periodo.fechaInicio) : 'Inicio';
    const fechaFin = periodo.fechaFin ? this.formatDate(periodo.fechaFin) : 'Actualidad';
    this.addInfoBox(doc, `Periodo: ${fechaInicio} - ${fechaFin}`, COLORS.INFO);
  }

  private addGroupSummary(doc: PDFKit.PDFDocument, data: any): void {
    const fields = [
      { label: 'Total de Ventas', value: data.totalVentas.toString(), color: COLORS.PRIMARY },
      { label: 'Monto Total', value: this.formatCurrency(data.totalGrupo), color: COLORS.SUCCESS },
    ];
    this.addTwoColumnFields(doc, fields);
  }

  private addChatterSalesBreakdown(doc: PDFKit.PDFDocument, grupo: any): void {
    const turnos = ['AM', 'PM', 'MADRUGADA', 'SUPERNUMERARIO'];

    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');

    for (const turno of turnos) {
      const data = grupo[turno];
      if (!data) continue;

      const chatter = data.chatter as any;
      const nombre = chatter ? `${chatter.nombre} ${chatter.apellido}` : 'No asignado';
      const ventasCount = data.ventas?.length || 0;
      const total = data.total || 0;

      this.ensureSpace(doc, 40);

      doc
        .fontSize(FONT_SIZES.SUBSECTION)
        .fillColor(COLORS.GRAY[700])
        .font('Helvetica-Bold')
        .text(`Turno ${turno}`, { width: PDF_CONFIG.CONTENT_WIDTH })
        .moveDown(0.2);

      const fields = [
        { label: 'Chatter', value: nombre },
        { label: 'Total Ventas', value: ventasCount.toString() },
        { label: 'Monto Total', value: this.formatCurrency(total), color: COLORS.SUCCESS },
      ];

      this.addTwoColumnFields(doc, fields);
      doc.moveDown(0.3);
    }
  }

  private addDetailedSalesBreakdown(doc: PDFKit.PDFDocument, grupo: any): void {
    const turnos = ['AM', 'PM', 'MADRUGADA', 'SUPERNUMERARIO'];

    for (const turno of turnos) {
      const data = grupo[turno];
      if (!data || !data.ventas || data.ventas.length === 0) continue;

      const chatter = data.chatter as any;
      const nombre = chatter ? `${chatter.nombre} ${chatter.apellido}` : 'No asignado';

      this.ensureSpace(doc, 60);

      doc
        .fontSize(FONT_SIZES.SUBSECTION)
        .fillColor(COLORS.PRIMARY)
        .font('Helvetica-Bold')
        .text(`Ventas - Turno ${turno}: ${nombre}`, { width: PDF_CONFIG.CONTENT_WIDTH })
        .moveDown(0.3);

      // Tabla de ventas
      this.addSalesTable(doc, data.ventas.slice(0, 20)); // Limitar a 20 por turno

      if (data.ventas.length > 20) {
        doc
          .fontSize(FONT_SIZES.SMALL)
          .fillColor(COLORS.GRAY[500])
          .font('Helvetica-Oblique')
          .text(`... y ${data.ventas.length - 20} ventas más`, { width: PDF_CONFIG.CONTENT_WIDTH })
          .moveDown(0.5);
      }

      doc.moveDown(0.3);
    }
  }

  private addSalesTable(doc: PDFKit.PDFDocument, ventas: any[]): void {
    const tableTop = doc.y;
    const colWidths = [120, 100, 80, 120];
    const headers = ['Fecha', 'Tipo de Venta', 'Monto', 'Plataforma'];

    // Headers
    doc.fontSize(FONT_SIZES.SMALL).font('Helvetica-Bold').fillColor(COLORS.GRAY[700]);
    
    let xPos = PDF_CONFIG.MARGIN;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'left' });
      xPos += colWidths[i];
    });

    doc.moveDown(0.5);

    // Rows
    doc.fontSize(FONT_SIZES.SMALL).font('Helvetica').fillColor(COLORS.GRAY[600]);

    for (const venta of ventas) {
      this.ensureSpace(doc, 20);
      
      const rowY = doc.y;
      xPos = PDF_CONFIG.MARGIN;

      const fecha = this.formatDate(venta.fechaVenta);
      const tipo = this.formatTipoVenta(venta.tipoVenta);
      const monto = this.formatCurrency(venta.monto);
      const plataforma = venta.plataforma || 'N/A';

      doc.text(fecha, xPos, rowY, { width: colWidths[0], align: 'left' });
      xPos += colWidths[0];

      doc.text(tipo, xPos, rowY, { width: colWidths[1], align: 'left' });
      xPos += colWidths[1];

      doc.fillColor(COLORS.SUCCESS).text(monto, xPos, rowY, { width: colWidths[2], align: 'right' });
      xPos += colWidths[2];

      doc.fillColor(COLORS.GRAY[600]).text(plataforma, xPos, rowY, { width: colWidths[3], align: 'left' });

      doc.moveDown(0.3);
    }
  }

  private addChatterGeneralStats(doc: PDFKit.PDFDocument, stats: any): void {
    const fields = [
      { label: 'Total de Ventas', value: stats.totalVentas.toString(), color: COLORS.PRIMARY },
      { label: 'Monto Total', value: this.formatCurrency(stats.totalMonto), color: COLORS.SUCCESS },
      { label: 'Promedio por Venta', value: this.formatCurrency(stats.promedioVenta), color: COLORS.INFO },
    ];
    this.addTwoColumnFields(doc, fields);
  }

  private addVentasPorTipo(doc: PDFKit.PDFDocument, ventasPorTipo: any): void {
    if (!ventasPorTipo || Object.keys(ventasPorTipo).length === 0) {
      doc.fontSize(FONT_SIZES.BODY).fillColor(COLORS.GRAY[500]).text('No hay datos disponibles');
      return;
    }

    doc.fontSize(FONT_SIZES.BODY).font('Helvetica').fillColor(COLORS.GRAY[700]);

    for (const [tipo, monto] of Object.entries(ventasPorTipo)) {
      this.ensureSpace(doc, 20);
      const tipoFormateado = this.formatTipoVenta(tipo);
      const montoFormateado = this.formatCurrency(monto as number);

      doc
        .fillColor(COLORS.GRAY[600])
        .text(`${tipoFormateado}: `, { continued: true, width: PDF_CONFIG.CONTENT_WIDTH })
        .fillColor(COLORS.SUCCESS)
        .font('Helvetica-Bold')
        .text(montoFormateado, { width: PDF_CONFIG.CONTENT_WIDTH })
        .font('Helvetica')
        .moveDown(0.3);
    }
  }

  private addVentasPorModelo(doc: PDFKit.PDFDocument, ventasPorModelo: any[]): void {
    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');

    for (const item of ventasPorModelo.slice(0, 10)) {
      this.ensureSpace(doc, 30);

      doc
        .fontSize(FONT_SIZES.SUBSECTION)
        .fillColor(COLORS.GRAY[700])
        .font('Helvetica-Bold')
        .text(item.nombreCompleto, { width: PDF_CONFIG.CONTENT_WIDTH })
        .moveDown(0.2);

      const fields = [
        { label: 'Total Ventas', value: item.count.toString() },
        { label: 'Monto Total', value: this.formatCurrency(item.total), color: COLORS.SUCCESS },
      ];

      this.addTwoColumnFields(doc, fields);
      doc.moveDown(0.2);
    }
  }

  private addComparisonSummary(doc: PDFKit.PDFDocument, data: any): void {
    const fields = [
      { label: 'Total de Grupos', value: data.totalModelos.toString(), color: COLORS.PRIMARY },
    ];
    this.addTwoColumnFields(doc, fields);
  }

  private addGroupRanking(doc: PDFKit.PDFDocument, comparaciones: any[]): void {
    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');

    comparaciones.forEach((grupo, index) => {
      this.ensureSpace(doc, 40);

      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

      doc
        .fontSize(FONT_SIZES.SUBSECTION)
        .fillColor(COLORS.GRAY[700])
        .font('Helvetica-Bold')
        .text(`${medal} ${grupo.modelo.nombreCompleto}`, { width: PDF_CONFIG.CONTENT_WIDTH })
        .moveDown(0.2);

      const fields = [
        { label: 'Total Ventas', value: grupo.totalVentas.toString() },
        { label: 'Monto Total', value: this.formatCurrency(grupo.totalGrupo), color: COLORS.SUCCESS },
      ];

      this.addTwoColumnFields(doc, fields);
      doc.moveDown(0.3);
    });
  }

  private addGroupDetail(doc: PDFKit.PDFDocument, grupo: any): void {
    const fields = [
      { label: 'Total de Ventas', value: grupo.totalVentas.toString(), color: COLORS.PRIMARY },
      { label: 'Monto Total', value: this.formatCurrency(grupo.totalGrupo), color: COLORS.SUCCESS },
    ];
    this.addTwoColumnFields(doc, fields);
  }

  private addGeneralStatsSummary(doc: PDFKit.PDFDocument, data: any): void {
    const fields = [
      { label: 'Total de Ventas', value: data.totalVentas.toString(), color: COLORS.PRIMARY },
      { label: 'Monto Total', value: this.formatCurrency(data.totalMonto), color: COLORS.SUCCESS },
      { label: 'Promedio por Venta', value: this.formatCurrency(data.promedioVenta), color: COLORS.INFO },
    ];
    this.addTwoColumnFields(doc, fields);
  }

  private addTopChattersTable(doc: PDFKit.PDFDocument, topChatters: any[]): void {
    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');

    topChatters.forEach((chatter, index) => {
      this.ensureSpace(doc, 40);

      const ranking = `#${index + 1}`;

      doc
        .fontSize(FONT_SIZES.SUBSECTION)
        .fillColor(COLORS.GRAY[700])
        .font('Helvetica-Bold')
        .text(`${ranking} ${chatter.nombre}`, { width: PDF_CONFIG.CONTENT_WIDTH })
        .moveDown(0.2);

      const fields = [
        { label: 'Total Ventas', value: chatter.count.toString() },
        { label: 'Monto Total', value: this.formatCurrency(chatter.total), color: COLORS.SUCCESS },
      ];

      this.addTwoColumnFields(doc, fields);
      doc.moveDown(0.3);
    });
  }

  private addTopModelosTable(doc: PDFKit.PDFDocument, topModelos: any[]): void {
    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');

    topModelos.forEach((modelo, index) => {
      this.ensureSpace(doc, 40);

      const ranking = `#${index + 1}`;

      doc
        .fontSize(FONT_SIZES.SUBSECTION)
        .fillColor(COLORS.GRAY[700])
        .font('Helvetica-Bold')
        .text(`${ranking} ${modelo.nombreCompleto}`, { width: PDF_CONFIG.CONTENT_WIDTH })
        .moveDown(0.2);

      const fields = [
        { label: 'Total Ventas', value: modelo.count.toString() },
        { label: 'Monto Total', value: this.formatCurrency(modelo.total), color: COLORS.SUCCESS },
      ];

      this.addTwoColumnFields(doc, fields);
      doc.moveDown(0.3);
    });
  }

  // ========== UTILIDADES DE FORMATO ==========

  private addHeader(doc: PDFKit.PDFDocument, title: string): void {
    const top = PDF_CONFIG.MARGIN - 5;
    doc.x = PDF_CONFIG.MARGIN;
    doc.y = top;

    doc
      .fontSize(FONT_SIZES.TITLE)
      .fillColor(COLORS.PRIMARY)
      .font('Helvetica-Bold')
      .text(title, {
        align: 'center',
        width: PDF_CONFIG.CONTENT_WIDTH,
      })
      .moveDown(0.4);

    doc
      .fontSize(FONT_SIZES.BODY)
      .fillColor(COLORS.GRAY[500])
      .font('Helvetica')
      .text('OnlyTop - Sistema de Gestión de Chatters', {
        align: 'center',
        width: PDF_CONFIG.CONTENT_WIDTH,
      })
      .moveDown(0.3);

    // Configurar header para nuevas páginas
    this.onPageAdded = () => {
      doc.x = PDF_CONFIG.MARGIN;
      doc.y = PDF_CONFIG.MARGIN - 5;

      doc
        .fontSize(16)
        .fillColor(COLORS.PRIMARY)
        .font('Helvetica-Bold')
        .text(title, {
          align: 'center',
          width: PDF_CONFIG.CONTENT_WIDTH,
        })
        .moveDown(0.2);

      this.addDivider(doc);
      doc.moveDown(0.2);
    };
    doc.on('pageAdded', this.onPageAdded);
  }

  private addSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    this.ensureSpace(doc, 28);
    doc.x = PDF_CONFIG.MARGIN;
    doc
      .fontSize(FONT_SIZES.SECTION_TITLE)
      .fillColor(COLORS.GRAY[800])
      .font('Helvetica-Bold')
      .text(title, { underline: true, width: PDF_CONFIG.CONTENT_WIDTH, align: 'left' })
      .moveDown(0.5);
  }

  private addInfoBox(doc: PDFKit.PDFDocument, text: string, color: string): void {
    this.ensureSpace(doc, 40);

    const boxY = doc.y;
    doc
      .roundedRect(PDF_CONFIG.MARGIN, boxY, PDF_CONFIG.CONTENT_WIDTH, 30, 5)
      .fillAndStroke(COLORS.GRAY[50], color);

    doc.y = boxY + 10;

    doc
      .fontSize(FONT_SIZES.BODY)
      .fillColor(COLORS.GRAY[700])
      .font('Helvetica-Bold')
      .text(text, PDF_CONFIG.MARGIN + 15, doc.y, { width: PDF_CONFIG.CONTENT_WIDTH - 30 });

    doc.y = boxY + 35;
  }

  private addTwoColumnFields(
    doc: PDFKit.PDFDocument,
    fields: Array<{ label: string; value: string; color?: string }>,
  ): void {
    const colW = (PDF_CONFIG.CONTENT_WIDTH - 20) / 2;
    const leftX = PDF_CONFIG.MARGIN;
    const rightX = leftX + colW + 20;
    const lineGap = 3;

    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');

    for (let i = 0; i < fields.length; i += 2) {
      const L = fields[i];
      const R = fields[i + 1];

      const leftText = `${L.label}: ${L.value}`;
      const leftH = doc.heightOfString(leftText, { width: colW, lineGap });

      let rightH = 0;
      if (R) {
        const rightText = `${R.label}: ${R.value}`;
        rightH = doc.heightOfString(rightText, { width: colW, lineGap });
      }

      const rowH = Math.max(leftH, rightH);
      this.ensureSpace(doc, rowH + 8);

      const yStartRow = doc.y;

      // Columna izquierda
      doc
        .fillColor(COLORS.GRAY[600])
        .text(`${L.label}: `, leftX, yStartRow, { width: colW, continued: true, lineGap })
        .fillColor(L.color || COLORS.GRAY[700])
        .font('Helvetica-Bold')
        .text(L.value, { width: colW, continued: false, lineGap })
        .font('Helvetica');

      // Columna derecha
      if (R) {
        doc
          .fillColor(COLORS.GRAY[600])
          .text(`${R.label}: `, rightX, yStartRow, { width: colW, continued: true, lineGap })
          .fillColor(R.color || COLORS.GRAY[700])
          .font('Helvetica-Bold')
          .text(R.value, { width: colW, continued: false, lineGap })
          .font('Helvetica');
      }

      doc.y = yStartRow + rowH;
      doc.moveDown(0.4);
    }

    doc.x = PDF_CONFIG.MARGIN;
    doc.moveDown(0.6);
  }

  private addDivider(doc: PDFKit.PDFDocument): void {
    const needed = 14;
    if (doc.y + needed > this.contentBottomY) {
      return;
    }
    doc.moveDown(0.4);
    doc
      .strokeColor(COLORS.GRAY[200])
      .lineWidth(1)
      .moveTo(PDF_CONFIG.MARGIN, doc.y)
      .lineTo(PDF_CONFIG.PAGE_WIDTH - PDF_CONFIG.MARGIN, doc.y)
      .stroke();
    doc.moveDown(0.4);
  }

  private get contentBottomY() {
    return PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN - 80;
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed = 40, allowAddPage = true) {
    if (doc.y + needed > this.contentBottomY && allowAddPage) {
      doc.addPage();
      doc.x = PDF_CONFIG.MARGIN;
    }
  }

  private drawFooters(doc: PDFKit.PDFDocument): void {
    if (this.onPageAdded) {
      doc.removeListener('pageAdded', this.onPageAdded);
      this.onPageAdded = undefined;
    }

    const range = doc.bufferedPageRange();
    const totalPages = range.start + range.count;
    
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      this.drawFooterForPage(doc, i + 1, totalPages);
    }
  }

  private drawFooterForPage(
    doc: PDFKit.PDFDocument,
    pageNumber: number,
    pageCount: number,
  ): void {
    const bottomY = PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN - 60;

    doc
      .strokeColor(COLORS.GRAY[200])
      .lineWidth(1)
      .moveTo(PDF_CONFIG.MARGIN, bottomY)
      .lineTo(PDF_CONFIG.PAGE_WIDTH - PDF_CONFIG.MARGIN, bottomY)
      .stroke();

    const leftX = PDF_CONFIG.MARGIN;
    const width = PDF_CONFIG.CONTENT_WIDTH;
    let y = bottomY + 10;

    const generatedAt = this.currentGeneratedAt ?? new Date();

    const drawCenteredLine = (text: string, fontSize: number, bold: boolean, color: string, extraGap = 1) => {
      doc.fontSize(fontSize).fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica');
      const h = doc.heightOfString(text, { width, align: 'center' });
      doc.text(text, leftX, y, { width, align: 'center', lineBreak: false });
      y += h + extraGap;
    };

    drawCenteredLine('Este documento ha sido generado digitalmente y tiene validez interna.', FONT_SIZES.TINY, false, COLORS.GRAY[400], 1);
    drawCenteredLine('OnlyTop - Sistema de Gestión de Chatters', FONT_SIZES.MICRO, false, COLORS.GRAY[500], 1);
    drawCenteredLine(`Generado el: ${this.formatDateTime(generatedAt)}`, FONT_SIZES.MICRO, false, COLORS.GRAY[400], 1);
    drawCenteredLine(`Pág. ${pageNumber} de ${pageCount}`, FONT_SIZES.MICRO, true, COLORS.GRAY[500], 0);
  }

  // ========== UTILIDADES DE FORMATO DE DATOS ==========

  private formatDate(date: string | Date): string {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  private formatDateTime(date: string | Date): string {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  private formatCurrency(amount: number): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  }

  private formatTipoVenta(tipo: string): string {
    const tipos: Record<string, string> = {
      TIP: 'Propina',
      CONTENIDO_PERSONALIZADO: 'Contenido Personalizado',
      SUSCRIPCION: 'Suscripción',
      PPV: 'Pay Per View',
      SEXTING: 'Sexting',
      VIDEO_CALL: 'Videollamada',
      AUDIO_CALL: 'Llamada de Audio',
      MENSAJE_MASIVO: 'Mensaje Masivo',
      OTRO: 'Otro',
    };
    return tipos[tipo] || tipo;
  }
}

