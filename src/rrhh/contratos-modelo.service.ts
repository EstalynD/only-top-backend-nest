import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  ContratoModeloEntity, 
  ContratoModeloDocument,
  EstadoContrato,
  TipoComision,
  PeriodicidadPago,
} from './contrato-modelo.schema.js';
import { ModeloEntity, ModeloDocument } from './modelo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from './empleado.schema.js';
import { PaymentProcessorEntity } from '../sistema/payment-processor.schema.js';
import { CommissionScaleEntity } from '../sistema/commission-scale.schema.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { EmailConfigService } from '../sistema/email-config.service.js';
import type { EmailMessage } from '../email/brevo-smtp.provider.js';
import { 
  CreateContratoModeloDto, 
  UpdateContratoModeloDto,
  FirmarContratoDto,
} from './dto/contrato-modelo.dto.js';
import * as crypto from 'crypto';

// Store OTP codes temporarily (in production, use Redis)
const otpStore = new Map<string, { code: string; expiresAt: Date; contratoId: string }>();

@Injectable()
export class ContratosModeloService {
  private readonly logger = new Logger(ContratosModeloService.name);

  constructor(
    @InjectModel(ContratoModeloEntity.name) private contratoModel: Model<ContratoModeloDocument>,
    @InjectModel(ModeloEntity.name) private modeloModel: Model<ModeloDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(PaymentProcessorEntity.name) private paymentProcessorModel: Model<PaymentProcessorEntity>,
    @InjectModel(CommissionScaleEntity.name) private commissionScaleModel: Model<CommissionScaleEntity>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly emailConfigService: EmailConfigService,
  ) {}

  // ========== CRUD DE CONTRATOS ==========

  async createContrato(dto: CreateContratoModeloDto, creadoPor?: string): Promise<ContratoModeloDocument> {
    // Validar que la modelo existe
    const modelo = await this.modeloModel.findById(dto.modeloId).exec();
    if (!modelo) {
      throw new NotFoundException(`Modelo with ID '${dto.modeloId}' not found`);
    }

    // Verificar que no haya un contrato activo para esta modelo
    const contratoActivo = await this.contratoModel.findOne({
      modeloId: new Types.ObjectId(dto.modeloId),
      estado: { $in: [EstadoContrato.FIRMADO, EstadoContrato.PENDIENTE_FIRMA] },
    }).exec();

    if (contratoActivo) {
      throw new ConflictException(
        `La modelo ${modelo.nombreCompleto} ya tiene un contrato ${contratoActivo.estado.toLowerCase()}`
      );
    }

    // Validar procesador de pago
    const procesador = await this.paymentProcessorModel.findById(dto.procesadorPagoId).exec();
    if (!procesador) {
      throw new NotFoundException('Payment processor not found');
    }

    // Preparar datos de comisión
    let comisionData: any = {};
    if (dto.tipoComision === TipoComision.FIJO) {
      if (dto.comisionFijaPorcentaje === undefined) {
        throw new BadRequestException('Porcentaje de comisión fija es requerido');
      }
      comisionData.comisionFija = { porcentaje: dto.comisionFijaPorcentaje };
      comisionData.comisionEscalonada = null;
    } else if (dto.tipoComision === TipoComision.ESCALONADO) {
      if (!dto.comisionEscalonadaId) {
        throw new BadRequestException('Escala de comisión es requerida');
      }
      const escala = await this.commissionScaleModel.findById(dto.comisionEscalonadaId).exec();
      if (!escala) {
        throw new NotFoundException('Commission scale not found');
      }
      comisionData.comisionEscalonada = {
        escalaId: new Types.ObjectId(dto.comisionEscalonadaId),
        escalaNombre: escala.name,
      };
      comisionData.comisionFija = null;
    }

    // Generar número de contrato único
    const numeroContrato = await this.generarNumeroContrato();

    // Crear contrato
    const contrato = new this.contratoModel({
      modeloId: new Types.ObjectId(dto.modeloId),
      numeroContrato,
      fechaInicio: new Date(dto.fechaInicio),
      periodicidadPago: dto.periodicidadPago,
      fechaInicioCobro: new Date(dto.fechaInicioCobro),
      tipoComision: dto.tipoComision,
      ...comisionData,
      procesadorPagoId: new Types.ObjectId(dto.procesadorPagoId),
      procesadorPagoNombre: procesador.name,
      estado: EstadoContrato.BORRADOR,
      creadoPor: creadoPor ? new Types.ObjectId(creadoPor) : null,
      salesCloserAsignado: dto.salesCloserAsignado ? new Types.ObjectId(dto.salesCloserAsignado) : modelo.salesCloserAsignado,
      notasInternas: dto.notasInternas,
    });

    return await contrato.save();
  }

