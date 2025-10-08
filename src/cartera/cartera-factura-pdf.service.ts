import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { MoneyService } from '../money/money.service.js';

/**
 * Servicio para generar PDFs de Facturas Individuales
 * 
 * Genera documentos PDF profesionales para:
 * - Facturas individuales con detalle completo
 * - Recibos de pago
 * - Comprobantes de facturación
 * 
 * Arquitectura:
 * - Separado de cartera-pdf.service.ts para evitar sobrecarga
 * - Diseño profesional consistente con estado de cuenta
 * - Integración con MoneyService para formateo dinámico
 * - Soporte multi-moneda (USD, COP)
 * 
 * @author OnlyTop Development Team
 * @version 1.0.0
 * @since 2025
 */

// ========== INTERFACES ==========
interface FacturaData {
  factura: FacturaInfo;
  modelo: ModeloInfo;
  contrato: ContratoInfo;
  pagos: PagoInfo[];
}

interface FacturaInfo {
  numeroFactura: string;
  fechaEmision: string | Date;
  fechaVencimiento: string | Date;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO' | 'CANCELADO';
  moneda: 'USD' | 'COP';
  items: ItemFactura[];
  subtotal: number;
  descuento: number;
  total: number;
  saldoPendiente: number;
  montoPagado: number;
  notas?: string | null;
  periodo: {
    anio: number;
    mes: number;
    quincena?: number | null;
  };
}

interface ItemFactura {
  concepto: string;
  cantidad: number;
  valorUnitario: number;
  subtotal: number;
  notas?: string | null;
}

interface ModeloInfo {
  nombreCompleto: string;
  numeroIdentificacion: string;
  correoElectronico: string;
  telefono?: string;
}

interface ContratoInfo {
  numeroContrato: string;
  fechaInicio: string | Date;
  periodicidadPago: 'QUINCENAL' | 'MENSUAL';
  tipoComision: 'FIJO' | 'ESCALONADO';
}

interface PagoInfo {
  numeroRecibo: string;
  fechaPago: string | Date;
  monto: number;
  moneda: 'USD' | 'COP';
  metodoPago: string;
  referencia?: string;
  comprobanteUrl?: string;
}

type EstadoFactura = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO' | 'CANCELADO';

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
  TITLE: 22,
  SUBTITLE: 16,
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

const ESTADO_COLORS: Record<EstadoFactura, string> = {
  PENDIENTE: COLORS.WARNING,
  PARCIAL: COLORS.SECONDARY,
  PAGADO: COLORS.SUCCESS,
  VENCIDO: COLORS.DANGER,
  CANCELADO: COLORS.GRAY[500],
};

const ESTADO_LABELS: Record<EstadoFactura, string> = {
  PENDIENTE: 'PENDIENTE DE PAGO',
  PARCIAL: 'PARCIALMENTE PAGADO',
  PAGADO: 'PAGADO',
  VENCIDO: 'VENCIDO',
  CANCELADO: 'CANCELADO',
};

@Injectable()
export class CarteraFacturaPdfService {
  private readonly logger = new Logger(CarteraFacturaPdfService.name);
  private currentGeneratedAt?: Date;

  constructor(
    private readonly configService: ConfigService,
    private readonly moneyService: MoneyService,
  ) {}

