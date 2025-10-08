import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContratoModeloEntity, ContratoModeloDocument } from '../rrhh/contrato-modelo.schema.js';
import { ModeloEntity } from '../rrhh/modelo.schema.js';
import { CommissionScaleEntity } from '../sistema/commission-scale.schema.js';
import { PaymentProcessorEntity } from '../sistema/payment-processor.schema.js';
import { PdfGeneratorService } from './pdf-generator.service.js';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    @InjectModel(ContratoModeloEntity.name) private contratoModel: Model<ContratoModeloDocument>,
    @InjectModel(ModeloEntity.name) private modeloModel: Model<ModeloEntity>,
    @InjectModel(CommissionScaleEntity.name) private commissionScaleModel: Model<CommissionScaleEntity>,
    @InjectModel(PaymentProcessorEntity.name) private paymentProcessorModel: Model<PaymentProcessorEntity>,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {}

  /**
   * Genera el PDF de un contrato de modelo
   */
  async generateContratoModeloPdf(contratoId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(contratoId)) {
      throw new NotFoundException('Invalid contract ID');
    }

    // Obtener el contrato con toda la información necesaria
    const contrato = await this.contratoModel
      .findById(contratoId)
      .populate('modeloId')
      .populate('procesadorPagoId')
      .populate('comisionEscalonada.escalaId')
      .populate('salesCloserAsignado', 'nombre apellido correoElectronico')
      .exec();

    if (!contrato) {
      throw new NotFoundException('Contract not found');
    }

    // Preparar los datos para el PDF
    const pdfData = await this.prepareContratoPdfData(contrato);

    // Generar el PDF
    this.logger.log(`Generating PDF for contract: ${contrato.numeroContrato}`);
    const pdfBuffer = await this.pdfGeneratorService.generateContratoModeloPdf(pdfData);

    return pdfBuffer;
  }

  /**
   * Genera el PDF con el nombre de archivo sugerido
   */
  async generateContratoModeloPdfWithFilename(
    contratoId: string,
  ): Promise<{ pdfBuffer: Buffer; filename: string }> {
    if (!Types.ObjectId.isValid(contratoId)) {
      throw new NotFoundException('Invalid contract ID');
    }

    const contrato = await this.contratoModel.findById(contratoId).exec();

    if (!contrato) {
      throw new NotFoundException('Contract not found');
    }

    const pdfBuffer = await this.generateContratoModeloPdf(contratoId);
    const filename = `${contrato.numeroContrato}.pdf`;

    return { pdfBuffer, filename };
  }

  /**
   * Obtiene información básica del contrato para preview
   */
  async getContratoInfo(contratoId: string): Promise<any> {
    if (!Types.ObjectId.isValid(contratoId)) {
      throw new NotFoundException('Invalid contract ID');
    }

    const contrato = await this.contratoModel
      .findById(contratoId)
      .populate('modeloId', 'nombreCompleto numeroIdentificacion correoElectronico')
      .exec();

    if (!contrato) {
      throw new NotFoundException('Contract not found');
    }

    const modelo = contrato.modeloId as any;

    return {
      contratoId: contrato._id,
      numeroContrato: contrato.numeroContrato,
      estado: contrato.estado,
      fechaInicio: contrato.fechaInicio,
      periodicidadPago: contrato.periodicidadPago,
      modelo: {
        nombreCompleto: modelo?.nombreCompleto || 'N/A',
        numeroIdentificacion: modelo?.numeroIdentificacion || 'N/A',
        correoElectronico: modelo?.correoElectronico || 'N/A',
      },
      firmado: contrato.estado === 'FIRMADO',
      fechaFirma: contrato.fechaFirma,
      pdfUrl: this.generatePdfUrl(contrato),
    };
  }

  /**
   * Prepara los datos del contrato para generar el PDF
   */
  private async prepareContratoPdfData(contrato: ContratoModeloDocument): Promise<any> {
    const modelo = contrato.modeloId as any;
    const procesador = contrato.procesadorPagoId as any;

    const pdfData: any = {
      _id: contrato._id,
      numeroContrato: contrato.numeroContrato,
      fechaInicio: contrato.fechaInicio,
      periodicidadPago: contrato.periodicidadPago,
      fechaInicioCobro: contrato.fechaInicioCobro,
      tipoComision: contrato.tipoComision,
      estado: contrato.estado,
      procesadorPagoNombre: procesador?.name || contrato.procesadorPagoNombre || 'N/A',
  createdAt: (contrato as any)?.createdAt || new Date(),
      modelo: {
        nombreCompleto: modelo?.nombreCompleto || 'N/A',
        numeroIdentificacion: modelo?.numeroIdentificacion || 'N/A',
        tipoDocumento: modelo?.tipoDocumento || 'N/A',
        correoElectronico: modelo?.correoElectronico || 'N/A',
        telefono: modelo?.telefono || 'N/A',
        fechaNacimiento: modelo?.fechaNacimiento || null,
        paisResidencia: modelo?.paisResidencia || 'N/A',
        ciudadResidencia: modelo?.ciudadResidencia || 'N/A',
      },
    };

    // Información de comisión
    if (contrato.tipoComision === 'FIJO') {
      pdfData.comisionFija = contrato.comisionFija;
    } else if (contrato.tipoComision === 'ESCALONADO') {
      pdfData.comisionEscalonada = contrato.comisionEscalonada;

      // Obtener los rules de la escala si está disponible
      const escalaId = contrato.comisionEscalonada?.escalaId;
      if (escalaId) {
        let escala: any = null;
        
        // Si ya está poblado
        if (typeof escalaId === 'object' && 'rules' in escalaId) {
          escala = escalaId;
        } else {
          // Si no está poblado, buscarlo
          escala = await this.commissionScaleModel.findById(escalaId).exec();
        }

        if (escala && escala.rules) {
          pdfData.escalaRules = escala.rules;
        }
      }
    }

    // Información de firma si existe
    if (contrato.firma) {
      pdfData.firma = {
        fechaFirma: contrato.firma.fechaFirma,
        nombreCompleto: contrato.firma.nombreCompleto,
        numeroIdentificacion: contrato.firma.numeroIdentificacion,
        ipAddress: contrato.firma.ipAddress,
        userAgent: contrato.firma.userAgent,
        dispositivo: contrato.firma.dispositivo,
        otpVerificado: contrato.firma.otpVerificado,
      };
    }

    return pdfData;
  }

  /**
   * Genera la URL personalizada para el PDF
   */
  private generatePdfUrl(contrato: ContratoModeloDocument): string {
    const baseUrl = process.env.API_URL || 'http://localhost:4000';
    return `${baseUrl}/api/pdf/contratos-modelo/${contrato._id}/A4/${contrato.numeroContrato}.pdf`;
  }

  /**
   * Genera la URL de descarga
   */
  generateDownloadUrl(contratoId: string): string {
    const baseUrl = process.env.API_URL || 'http://localhost:4000';
    return `${baseUrl}/api/pdf/contratos-modelo/${contratoId}/download`;
  }
}

