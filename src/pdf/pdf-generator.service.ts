import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type * as PDFKit from 'pdfkit';

// ========== INTERFACES ==========
interface ContratoData {
  numeroContrato: string;
  fechaInicio: string | Date;
  periodicidadPago: string;
  fechaInicioCobro: string | Date;
  procesadorPagoNombre?: string;
  estado: ContratoEstado;
  createdAt: string | Date;
  tipoComision: 'FIJO' | 'ESCALONADO';
  comisionFija?: ComisionFija;
  comisionEscalonada?: ComisionEscalonada;
  escalaRules?: EscalaRule[];
  modelo: ModeloInfo;
  firma?: FirmaDigital;
}

interface ModeloInfo {
  nombreCompleto: string;
  tipoDocumento: string;
  numeroIdentificacion: string;
  correoElectronico: string;
  telefono?: string;
  fechaNacimiento: string | Date;
  paisResidencia: string;
  ciudadResidencia: string;
}

interface ComisionFija {
  porcentaje: number;
}

interface ComisionEscalonada {
  escalaNombre?: string;
}

interface EscalaRule {
  minUsd: number;
  maxUsd?: number;
  percentage: number;
}

interface FirmaDigital {
  nombreCompleto: string;
  numeroIdentificacion: string;
  fechaFirma: string | Date;
  ipAddress: string;
  otpVerificado: boolean;
  userAgent: string;
}

type ContratoEstado = 'BORRADOR' | 'PENDIENTE_FIRMA' | 'FIRMADO' | 'RECHAZADO' | 'CANCELADO';

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

const SPACING = {
  SECTION: 1.5,
  PARAGRAPH: 1,
  LINE: 0.5,
  SMALL: 0.3,
} as const;

const ESTADO_COLORS: Record<ContratoEstado, string> = {
  BORRADOR: COLORS.WARNING,
  PENDIENTE_FIRMA: COLORS.SECONDARY,
  FIRMADO: COLORS.SUCCESS,
  RECHAZADO: COLORS.DANGER,
  CANCELADO: COLORS.GRAY[500],
};