  async findAllContratos(filters?: {
    modeloId?: string;
    estado?: EstadoContrato;
    search?: string;
  }): Promise<ContratoModeloDocument[]> {
    const query: any = {};

    if (filters?.modeloId) {
      if (!Types.ObjectId.isValid(filters.modeloId)) {
        throw new BadRequestException('Invalid modelo ID format');
      }
      query.modeloId = new Types.ObjectId(filters.modeloId);
    }

    if (filters?.estado) {
      query.estado = filters.estado;
    }

    let contratos = await this.contratoModel
      .find(query)
      .populate('modeloId', 'nombreCompleto correoElectronico numeroIdentificacion fotoPerfil')
      .populate('procesadorPagoId', 'name code')
      .populate('comisionEscalonada.escalaId', 'name')
      .populate('salesCloserAsignado', 'nombre apellido correoElectronico')
      .sort({ createdAt: -1 })
      .exec();

    // Filtro de búsqueda por nombre o número de contrato
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      contratos = contratos.filter(c => {
        const modelo = c.modeloId as any;
        return (
          c.numeroContrato.toLowerCase().includes(searchLower) ||
          (modelo?.nombreCompleto || '').toLowerCase().includes(searchLower) ||
          (modelo?.numeroIdentificacion || '').includes(searchLower)
        );
      });
    }

