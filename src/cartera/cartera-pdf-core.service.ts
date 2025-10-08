import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { FacturaEntity, FacturaDocument } from './factura.schema.js';
import { PagoEntity, PagoDocument } from './pago.schema.js';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { ContratoModeloEntity, ContratoModeloDocument } from '../rrhh/contrato-modelo.schema.js';
import { CarteraPdfService } from './cartera-pdf.service.js';
import { CarteraFacturaPdfService } from './cartera-factura-pdf.service.js';
import { MoneyService } from '../money/money.service.js';

/**
 * Servicio Core para la gestión centralizada de PDFs del módulo de Cartera
 * 
 * Responsabilidades:
 * - Obtener y preparar datos de BD para PDFs
 * - Coordinar generación de PDFs (estado de cuenta, facturas)
 * - Generar URLs públicas y de descarga
 * - Validar permisos y existencia de datos
 * 
 * Arquitectura inspirada en pdf.service.ts:
 * - Separación clara entre obtención de datos y generación visual
 * - Centralización de lógica de URLs
 * - Validaciones robustas antes de generar PDFs
 * 
 * @author OnlyTop Development Team
 * @version 1.0.0
 * @since 2025
 */
@Injectable()
export class CarteraPdfCoreService {
  private readonly logger = new Logger(CarteraPdfCoreService.name);

  constructor(
    @InjectModel(FacturaEntity.name) private readonly facturaModel: Model<FacturaDocument>,
    @InjectModel(PagoEntity.name) private readonly pagoModel: Model<PagoDocument>,
    @InjectModel(ModeloEntity.name) private readonly modeloModel: Model<ModeloDocument>,
    @InjectModel(ContratoModeloEntity.name) private readonly contratoModel: Model<ContratoModeloDocument>,
    private readonly configService: ConfigService,
    private readonly carteraPdfService: CarteraPdfService,
    private readonly facturaePdfService: CarteraFacturaPdfService,
    private readonly moneyService: MoneyService,
  ) {}

  // ========== GENERACIÓN DE PDFS ==========

  /**
   * Genera el PDF de una factura individual
   * @param facturaId ID de la factura
   * @returns Buffer del PDF generado
   */
  async generateFacturaPdf(facturaId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(facturaId)) {
      throw new BadRequestException('ID de factura inválido');
    }

    this.logger.log(`Generando PDF de factura: ${facturaId}`);

    // Obtener datos completos
    const facturaData = await this.obtenerFacturaParaPdf(facturaId);

    // Generar PDF
    const pdfBuffer = await this.facturaePdfService.generateFacturaPdf(facturaData);

