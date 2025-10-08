import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import type * as PDFKit from 'pdfkit';
import { MoneyService } from '../money/money.service.js';

/**
 * Servicio para generar PDFs del módulo de Cartera
 * 
 * Genera documentos PDF para:
 * - Estado de cuenta por modelo
 * - Facturas individuales
 * - Reportes de pagos
 * 
 * Arquitectura inspirada en pdf-generator.service.ts:
 * - Gestión de páginas con buffering
 * - Helpers para espaciado y diseño
 * - Consistencia en estilos y colores
 * - Footer en todas las páginas
 * 
 * Integración con MoneyService:
 * - Formateo profesional de monedas según configuración BD
 * - Soporte multi-moneda (USD, COP)
 * - Consistencia con el resto del sistema
 * 
 * @author OnlyTop Development Team
 * @version 2.1.0
 * @since 2025
 */

// ========== INTERFACES ==========
interface EstadoCuentaData {
  modelo: ModeloInfoEstadoCuenta;
  facturas: FacturaEstadoCuenta[];
  pagos: PagoEstadoCuenta[];
  totales: TotalesEstadoCuenta;
  periodo: {
    desde: string | Date;
    hasta: string | Date;
  };
}

interface ModeloInfoEstadoCuenta {
  nombreCompleto: string;
  numeroIdentificacion: string;
  correoElectronico: string;
  telefono?: string;
}

interface FacturaEstadoCuenta {
  numeroFactura: string;
  fechaEmision: string | Date;
  fechaVencimiento: string | Date;
  concepto: string;
  moneda: 'USD' | 'COP'; // Moneda de la factura
  montoTotal: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO' | 'CANCELADO';
  diasVencido?: number;
}

interface PagoEstadoCuenta {
  numeroRecibo: string;
  fechaPago: string | Date;
  moneda: 'USD' | 'COP'; // Moneda del pago
  montoPagado: number;
  facturaNumero: string;
  metodoPago: string;
  referencia?: string;
  comprobanteUrl?: string;
}

interface TotalesEstadoCuenta {
  moneda: 'USD' | 'COP'; // Moneda principal del estado de cuenta
  totalFacturado: number;
  totalPagado: number;
  saldoPendiente: number;
  facturasVencidas: number;
  montoVencido: number;
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

const ESTADO_COLORS: Record<EstadoFactura, string> = {
  PENDIENTE: COLORS.WARNING,
  PARCIAL: COLORS.SECONDARY,
  PAGADO: COLORS.SUCCESS,
  VENCIDO: COLORS.DANGER,
  CANCELADO: COLORS.GRAY[500],
};

@Injectable()
export class CarteraPdfService {
  private readonly logger = new Logger(CarteraPdfService.name);
  private currentGeneratedAt?: Date;

  constructor(
    private readonly configService: ConfigService,
    private readonly moneyService: MoneyService,
  ) {}