    return contratos;
  }

  async findContratoById(id: string): Promise<ContratoModeloDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid contract ID format');
    }

    const contrato = await this.contratoModel
      .findById(id)
      .populate('modeloId')
      .populate('procesadorPagoId')
      .populate('comisionEscalonada.escalaId')
      .populate('salesCloserAsignado', 'nombre apellido correoElectronico telefono')
      .exec();

    if (!contrato) {
      throw new NotFoundException(`Contract with ID '${id}' not found`);
    }

    return contrato;
  }

  async updateContrato(id: string, dto: UpdateContratoModeloDto): Promise<ContratoModeloDocument> {
    const contrato = await this.findContratoById(id);

    // Solo se puede actualizar si está en borrador
    if (contrato.estado !== EstadoContrato.BORRADOR) {
      throw new BadRequestException('Solo se pueden editar contratos en estado borrador');
    }

    const updateData: any = {};

    if (dto.fechaInicio) updateData.fechaInicio = new Date(dto.fechaInicio);
    if (dto.periodicidadPago) updateData.periodicidadPago = dto.periodicidadPago;
    if (dto.fechaInicioCobro) updateData.fechaInicioCobro = new Date(dto.fechaInicioCobro);
    if (dto.notasInternas !== undefined) updateData.notasInternas = dto.notasInternas;

    // Actualizar tipo de comisión si es necesario
    if (dto.tipoComision) {
      updateData.tipoComision = dto.tipoComision;
      
      if (dto.tipoComision === TipoComision.FIJO && dto.comisionFijaPorcentaje !== undefined) {
        updateData.comisionFija = { porcentaje: dto.comisionFijaPorcentaje };
        updateData.comisionEscalonada = null;
      } else if (dto.tipoComision === TipoComision.ESCALONADO && dto.comisionEscalonadaId) {
        const escala = await this.commissionScaleModel.findById(dto.comisionEscalonadaId).exec();
        if (!escala) {
          throw new NotFoundException('Commission scale not found');
        }
        updateData.comisionEscalonada = {
          escalaId: new Types.ObjectId(dto.comisionEscalonadaId),
          escalaNombre: escala.name,
        };
        updateData.comisionFija = null;
      }
    }

    // Actualizar procesador si es necesario
    if (dto.procesadorPagoId) {
      const procesador = await this.paymentProcessorModel.findById(dto.procesadorPagoId).exec();
      if (!procesador) {
        throw new NotFoundException('Payment processor not found');
      }
      updateData.procesadorPagoId = new Types.ObjectId(dto.procesadorPagoId);
      updateData.procesadorPagoNombre = procesador.name;
    }

    const updated = await this.contratoModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('modeloId')
      .populate('procesadorPagoId')
      .populate('comisionEscalonada.escalaId')
      .populate('salesCloserAsignado')
      .exec();

    return updated!;
  }

  async deleteContrato(id: string): Promise<void> {
    const contrato = await this.findContratoById(id);

    // Solo se puede eliminar si está en borrador o rechazado
    if (![EstadoContrato.BORRADOR, EstadoContrato.RECHAZADO].includes(contrato.estado as EstadoContrato)) {
      throw new BadRequestException('Solo se pueden eliminar contratos en estado borrador o rechazado');
    }

    await this.contratoModel.findByIdAndDelete(id).exec();
  }

  // ========== PROCESO DE FIRMA ==========

  async enviarParaFirma(contratoId: string): Promise<{ success: boolean; message: string }> {
    const contrato = await this.findContratoById(contratoId);

    if (contrato.estado !== EstadoContrato.BORRADOR) {
      throw new BadRequestException('El contrato debe estar en estado borrador');
    }

    const modelo = contrato.modeloId as any;
    if (!modelo) {
      throw new NotFoundException('Modelo no encontrada');
    }

    // Actualizar estado
    contrato.estado = EstadoContrato.PENDIENTE_FIRMA;
    contrato.fechaEnvioPendienteFirma = new Date();
    await contrato.save();

    // Enviar email con link de firma (en producción sería un link real)
    const emailEnabled = await this.emailConfigService.isEnabled();
    if (emailEnabled) {
      try {
        const message: EmailMessage = {
          to: modelo.correoElectronico,
          subject: '📄 Contrato Digital - OnlyTop',
          html: this.generateEmailContratoParaFirma(modelo.nombreCompleto, contrato.numeroContrato),
        };
        await this.emailConfigService.sendEmail(message);
      } catch (error) {
        this.logger.error('Error al enviar email de contrato', error);
      }
    }

    return {
      success: true,
      message: 'Contrato enviado para firma. La modelo recibirá un email con las instrucciones.',
    };
  }

  async enviarEnlaceFirma(contratoId: string): Promise<{ success: boolean; message: string; enlace: string }> {
    const contrato = await this.findContratoById(contratoId);

    if (contrato.estado !== EstadoContrato.BORRADOR) {
      throw new BadRequestException('El contrato debe estar en estado borrador');
    }

    const modelo = contrato.modeloId as any;
    if (!modelo) {
      throw new NotFoundException('Modelo no encontrada');
    }

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    // Actualizar contrato con el token
    contrato.tokenFirmaUnico = token;
    contrato.tokenFirmaExpiracion = expiracion;
    contrato.estado = EstadoContrato.PENDIENTE_FIRMA;
    contrato.fechaEnvioPendienteFirma = new Date();
    await contrato.save();

    // Generar enlace único
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const enlaceFirma = `${frontendUrl}/firma-contrato/${token}`;

    // Enviar email con el enlace
    const emailEnabled = await this.emailConfigService.isEnabled();
    if (emailEnabled) {
      try {
        const message: EmailMessage = {
          to: modelo.correoElectronico,
          subject: '📄 Firma tu Contrato Digital - OnlyTop',
          html: this.generateEmailEnlaceFirma(modelo.nombreCompleto, contrato.numeroContrato, enlaceFirma, expiracion),
        };
        await this.emailConfigService.sendEmail(message);
      } catch (error) {
        this.logger.error('Error al enviar email con enlace de firma', error);
      }
    }

    return {
      success: true,
      message: 'Enlace de firma enviado al correo de la modelo',
      enlace: enlaceFirma,
    };
  }

  async obtenerContratoPorToken(token: string): Promise<ContratoModeloDocument> {
    const contrato = await this.contratoModel
      .findOne({ tokenFirmaUnico: token })
      .populate('modeloId')
      .populate('procesadorPagoId')
      .populate('comisionEscalonada.escalaId')
      .exec();

    if (!contrato) {
      throw new NotFoundException('Contrato no encontrado o enlace inválido');
    }

    if (contrato.tokenFirmaExpiracion && new Date() > contrato.tokenFirmaExpiracion) {
      throw new BadRequestException('El enlace de firma ha expirado');
    }

    if (contrato.estado !== EstadoContrato.PENDIENTE_FIRMA) {
      throw new BadRequestException('Este contrato ya no está disponible para firma');
    }

    return contrato;
  }

  async solicitarOtpPorToken(token: string): Promise<{ success: boolean; message: string }> {
    const contrato = await this.obtenerContratoPorToken(token);
    const modelo = contrato.modeloId as any;

    // Generar código OTP de 6 dígitos
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Guardar OTP con el token como clave
    const otpKey = `token_${token}`;
    otpStore.set(otpKey, { code: otpCode, expiresAt, contratoId: contrato._id.toString() });

    // Limpiar OTPs expirados
    this.cleanExpiredOtps();

    // Enviar email con OTP
    const emailEnabled = await this.emailConfigService.isEnabled();
    if (emailEnabled) {
      try {
        const message: EmailMessage = {
          to: modelo.correoElectronico,
          subject: '🔐 Código de Verificación - OnlyTop',
          html: this.generateEmailOtp(modelo.nombreCompleto, otpCode),
        };
        await this.emailConfigService.sendEmail(message);
      } catch (error) {
        this.logger.error('Error al enviar OTP por email', error);
        throw new BadRequestException('Error al enviar código de verificación');
      }
    }

    return {
      success: true,
      message: 'Código OTP enviado a tu correo electrónico',
    };
  }

  async firmarContratoPorToken(token: string, dto: Omit<FirmarContratoDto, 'contratoId'>): Promise<{ success: boolean; contrato: ContratoModeloDocument }> {
    const contrato = await this.obtenerContratoPorToken(token);
    const modelo = contrato.modeloId as any;

    if (!modelo) {
      throw new NotFoundException('Modelo no encontrada');
    }

    // Validar nombre completo
    if (modelo.nombreCompleto.toLowerCase() !== dto.nombreCompleto.toLowerCase()) {
      throw new BadRequestException('El nombre completo no coincide');
    }

    // Validar número de identificación
    if (modelo.numeroIdentificacion !== dto.numeroIdentificacion) {
      throw new BadRequestException('El número de identificación no coincide');
    }

    // Verificar OTP
    const otpKey = `token_${token}`;
    const otpData = otpStore.get(otpKey);

    if (!otpData) {
      throw new BadRequestException('Código OTP no encontrado o expirado. Solicita uno nuevo.');
    }

    if (otpData.code !== dto.codigoOtp) {
      throw new BadRequestException('Código OTP incorrecto');
    }

    if (new Date() > otpData.expiresAt) {
      otpStore.delete(otpKey);
      throw new BadRequestException('Código OTP expirado. Solicita uno nuevo.');
    }

    // Eliminar OTP usado
    otpStore.delete(otpKey);

    // Registrar firma
    contrato.firma = {
      fechaFirma: new Date(),
      nombreCompleto: dto.nombreCompleto,
      numeroIdentificacion: dto.numeroIdentificacion,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      dispositivo: dto.dispositivo,
      otpVerificado: true,
    };
    contrato.estado = EstadoContrato.FIRMADO;
    contrato.fechaFirma = new Date();
    contrato.tokenFirmaUnico = null; // Invalidar el token
    contrato.tokenFirmaExpiracion = null;

    await contrato.save();

    // El PDF ahora se genera on-demand cuando se solicita
    // No es necesario guardarlo en este momento
    this.logger.log(`Contrato ${contrato.numeroContrato} firmado exitosamente por enlace. PDF disponible on-demand.`);

    // Enviar email de bienvenida
    await this.enviarEmailBienvenida(modelo);

    return {
      success: true,
      contrato,
    };
  }

  async solicitarOtp(contratoId: string, correoModelo: string): Promise<{ success: boolean; message: string }> {
    const contrato = await this.findContratoById(contratoId);

    if (contrato.estado !== EstadoContrato.PENDIENTE_FIRMA) {
      throw new BadRequestException('El contrato debe estar pendiente de firma');
    }

    const modelo = contrato.modeloId as any;
    if (modelo.correoElectronico !== correoModelo) {
      throw new BadRequestException('Email no coincide con el de la modelo');
    }

    // Generar código OTP de 6 dígitos
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Guardar OTP
    const otpKey = `${contratoId}_${correoModelo}`;
    otpStore.set(otpKey, { code: otpCode, expiresAt, contratoId });

    // Limpiar OTPs expirados
    this.cleanExpiredOtps();

    // Enviar email con OTP
    const emailEnabled = await this.emailConfigService.isEnabled();
    if (emailEnabled) {
      try {
        const message: EmailMessage = {
          to: correoModelo,
          subject: '🔐 Código de Verificación - OnlyTop',
          html: this.generateEmailOtp(modelo.nombreCompleto, otpCode),
        };
        await this.emailConfigService.sendEmail(message);
      } catch (error) {
        this.logger.error('Error al enviar OTP por email', error);
        throw new BadRequestException('Error al enviar código de verificación');
      }
    }

    return {
      success: true,
      message: 'Código OTP enviado a tu correo electrónico',
    };
  }

  async firmarContrato(dto: FirmarContratoDto): Promise<{ success: boolean; contrato: ContratoModeloDocument }> {
    const contrato = await this.findContratoById(dto.contratoId);

    if (contrato.estado !== EstadoContrato.PENDIENTE_FIRMA) {
      throw new BadRequestException('El contrato debe estar pendiente de firma');
    }

    const modelo = contrato.modeloId as any;
    if (!modelo) {
      throw new NotFoundException('Modelo no encontrada');
    }

    // Validar nombre completo
    if (modelo.nombreCompleto.toLowerCase() !== dto.nombreCompleto.toLowerCase()) {
      throw new BadRequestException('El nombre completo no coincide');
    }

    // Validar número de identificación
    if (modelo.numeroIdentificacion !== dto.numeroIdentificacion) {
      throw new BadRequestException('El número de identificación no coincide');
    }

    // Verificar OTP
    const otpKey = `${dto.contratoId}_${modelo.correoElectronico}`;
    const otpData = otpStore.get(otpKey);

    if (!otpData) {
      throw new BadRequestException('Código OTP no encontrado o expirado. Solicita uno nuevo.');
    }

    if (otpData.code !== dto.codigoOtp) {
      throw new BadRequestException('Código OTP incorrecto');
    }

    if (new Date() > otpData.expiresAt) {
      otpStore.delete(otpKey);
      throw new BadRequestException('Código OTP expirado. Solicita uno nuevo.');
    }

    // Eliminar OTP usado
    otpStore.delete(otpKey);

    // Registrar firma
    contrato.firma = {
      fechaFirma: new Date(),
      nombreCompleto: dto.nombreCompleto,
      numeroIdentificacion: dto.numeroIdentificacion,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      dispositivo: dto.dispositivo,
      otpVerificado: true,
    };
    contrato.estado = EstadoContrato.FIRMADO;
    contrato.fechaFirma = new Date();

    await contrato.save();

    // El PDF ahora se genera on-demand cuando se solicita
    // No es necesario guardarlo en este momento
    this.logger.log(`Contrato ${contrato.numeroContrato} firmado exitosamente. PDF disponible on-demand.`);

    // Enviar email de bienvenida
    await this.enviarEmailBienvenida(modelo);

    return {
      success: true,
      contrato,
    };
  }

  // ========== UTILIDADES ==========

  private async generarNumeroContrato(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CTMO-${year}`;
    
    // Buscar el último contrato del año
    const lastContrato = await this.contratoModel
      .findOne({ numeroContrato: new RegExp(`^${prefix}`) })
      .sort({ numeroContrato: -1 })
      .exec();

    let sequence = 1;
    if (lastContrato) {
      const lastSequence = parseInt(lastContrato.numeroContrato.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(5, '0')}`;
  }

  private async enviarEmailBienvenida(modelo: any): Promise<void> {
    const emailEnabled = await this.emailConfigService.isEnabled();
    if (!emailEnabled) return;

    try {
      const message: EmailMessage = {
        to: modelo.correoElectronico,
        subject: '¡Bienvenid@ oficialmente a OnlyTop! 🎉',
        html: this.generateEmailBienvenida(modelo.nombreCompleto),
      };
      await this.emailConfigService.sendEmail(message);
    } catch (error) {
      this.logger.error('Error al enviar email de bienvenida', error);
    }
  }

  private generateEmailEnlaceFirma(nombreModelo: string, numeroContrato: string, enlace: string, expiracion: Date): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; padding: 15px 40px; background: #3b82f6; color: white !important; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✍️ Firma tu Contrato Digital</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${nombreModelo}</strong>,</p>
            
            <p>Tu contrato digital con OnlyTop está listo para ser firmado.</p>
            
            <p><strong>Número de Contrato:</strong> ${numeroContrato}</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${enlace}" class="button">Firmar Contrato Ahora</a>
            </div>
            
            <div class="warning">
              <p><strong>⚠️ Importante:</strong></p>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Este enlace es único y personal</li>
                <li>Expira el <strong>${expiracion.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></li>
                <li>No compartas este enlace con nadie</li>
              </ul>
            </div>
            
            <p><strong>Para firmar el contrato necesitarás:</strong></p>
            <ul>
              <li>Tu nombre completo (como aparece en tu identificación)</li>
              <li>Tu número de identificación</li>
              <li>Un código de verificación (OTP) que te enviaremos a este correo</li>
            </ul>
            
            <p>El proceso de firma es seguro, rápido y solo tomará unos minutos.</p>
            
            <p>Si tienes alguna pregunta, no dudes en contactar a tu Sales Closer asignado.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} OnlyTop. Todos los derechos reservados.</p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
              Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:<br>
              <span style="word-break: break-all;">${enlace}</span>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateEmailContratoParaFirma(nombreModelo: string, numeroContrato: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Contrato Digital Pendiente</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${nombreModelo}</strong>,</p>
            
            <p>Tu contrato digital con OnlyTop está listo para ser firmado.</p>
            
            <p><strong>Número de Contrato:</strong> ${numeroContrato}</p>
            
            <p>Para firmar el contrato necesitarás:</p>
            <ul>
              <li>Tu nombre completo</li>
              <li>Tu número de identificación</li>
              <li>Un código de verificación (OTP) que te enviaremos</li>
            </ul>
            
            <p>El proceso de firma es seguro y solo tomará unos minutos.</p>
            
            <p>Si tienes alguna pregunta, no dudes en contactar a tu Sales Closer asignado.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} OnlyTop. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateEmailOtp(nombreModelo: string, otpCode: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; text-align: center; }
          .otp-code { font-size: 36px; font-weight: bold; color: #1e40af; letter-spacing: 8px; padding: 20px; background: #eff6ff; border-radius: 10px; margin: 20px 0; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; text-align: left; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Código de Verificación</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${nombreModelo}</strong>,</p>
            
            <p>Tu código de verificación para firmar el contrato es:</p>
            
            <div class="otp-code">${otpCode}</div>
            
            <div class="warning">
              <p><strong>⚠️ Importante:</strong></p>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Este código expira en <strong>10 minutos</strong></li>
                <li>No compartas este código con nadie</li>
                <li>OnlyTop nunca te pedirá este código por teléfono o chat</li>
              </ul>
            </div>
            
            <p>Si no solicitaste este código, ignora este mensaje.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} OnlyTop. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateEmailBienvenida(nombreModelo: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ec4899, #be185d); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .highlight { background: #fdf2f8; border-left: 4px solid #ec4899; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          ul { padding-left: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Bienvenid@ a OnlyTop!</h1>
          </div>
          <div class="content">
            <p>¡Hola <strong>${nombreModelo}</strong>!</p>
            
            <p>Es un placer darte la bienvenida oficialmente a la familia OnlyTop. Estamos emocionados de comenzar este viaje contigo y ayudarte a alcanzar tus metas.</p>
            
            <div class="highlight">
              <p><strong>✨ ¿Qué sigue ahora?</strong></p>
              <ul>
                <li>Tu equipo de trabajo ya ha sido asignado y se pondrá en contacto contigo pronto</li>
                <li>Recibirás actualizaciones sobre tus campañas y estrategias de crecimiento</li>
                <li>Tu Sales Closer estará disponible para cualquier consulta</li>
              </ul>
            </div>
            
            <p>Recuerda que nuestro objetivo es maximizar tu potencial y brindarte el mejor soporte posible. Estamos aquí para ti en cada paso del camino.</p>
            
            <p><strong>¡Prepárate para alcanzar nuevas alturas! 🚀</strong></p>
            
            <p>Con cariño,<br><strong>El equipo de OnlyTop</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} OnlyTop. Todos los derechos reservados.</p>
            <p>Si tienes alguna pregunta, responde a este email o contacta a tu Sales Closer.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private cleanExpiredOtps(): void {
    const now = new Date();
    for (const [key, data] of otpStore.entries()) {
      if (now > data.expiresAt) {
        otpStore.delete(key);
      }
    }
  }

  async getContratosStats(): Promise<any> {
    const total = await this.contratoModel.countDocuments().exec();
    const firmados = await this.contratoModel.countDocuments({ estado: EstadoContrato.FIRMADO }).exec();
    const pendientes = await this.contratoModel.countDocuments({ estado: EstadoContrato.PENDIENTE_FIRMA }).exec();
    const borradores = await this.contratoModel.countDocuments({ estado: EstadoContrato.BORRADOR }).exec();

    return {
      total,
      firmados,
      pendientes,
      borradores,
      rechazados: await this.contratoModel.countDocuments({ estado: EstadoContrato.RECHAZADO }).exec(),
    };
  }
}