// ========== SERVICIO ==========
@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private currentGeneratedAt?: Date;
  private onPageAdded?: () => void;

  /**
   * Genera un PDF de contrato de modelo con formato profesional
   */
  async generateContratoModeloPdf(contratoData: ContratoData): Promise<Buffer> {
    try {
      this.validateContratoData(contratoData);

      // Marcar timestamp de generación para usar en footer consistente
      this.currentGeneratedAt = new Date();

      const doc = this.createPdfDocument(contratoData);
      const pdfBuffer = await this.generatePdfBuffer(doc, contratoData);

      this.logger.log(`PDF generado exitosamente: ${contratoData.numeroContrato}`);
      return pdfBuffer;
    } catch (error) {
      this.logger.error(`Error generando PDF: ${contratoData.numeroContrato}`, error);
      throw new Error(`No se pudo generar el PDF del contrato: ${error.message}`);
    }
  }

  // ========== MÉTODOS PRINCIPALES ==========

  private createPdfDocument(contratoData: ContratoData): PDFKit.PDFDocument {
    return new PDFDocument({
      size: PDF_CONFIG.SIZE,
      margin: PDF_CONFIG.MARGIN,
      bufferPages: true,
      info: this.getPdfMetadata(contratoData),
    });
  }

  private getPdfMetadata(contratoData: ContratoData) {
    return {
      Title: `Contrato ${contratoData.numeroContrato}`,
      Author: 'OnlyTop',
      Subject: 'Contrato de Gestión de Contenido Digital',
      Creator: 'OnlyTop Sistema de Gestión',
      Producer: 'OnlyTop PDF Generator v2.0',
      CreationDate: new Date(),
    };
  }

  private async generatePdfBuffer(
    doc: PDFKit.PDFDocument,
    contratoData: ContratoData,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.buildPdfContent(doc, contratoData);
        // Dibujar footers uniformes en TODAS las páginas antes de cerrar
        this.drawFooters(doc, contratoData);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private buildPdfContent(doc: PDFKit.PDFDocument, data: ContratoData): void {
    // Construir el contenido del PDF
    this.addHeader(doc, data);
    this.addContratoInfo(doc, data);
    this.addModeloInfo(doc, data);
    this.addTerminosCondiciones(doc, data);
    this.addComisionesInfo(doc, data);
    
    if (data.firma) {
      this.addFirmaDigital(doc, data);
    }
    // Footers ahora se dibujan de forma uniforme al final en drawFooters()
  }

  // ========== FOOTER POR PÁGINA ==========

  private drawFooters(doc: PDFKit.PDFDocument, data: ContratoData): void {
    // Evitar que el header automático decore nuevas páginas durante el dibujado de footers
    if (this.onPageAdded) {
      doc.removeListener('pageAdded', this.onPageAdded);
      this.onPageAdded = undefined;
    }
    const range = doc.bufferedPageRange();
    const totalPages = range.start + range.count; // total absoluto
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      this.drawFooterForPage(doc, data, i + 1, totalPages);
    }
  }

  private drawFooterForPage(
    doc: PDFKit.PDFDocument,
    data: ContratoData,
    pageNumber: number,
    pageCount: number,
  ): void {
    const bottomY = PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN - 60;

    // Separador superior del footer
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
    const hora = this.formatTime(generatedAt);

    const drawCenteredLine = (
      text: string,
      fontSize: number,
      bold: boolean,
      color: string,
      extraGap = 1,
    ) => {
      doc.fontSize(fontSize).fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica');
      const h = doc.heightOfString(text, { width, align: 'center' });
      doc.text(text, leftX, y, { width, align: 'center', lineBreak: false });
      y += h + extraGap;
    };

    // Línea superior: hora + Documento ID
  drawCenteredLine(`${hora} · Documento ID: ${data.numeroContrato}`, FONT_SIZES.TINY, true, COLORS.GRAY[600], 1);
    // Texto legal
  drawCenteredLine('Este documento ha sido generado digitalmente y tiene validez legal.', FONT_SIZES.TINY, false, COLORS.GRAY[400], 1);
    // Información de la empresa
  drawCenteredLine('OnlyTop - Gestión de Contenido Digital', FONT_SIZES.MICRO, false, COLORS.GRAY[500], 1);
    // Metadata de fecha completa
  drawCenteredLine(`Generado el: ${this.formatDateTime(generatedAt)}`, FONT_SIZES.MICRO, false, COLORS.GRAY[400], 1);
    // Paginación (pequeña y debajo de todo)
    drawCenteredLine(`Pág. ${pageNumber} de ${pageCount}`, FONT_SIZES.MICRO, true, COLORS.GRAY[500], 0);
  }

  // ========== VALIDACIÓN ==========

  private validateContratoData(data: ContratoData): void {
    const requiredFields = ['numeroContrato', 'fechaInicio', 'estado', 'tipoComision', 'modelo'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }

    if (!data.modelo.nombreCompleto || !data.modelo.numeroIdentificacion) {
      throw new Error('Información de la modelo incompleta');
    }

    if (data.tipoComision === 'FIJO' && !data.comisionFija?.porcentaje) {
      throw new Error('Porcentaje de comisión fija no especificado');
    }

    if (data.tipoComision === 'ESCALONADO' && (!data.escalaRules || data.escalaRules.length === 0)) {
      throw new Error('Reglas de escala no especificadas');
    }
  }

  // ========== SECCIONES DEL PDF ==========

  private addHeader(doc: PDFKit.PDFDocument, data: ContratoData): void {
    // Header de la primera página
    this.renderHeader(doc, data);
    this.addDivider(doc);
    // Separación extra para que el primer bloque no "se pegue" al header
    doc.moveDown(0.3);

    // Repetir en nuevas páginas
    this.onPageAdded = () => {
      this.renderHeader(doc, data, true);
      this.addDivider(doc);
      doc.moveDown(0.2);
    };
    doc.on('pageAdded', this.onPageAdded);  
  }

  private renderHeader(doc: PDFKit.PDFDocument, data: ContratoData, compact = false) {
    const top = PDF_CONFIG.MARGIN - 5;
    doc.x = PDF_CONFIG.MARGIN;
    doc.y = top;

    doc
      .fontSize(compact ? 16 : FONT_SIZES.TITLE)
      .fillColor(COLORS.PRIMARY)
      .font('Helvetica-Bold')
      .text('CONTRATO DE GESTIÓN DE CONTENIDO DIGITAL', {
        align: 'center',
        width: PDF_CONFIG.CONTENT_WIDTH,
      })
      .moveDown(compact ? 0.2 : 0.4);

    if (!compact) {
      doc
        .fontSize(FONT_SIZES.BODY)
        .fillColor(COLORS.GRAY[500])
        .font('Helvetica')
        .text('OnlyTop - Agencia de Gestión de Contenido Digital', {
          align: 'center',
          width: PDF_CONFIG.CONTENT_WIDTH,
        })
        .moveDown(0.3);

      doc
        .fontSize(FONT_SIZES.SUBSECTION)
        .fillColor(COLORS.GRAY[700])
        .font('Helvetica-Bold')
        .text(`Número de Contrato: ${data.numeroContrato}`, {
          align: 'center',
          width: PDF_CONFIG.CONTENT_WIDTH,
        })
        .moveDown(0.4);
    }
  }

  private addContratoInfo(doc: PDFKit.PDFDocument, data: ContratoData): void {
    this.addSectionTitle(doc, 'INFORMACIÓN DEL CONTRATO');

    const fields = [
      { label: 'Fecha de Inicio', value: this.formatDate(data.fechaInicio) },
      { label: 'Periodicidad de Pago', value: data.periodicidadPago },
      { label: 'Fecha Inicio de Cobro', value: this.formatDate(data.fechaInicioCobro) },
      { label: 'Procesador de Pago', value: data.procesadorPagoNombre || 'N/A' },
      { label: 'Estado', value: data.estado, color: ESTADO_COLORS[data.estado] },
      { label: 'Fecha de Creación', value: this.formatDate(data.createdAt) },
    ];

    this.addTwoColumnFields(doc, fields);
    this.addDivider(doc);
  }

  private addModeloInfo(doc: PDFKit.PDFDocument, data: ContratoData): void {
    const modelo = data.modelo;
    if (!modelo) return;

    this.addSectionTitle(doc, 'INFORMACIÓN DE LA MODELO');

    const fields = [
      { label: 'Nombre Completo', value: modelo.nombreCompleto },
      { label: 'Identificación', value: `${modelo.tipoDocumento}: ${modelo.numeroIdentificacion}` },
      { label: 'Email', value: modelo.correoElectronico },
      { label: 'Teléfono', value: modelo.telefono || 'N/A' },
      { label: 'Fecha de Nacimiento', value: this.formatDate(modelo.fechaNacimiento) },
      { label: 'País', value: modelo.paisResidencia },
      { label: 'Ciudad', value: modelo.ciudadResidencia },
    ];

    this.addTwoColumnFields(doc, fields);
    this.addDivider(doc);
  }

  private addTerminosCondiciones(doc: PDFKit.PDFDocument, data: ContratoData): void {
    this.addSectionTitle(doc, 'TÉRMINOS Y CONDICIONES');

    const terminos = this.getTerminosCondiciones();

    doc.fontSize(FONT_SIZES.BODY).fillColor(COLORS.GRAY[700]).font('Helvetica');

    const width = PDF_CONFIG.CONTENT_WIDTH;

    terminos.forEach((t, idx) => {
      const para = `${idx + 1}. ${t}`;
      const h = doc.heightOfString(para, { width, align: 'justify', lineGap: 2 });
      this.ensureSpace(doc, h + 6);
      doc.text(para, {
        width,
        align: 'justify',
        lineGap: 2,
      });
      doc.moveDown(0.5);
    });

    this.addDivider(doc);
  }

  private addComisionesInfo(doc: PDFKit.PDFDocument, data: ContratoData): void {
    this.addSectionTitle(doc, 'ESTRUCTURA DE COMISIÓN');

    if (data.tipoComision === 'FIJO') {
      this.addComisionFija(doc, data);
    } else if (data.tipoComision === 'ESCALONADO') {
      this.addComisionEscalonada(doc, data);
    }

    this.addDivider(doc);
  }

  private addComisionFija(doc: PDFKit.PDFDocument, data: ContratoData): void {
    if (!data.comisionFija) {
      throw new Error('Información de comisión fija no disponible');
    }

    const width = PDF_CONFIG.CONTENT_WIDTH;
    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');

    // Tipo de comisión
    this.ensureSpace(doc, 20);
    doc
      .fillColor(COLORS.GRAY[600])
      .text('Tipo de Comisión: ', { continued: true, width })
      .fillColor(COLORS.SUCCESS)
      .font('Helvetica-Bold')
      .text('COMISIÓN FIJA', { width })
      .moveDown(0.4);

    // Porcentaje destacado
    this.ensureSpace(doc, 24);
    const pctLine = `Porcentaje: `;
    const pctValue = `${data.comisionFija.porcentaje}%`;
    doc
      .fillColor(COLORS.GRAY[600])
      .font('Helvetica')
      .text(pctLine, { continued: true, width })
      .fillColor(COLORS.SUCCESS)
      .fontSize(FONT_SIZES.SECTION_TITLE)
      .font('Helvetica-Bold')
      .text(pctValue, { width })
      .moveDown(0.4);

    // Descripción
    const desc = `La MODELO pagará a OnlyTop el ${data.comisionFija.porcentaje}% de sus ingresos brutos mensuales generados a través de las plataformas gestionadas.`;
    const h = doc.heightOfString(desc, { width, align: 'justify', lineGap: 2 });
    this.ensureSpace(doc, h + 6);
    doc
      .fontSize(FONT_SIZES.BODY)
      .fillColor(COLORS.GRAY[700])
      .font('Helvetica')
      .text(desc, { width, align: 'justify', lineGap: 2 })
      .moveDown(0.8);
  }

  private addComisionEscalonada(doc: PDFKit.PDFDocument, data: ContratoData): void {
    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');
    const width = PDF_CONFIG.CONTENT_WIDTH;

    // Tipo de comisión
    this.ensureSpace(doc, 20);
    doc
      .fillColor(COLORS.GRAY[600])
      .text('Tipo de Comisión: ', { continued: true, width })
      .fillColor(COLORS.SECONDARY)
      .font('Helvetica-Bold')
      .text('COMISIÓN ESCALONADA', { width })
      .moveDown(0.4);

    // Nombre de la escala
    this.ensureSpace(doc, 20);
    doc
      .fillColor(COLORS.GRAY[600])
      .font('Helvetica')
      .text('Escala: ', { continued: true, width })
      .fillColor(COLORS.GRAY[700])
      .font('Helvetica-Bold')
      .text(data.comisionEscalonada?.escalaNombre || 'Escala Estándar', { width })
      .moveDown(0.6);

    // Tabla de tramos
    if (data.escalaRules && data.escalaRules.length > 0) {
      this.addEscalaTable(doc, data.escalaRules);
    }

    // Descripción
    const desc = 'La MODELO pagará a OnlyTop un porcentaje escalonado según sus ingresos mensuales brutos, de acuerdo a la tabla de tramos anterior.';
    const h = doc.heightOfString(desc, { width, align: 'justify', lineGap: 2 });
    this.ensureSpace(doc, h + 6);
    doc
      .fontSize(FONT_SIZES.BODY)
      .fillColor(COLORS.GRAY[700])
      .font('Helvetica')
      .text(desc, { width, align: 'justify', lineGap: 2 })
      .moveDown(0.8);
  }

  private addEscalaTable(doc: PDFKit.PDFDocument, rules: EscalaRule[]): void {
    const width = PDF_CONFIG.CONTENT_WIDTH;
    this.ensureSpace(doc, 22);
    doc
      .fontSize(FONT_SIZES.SMALL)
      .fillColor(COLORS.GRAY[600])
      .font('Helvetica-Bold')
      .text('Tramos de Comisión:', { underline: true, width })
      .moveDown(0.3);

    doc.font('Helvetica').fontSize(FONT_SIZES.SMALL);

    for (const rule of rules) {
      const rango = this.formatRangoComision(rule);
      const line = `• ${rango}: ${rule.percentage}%`;
      const h = doc.heightOfString(line, { width, lineGap: 1 });
      this.ensureSpace(doc, h + 4);
      // pintar con color parcial: primero la parte fija, luego el %
      const base = `• ${rango}: `;
      doc.fillColor(COLORS.GRAY[700]).text(base, {
        width,
        continued: true,
        lineGap: 1,
      });
      doc.fillColor(COLORS.SECONDARY).font('Helvetica-Bold').text(`${rule.percentage}%`, {
        width,
        continued: false,
        lineGap: 1,
      });
      doc.font('Helvetica').fillColor(COLORS.GRAY[700]);
      doc.moveDown(0.1);
    }

    doc.moveDown(0.4);
  }

  private addFirmaDigital(doc: PDFKit.PDFDocument, data: ContratoData): void {
    const firma = data.firma;
    
    if (!firma) {
      throw new Error('Información de firma digital no disponible');
    }

    this.addSectionTitle(doc, 'FIRMA DIGITAL');

    const boxHeight = 130;
    this.ensureSpace(doc, boxHeight + 20);

    doc.save();

    const boxY = doc.y;
    doc
      .roundedRect(PDF_CONFIG.MARGIN, boxY, PDF_CONFIG.CONTENT_WIDTH, boxHeight, 5)
      .fillAndStroke(COLORS.GRAY[50], COLORS.GRAY[300]);

    // Contenido del recuadro
    doc.y = boxY + 15;

    // Badge de verificación
    doc
      .fontSize(FONT_SIZES.SUBSECTION)
      .fillColor(COLORS.SUCCESS)
      .font('Helvetica-Bold')
      .text('CONTRATO FIRMADO DIGITALMENTE', PDF_CONFIG.MARGIN + 15, doc.y)
      .moveDown(0.6);

    doc.fontSize(FONT_SIZES.SMALL).font('Helvetica').fillColor(COLORS.GRAY[800]);

    const leftX = PDF_CONFIG.MARGIN + 15;
    const rightX = PDF_CONFIG.MARGIN + PDF_CONFIG.CONTENT_WIDTH / 2 + 10;
    const baseY = doc.y;

    // Columna izquierda
    this.addFieldInBox(doc, 'Firmado por:', firma.nombreCompleto, leftX, baseY);
    this.addFieldInBox(doc, 'Identificación:', firma.numeroIdentificacion, leftX, baseY + 18);
    this.addFieldInBox(doc, 'Fecha de Firma:', this.formatDateTime(firma.fechaFirma), leftX, baseY + 36);

    // Columna derecha
    this.addFieldInBox(doc, 'IP Address:', firma.ipAddress, rightX, baseY);
    this.addFieldInBox(
      doc,
      'Verificación OTP:',
      firma.otpVerificado ? 'Verificado' : 'No verificado',
      rightX,
      baseY + 18,
      firma.otpVerificado ? COLORS.SUCCESS : COLORS.DANGER
    );
    this.addFieldInBox(doc, 'User Agent:', this.truncateText(firma.userAgent, 40), rightX, baseY + 36);

    doc.restore();
    doc.y = boxY + boxHeight + 10;
  }

  private addFooter(doc: PDFKit.PDFDocument, data: ContratoData): void {
    const bottomY = PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN - 60;

    doc
      .strokeColor(COLORS.GRAY[200])
      .lineWidth(1)
      .moveTo(PDF_CONFIG.MARGIN, bottomY)
      .lineTo(PDF_CONFIG.PAGE_WIDTH - PDF_CONFIG.MARGIN, bottomY)
      .stroke();

    doc.y = bottomY + 15;

    // Texto legal
    doc
      .fontSize(FONT_SIZES.TINY)
      .fillColor(COLORS.GRAY[400])
      .font('Helvetica')
      .text('Este documento ha sido generado digitalmente y tiene validez legal.', {
        align: 'center',
      })
      .moveDown(SPACING.SMALL);

    // Información de la empresa
    doc
      .fontSize(FONT_SIZES.MICRO)
      .fillColor(COLORS.GRAY[500])
      .text('OnlyTop - Gestión de Contenido Digital', { align: 'center' })
      .moveDown(SPACING.SMALL);

    // Metadata
    doc
      .fontSize(FONT_SIZES.MICRO)
      .fillColor(COLORS.GRAY[400])
      .text(`Generado el: ${this.formatDateTime(new Date())}`, { align: 'center' })
      .moveDown(SPACING.SMALL);

    doc
      .fontSize(FONT_SIZES.MICRO)
      .fillColor(COLORS.GRAY[500])
      .font('Helvetica-Bold')
      .text(`Documento ID: ${data.numeroContrato}`, { align: 'center' });
  }

  // ========== UTILIDADES DE FORMATO ==========

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

  private get contentBottomY() {
    return PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN - 80; // reserva para footer
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed = 40, allowAddPage = true) {
    if (doc.y + needed > this.contentBottomY && allowAddPage) {
      doc.addPage();
      // No reasignar doc.y aquí; el header (pageAdded) ya ajusta y y agrega separador
      doc.x = PDF_CONFIG.MARGIN;
    }
  }

  private addDivider(doc: PDFKit.PDFDocument): void {
    const needed = 14; // alto aprox. línea + respiración
    if (doc.y + needed > this.contentBottomY) {
      // No forzar salto aquí; evita páginas vacías con solo header
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

  private addTwoColumnFields(
    doc: PDFKit.PDFDocument,
    fields: Array<{ label: string; value: string; color?: string }>,
  ): void {
    const colW = (PDF_CONFIG.CONTENT_WIDTH - 20) / 2; // 20 de gutter
    const leftX = PDF_CONFIG.MARGIN;
    const rightX = leftX + colW + 20;
    const lineGap = 3;

    doc.fontSize(FONT_SIZES.BODY).font('Helvetica');

    for (let i = 0; i < fields.length; i += 2) {
      // medir celda izquierda
      const L = fields[i];
      const leftLabel = `${L.label}: `;
      const leftValue = L.value ?? 'N/A';

      const leftText = leftLabel + leftValue;
      const leftH = doc.heightOfString(leftText, {
        width: colW,
        align: 'left',
        lineGap,
      });

      // medir celda derecha (si existe)
      let rightH = 0;
      let R: typeof L | undefined = undefined;
      if (i + 1 < fields.length) {
        R = fields[i + 1];
        const rightText = `${R.label}: ${R.value ?? 'N/A'}`;
        rightH = doc.heightOfString(rightText, {
          width: colW,
          align: 'left',
          lineGap,
        });
      }

      const rowH = Math.max(leftH, rightH);

      // prever salto antes de pintar la fila
      this.ensureSpace(doc, rowH + 8);

      const yStartRow = doc.y;

      // pintar izquierda
      doc
        .fillColor(COLORS.GRAY[600])
        .text(leftLabel, leftX, yStartRow, {
          width: colW,
          continued: true,
          lineGap,
        })
        .fillColor(L.color || COLORS.GRAY[700])
        .font('Helvetica-Bold')
        .text(leftValue, { width: colW, continued: false, lineGap })
        .font('Helvetica');

      // pintar derecha si hay
      if (R) {
        doc
          .fillColor(COLORS.GRAY[600])
          .text(`${R.label}: `, rightX, yStartRow, {
            width: colW,
            continued: true,
            lineGap,
          })
          .fillColor(R.color || COLORS.GRAY[700])
          .font('Helvetica-Bold')
          .text(R.value ?? 'N/A', { width: colW, continued: false, lineGap })
          .font('Helvetica');
      }

      // avanzar a la siguiente fila por el alto máximo
      doc.y = yStartRow + rowH;
      doc.moveDown(0.4);
    }

    // reset de x por si acaso
    doc.x = PDF_CONFIG.MARGIN;
    doc.moveDown(0.6);
  }

  private addFieldInBox(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    valueColor: string = COLORS.GRAY[800],
  ): void {
    doc.fillColor(COLORS.GRAY[600]).text(`${label}`, x, y, {
      width: 100,
      continued: false,
    });

    doc
      .fillColor(valueColor)
      .font('Helvetica-Bold')
      .text(value, x + 105, y, {
        width: 150,
      });

    doc.font('Helvetica');
  }

  // ========== UTILIDADES DE DATOS ==========

  private getTerminosCondiciones(): string[] {
    return [
      'La MODELO se compromete a crear y publicar contenido digital en las plataformas acordadas de manera profesional, consistente y cumpliendo con los estándares de calidad establecidos.',
      'OnlyTop se compromete a gestionar, promover y optimizar el contenido de la MODELO para maximizar sus ingresos, proporcionando estrategias de marketing y análisis de rendimiento.',
      'La MODELO mantiene todos los derechos de autor sobre su contenido original y su imagen. OnlyTop no adquiere derechos de propiedad sobre el contenido creado.',
      'OnlyTop proporcionará servicios de gestión de chatting profesional, marketing digital, soporte técnico y asesoría estratégica para el crecimiento de la cuenta.',
      'Ambas partes se comprometen a mantener estricta confidencialidad sobre la información comercial, personal y financiera compartida durante la vigencia del contrato.',
      'Los pagos se realizarán según la periodicidad acordada y el sistema de comisiones establecido. OnlyTop proporcionará reportes detallados de ingresos mensualmente.',
      'Cualquier modificación a los términos de este contrato debe ser acordada por escrito y firmada digitalmente por ambas partes para tener validez.',
      'Este contrato puede ser terminado por cualquiera de las partes con notificación previa por escrito de treinta (30) días calendario, cumpliendo con las obligaciones pendientes.',
    ];
  }

  private formatDate(date: string | Date): string {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
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
        second: '2-digit',
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  private formatTime(date: string | Date | Date): string {
    if (!date) return 'N/A';
    try {
      const d = new Date(date as any);
      return d.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Hora inválida';
    }
  }

  private formatRangoComision(rule: EscalaRule): string {
    const minFormatted = this.formatCurrency(rule.minUsd);
    if (rule.maxUsd) {
      const maxFormatted = this.formatCurrency(rule.maxUsd);
      return `${minFormatted} - ${maxFormatted}`;
    }
    return `${minFormatted} en adelante`;
  }

  private formatCurrency(amount: number): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return 'N/A';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  }
}