  /**
   * Genera un PDF de estado de cuenta con formato profesional
   */
  async generateEstadoCuentaPdf(estadoCuenta: EstadoCuentaData): Promise<Buffer> {
    try {
      this.currentGeneratedAt = new Date();
      
      this.logger.log(`Generando PDF de estado de cuenta para: ${estadoCuenta.modelo.nombreCompleto}`);

      const doc = new PDFDocument({
        size: PDF_CONFIG.SIZE,
        margin: PDF_CONFIG.MARGIN,
        bufferPages: true,
        info: {
          Title: `Estado de Cuenta - ${estadoCuenta.modelo.nombreCompleto}`,
          Author: 'OnlyTop',
          Subject: 'Estado de Cuenta de Facturación',
          Creator: 'OnlyTop Sistema de Cartera',
          Producer: 'OnlyTop PDF Generator - Cartera v2.0',
          CreationDate: this.currentGeneratedAt,
        },
      });

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          this.logger.log(`✅ PDF generado exitosamente (${Buffer.concat(chunks).length} bytes)`);
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);

        // Generar contenido del PDF
        this.buildPdfContent(doc, estadoCuenta);

        // Dibujar footers en todas las páginas
        this.drawFooters(doc, estadoCuenta);

        doc.end();
      });
    } catch (error: any) {
      this.logger.error(`❌ Error generando PDF Estado de Cuenta: ${error.message}`, error.stack);
      throw new Error(`No se pudo generar el PDF del estado de cuenta: ${error.message}`);
    }
  }

  // ========== CONSTRUCCIÓN DEL CONTENIDO ==========

  private buildPdfContent(doc: PDFKit.PDFDocument, data: EstadoCuentaData): void {
    // Header con branding
    this.addHeader(doc, data);
    
    // Información del modelo
    this.addModeloInfo(doc, data);
    
    // Periodo del estado de cuenta
    this.addPeriodoInfo(doc, data);
    
    // Resumen de totales (destacado)
    this.addTotalesResumen(doc, data);
    
    // Tabla de facturas
    if (data.facturas.length > 0) {
      this.ensureSpace(doc, 100);
      this.addFacturasTable(doc, data.facturas);
    } else {
      this.ensureSpace(doc, 40);
      doc
        .fontSize(FONT_SIZES.BODY)
        .fillColor(COLORS.GRAY[500])
        .font('Helvetica')
        .text('No hay facturas en el periodo seleccionado', PDF_CONFIG.MARGIN, doc.y, {
          align: 'center',
          width: PDF_CONFIG.CONTENT_WIDTH,
        });
    }
    
    // Tabla de pagos
    if (data.pagos.length > 0) {
      this.ensureSpace(doc, 100);
      this.addPagosTable(doc, data.pagos);
    }
  }

  // ========== SECCIONES DEL PDF ==========

  private addHeader(doc: PDFKit.PDFDocument, data: EstadoCuentaData): void {
    // Fondo elegante con gradiente simulado
    doc
      .rect(0, 0, PDF_CONFIG.PAGE_WIDTH, 90)
      .fill(COLORS.PRIMARY);

    // Título principal
    doc
      .fontSize(FONT_SIZES.TITLE)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text('ESTADO DE CUENTA', PDF_CONFIG.MARGIN, 25, {
        align: 'center',
        width: PDF_CONFIG.CONTENT_WIDTH,
      });

    // Subtítulo
    doc
      .fontSize(FONT_SIZES.SUBSECTION)
      .fillColor('#ffffff')
      .font('Helvetica')
      .text('OnlyTop - Sistema de Cartera', PDF_CONFIG.MARGIN, 55, {
        align: 'center',
        width: PDF_CONFIG.CONTENT_WIDTH,
      });

    // Fecha de generación
    doc
      .fontSize(FONT_SIZES.SMALL)
      .fillColor('#ffffff')
      .text(`Generado el ${this.formatDate(this.currentGeneratedAt!)}`, PDF_CONFIG.MARGIN, 75, {
        align: 'center',
        width: PDF_CONFIG.CONTENT_WIDTH,
      });

    doc.y = 105;
  }

  private addModeloInfo(doc: PDFKit.PDFDocument, data: EstadoCuentaData): void {
    this.addSectionTitle(doc, 'Información del Modelo');
    this.ensureSpace(doc, 80, false);

    // Caja con información del modelo
    const startY = doc.y;
    const boxHeight = 70;

    doc
      .roundedRect(PDF_CONFIG.MARGIN, startY, PDF_CONFIG.CONTENT_WIDTH, boxHeight, 5)
      .fillAndStroke(COLORS.GRAY[50], COLORS.GRAY[300]);

    const infoY = startY + 12;
    const colWidth = PDF_CONFIG.CONTENT_WIDTH / 2;

    // Columna izquierda
    this.addFieldInBox(
      doc,
      'Nombre Completo',
      data.modelo.nombreCompleto,
      PDF_CONFIG.MARGIN + 15,
      infoY,
      COLORS.GRAY[900],
    );

    this.addFieldInBox(
      doc,
      'Identificación',
      data.modelo.numeroIdentificacion,
      PDF_CONFIG.MARGIN + 15,
      infoY + 28,
      COLORS.GRAY[800],
    );

    // Columna derecha
    this.addFieldInBox(
      doc,
      'Correo Electrónico',
      data.modelo.correoElectronico,
      PDF_CONFIG.MARGIN + colWidth + 15,
      infoY,
      COLORS.PRIMARY,
    );

    this.addFieldInBox(
      doc,
      'Teléfono',
      data.modelo.telefono || 'No especificado',
      PDF_CONFIG.MARGIN + colWidth + 15,
      infoY + 28,
      COLORS.GRAY[800],
    );

    doc.y = startY + boxHeight + 15;
  }

  private addPeriodoInfo(doc: PDFKit.PDFDocument, data: EstadoCuentaData): void {
    this.addSectionTitle(doc, 'Periodo del Estado de Cuenta');
    this.ensureSpace(doc, 40, false);

    const startY = doc.y;

    doc
      .roundedRect(PDF_CONFIG.MARGIN, startY, PDF_CONFIG.CONTENT_WIDTH, 35, 5)
      .fillAndStroke(COLORS.GRAY[50], COLORS.GRAY[300]);

    doc
      .fontSize(FONT_SIZES.BODY)
      .fillColor(COLORS.GRAY[900])
      .font('Helvetica-Bold')
      .text(
        `Desde: ${this.formatDate(data.periodo.desde)}`,
        PDF_CONFIG.MARGIN + 20,
        startY + 12,
        {
          continued: true,
          width: 200,
        },
      )
      .font('Helvetica')
      .text('  |  ', { continued: true })
      .font('Helvetica-Bold')
      .text(`Hasta: ${this.formatDate(data.periodo.hasta)}`);

    doc.y = startY + 50;
  }

  private addTotalesResumen(doc: PDFKit.PDFDocument, data: EstadoCuentaData): void {
    this.addSectionTitle(doc, 'Resumen Financiero');
    this.ensureSpace(doc, 120, false);

    const startY = doc.y;
    const boxHeight = 110;

    // Caja principal con sombra simulada
    doc
      .roundedRect(PDF_CONFIG.MARGIN + 2, startY + 2, PDF_CONFIG.CONTENT_WIDTH, boxHeight, 8)
      .fill(COLORS.GRAY[300]);

    doc
      .roundedRect(PDF_CONFIG.MARGIN, startY, PDF_CONFIG.CONTENT_WIDTH, boxHeight, 8)
      .fillAndStroke(COLORS.GRAY[50], COLORS.GRAY[300]);

    // Organizar datos en grid 2x2 (sin emojis para evitar problemas de renderizado)
    const moneda = data.totales.moneda;
    const items = [
      {
        label: 'Total Facturado',
        value: this.formatCurrency(data.totales.totalFacturado, moneda),
        color: COLORS.GRAY[900],
      },
      {
        label: 'Total Pagado',
        value: this.formatCurrency(data.totales.totalPagado, moneda),
        color: COLORS.SUCCESS,
      },
      {
        label: 'Saldo Pendiente',
        value: this.formatCurrency(data.totales.saldoPendiente, moneda),
        color: data.totales.saldoPendiente > 0 ? COLORS.WARNING : COLORS.SUCCESS,
      },
      {
        label: 'Facturas Vencidas',
        value: `${data.totales.facturasVencidas} facturas`,
        color: data.totales.facturasVencidas > 0 ? COLORS.DANGER : COLORS.SUCCESS,
      },
    ];

    const colWidth = PDF_CONFIG.CONTENT_WIDTH / 2;
    const rowHeight = 50;

    items.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = PDF_CONFIG.MARGIN + col * colWidth + 20;
      const y = startY + row * rowHeight + 15;

      // Label
      doc
        .fontSize(FONT_SIZES.SMALL)
        .fillColor(COLORS.GRAY[600])
        .font('Helvetica')
        .text(item.label, x, y);

      // Valor destacado
      doc
        .fontSize(FONT_SIZES.SECTION_TITLE)
        .fillColor(item.color)
        .font('Helvetica-Bold')
        .text(item.value, x, y + 14, {
          width: colWidth - 40,
        });
    });

    doc.y = startY + boxHeight + 20;
  }

  private addFacturasTable(doc: PDFKit.PDFDocument, facturas: FacturaEstadoCuenta[]): void {
    this.addSectionTitle(doc, 'Detalle de Facturas');

    // Configuración de columnas
    const colWidths = [75, 65, 65, 75, 70, 70, 65];
    const colX = [
      PDF_CONFIG.MARGIN,
      PDF_CONFIG.MARGIN + 75,
      PDF_CONFIG.MARGIN + 140,
      PDF_CONFIG.MARGIN + 205,
      PDF_CONFIG.MARGIN + 280,
      PDF_CONFIG.MARGIN + 350,
      PDF_CONFIG.MARGIN + 420,
    ];

    this.ensureSpace(doc, 50, false);

    // Header de tabla
    const headerY = doc.y;
    doc
      .roundedRect(PDF_CONFIG.MARGIN, headerY, PDF_CONFIG.CONTENT_WIDTH, 25, 3)
      .fill(COLORS.PRIMARY);

    doc.fontSize(FONT_SIZES.SMALL).fillColor('#ffffff').font('Helvetica-Bold');

    const headers = ['N° Factura', 'F. Emisión', 'F. Vencim.', 'Monto Total', 'Pagado', 'Saldo', 'Estado'];
    headers.forEach((header, i) => {
      doc.text(header, colX[i] + 3, headerY + 7, { width: colWidths[i] - 6, align: 'center' });
    });

    doc.y = headerY + 30;

    // Filas de datos
    facturas.forEach((factura, index) => {
      this.ensureSpace(doc, 22);

      const rowY = doc.y;

      // Alternar color de fondo
      if (index % 2 === 0) {
        doc
          .rect(PDF_CONFIG.MARGIN, rowY, PDF_CONFIG.CONTENT_WIDTH, 20)
          .fill(COLORS.GRAY[50]);
      }

      doc.fontSize(FONT_SIZES.TINY).fillColor(COLORS.GRAY[900]).font('Helvetica');

      doc.text(factura.numeroFactura, colX[0] + 3, rowY + 5, {
        width: colWidths[0] - 6,
        align: 'left',
      });
      doc.text(this.formatDate(factura.fechaEmision), colX[1] + 3, rowY + 5, {
        width: colWidths[1] - 6,
        align: 'center',
      });
      doc.text(this.formatDate(factura.fechaVencimiento), colX[2] + 3, rowY + 5, {
        width: colWidths[2] - 6,
        align: 'center',
      });
      doc.text(this.formatCurrency(factura.montoTotal, factura.moneda), colX[3] + 3, rowY + 5, {
        width: colWidths[3] - 6,
        align: 'right',
      });
      doc.text(this.formatCurrency(factura.montoPagado, factura.moneda), colX[4] + 3, rowY + 5, {
        width: colWidths[4] - 6,
        align: 'right',
      });

      // Saldo con color condicional
      const saldoColor = factura.saldoPendiente > 0 ? COLORS.WARNING : COLORS.SUCCESS;
      doc.fillColor(saldoColor);
      doc.text(this.formatCurrency(factura.saldoPendiente, factura.moneda), colX[5] + 3, rowY + 5, {
        width: colWidths[5] - 6,
        align: 'right',
      });

      // Estado con color
      const estadoColor = ESTADO_COLORS[factura.estado] || COLORS.GRAY[800];
      doc.fillColor(estadoColor).font('Helvetica-Bold');
      doc.text(factura.estado, colX[6] + 3, rowY + 5, {
        width: colWidths[6] - 6,
        align: 'center',
      });

      doc.y = rowY + 22;
    });

    doc.y += 10;
  }

  private addPagosTable(doc: PDFKit.PDFDocument, pagos: PagoEstadoCuenta[]): void {
    this.addSectionTitle(doc, 'Historial de Pagos');

    // Configuración de columnas
    const colWidths = [70, 65, 75, 75, 85, 115];
    const colX = [
      PDF_CONFIG.MARGIN,
      PDF_CONFIG.MARGIN + 70,
      PDF_CONFIG.MARGIN + 135,
      PDF_CONFIG.MARGIN + 210,
      PDF_CONFIG.MARGIN + 285,
      PDF_CONFIG.MARGIN + 370,
    ];

    this.ensureSpace(doc, 50, false);

    // Header de tabla
    const headerY = doc.y;
    doc
      .roundedRect(PDF_CONFIG.MARGIN, headerY, PDF_CONFIG.CONTENT_WIDTH, 25, 3)
      .fill(COLORS.SUCCESS);

    doc.fontSize(FONT_SIZES.SMALL).fillColor('#ffffff').font('Helvetica-Bold');

    const headers = ['N° Recibo', 'Fecha', 'Monto', 'N° Factura', 'Método', 'Referencia'];
    headers.forEach((header, i) => {
      doc.text(header, colX[i] + 3, headerY + 7, { width: colWidths[i] - 6, align: 'center' });
    });

    doc.y = headerY + 30;

    // Filas de datos
    pagos.forEach((pago, index) => {
      this.ensureSpace(doc, 22);

      const rowY = doc.y;

      // Alternar color de fondo
      if (index % 2 === 0) {
        doc
          .rect(PDF_CONFIG.MARGIN, rowY, PDF_CONFIG.CONTENT_WIDTH, 20)
          .fill(COLORS.GRAY[50]);
      }

      doc.fontSize(FONT_SIZES.TINY).fillColor(COLORS.GRAY[900]).font('Helvetica');

      doc.text(pago.numeroRecibo, colX[0] + 3, rowY + 5, {
        width: colWidths[0] - 6,
        align: 'left',
      });
      doc.text(this.formatDate(pago.fechaPago), colX[1] + 3, rowY + 5, {
        width: colWidths[1] - 6,
        align: 'center',
      });
      doc.fillColor(COLORS.SUCCESS).font('Helvetica-Bold');
      doc.text(this.formatCurrency(pago.montoPagado, pago.moneda), colX[2] + 3, rowY + 5, {
        width: colWidths[2] - 6,
        align: 'right',
      });
      doc.fillColor(COLORS.GRAY[900]).font('Helvetica');
      doc.text(pago.facturaNumero, colX[3] + 3, rowY + 5, {
        width: colWidths[3] - 6,
        align: 'center',
      });
      doc.text(pago.metodoPago, colX[4] + 3, rowY + 5, {
        width: colWidths[4] - 6,
        align: 'center',
      });
      doc.text(pago.referencia || 'N/A', colX[5] + 3, rowY + 5, {
        width: colWidths[5] - 6,
        align: 'center',
      });

      doc.y = rowY + 22;
    });

    doc.y += 10;
  }

  // ========== FOOTER ==========

  private drawFooters(doc: PDFKit.PDFDocument, data: EstadoCuentaData): void {
    const range = (doc as any).bufferedPageRange();
    const totalPages = range.start + range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      this.drawFooterForPage(doc, data, i + 1, totalPages);
    }
  }

  private drawFooterForPage(
    doc: PDFKit.PDFDocument,
    data: EstadoCuentaData,
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

    // Helper para líneas centradas
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
    drawCenteredLine(
      `${hora} · Estado de Cuenta - ${data.modelo.nombreCompleto}`,
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
      'OnlyTop - Sistema de Cartera',
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
      .text(value, x, y + 10, { width: 220, ellipsis: true });
  }

  // ========== UTILIDADES DE FORMATO ==========

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

  private formatDateTime(date: Date): string {
    if (!date) return 'N/A';
    try {
      return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  private formatTime(date: Date): string {
    if (!date) return 'N/A';
    try {
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Hora inválida';
    }
  }

  /**
   * Formatea un valor monetario usando MoneyService
   * Usa la configuración dinámica de la BD para formato apropiado
   * 
   * @param amount Valor numérico a formatear
   * @param currency Código de moneda (USD, COP)
   * @returns String formateado según configuración de la moneda
   */
  private formatCurrency(amount: number, currency: 'USD' | 'COP' = 'USD'): string {
    return this.moneyService.formatForUser(amount, currency);
  }

  // ========== NOTA SOBRE URLs ==========
  // Los métodos de generación de URLs ahora están centralizados en CarteraPdfCoreService
  // generateEstadoCuentaPdfUrl() -> pdfCoreService.generateEstadoCuentaPdfUrl()
  // generateEstadoCuentaDownloadUrl() -> pdfCoreService.generateEstadoCuentaDownloadUrl()
}