  /**
   * Genera un PDF de factura individual con formato profesional
   */
  async generateFacturaPdf(facturaData: FacturaData): Promise<Buffer> {
    try {
      this.currentGeneratedAt = new Date();
      
      this.logger.log(`Generando PDF de factura: ${facturaData.factura.numeroFactura}`);

      const doc = new PDFDocument({
        size: PDF_CONFIG.SIZE,
        margin: PDF_CONFIG.MARGIN,
        bufferPages: true,
        info: {
          Title: `Factura ${facturaData.factura.numeroFactura}`,
          Author: 'OnlyTop',
          Subject: 'Factura de Comisiones',
          Creator: 'OnlyTop Sistema de Cartera',
          Producer: 'OnlyTop PDF Generator - Facturas v1.0',
          CreationDate: this.currentGeneratedAt,
        },
      });

      return new Promise((resolve, reject) => {
        const buffers: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          this.logger.log(`✅ PDF generado: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
          resolve(pdfBuffer);
        });
        doc.on('error', (err: Error) => {
          this.logger.error(`❌ Error en generación de PDF: ${err.message}`, err.stack);
          reject(err);
        });

        // Construir contenido del PDF
        this.buildPdfContent(doc, facturaData);

        // Dibujar footers en todas las páginas
        this.drawFooters(doc, facturaData);

        doc.end();
      });
    } catch (error: any) {
      this.logger.error(`❌ Error generando PDF de Factura: ${error.message}`, error.stack);
      throw new Error(`No se pudo generar el PDF de la factura: ${error.message}`);
    }
  }

  // ========== CONSTRUCCIÓN DEL CONTENIDO ==========

  private buildPdfContent(doc: PDFKit.PDFDocument, data: FacturaData): void {
    // Header con branding y estado
    this.addHeader(doc, data);
    
    // Información de factura y modelo (lado a lado)
    this.addFacturaYModeloInfo(doc, data);
    
    // Periodo de facturación
    this.addPeriodoInfo(doc, data);
    
    // Tabla de items
    this.addItemsTable(doc, data);
    
    // Totales (destacado)
    this.addTotales(doc, data);
    
    // Información de pagos (si existen)
    if (data.pagos.length > 0) {
      this.addPagosInfo(doc, data);
    }
    
    // Notas adicionales
    if (data.factura.notas) {
      this.addNotas(doc, data);
    }
    
    // Información legal y términos
    this.addTerminosCondiciones(doc);
  }

  // ========== SECCIONES DEL PDF ==========

  private addHeader(doc: PDFKit.PDFDocument, data: FacturaData): void {
    const estado = data.factura.estado;
    const estadoColor = ESTADO_COLORS[estado];

    // Fondo principal
    doc
      .rect(0, 0, PDF_CONFIG.PAGE_WIDTH, 80)
      .fill(COLORS.PRIMARY);

    // Badge de estado en la esquina superior derecha
    const badgeWidth = 150;
    const badgeX = PDF_CONFIG.PAGE_WIDTH - badgeWidth - PDF_CONFIG.MARGIN;
    doc
      .roundedRect(badgeX, 15, badgeWidth, 25, 5)
      .fill(estadoColor);

    doc
      .fontSize(FONT_SIZES.SMALL)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text(ESTADO_LABELS[estado], badgeX, 22, {
        width: badgeWidth,
        align: 'center',
      });

    // Título principal
    doc
      .fontSize(FONT_SIZES.TITLE)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text('FACTURA', PDF_CONFIG.MARGIN, 25, {
        width: 300,
      });

    // Subtítulo
    doc
      .fontSize(FONT_SIZES.BODY)
      .fillColor('#ffffff')
      .font('Helvetica')
      .text('OnlyTop - Sistema de Cartera', PDF_CONFIG.MARGIN, 52);

    doc.y = 95;
  }

  private addFacturaYModeloInfo(doc: PDFKit.PDFDocument, data: FacturaData): void {
    const startY = doc.y;
    const leftX = PDF_CONFIG.MARGIN;
    const rightX = PDF_CONFIG.MARGIN + 260;
    const boxWidth = 235;
    const boxHeight = 140;

    // Caja izquierda: Información de Factura
    doc
      .roundedRect(leftX, startY, boxWidth, boxHeight, 5)
      .fillAndStroke(COLORS.GRAY[50], COLORS.GRAY[300]);

    doc
      .fontSize(FONT_SIZES.SECTION_TITLE)
      .fillColor(COLORS.PRIMARY)
      .font('Helvetica-Bold')
      .text('INFORMACIÓN DE FACTURA', leftX + 12, startY + 12, {
        width: boxWidth - 24,
      });

    let leftY = startY + 35;
    this.addFieldInBox(doc, 'N° Factura', data.factura.numeroFactura, leftX + 12, leftY);
    leftY += 26;
    this.addFieldInBox(doc, 'Fecha Emisión', this.formatDate(data.factura.fechaEmision), leftX + 12, leftY);
    leftY += 26;
    this.addFieldInBox(doc, 'Fecha Vencimiento', this.formatDate(data.factura.fechaVencimiento), leftX + 12, leftY, 
      this.isVencida(data.factura.fechaVencimiento) ? COLORS.DANGER : COLORS.GRAY[800]);
    leftY += 26;
    this.addFieldInBox(doc, 'Moneda', data.factura.moneda, leftX + 12, leftY);

    // Caja derecha: Información del Modelo
    doc
      .roundedRect(rightX, startY, boxWidth, boxHeight, 5)
      .fillAndStroke(COLORS.GRAY[50], COLORS.GRAY[300]);

    doc
      .fontSize(FONT_SIZES.SECTION_TITLE)
      .fillColor(COLORS.PRIMARY)
      .font('Helvetica-Bold')
      .text('FACTURADO A', rightX + 12, startY + 12, {
        width: boxWidth - 24,
      });

    let rightY = startY + 35;
    this.addFieldInBox(doc, 'Nombre', data.modelo.nombreCompleto, rightX + 12, rightY);
    rightY += 26;
    this.addFieldInBox(doc, 'Identificación', data.modelo.numeroIdentificacion, rightX + 12, rightY);
    rightY += 26;
    this.addFieldInBox(doc, 'Email', data.modelo.correoElectronico, rightX + 12, rightY, COLORS.PRIMARY);
    rightY += 26;
    this.addFieldInBox(doc, 'Teléfono', data.modelo.telefono || 'N/A', rightX + 12, rightY);

    doc.y = startY + boxHeight + 20;
  }

  private addPeriodoInfo(doc: PDFKit.PDFDocument, data: FacturaData): void {
    this.ensureSpace(doc, 50, false);

    const startY = doc.y;
    const periodo = data.factura.periodo;
    
    let periodoTexto = '';
    if (periodo.quincena === 1) {
      periodoTexto = `Primera Quincena - ${this.getNombreMes(periodo.mes)} ${periodo.anio} (Días 1-15)`;
    } else if (periodo.quincena === 2) {
      periodoTexto = `Segunda Quincena - ${this.getNombreMes(periodo.mes)} ${periodo.anio} (Días 16-${this.getDiasEnMes(periodo.anio, periodo.mes)})`;
    } else {
      periodoTexto = `Mes Completo - ${this.getNombreMes(periodo.mes)} ${periodo.anio}`;
    }

    doc
      .roundedRect(PDF_CONFIG.MARGIN, startY, PDF_CONFIG.CONTENT_WIDTH, 40, 5)
      .fillAndStroke('#e0f2fe', '#0284c7');

    doc
      .fontSize(FONT_SIZES.SMALL)
      .fillColor(COLORS.GRAY[600])
      .font('Helvetica')
      .text('PERIODO DE FACTURACIÓN', PDF_CONFIG.MARGIN + 15, startY + 10);

    doc
      .fontSize(FONT_SIZES.SUBSECTION)
      .fillColor(COLORS.GRAY[900])
      .font('Helvetica-Bold')
      .text(periodoTexto, PDF_CONFIG.MARGIN + 15, startY + 23);

    doc.y = startY + 55;
  }

  private addItemsTable(doc: PDFKit.PDFDocument, data: FacturaData): void {
    this.addSectionTitle(doc, 'DETALLE DE COMISIONES');

    const colWidths = [50, 210, 70, 75, 85];
    const colX = [
      PDF_CONFIG.MARGIN,
      PDF_CONFIG.MARGIN + 50,
      PDF_CONFIG.MARGIN + 260,
      PDF_CONFIG.MARGIN + 330,
      PDF_CONFIG.MARGIN + 405,
    ];

    this.ensureSpace(doc, 50, false);

    // Header de tabla
    const headerY = doc.y;
    doc
      .roundedRect(PDF_CONFIG.MARGIN, headerY, PDF_CONFIG.CONTENT_WIDTH, 28, 3)
      .fill(COLORS.PRIMARY);

    doc.fontSize(FONT_SIZES.SMALL).fillColor('#ffffff').font('Helvetica-Bold');

    const headers = ['Cant.', 'Concepto', 'Valor Unit.', 'Subtotal', 'Notas'];
    headers.forEach((header, i) => {
      const align = i === 0 ? 'center' : (i >= 2 && i <= 3 ? 'right' : 'left');
      doc.text(header, colX[i] + 5, headerY + 9, { width: colWidths[i] - 10, align });
    });

    doc.y = headerY + 33;

    // Filas de items
    data.factura.items.forEach((item, index) => {
      this.ensureSpace(doc, 30);

      const rowY = doc.y;
      const rowHeight = 28;

      // Alternar color de fondo
      if (index % 2 === 0) {
        doc
          .rect(PDF_CONFIG.MARGIN, rowY, PDF_CONFIG.CONTENT_WIDTH, rowHeight)
          .fill(COLORS.GRAY[50]);
      }

      doc.fontSize(FONT_SIZES.SMALL).fillColor(COLORS.GRAY[900]).font('Helvetica');

      // Cantidad
      doc.text(item.cantidad.toString(), colX[0] + 5, rowY + 8, {
        width: colWidths[0] - 10,
        align: 'center',
      });

      // Concepto
      doc.font('Helvetica-Bold');
      doc.text(item.concepto, colX[1] + 5, rowY + 8, {
        width: colWidths[1] - 10,
        ellipsis: true,
      });

      // Valor Unitario
      doc.font('Helvetica');
      doc.text(this.formatCurrency(item.valorUnitario, data.factura.moneda), colX[2] + 5, rowY + 8, {
        width: colWidths[2] - 10,
        align: 'right',
      });

      // Subtotal
      doc.font('Helvetica-Bold');
      doc.text(this.formatCurrency(item.subtotal, data.factura.moneda), colX[3] + 5, rowY + 8, {
        width: colWidths[3] - 10,
        align: 'right',
      });

      // Notas
      if (item.notas) {
        doc.fontSize(FONT_SIZES.TINY).font('Helvetica').fillColor(COLORS.GRAY[600]);
        doc.text(item.notas, colX[4] + 5, rowY + 8, {
          width: colWidths[4] - 10,
          ellipsis: true,
        });
      }

      doc.y = rowY + rowHeight;
    });

    doc.y += 10;
  }

  private addTotales(doc: PDFKit.PDFDocument, data: FacturaData): void {
    this.ensureSpace(doc, 120, false);

    const startY = doc.y;
    const boxWidth = 250;
    const boxX = PDF_CONFIG.PAGE_WIDTH - PDF_CONFIG.MARGIN - boxWidth;
    const boxHeight = 110;

    // Caja de totales
    doc
      .roundedRect(boxX, startY, boxWidth, boxHeight, 8)
      .fillAndStroke(COLORS.GRAY[50], COLORS.GRAY[300]);

    let y = startY + 12;
    const labelX = boxX + 15;
    const valueX = boxX + boxWidth - 15;

    // Subtotal
    this.addTotalLine(doc, 'Subtotal:', this.formatCurrency(data.factura.subtotal, data.factura.moneda), 
      labelX, valueX, y, FONT_SIZES.BODY, COLORS.GRAY[700]);
    y += 20;

    // Descuento (si existe)
    if (data.factura.descuento > 0) {
      this.addTotalLine(doc, 'Descuento:', `-${this.formatCurrency(data.factura.descuento, data.factura.moneda)}`, 
        labelX, valueX, y, FONT_SIZES.BODY, COLORS.DANGER);
      y += 20;
    }

    // Línea separadora
    doc
      .strokeColor(COLORS.GRAY[300])
      .lineWidth(1)
      .moveTo(boxX + 15, y - 5)
      .lineTo(boxX + boxWidth - 15, y - 5)
      .stroke();

    // Total
    this.addTotalLine(doc, 'TOTAL:', this.formatCurrency(data.factura.total, data.factura.moneda), 
      labelX, valueX, y, FONT_SIZES.SUBTITLE, COLORS.PRIMARY);
    y += 25;

    // Pagado
    if (data.factura.montoPagado > 0) {
      this.addTotalLine(doc, 'Pagado:', this.formatCurrency(data.factura.montoPagado, data.factura.moneda), 
        labelX, valueX, y, FONT_SIZES.BODY, COLORS.SUCCESS);
      y += 20;

      // Saldo Pendiente
      const saldoColor = data.factura.saldoPendiente > 0 ? COLORS.WARNING : COLORS.SUCCESS;
      this.addTotalLine(doc, 'Saldo Pendiente:', this.formatCurrency(data.factura.saldoPendiente, data.factura.moneda), 
        labelX, valueX, y, FONT_SIZES.SUBSECTION, saldoColor);
    }

    doc.y = startY + boxHeight + 20;
  }

  private addPagosInfo(doc: PDFKit.PDFDocument, data: FacturaData): void {
    this.addSectionTitle(doc, 'HISTORIAL DE PAGOS');

    const colWidths = [80, 70, 90, 90, 80, 75];
    const colX = [
      PDF_CONFIG.MARGIN,
      PDF_CONFIG.MARGIN + 80,
      PDF_CONFIG.MARGIN + 150,
      PDF_CONFIG.MARGIN + 240,
      PDF_CONFIG.MARGIN + 330,
      PDF_CONFIG.MARGIN + 410,
    ];

    this.ensureSpace(doc, 50, false);

    // Header de tabla
    const headerY = doc.y;
    doc
      .roundedRect(PDF_CONFIG.MARGIN, headerY, PDF_CONFIG.CONTENT_WIDTH, 25, 3)
      .fill(COLORS.SUCCESS);

    doc.fontSize(FONT_SIZES.SMALL).fillColor('#ffffff').font('Helvetica-Bold');

    const headers = ['N° Recibo', 'Fecha', 'Monto', 'Método', 'Referencia', 'Estado'];
    headers.forEach((header, i) => {
      doc.text(header, colX[i] + 3, headerY + 7, { width: colWidths[i] - 6, align: 'center' });
    });

    doc.y = headerY + 30;

    // Filas de pagos
    data.pagos.forEach((pago, index) => {
      this.ensureSpace(doc, 22);

      const rowY = doc.y;

      // Alternar color de fondo
      if (index % 2 === 0) {
        doc
          .rect(PDF_CONFIG.MARGIN, rowY, PDF_CONFIG.CONTENT_WIDTH, 22)
          .fill(COLORS.GRAY[50]);
      }

      doc.fontSize(FONT_SIZES.TINY).fillColor(COLORS.GRAY[900]).font('Helvetica');

      doc.text(pago.numeroRecibo, colX[0] + 3, rowY + 5, { width: colWidths[0] - 6, align: 'left' });
      doc.text(this.formatDate(pago.fechaPago), colX[1] + 3, rowY + 5, { width: colWidths[1] - 6, align: 'center' });
      
      doc.fillColor(COLORS.SUCCESS).font('Helvetica-Bold');
      doc.text(this.formatCurrency(pago.monto, pago.moneda), colX[2] + 3, rowY + 5, { width: colWidths[2] - 6, align: 'right' });
      
      doc.fillColor(COLORS.GRAY[900]).font('Helvetica');
      doc.text(pago.metodoPago, colX[3] + 3, rowY + 5, { width: colWidths[3] - 6, align: 'center' });
      doc.text(pago.referencia || 'N/A', colX[4] + 3, rowY + 5, { width: colWidths[4] - 6, align: 'center', ellipsis: true });
      
      doc.fillColor(COLORS.SUCCESS).font('Helvetica-Bold');
      doc.text('APLICADO', colX[5] + 3, rowY + 5, { width: colWidths[5] - 6, align: 'center' });

      doc.y = rowY + 22;
    });

    doc.y += 10;
  }

  private addNotas(doc: PDFKit.PDFDocument, data: FacturaData): void {
    this.ensureSpace(doc, 60, false);

    const startY = doc.y;
    const notasHeight = 60; // Altura estimada para la caja de notas

    doc
      .roundedRect(PDF_CONFIG.MARGIN, startY, PDF_CONFIG.CONTENT_WIDTH, notasHeight, 5)
      .fillAndStroke('#fef3c7', '#f59e0b');

    doc
      .fontSize(FONT_SIZES.SMALL)
      .fillColor(COLORS.GRAY[700])
      .font('Helvetica-Bold')
      .text('NOTAS ADICIONALES', PDF_CONFIG.MARGIN + 15, startY + 10);

    doc
      .fontSize(FONT_SIZES.SMALL)
      .fillColor(COLORS.GRAY[800])
      .font('Helvetica')
      .text(data.factura.notas!, PDF_CONFIG.MARGIN + 15, startY + 28, {
        width: PDF_CONFIG.CONTENT_WIDTH - 30,
        align: 'left',
      });

    doc.y = startY + notasHeight + 20;
  }

  private addTerminosCondiciones(doc: PDFKit.PDFDocument): void {
    this.ensureSpace(doc, 80, false);

    const startY = doc.y;

    doc
      .fontSize(FONT_SIZES.SMALL)
      .fillColor(COLORS.GRAY[600])
      .font('Helvetica-Bold')
      .text('TÉRMINOS Y CONDICIONES', PDF_CONFIG.MARGIN, startY);

    doc
      .fontSize(FONT_SIZES.TINY)
      .fillColor(COLORS.GRAY[500])
      .font('Helvetica')
      .text(
        'Esta factura refleja las comisiones generadas según el contrato vigente. ' +
        'El pago debe realizarse antes de la fecha de vencimiento indicada. ' +
        'Pagos vencidos pueden generar recargos según términos contractuales.',
        PDF_CONFIG.MARGIN,
        startY + 15,
        {
          width: PDF_CONFIG.CONTENT_WIDTH,
          align: 'justify',
        }
      );

    doc.y = startY + 65;
  }

  // ========== FOOTER ==========

  private drawFooters(doc: PDFKit.PDFDocument, data: FacturaData): void {
    const range = (doc as any).bufferedPageRange();
    const totalPages = range.start + range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      this.drawFooterForPage(doc, data, i + 1, totalPages);
    }
  }

  private drawFooterForPage(
    doc: PDFKit.PDFDocument,
    data: FacturaData,
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

    let y = bottomY + 10;

    const generatedAt = this.currentGeneratedAt ?? new Date();

    // Helper para líneas centradas
    const drawCenteredLine = (
      text: string,
      fontSize: number,
      bold: boolean,
      color: string,
      extraGap = 1,
    ) => {
      doc
        .fontSize(fontSize)
        .fillColor(color)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(text, PDF_CONFIG.MARGIN, y, {
          width: PDF_CONFIG.CONTENT_WIDTH,
          align: 'center',
        });
      y += fontSize + extraGap;
    };

    // Línea superior: Factura número
    drawCenteredLine(
      `Factura ${data.factura.numeroFactura} · ${data.modelo.nombreCompleto}`,
      FONT_SIZES.TINY,
      true,
      COLORS.GRAY[600],
      1,
    );

    // Texto legal
    drawCenteredLine(
      'Este documento ha sido generado digitalmente y tiene validez legal.',
      FONT_SIZES.TINY,
      false,
      COLORS.GRAY[400],
      1,
    );

    // Información de la empresa
    drawCenteredLine(
      'OnlyTop - Sistema de Cartera · cartera@onlytop.com',
      FONT_SIZES.MICRO,
      false,
      COLORS.GRAY[500],
      1,
    );

    // Metadata de fecha completa
    drawCenteredLine(
      `Generado el: ${this.formatDateTime(generatedAt)}`,
      FONT_SIZES.MICRO,
      false,
      COLORS.GRAY[400],
      1,
    );

    // Paginación
    drawCenteredLine(`Pág. ${pageNumber} de ${pageCount}`, FONT_SIZES.MICRO, true, COLORS.GRAY[500], 0);
  }

  // ========== UTILIDADES DE DISEÑO ==========

  private addSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    this.ensureSpace(doc, 30, false);

    doc
      .fontSize(FONT_SIZES.SECTION_TITLE)
      .fillColor(COLORS.PRIMARY)
      .font('Helvetica-Bold')
      .text(title, PDF_CONFIG.MARGIN, doc.y);

    doc.y += 18;
  }

  private get contentBottomY(): number {
    return PDF_CONFIG.PAGE_HEIGHT - PDF_CONFIG.MARGIN - 80; // reserva para footer
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number = 40, allowAddPage: boolean = true): void {
    if (doc.y + needed > this.contentBottomY && allowAddPage) {
      doc.addPage();
      doc.y = PDF_CONFIG.MARGIN;
    }
  }

  private addFieldInBox(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    valueColor: string = COLORS.GRAY[800],
  ): void {
    doc
      .fontSize(FONT_SIZES.TINY)
      .fillColor(COLORS.GRAY[600])
      .font('Helvetica')
      .text(label, x, y);

    doc
      .fontSize(FONT_SIZES.SMALL)
      .fillColor(valueColor)
      .font('Helvetica-Bold')
      .text(value, x, y + 10, { width: 200, ellipsis: true });
  }

  private addTotalLine(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    labelX: number,
    valueX: number,
    y: number,
    fontSize: number,
    color: string,
  ): void {
    doc
      .fontSize(fontSize)
      .fillColor(color)
      .font('Helvetica-Bold')
      .text(label, labelX, y);

    doc.text(value, valueX - 100, y, {
      width: 100,
      align: 'right',
    });
  }

  // ========== UTILIDADES DE FORMATO ==========

  private formatDate(date: string | Date): string {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  private formatDateTime(date: Date): string {
    if (!date) return 'N/A';
    try {
      return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  private formatCurrency(amount: number, currency: 'USD' | 'COP' = 'USD'): string {
    return this.moneyService.formatForUser(amount, currency);
  }

  private isVencida(fechaVencimiento: string | Date): boolean {
    try {
      const fecha = typeof fechaVencimiento === 'string' ? new Date(fechaVencimiento) : fechaVencimiento;
      return fecha < new Date();
    } catch {
      return false;
    }
  }

  private getNombreMes(mes: number): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1] || 'Mes inválido';
  }

  private getDiasEnMes(anio: number, mes: number): number {
    return new Date(anio, mes, 0).getDate();
  }

  // ========== NOTA SOBRE URLs ==========
  // Los métodos de generación de URLs ahora están centralizados en CarteraPdfCoreService
  // generateFacturaPdfUrl() -> pdfCoreService.generateFacturaPdfUrl()
  // generateFacturaDownloadUrl() -> pdfCoreService.generateFacturaDownloadUrl()
}