    return pdfBuffer;
  }

  /**
   * Genera el PDF de estado de cuenta de un modelo
   * @param modeloId ID del modelo
   * @param desde Fecha inicio (opcional)
   * @param hasta Fecha fin (opcional)
   * @returns Buffer del PDF generado
   */
  async generateEstadoCuentaPdf(
    modeloId: string,
    desde?: Date,
    hasta?: Date,
  ): Promise<Buffer> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('ID de modelo inválido');
    }

    this.logger.log(`Generando PDF de estado de cuenta para modelo: ${modeloId}`);

    // Obtener datos completos
    const estadoCuentaData = await this.obtenerEstadoCuentaParaPdf(modeloId, desde, hasta);

    // Generar PDF
    const pdfBuffer = await this.carteraPdfService.generateEstadoCuentaPdf(estadoCuentaData);

    return pdfBuffer;
  }

  /**
   * Genera PDF de factura con nombre de archivo sugerido
   * @param facturaId ID de la factura
   * @returns Buffer del PDF y nombre de archivo
   */
  async generateFacturaPdfWithFilename(
    facturaId: string,
  ): Promise<{ pdfBuffer: Buffer; filename: string }> {
    const factura = await this.facturaModel.findById(facturaId).exec();

    if (!factura) {
      throw new NotFoundException('Factura no encontrada');
    }

    const pdfBuffer = await this.generateFacturaPdf(facturaId);
    const filename = `Factura_${factura.numeroFactura}.pdf`;

    return { pdfBuffer, filename };
  }

  /**
   * Genera PDF de estado de cuenta con nombre de archivo sugerido
   * @param modeloId ID del modelo
   * @returns Buffer del PDF y nombre de archivo
   */
  async generateEstadoCuentaPdfWithFilename(
    modeloId: string,
  ): Promise<{ pdfBuffer: Buffer; filename: string }> {
    const modelo = await this.modeloModel.findById(modeloId).exec();

    if (!modelo) {
      throw new NotFoundException('Modelo no encontrado');
    }

    const pdfBuffer = await this.generateEstadoCuentaPdf(modeloId);
    const fecha = new Date().toISOString().split('T')[0];
    const filename = `EstadoCuenta_${modelo.nombreCompleto.replace(/\s+/g, '_')}_${fecha}.pdf`;

    return { pdfBuffer, filename };
  }

  // ========== OBTENCIÓN DE DATOS ==========

  /**
   * Obtiene y prepara los datos de una factura para generar PDF
   */
  async obtenerFacturaParaPdf(facturaId: string): Promise<any> {
    if (!Types.ObjectId.isValid(facturaId)) {
      throw new BadRequestException('ID de factura inválido');
    }

    // Obtener factura con relaciones
    const factura = await this.facturaModel
      .findById(facturaId)
      .populate('modeloId')
      .populate('contratoId')
      .populate('pagos')
      .exec();

    if (!factura) {
      throw new NotFoundException('Factura no encontrada');
    }

    // Extraer datos del modelo
    const modelo = factura.modeloId as any;
    const contrato = factura.contratoId as any;

    // Preparar información de items
    const items = factura.items.map((item) => ({
      concepto: item.concepto,
      cantidad: item.cantidad,
      valorUnitario: this.moneyService.fromDatabase(item.valorUnitario),
      subtotal: this.moneyService.fromDatabase(item.subtotal),
      notas: item.notas,
    }));

    // Preparar información de pagos
    const pagos = await this.pagoModel
      .find({ _id: { $in: factura.pagos } })
      .sort({ fechaPago: -1 })
      .exec();

    const pagosData = pagos.map((pago) => ({
      numeroRecibo: pago.numeroRecibo,
      fechaPago: pago.fechaPago,
      monto: this.moneyService.fromDatabase(pago.monto),
      moneda: pago.moneda,
      metodoPago: pago.metodoPago,
      referencia: pago.referencia || null,
      comprobante: (pago as any).comprobante || null,
    }));

    // Preparar datos para el PDF
    const facturaData = {
      factura: {
        numeroFactura: factura.numeroFactura,
        fechaEmision: factura.fechaEmision,
        fechaVencimiento: factura.fechaVencimiento,
        estado: factura.estado,
        moneda: factura.moneda,
        items: items,
        subtotal: this.moneyService.fromDatabase(factura.subtotal),
        descuento: this.moneyService.fromDatabase(factura.descuento),
        total: this.moneyService.fromDatabase(factura.total),
        saldoPendiente: this.moneyService.fromDatabase(factura.saldoPendiente),
        montoPagado: this.moneyService.fromDatabase(factura.total - factura.saldoPendiente),
        notas: factura.notas,
        periodo: {
          anio: factura.periodo.anio,
          mes: factura.periodo.mes,
          quincena: factura.periodo.quincena,
        },
      },
      modelo: {
        nombreCompleto: modelo?.nombreCompleto || 'N/A',
        numeroIdentificacion: modelo?.numeroIdentificacion || 'N/A',
        correoElectronico: modelo?.correoElectronico || 'N/A',
        telefono: modelo?.telefono || null,
      },
      contrato: {
        numeroContrato: contrato?.numeroContrato || 'N/A',
        fechaInicio: contrato?.fechaInicio || new Date(),
        periodicidadPago: contrato?.periodicidadPago || 'MENSUAL',
        tipoComision: contrato?.tipoComision || 'FIJO',
      },
      pagos: pagosData,
    };

    return facturaData;
  }

  /**
   * Obtiene y prepara los datos del estado de cuenta de un modelo para PDF
   */
  async obtenerEstadoCuentaParaPdf(
    modeloId: string,
    desde?: Date,
    hasta?: Date,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('ID de modelo inválido');
    }

    // Obtener información del modelo
    const modelo = await this.modeloModel.findById(modeloId).exec();

    if (!modelo) {
      throw new NotFoundException('Modelo no encontrado');
    }

    // Definir rango de fechas
    const fechaDesde = desde || new Date(new Date().getFullYear(), 0, 1); // Inicio del año por defecto
    const fechaHasta = hasta || new Date(); // Hoy por defecto

    // Obtener facturas del periodo
    const facturas = await this.facturaModel
      .find({
        modeloId: new Types.ObjectId(modeloId),
        fechaEmision: { $gte: fechaDesde, $lte: fechaHasta },
      })
      .sort({ fechaEmision: -1 })
      .exec();

    // Obtener pagos del periodo
    const pagos = await this.pagoModel
      .find({
        modeloId: new Types.ObjectId(modeloId),
        fechaPago: { $gte: fechaDesde, $lte: fechaHasta },
      })
      .populate('facturaId', 'numeroFactura')
      .sort({ fechaPago: -1 })
      .exec();

    // Preparar datos de facturas
    const facturasData = facturas.map((factura) => {
      const total = this.moneyService.fromDatabase(factura.total);
      const saldoPendiente = this.moneyService.fromDatabase(factura.saldoPendiente);
      const montoPagado = total - saldoPendiente;

      // Calcular días de vencimiento
      let diasVencido = 0;
      if (factura.estado === 'VENCIDO') {
        const hoy = new Date();
        const vencimiento = new Date(factura.fechaVencimiento);
        diasVencido = Math.floor((hoy.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        numeroFactura: factura.numeroFactura,
        fechaEmision: factura.fechaEmision,
        fechaVencimiento: factura.fechaVencimiento,
        concepto: factura.items.map((i) => i.concepto).join(', '),
        moneda: factura.moneda,
        montoTotal: total,
        montoPagado: montoPagado,
        saldoPendiente: saldoPendiente,
        estado: factura.estado,
        diasVencido: diasVencido > 0 ? diasVencido : undefined,
      };
    });

    // Preparar datos de pagos
    const pagosData = pagos.map((pago) => {
      const factura = pago.facturaId as any;
      return {
        numeroRecibo: pago.numeroRecibo,
        fechaPago: pago.fechaPago,
        moneda: pago.moneda,
        montoPagado: this.moneyService.fromDatabase(pago.monto),
        facturaNumero: factura?.numeroFactura || 'N/A',
        metodoPago: pago.metodoPago,
        referencia: pago.referencia || null,
        comprobanteUrl: (pago as any).comprobante || null,
      };
    });

    // Calcular totales (asumiendo una moneda principal, normalmente USD)
    const monedaPrincipal = facturas.length > 0 ? facturas[0].moneda : 'USD';
    
    const totalFacturado = facturas
      .filter((f) => f.moneda === monedaPrincipal)
      .reduce((sum, f) => sum + this.moneyService.fromDatabase(f.total), 0);

    const totalPagado = pagos
      .filter((p) => p.moneda === monedaPrincipal)
      .reduce((sum, p) => sum + this.moneyService.fromDatabase(p.monto), 0);

    const saldoPendiente = facturas
      .filter((f) => f.moneda === monedaPrincipal)
      .reduce((sum, f) => sum + this.moneyService.fromDatabase(f.saldoPendiente), 0);

    const facturasVencidas = facturas.filter((f) => f.estado === 'VENCIDO').length;

    const montoVencido = facturas
      .filter((f) => f.estado === 'VENCIDO' && f.moneda === monedaPrincipal)
      .reduce((sum, f) => sum + this.moneyService.fromDatabase(f.saldoPendiente), 0);

    // Preparar datos completos
    const estadoCuentaData = {
      modelo: {
        nombreCompleto: modelo.nombreCompleto,
        numeroIdentificacion: modelo.numeroIdentificacion,
        correoElectronico: modelo.correoElectronico,
        telefono: modelo.telefono || null,
      },
      facturas: facturasData,
      pagos: pagosData,
      totales: {
        moneda: monedaPrincipal,
        totalFacturado,
        totalPagado,
        saldoPendiente,
        facturasVencidas,
        montoVencido,
      },
      periodo: {
        desde: fechaDesde,
        hasta: fechaHasta,
      },
    };

    return estadoCuentaData;
  }

  // ========== INFORMACIÓN Y METADATOS ==========

  /**
   * Obtiene información básica de una factura para preview
   */
  async getFacturaInfo(facturaId: string): Promise<any> {
    if (!Types.ObjectId.isValid(facturaId)) {
      throw new BadRequestException('ID de factura inválido');
    }

    const factura = await this.facturaModel
      .findById(facturaId)
      .populate('modeloId', 'nombreCompleto numeroIdentificacion correoElectronico')
      .exec();

    if (!factura) {
      throw new NotFoundException('Factura no encontrada');
    }

    const modelo = factura.modeloId as any;

    return {
      facturaId: factura._id,
      numeroFactura: factura.numeroFactura,
      estado: factura.estado,
      fechaEmision: factura.fechaEmision,
      fechaVencimiento: factura.fechaVencimiento,
      moneda: factura.moneda,
      total: this.moneyService.fromDatabase(factura.total),
      saldoPendiente: this.moneyService.fromDatabase(factura.saldoPendiente),
      modelo: {
        nombreCompleto: modelo?.nombreCompleto || 'N/A',
        numeroIdentificacion: modelo?.numeroIdentificacion || 'N/A',
        correoElectronico: modelo?.correoElectronico || 'N/A',
      },
      pdfUrl: this.generateFacturaPdfUrl(factura._id.toString(), `${factura.numeroFactura}.pdf`),
      downloadUrl: this.generateFacturaDownloadUrl(factura._id.toString()),
    };
  }

  /**
   * Obtiene información básica del estado de cuenta de un modelo
   */
  async getEstadoCuentaInfo(modeloId: string): Promise<any> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('ID de modelo inválido');
    }

    const modelo = await this.modeloModel.findById(modeloId).exec();

    if (!modelo) {
      throw new NotFoundException('Modelo no encontrado');
    }

    // Obtener resumen rápido
    const facturasCount = await this.facturaModel
      .countDocuments({ modeloId: new Types.ObjectId(modeloId) })
      .exec();

    const pagosCount = await this.pagoModel
      .countDocuments({ modeloId: new Types.ObjectId(modeloId) })
      .exec();

    return {
      modeloId: modelo._id,
      nombreCompleto: modelo.nombreCompleto,
      correoElectronico: modelo.correoElectronico,
      facturasCount,
      pagosCount,
      pdfUrl: this.generateEstadoCuentaPdfUrl(modelo._id.toString(), `ESTADO-CUENTA-${modelo.nombreCompleto.replace(/\s+/g, '-')}.pdf`),
      downloadUrl: this.generateEstadoCuentaDownloadUrl(modelo._id.toString()),
    };
  }

  // ========== GENERACIÓN DE URLS ==========

  /**
   * Genera la URL para ver el PDF de una factura (inline) - PÚBLICO
   * Similar a /api/pdf/contratos-modelo/:id/A4/:filename.pdf
   */
  generateFacturaPdfUrl(facturaId: string, filename: string = 'factura.pdf'): string {
    const baseUrl = this.getApiBaseUrl();
    return `${baseUrl}/api/cartera-pdf/facturas/${facturaId}/A4/${filename}`;
  }

  /**
   * Genera la URL para descargar el PDF de una factura - PÚBLICO
   */
  generateFacturaDownloadUrl(facturaId: string): string {
    const baseUrl = this.getApiBaseUrl();
    return `${baseUrl}/api/cartera-pdf/facturas/${facturaId}/download`;
  }

  /**
   * Genera la URL para ver el PDF de estado de cuenta (inline) - PÚBLICO
   */
  generateEstadoCuentaPdfUrl(modeloId: string, filename: string = 'estado-cuenta.pdf'): string {
    const baseUrl = this.getApiBaseUrl();
    return `${baseUrl}/api/cartera-pdf/estado-cuenta/${modeloId}/A4/${filename}`;
  }

  /**
   * Genera la URL para descargar el PDF de estado de cuenta - PÚBLICO
   */
  generateEstadoCuentaDownloadUrl(modeloId: string): string {
    const baseUrl = this.getApiBaseUrl();
    return `${baseUrl}/api/cartera-pdf/estado-cuenta/${modeloId}/download`;
  }

  // ========== HELPERS PRIVADOS ==========

  /**
   * Obtiene la URL base del API desde configuración
   */
  private getApiBaseUrl(): string {
    return (
      this.configService.get('API_URL') ||
      this.configService.get('BACKEND_URL') ||
      'http://localhost:3041'
    );
  }
}
