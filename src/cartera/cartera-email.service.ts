import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailConfigService } from '../sistema/email-config.service.js';
import { CarteraTokenService } from './cartera-token.service.js';
import { CarteraPdfService } from './cartera-pdf.service.js';
import { MoneyService } from '../money/money.service.js';
import type { FacturaDocument } from './factura.schema.js';
import type { ModeloDocument } from '../rrhh/modelo.schema.js';

/**
 * Servicio de emails para el módulo de Cartera
 * 
 * Funcionalidades:
 * - Envío de recordatorios de pago próximo a vencer
 * - Envío de alertas de facturas vencidas
 * - Envío de alertas de mora
 * - Confirmación de pago recibido
 * - Plantillas HTML profesionales con datos dinámicos
 */
@Injectable()
export class CarteraEmailService {
  private readonly logger = new Logger(CarteraEmailService.name);

  constructor(
    private readonly emailConfigService: EmailConfigService,
    private readonly configService: ConfigService,
    private readonly tokenService: CarteraTokenService,
    private readonly pdfService: CarteraPdfService,
    private readonly moneyService: MoneyService,
  ) {}

  /**
   * Envía recordatorio de pago próximo a vencer
   */
  async enviarRecordatorioProximoVencimiento(
    factura: FacturaDocument,
    modelo: ModeloDocument,
    diasRestantes: number,
  ): Promise<{ success: boolean; messageId?: string; error?: string; token?: string }> {
    try {
      // Preparar datos de factura con valores formateados
      const facturaData = this.prepareFacturaData(factura);
      
      // Generar token de acceso temporal al PDF
      const modeloId = (modelo._id as any).toString();
      const facturaId = (factura._id as any).toString();
      
      const token = this.tokenService.generateToken({
        modeloId,
        facturaId,
        tipo: 'ESTADO_CUENTA',
        email: modelo.correoElectronico,
        expiresInDays: 7,
      });
      
      // Generar URL con token para acceso directo al PDF
      const pdfUrl = this.tokenService.generateEstadoCuentaUrl(token);

      const subject = `🔔 Recordatorio: Factura ${factura.numeroFactura} vence en ${diasRestantes} día(s)`;
      const html = this.generateProximoVencimientoTemplate(facturaData, modelo, diasRestantes, pdfUrl);
      const text = this.generateProximoVencimientoText(facturaData, modelo, diasRestantes, pdfUrl);

      const result = await this.emailConfigService.sendEmail({
        to: modelo.correoElectronico,
        subject,
        html,
        text,
      });

      this.logger.log(`✅ Recordatorio enviado a ${modelo.correoElectronico} - Factura ${factura.numeroFactura}`);

      return {
        success: true,
        messageId: result.id,
        token,
      };
    } catch (error: any) {
      this.logger.error(`Error enviando recordatorio próximo vencimiento: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envía alerta de factura vencida
   */
  async enviarAlertaFacturaVencida(
    factura: FacturaDocument,
    modelo: ModeloDocument,
    diasVencido: number,
  ): Promise<{ success: boolean; messageId?: string; error?: string; token?: string }> {
    try {
      // Preparar datos de factura con valores formateados
      const facturaData = this.prepareFacturaData(factura);
      
      // Generar token de acceso temporal al PDF
      const modeloId = (modelo._id as any).toString();
      const facturaId = (factura._id as any).toString();
      
      const token = this.tokenService.generateToken({
        modeloId,
        facturaId,
        tipo: 'ESTADO_CUENTA',
        email: modelo.correoElectronico,
        expiresInDays: 7,
      });
      
      // Generar URL con token para acceso directo al PDF
      const pdfUrl = this.tokenService.generateEstadoCuentaUrl(token);

      const subject = `⚠️ URGENTE: Factura ${factura.numeroFactura} vencida hace ${diasVencido} día(s)`;
      const html = this.generateFacturaVencidaTemplate(facturaData, modelo, diasVencido, pdfUrl);
      const text = this.generateFacturaVencidaText(facturaData, modelo, diasVencido, pdfUrl);

      const result = await this.emailConfigService.sendEmail({
        to: modelo.correoElectronico,
        subject,
        html,
        text,
      });

      this.logger.log(`✅ Alerta vencida enviada a ${modelo.correoElectronico} - Factura ${factura.numeroFactura}`);

      return {
        success: true,
        messageId: result.id,
        token,
      };
    } catch (error: any) {
      this.logger.error(`Error enviando alerta vencida: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envía alerta de mora
   */
  async enviarAlertaMora(
    factura: FacturaDocument,
    modelo: ModeloDocument,
    diasMora: number,
  ): Promise<{ success: boolean; messageId?: string; error?: string; token?: string }> {
    try {
      // Preparar datos de factura con valores formateados
      const facturaData = this.prepareFacturaData(factura);
      
      // Generar token de acceso temporal al PDF
      const modeloId = (modelo._id as any).toString();
      const facturaId = (factura._id as any).toString();
      
      const token = this.tokenService.generateToken({
        modeloId,
        facturaId,
        tipo: 'ESTADO_CUENTA',
        email: modelo.correoElectronico,
        expiresInDays: 7,
      });
      
      // Generar URL con token para acceso directo al PDF
      const pdfUrl = this.tokenService.generateEstadoCuentaUrl(token);

      const subject = `🚨 CUENTA EN MORA: Factura ${factura.numeroFactura} - ${diasMora} días de atraso`;
      const html = this.generateMoraTemplate(facturaData, modelo, diasMora, pdfUrl);
      const text = this.generateMoraText(facturaData, modelo, diasMora, pdfUrl);

      const result = await this.emailConfigService.sendEmail({
        to: modelo.correoElectronico,
        subject,
        html,
        text,
      });

      this.logger.log(`✅ Alerta mora enviada a ${modelo.correoElectronico} - Factura ${factura.numeroFactura}`);

      return {
        success: true,
        messageId: result.id,
        token,
      };
    } catch (error: any) {
      this.logger.error(`Error enviando alerta mora: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envía confirmación de pago recibido
   */
  async enviarConfirmacionPago(
    factura: FacturaDocument,
    modelo: ModeloDocument,
    montoPagadoBigInt: bigint,
  ): Promise<{ success: boolean; messageId?: string; error?: string; token?: string }> {
    try {
      // Preparar datos de factura con valores formateados
      const facturaData = this.prepareFacturaData(factura);
      
      // Formatear monto pagado
      const moneda = factura.moneda || 'USD';
      const montoPagadoNum = this.moneyService.fromDatabase(montoPagadoBigInt);
      const montoPagadoFormateado = this.moneyService.formatForUser(montoPagadoNum, moneda);
      
      // Generar token de acceso temporal al PDF
      const modeloId = (modelo._id as any).toString();
      const facturaId = (factura._id as any).toString();
      
      const token = this.tokenService.generateToken({
        modeloId,
        facturaId,
        tipo: 'ESTADO_CUENTA',
        email: modelo.correoElectronico,
        expiresInDays: 7,
      });
      
      // Generar URL con token para acceso directo al PDF
      const pdfUrl = this.tokenService.generateEstadoCuentaUrl(token);

      const subject = `✅ Pago recibido - Factura ${factura.numeroFactura}`;
      const html = this.generateConfirmacionPagoTemplate(
        facturaData, 
        modelo, 
        montoPagadoFormateado, 
        facturaData.saldoPendienteFormateado, 
        pdfUrl
      );
      const text = this.generateConfirmacionPagoText(
        facturaData, 
        modelo, 
        montoPagadoFormateado, 
        facturaData.saldoPendienteFormateado, 
        pdfUrl
      );

      const result = await this.emailConfigService.sendEmail({
        to: modelo.correoElectronico,
        subject,
        html,
        text,
      });

      this.logger.log(`✅ Confirmación pago enviada a ${modelo.correoElectronico} - Factura ${factura.numeroFactura}`);

      return {
        success: true,
        messageId: result.id,
        token,
      };
    } catch (error: any) {
      this.logger.error(`Error enviando confirmación pago: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }


  // ========== HELPER PARA FORMATEAR FACTURA ==========

  /**
   * Prepara los datos de la factura con valores formateados
   */
  private prepareFacturaData(factura: FacturaDocument): any {
    const moneda = factura.moneda || 'USD';
    
    // Convertir BigInt a números decimales
    const total = this.moneyService.fromDatabase(factura.total);
    const saldoPendiente = this.moneyService.fromDatabase(factura.saldoPendiente);
    const montoPagado = this.moneyService.subtract(total, saldoPendiente);
    
    // Formatear valores
    return {
      ...factura.toObject(),
      totalFormateado: this.moneyService.formatForUser(total, moneda),
      saldoPendienteFormateado: this.moneyService.formatForUser(saldoPendiente, moneda),
      montoPagadoFormateado: this.moneyService.formatForUser(montoPagado, moneda),
    };
  }

  // ========== PLANTILLAS HTML ==========

  private generateProximoVencimientoTemplate(factura: any, modelo: any, diasRestantes: number, pdfUrl: string): string {
    const urgencia = diasRestantes <= 2 ? 'alta' : 'media';
    const color = diasRestantes <= 2 ? '#ff4757' : '#ffa502';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Pago</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">OnlyTop</h1>
              <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Sistema de Gestión Financiera</p>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="background-color: ${color}; padding: 15px 20px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: bold;">
                🔔 Su factura vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="color: #333; margin: 0 0 20px; font-size: 22px;">Hola ${modelo.nombreCompleto},</h2>
              
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px; font-size: 15px;">
                Le recordamos que tiene una factura pendiente que vencerá pronto. A continuación los detalles:
              </p>

              <!-- Factura Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">Número de Factura:</td>
                        <td style="color: #333; font-size: 14px; font-weight: bold; text-align: right;">${factura.numeroFactura}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Fecha de Emisión:</td>
                        <td style="color: #333; font-size: 14px; text-align: right;">${new Date(factura.fechaEmision).toLocaleDateString('es-ES')}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Fecha de Vencimiento:</td>
                        <td style="color: #ff4757; font-size: 14px; font-weight: bold; text-align: right;">${new Date(factura.fechaVencimiento).toLocaleDateString('es-ES')}</td>
                      </tr>
                      <tr style="border-top: 2px solid #ddd;">
                        <td style="color: #666; font-size: 16px; padding-top: 12px; font-weight: bold;">Monto Total:</td>
                        <td style="color: #667eea; font-size: 20px; font-weight: bold; text-align: right; padding-top: 12px;">${factura.totalFormateado}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Saldo Pendiente:</td>
                        <td style="color: #ff4757; font-size: 16px; font-weight: bold; text-align: right;">${factura.saldoPendienteFormateado}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #555; line-height: 1.6; margin: 20px 0; font-size: 15px;">
                Para evitar cargos por mora o suspensión de servicios, por favor realice el pago antes de la fecha de vencimiento.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${pdfUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                      📄 Ver Mi Estado de Cuenta
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Payment Info -->
              <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #2e7d32; margin: 0 0 10px; font-size: 14px; font-weight: bold;">
                  💳 Información de Pago
                </p>
                <p style="color: #555; margin: 0; font-size: 13px; line-height: 1.5;">
                  Por favor registre su pago en el sistema y adjunte el comprobante para una verificación más rápida.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 13px;">
                Este es un mensaje automático del sistema de gestión financiera OnlyTop
              </p>
              <p style="color: #999; margin: 0; font-size: 12px;">
                Si tiene alguna pregunta, contáctenos en <a href="mailto:finanzas@onlytop.com" style="color: #667eea; text-decoration: none;">finanzas@onlytop.com</a>
              </p>
              <p style="color: #ccc; margin: 10px 0 0; font-size: 11px;">
                © ${new Date().getFullYear()} OnlyTop. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private generateFacturaVencidaTemplate(factura: any, modelo: any, diasVencido: number, pdfUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura Vencida</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">OnlyTop</h1>
              <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Sistema de Gestión Financiera</p>
            </td>
          </tr>

          <!-- Alert Banner URGENTE -->
          <tr>
            <td style="background-color: #ff4757; padding: 20px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: bold;">
                ⚠️ FACTURA VENCIDA - ACCIÓN REQUERIDA
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="color: #333; margin: 0 0 20px; font-size: 22px;">Hola ${modelo.nombreCompleto},</h2>
              
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px; font-size: 15px;">
                <strong style="color: #ff4757;">Su factura está vencida desde hace ${diasVencido} día${diasVencido !== 1 ? 's' : ''}.</strong> 
                Es importante que realice el pago lo antes posible para evitar:
              </p>

              <ul style="color: #555; line-height: 1.8; margin: 0 0 20px 20px; font-size: 14px;">
                <li>Cargos por mora</li>
                <li>Suspensión temporal de servicios</li>
                <li>Afectación de su historial crediticio</li>
              </ul>

              <!-- Factura Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff5f5; border: 2px solid #ff4757; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">Número de Factura:</td>
                        <td style="color: #333; font-size: 14px; font-weight: bold; text-align: right;">${factura.numeroFactura}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Fecha de Vencimiento:</td>
                        <td style="color: #ff4757; font-size: 14px; font-weight: bold; text-align: right;">${new Date(factura.fechaVencimiento).toLocaleDateString('es-ES')}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Días de Atraso:</td>
                        <td style="color: #ff4757; font-size: 16px; font-weight: bold; text-align: right;">${diasVencido} día${diasVencido !== 1 ? 's' : ''}</td>
                      </tr>
                      <tr style="border-top: 2px solid #ff4757;">
                        <td style="color: #666; font-size: 16px; padding-top: 12px; font-weight: bold;">Monto Adeudado:</td>
                        <td style="color: #ff4757; font-size: 22px; font-weight: bold; text-align: right; padding-top: 12px;">${factura.saldoPendienteFormateado}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button URGENTE -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${pdfUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #ff4757 0%, #c23616 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 18px; font-weight: bold; box-shadow: 0 6px 16px rgba(255, 71, 87, 0.4);">
                      🚨 VER ESTADO DE CUENTA AHORA
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Contact Info -->
              <div style="background-color: #fff9e6; border-left: 4px solid #ffa502; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #b8860b; margin: 0 0 10px; font-size: 14px; font-weight: bold;">
                  📞 ¿Necesita ayuda?
                </p>
                <p style="color: #555; margin: 0; font-size: 13px; line-height: 1.5;">
                  Si tiene dificultades para realizar el pago, contáctenos de inmediato en <a href="mailto:finanzas@onlytop.com" style="color: #667eea;">finanzas@onlytop.com</a> 
                  para establecer un plan de pagos.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 13px;">
                Este es un mensaje automático del sistema de gestión financiera OnlyTop
              </p>
              <p style="color: #999; margin: 0; font-size: 12px;">
                Contáctenos en <a href="mailto:finanzas@onlytop.com" style="color: #667eea; text-decoration: none;">finanzas@onlytop.com</a>
              </p>
              <p style="color: #ccc; margin: 10px 0 0; font-size: 11px;">
                © ${new Date().getFullYear()} OnlyTop. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private generateMoraTemplate(factura: any, modelo: any, diasMora: number, pdfUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cuenta en Mora</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 3px solid #d32f2f;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #d32f2f; padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">⚠️ CUENTA EN MORA</h1>
              <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">OnlyTop - Departamento de Cobranza</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="color: #d32f2f; margin: 0 0 20px; font-size: 22px;">Estimado/a ${modelo.nombreCompleto},</h2>
              
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px; font-size: 15px;">
                <strong>Su cuenta presenta un atraso de ${diasMora} días.</strong> Esta situación requiere su atención inmediata para evitar medidas adicionales.
              </p>

              <!-- Warning Box -->
              <div style="background-color: #ffebee; border: 2px solid #d32f2f; padding: 20px; margin: 20px 0; border-radius: 6px;">
                <p style="color: #d32f2f; margin: 0 0 15px; font-size: 16px; font-weight: bold;">
                  🚨 CONSECUENCIAS DE LA MORA
                </p>
                <ul style="color: #555; line-height: 1.8; margin: 0; font-size: 14px; padding-left: 20px;">
                  <li>Suspensión inmediata de servicios</li>
                  <li>Aplicación de recargos por mora</li>
                  <li>Reporte a centrales de riesgo</li>
                  <li>Inicio de proceso legal de cobranza</li>
                  <li>Imposibilidad de renovar contrato</li>
                </ul>
              </div>

              <!-- Factura Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">Factura:</td>
                        <td style="color: #333; font-size: 14px; font-weight: bold; text-align: right;">${factura.numeroFactura}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Vencimiento:</td>
                        <td style="color: #d32f2f; font-size: 14px; font-weight: bold; text-align: right;">${new Date(factura.fechaVencimiento).toLocaleDateString('es-ES')}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Días en Mora:</td>
                        <td style="color: #d32f2f; font-size: 18px; font-weight: bold; text-align: right;">${diasMora} días</td>
                      </tr>
                      <tr style="border-top: 2px solid #d32f2f;">
                        <td style="color: #666; font-size: 16px; padding-top: 12px; font-weight: bold;">Monto Adeudado:</td>
                        <td style="color: #d32f2f; font-size: 24px; font-weight: bold; text-align: right; padding-top: 12px;">${factura.saldoPendienteFormateado}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #555; line-height: 1.6; margin: 20px 0; font-size: 15px;">
                <strong>Plazo máximo para regularizar: 72 horas</strong> a partir de este comunicado. De lo contrario, procederemos con las medidas legales correspondientes.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${pdfUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 6px; font-size: 20px; font-weight: bold; box-shadow: 0 6px 20px rgba(211, 47, 47, 0.5); text-transform: uppercase; letter-spacing: 1px;">
                      🚨 ACCEDER INMEDIATAMENTE
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Contact Box -->
              <div style="background-color: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #1565c0; margin: 0 0 10px; font-size: 14px; font-weight: bold;">
                  💬 Línea directa de cobranza
                </p>
                <p style="color: #555; margin: 0; font-size: 13px; line-height: 1.5;">
                  <strong>Email:</strong> <a href="mailto:cobranza@onlytop.com" style="color: #1976d2;">cobranza@onlytop.com</a><br>
                  <strong>Horario:</strong> Lunes a Viernes, 9:00 AM - 6:00 PM
                </p>
              </div>

              <p style="color: #999; margin: 20px 0 0; font-size: 12px; font-style: italic;">
                Este comunicado tiene carácter legal y constituye evidencia de notificación de cobranza según los términos de su contrato.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 13px;">
                Departamento de Cobranza - OnlyTop
              </p>
              <p style="color: #ccc; margin: 0; font-size: 11px;">
                © ${new Date().getFullYear()} OnlyTop. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  private generateConfirmacionPagoTemplate(factura: any, modelo: any, montoPagado: string, saldoRestante: string, pdfUrl: string): string {
    const isPagoCompleto = saldoRestante === 'USD $ 0.00' || parseFloat(saldoRestante.replace(/[^\d.-]/g, '')) === 0;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Pago</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">OnlyTop</h1>
              <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Sistema de Gestión Financiera</p>
            </td>
          </tr>

          <!-- Success Banner -->
          <tr>
            <td style="background-color: #4caf50; padding: 20px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: bold;">
                ✅ ${isPagoCompleto ? 'PAGO COMPLETADO' : 'PAGO RECIBIDO'}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="color: #333; margin: 0 0 20px; font-size: 22px;">¡Gracias ${modelo.nombreCompleto}!</h2>
              
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px; font-size: 15px;">
                Hemos recibido su pago correctamente. A continuación los detalles de la transacción:
              </p>

              <!-- Payment Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f5e9; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">Factura:</td>
                        <td style="color: #333; font-size: 14px; font-weight: bold; text-align: right;">${factura.numeroFactura}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Fecha de Pago:</td>
                        <td style="color: #333; font-size: 14px; text-align: right;">${new Date().toLocaleDateString('es-ES')}</td>
                      </tr>
                      <tr style="border-top: 2px solid #4caf50;">
                        <td style="color: #666; font-size: 16px; padding-top: 12px; font-weight: bold;">Monto Pagado:</td>
                        <td style="color: #4caf50; font-size: 20px; font-weight: bold; text-align: right; padding-top: 12px;">${montoPagado}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Saldo Restante:</td>
                        <td style="color: ${isPagoCompleto ? '#4caf50' : '#ff9800'}; font-size: 16px; font-weight: bold; text-align: right;">
                          ${saldoRestante}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${isPagoCompleto ? `
              <div style="background-color: #e8f5e9; border: 2px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 6px; text-align: center;">
                <p style="color: #2e7d32; margin: 0; font-size: 18px; font-weight: bold;">
                  🎉 ¡FACTURA PAGADA EN SU TOTALIDAD!
                </p>
                <p style="color: #555; margin: 10px 0 0; font-size: 14px;">
                  Su cuenta está al día. Gracias por su puntualidad.
                </p>
              </div>
              ` : `
              <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #e65100; margin: 0 0 10px; font-size: 14px; font-weight: bold;">
                  ℹ️ Pago Parcial Registrado
                </p>
                <p style="color: #555; margin: 0; font-size: 13px; line-height: 1.5;">
                  Aún queda un saldo pendiente de <strong>${saldoRestante}</strong>. Por favor, complete el pago antes del vencimiento.
                </p>
              </div>
              `}

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${pdfUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                      📊 Ver Estado de Cuenta Completo
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #999; margin: 20px 0 0; font-size: 13px; font-style: italic; text-align: center;">
                Se ha enviado una copia de este recibo a su correo electrónico.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 13px;">
                Este es un mensaje automático del sistema de gestión financiera OnlyTop
              </p>
              <p style="color: #999; margin: 0; font-size: 12px;">
                Si tiene alguna pregunta, contáctenos en <a href="mailto:finanzas@onlytop.com" style="color: #667eea; text-decoration: none;">finanzas@onlytop.com</a>
              </p>
              <p style="color: #ccc; margin: 10px 0 0; font-size: 11px;">
                © ${new Date().getFullYear()} OnlyTop. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  // ========== PLANTILLAS TEXTO PLANO ==========

  private generateProximoVencimientoText(factura: any, modelo: any, diasRestantes: number, pdfUrl: string): string {
    return `
Hola ${modelo.nombreCompleto},

Le recordamos que tiene una factura pendiente que vencerá en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}.

DETALLES DE LA FACTURA:
- Número: ${factura.numeroFactura}
- Fecha de Emisión: ${new Date(factura.fechaEmision).toLocaleDateString('es-ES')}
- Fecha de Vencimiento: ${new Date(factura.fechaVencimiento).toLocaleDateString('es-ES')}
- Monto Total: ${factura.totalFormateado}
- Saldo Pendiente: ${factura.saldoPendienteFormateado}

Para evitar cargos por mora o suspensión de servicios, por favor realice el pago antes de la fecha de vencimiento.

Ver mi estado de cuenta:
${pdfUrl}

--
OnlyTop - Sistema de Gestión Financiera
finanzas@onlytop.com
    `.trim();
  }

  private generateFacturaVencidaText(factura: any, modelo: any, diasVencido: number, pdfUrl: string): string {
    return `
FACTURA VENCIDA - ACCIÓN REQUERIDA

Estimado/a ${modelo.nombreCompleto},

Su factura está vencida desde hace ${diasVencido} día${diasVencido !== 1 ? 's' : ''}.

DETALLES:
- Factura: ${factura.numeroFactura}
- Vencimiento: ${new Date(factura.fechaVencimiento).toLocaleDateString('es-ES')}
- Días de Atraso: ${diasVencido}
- Monto Adeudado: ${factura.saldoPendienteFormateado}

Por favor, realice el pago de inmediato para evitar:
- Cargos por mora
- Suspensión de servicios
- Afectación de su historial crediticio

PAGAR AHORA: ${pdfUrl}

Si tiene dificultades para realizar el pago, contáctenos en finanzas@onlytop.com

--
OnlyTop - Departamento de Finanzas
    `.trim();
  }

  private generateMoraText(factura: any, modelo: any, diasMora: number, pdfUrl: string): string {
    return `
CUENTA EN MORA - AVISO LEGAL

Estimado/a ${modelo.nombreCompleto},

Su cuenta presenta un atraso de ${diasMora} días. Esta situación requiere su atención inmediata.

DETALLES:
- Factura: ${factura.numeroFactura}
- Vencimiento: ${new Date(factura.fechaVencimiento).toLocaleDateString('es-ES')}
- Días en Mora: ${diasMora}
- Monto Adeudado: ${factura.saldoPendienteFormateado}

CONSECUENCIAS DE LA MORA:
- Suspensión inmediata de servicios
- Aplicación de recargos por mora
- Reporte a centrales de riesgo
- Inicio de proceso legal de cobranza
- Imposibilidad de renovar contrato

PLAZO MÁXIMO PARA REGULARIZAR: 72 horas

PAGAR INMEDIATAMENTE: ${pdfUrl}

Contacto: cobranza@onlytop.com

--
OnlyTop - Departamento de Cobranza
Este comunicado tiene carácter legal.
    `.trim();
  }

  private generateConfirmacionPagoText(factura: any, modelo: any, montoPagado: string, saldoRestante: string, pdfUrl: string): string {
    const isPagoCompleto = saldoRestante === 'USD $ 0.00' || parseFloat(saldoRestante.replace(/[^\d.-]/g, '')) === 0;

    return `
CONFIRMACIÓN DE PAGO

¡Gracias ${modelo.nombreCompleto}!

Hemos recibido su pago correctamente.

DETALLES DE LA TRANSACCIÓN:
- Factura: ${factura.numeroFactura}
- Fecha de Pago: ${new Date().toLocaleDateString('es-ES')}
- Monto Pagado: ${montoPagado}
- Saldo Restante: ${saldoRestante}

${isPagoCompleto 
  ? '¡FACTURA PAGADA EN SU TOTALIDAD!\nSu cuenta está al día. Gracias por su puntualidad.' 
  : `PAGO PARCIAL REGISTRADO\nAún queda un saldo pendiente de ${saldoRestante}. Por favor, complete el pago antes del vencimiento.`
}

Ver estado de cuenta: ${pdfUrl}

--
OnlyTop - Sistema de Gestión Financiera
finanzas@onlytop.com
    `.trim();
  }
}
