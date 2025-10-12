import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailConfigService } from '../sistema/email-config.service.js';
import { BirthdayTemplateEntity, BirthdayTemplateDocument } from './birthday-template.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from './empleado.schema.js';

/**
 * Servicio de emails para recordatorios de cumpleaños
 * 
 * Funcionalidades:
 * - Envío de recordatorios de cumpleaños a empleados
 * - Envío de notificaciones a jefes inmediatos
 * - Plantillas HTML profesionales con datos dinámicos
 * - Configuración flexible de días de anticipación
 */
@Injectable()
export class BirthdayEmailService {
  private readonly logger = new Logger(BirthdayEmailService.name);

  constructor(
    private readonly emailConfigService: EmailConfigService,
    @InjectModel(BirthdayTemplateEntity.name) private birthdayTemplateModel: Model<BirthdayTemplateDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
  ) {}

  /**
   * Envía recordatorio de cumpleaños al empleado
   */
  async enviarRecordatorioCumpleañosEmpleado(
    empleado: EmpleadoDocument,
    template: BirthdayTemplateDocument,
    diasRestantes: number,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!template.sendToEmployee) {
        this.logger.log(`Envío a empleado deshabilitado para plantilla ${template.name}`);
        return { success: true, messageId: 'skipped' };
      }

      const subject = this.processTemplate(template.employeeTemplate.subject, empleado, diasRestantes);
      const html = this.processTemplate(template.employeeTemplate.html, empleado, diasRestantes);
      const text = this.processTemplate(template.employeeTemplate.text, empleado, diasRestantes);

      // Enviar a correo personal si existe
      if (empleado.correoPersonal) {
        const result = await this.emailConfigService.sendEmail({
          to: empleado.correoPersonal,
          subject,
          html,
          text,
        });

        this.logger.log(`✅ Recordatorio cumpleaños enviado a ${empleado.correoPersonal} - ${empleado.nombre} ${empleado.apellido}`);
      }

      // Enviar a correo corporativo si existe y es diferente al personal
      if (empleado.correoCorporativo && empleado.correoCorporativo !== empleado.correoPersonal) {
        const result = await this.emailConfigService.sendEmail({
          to: empleado.correoCorporativo,
          subject,
          html,
          text,
        });

        this.logger.log(`✅ Recordatorio cumpleaños enviado a ${empleado.correoCorporativo} - ${empleado.nombre} ${empleado.apellido}`);
      }

      // Actualizar contador de uso de la plantilla
      await this.updateTemplateUsage(template._id.toString());

      return {
        success: true,
        messageId: 'sent',
      };
    } catch (error: any) {
      this.logger.error(`Error enviando recordatorio cumpleaños empleado: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Envía notificación de cumpleaños al jefe inmediato
   */
  async enviarNotificacionCumpleañosJefe(
    empleado: EmpleadoDocument,
    jefe: EmpleadoDocument,
    template: BirthdayTemplateDocument,
    diasRestantes: number,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!template.sendToBoss) {
        this.logger.log(`Envío a jefe deshabilitado para plantilla ${template.name}`);
        return { success: true, messageId: 'skipped' };
      }

      const subject = this.processTemplate(template.bossTemplate.subject, empleado, diasRestantes, jefe);
      const html = this.processTemplate(template.bossTemplate.html, empleado, diasRestantes, jefe);
      const text = this.processTemplate(template.bossTemplate.text, empleado, diasRestantes, jefe);

      const result = await this.emailConfigService.sendEmail({
        to: jefe.correoElectronico,
        subject,
        html,
        text,
      });

      this.logger.log(`✅ Notificación cumpleaños enviada a jefe ${jefe.correoElectronico} - Empleado: ${empleado.nombre} ${empleado.apellido}`);

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error: any) {
      this.logger.error(`Error enviando notificación cumpleaños jefe: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Procesa una plantilla reemplazando variables
   */
  private processTemplate(
    template: string,
    empleado: EmpleadoDocument,
    diasRestantes: number,
    jefe?: EmpleadoDocument
  ): string {
    const fechaCumpleaños = new Date(empleado.fechaNacimiento);
    const fechaActual = new Date();
    const edad = fechaActual.getFullYear() - fechaCumpleaños.getFullYear();
    
    // Ajustar edad si aún no ha cumplido años este año
    if (fechaActual.getMonth() < fechaCumpleaños.getMonth() || 
        (fechaActual.getMonth() === fechaCumpleaños.getMonth() && fechaActual.getDate() < fechaCumpleaños.getDate())) {
      // No ha cumplido años aún
    }

    const variables = {
      // Empleado
      '{{empleado.nombre}}': empleado.nombre,
      '{{empleado.apellido}}': empleado.apellido,
      '{{empleado.nombreCompleto}}': `${empleado.nombre} ${empleado.apellido}`,
      '{{empleado.correoElectronico}}': empleado.correoElectronico,
      '{{empleado.correoPersonal}}': empleado.correoPersonal || '',
      '{{empleado.correoCorporativo}}': empleado.correoCorporativo || '',
      '{{empleado.telefono}}': empleado.telefono,
      '{{empleado.ciudad}}': empleado.ciudad,
      '{{empleado.pais}}': empleado.pais,
      
      // Fecha de cumpleaños
      '{{cumpleaños.fecha}}': fechaCumpleaños.toLocaleDateString('es-ES'),
      '{{cumpleaños.dia}}': fechaCumpleaños.getDate().toString(),
      '{{cumpleaños.mes}}': fechaCumpleaños.toLocaleDateString('es-ES', { month: 'long' }),
      '{{cumpleaños.mesCorto}}': fechaCumpleaños.toLocaleDateString('es-ES', { month: 'short' }),
      '{{cumpleaños.edad}}': edad.toString(),
      '{{cumpleaños.diasRestantes}}': diasRestantes.toString(),
      
      // Jefe (si está disponible)
      '{{jefe.nombre}}': jefe ? jefe.nombre : '',
      '{{jefe.apellido}}': jefe ? jefe.apellido : '',
      '{{jefe.nombreCompleto}}': jefe ? `${jefe.nombre} ${jefe.apellido}` : '',
      '{{jefe.correoElectronico}}': jefe ? jefe.correoElectronico : '',
      
      // Fechas
      '{{fecha.actual}}': new Date().toLocaleDateString('es-ES'),
      '{{fecha.actualCompleta}}': new Date().toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      
      // Sistema
      '{{sistema.nombre}}': 'OnlyTop',
      '{{sistema.ano}}': new Date().getFullYear().toString(),
    };

    let processedTemplate = template;
    for (const [variable, valor] of Object.entries(variables)) {
      processedTemplate = processedTemplate.replace(new RegExp(variable, 'g'), valor);
    }

    return processedTemplate;
  }

  /**
   * Actualiza el contador de uso de una plantilla
   */
  private async updateTemplateUsage(templateId: string): Promise<void> {
    try {
      await this.birthdayTemplateModel.findByIdAndUpdate(
        templateId,
        {
          $inc: { usageCount: 1 },
          $set: { lastUsed: new Date() }
        }
      ).exec();
    } catch (error: any) {
      this.logger.error(`Error actualizando uso de plantilla: ${error.message}`);
    }
  }

  /**
   * Obtiene la plantilla activa por defecto
   */
  async getDefaultTemplate(): Promise<BirthdayTemplateDocument | null> {
    try {
      return await this.birthdayTemplateModel
        .findOne({ isActive: true, isDefault: true })
        .exec();
    } catch (error: any) {
      this.logger.error(`Error obteniendo plantilla por defecto: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtiene todas las plantillas activas
   */
  async getActiveTemplates(): Promise<BirthdayTemplateDocument[]> {
    try {
      return await this.birthdayTemplateModel
        .find({ isActive: true })
        .sort({ isDefault: -1, name: 1 })
        .exec();
    } catch (error: any) {
      this.logger.error(`Error obteniendo plantillas activas: ${error.message}`);
      return [];
    }
  }

  /**
   * Crea las plantillas predeterminadas si no existen
   */
  async createDefaultTemplates(): Promise<void> {
    try {
      const existingTemplates = await this.birthdayTemplateModel.countDocuments().exec();
      
      if (existingTemplates > 0) {
        this.logger.log('Las plantillas predeterminadas ya existen');
        return;
      }

      // Plantilla Corporativa
      const corporateTemplate = new this.birthdayTemplateModel({
        name: 'Plantilla Corporativa',
        description: 'Diseño profesional con colores corporativos',
        type: 'CORPORATE',
        isActive: true,
        isDefault: true,
        daysBeforeBirthday: 2,
        sendToEmployee: true,
        sendToBoss: true,
        employeeTemplate: {
          subject: '🎂 ¡Feliz Cumpleaños {{empleado.nombre}}!',
          html: this.getCorporateEmployeeTemplate(),
          text: this.getCorporateEmployeeTextTemplate()
        },
        bossTemplate: {
          subject: '📅 Recordatorio: Cumpleaños de {{empleado.nombreCompleto}}',
          html: this.getCorporateBossTemplate(),
          text: this.getCorporateBossTextTemplate()
        }
      });

      // Plantilla Festiva
      const festiveTemplate = new this.birthdayTemplateModel({
        name: 'Plantilla Festiva',
        description: 'Diseño más colorido y celebrativo',
        type: 'FESTIVE',
        isActive: true,
        isDefault: false,
        daysBeforeBirthday: 2,
        sendToEmployee: true,
        sendToBoss: true,
        employeeTemplate: {
          subject: '🎉 ¡Feliz Cumpleaños {{empleado.nombre}}! ¡Que tengas un día espectacular!',
          html: this.getFestiveEmployeeTemplate(),
          text: this.getFestiveEmployeeTextTemplate()
        },
        bossTemplate: {
          subject: '🎂 ¡Cumpleaños Próximo! {{empleado.nombreCompleto}} cumple años en {{cumpleaños.diasRestantes}} días',
          html: this.getFestiveBossTemplate(),
          text: this.getFestiveBossTextTemplate()
        }
      });

      await Promise.all([
        corporateTemplate.save(),
        festiveTemplate.save()
      ]);

      this.logger.log('✅ Plantillas predeterminadas creadas exitosamente');
    } catch (error: any) {
      this.logger.error(`Error creando plantillas predeterminadas: ${error.message}`, error.stack);
    }
  }

  // ========== PLANTILLAS HTML CORPORATIVAS ==========

  private getCorporateEmployeeTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feliz Cumpleaños</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1c41d9 0%, #1c3fb8 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">{{sistema.nombre}}</h1>
              <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Sistema de Gestión de RRHH</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="color: #333; margin: 0 0 20px; font-size: 22px;">¡Feliz Cumpleaños {{empleado.nombre}}!</h2>
              
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px; font-size: 15px;">
                ¡Esperamos que tengas un día maravilloso lleno de alegría y celebraciones!
              </p>

              <!-- Birthday Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">Fecha:</td>
                        <td style="color: #333; font-size: 14px; font-weight: bold; text-align: right;">{{cumpleaños.fecha}}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Edad:</td>
                        <td style="color: #1c41d9; font-size: 16px; font-weight: bold; text-align: right;">{{cumpleaños.edad}} años</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Ciudad:</td>
                        <td style="color: #333; font-size: 14px; text-align: right;">{{empleado.ciudad}}, {{empleado.pais}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #555; line-height: 1.6; margin: 20px 0; font-size: 15px;">
                Que este nuevo año de vida esté lleno de éxitos, alegría y momentos inolvidables. 
                ¡Disfruta tu día especial!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 13px;">
                Este es un mensaje automático del sistema de gestión de RRHH {{sistema.nombre}}
              </p>
              <p style="color: #ccc; margin: 0; font-size: 11px;">
                © {{sistema.ano}} {{sistema.nombre}}. Todos los derechos reservados.
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

  private getCorporateBossTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recordatorio de Cumpleaños</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1c41d9 0%, #1c3fb8 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">{{sistema.nombre}}</h1>
              <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Sistema de Gestión de RRHH</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="color: #333; margin: 0 0 20px; font-size: 22px;">Recordatorio de Cumpleaños</h2>
              
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px; font-size: 15px;">
                Le recordamos que el empleado <strong>{{empleado.nombreCompleto}}</strong> cumple años en {{cumpleaños.diasRestantes}} día{{cumpleaños.diasRestantes !== '1' ? 's' : ''}} ({{cumpleaños.fecha}}).
              </p>

              <!-- Employee Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">Nombre:</td>
                        <td style="color: #333; font-size: 14px; font-weight: bold; text-align: right;">{{empleado.nombreCompleto}}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Correo:</td>
                        <td style="color: #333; font-size: 14px; text-align: right;">{{empleado.correoElectronico}}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Teléfono:</td>
                        <td style="color: #333; font-size: 14px; text-align: right;">{{empleado.telefono}}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Fecha de Cumpleaños:</td>
                        <td style="color: #1c41d9; font-size: 16px; font-weight: bold; text-align: right;">{{cumpleaños.fecha}}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Edad:</td>
                        <td style="color: #1c41d9; font-size: 16px; font-weight: bold; text-align: right;">{{cumpleaños.edad}} años</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Suggestion Box -->
              <div style="background-color: #e3f2fd; border-left: 4px solid #1c41d9; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #1565c0; margin: 0; font-size: 14px;">
                  💡 <strong>Sugerencia:</strong> Considere organizar una pequeña celebración o enviar un mensaje personal de felicitación.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 13px;">
                Este es un mensaje automático del sistema de gestión de RRHH {{sistema.nombre}}
              </p>
              <p style="color: #ccc; margin: 0; font-size: 11px;">
                © {{sistema.ano}} {{sistema.nombre}}. Todos los derechos reservados.
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

  private getCorporateEmployeeTextTemplate(): string {
    return `
¡Feliz Cumpleaños {{empleado.nombre}}!

Esperamos que tengas un día maravilloso lleno de alegría y celebraciones.

DETALLES:
- Fecha: {{cumpleaños.fecha}}
- Edad: {{cumpleaños.edad}} años
- Ciudad: {{empleado.ciudad}}, {{empleado.pais}}

Que este nuevo año de vida esté lleno de éxitos, alegría y momentos inolvidables.
¡Disfruta tu día especial!

--
{{sistema.nombre}} - Sistema de Gestión de RRHH
© {{sistema.ano}} {{sistema.nombre}}. Todos los derechos reservados.
    `.trim();
  }

  private getCorporateBossTextTemplate(): string {
    return `
Recordatorio de Cumpleaños

Le recordamos que el empleado {{empleado.nombreCompleto}} cumple años en {{cumpleaños.diasRestantes}} día{{cumpleaños.diasRestantes !== '1' ? 's' : ''}} ({{cumpleaños.fecha}}).

INFORMACIÓN DEL EMPLEADO:
- Nombre: {{empleado.nombreCompleto}}
- Correo: {{empleado.correoElectronico}}
- Teléfono: {{empleado.telefono}}
- Fecha de Cumpleaños: {{cumpleaños.fecha}}
- Edad: {{cumpleaños.edad}} años

SUGERENCIA: Considere organizar una pequeña celebración o enviar un mensaje personal de felicitación.

--
{{sistema.nombre}} - Sistema de Gestión de RRHH
© {{sistema.ano}} {{sistema.nombre}}. Todos los derechos reservados.
    `.trim();
  }

  // ========== PLANTILLAS FESTIVAS ==========

  private getFestiveEmployeeTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feliz Cumpleaños</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 {{sistema.nombre}}</h1>
              <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">¡Celebrando contigo!</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="color: #333; margin: 0 0 20px; font-size: 22px;">🎈 ¡Feliz Cumpleaños {{empleado.nombre}}!</h2>
              
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px; font-size: 15px;">
                ¡Que este nuevo año de vida esté lleno de éxitos, alegría y momentos inolvidables!
              </p>

              <!-- Birthday Celebration Card -->
              <div style="background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%); padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">🎂</div>
                <h3 style="color: #2d3436; margin: 0 0 10px; font-size: 18px;">¡Cumples {{cumpleaños.edad}} años!</h3>
                <p style="color: #636e72; margin: 0; font-size: 14px;">Que sea un día espectacular</p>
              </div>

              <p style="color: #555; line-height: 1.6; margin: 20px 0; font-size: 15px;">
                ¡Disfruta cada momento de tu día especial! Que la alegría y la felicidad te acompañen siempre.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 13px;">
                Este es un mensaje automático del sistema de gestión de RRHH {{sistema.nombre}}
              </p>
              <p style="color: #ccc; margin: 0; font-size: 11px;">
                © {{sistema.ano}} {{sistema.nombre}}. Todos los derechos reservados.
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

  private getFestiveBossTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cumpleaños Próximo</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎂 {{sistema.nombre}}</h1>
              <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; opacity: 0.9;">¡Celebrando juntos!</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <h2 style="color: #333; margin: 0 0 20px; font-size: 22px;">🎂 ¡Cumpleaños Próximo!</h2>
              
              <p style="color: #555; line-height: 1.6; margin: 0 0 20px; font-size: 15px;">
                ¡Se acerca una fecha muy especial! <strong>{{empleado.nombreCompleto}}</strong> cumple años en {{cumpleaños.diasRestantes}} día{{cumpleaños.diasRestantes !== '1' ? 's' : ''}}.
              </p>

              <!-- Birthday Info Card -->
              <div style="background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%); padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">🎂</div>
                <h3 style="color: #2d3436; margin: 0 0 10px; font-size: 18px;">{{cumpleaños.fecha}}</h3>
                <p style="color: #636e72; margin: 0; font-size: 14px;">Fecha de cumpleaños</p>
              </div>

              <!-- Employee Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">Empleado:</td>
                        <td style="color: #333; font-size: 14px; font-weight: bold; text-align: right;">{{empleado.nombreCompleto}}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Edad:</td>
                        <td style="color: #ff6b6b; font-size: 16px; font-weight: bold; text-align: right;">{{cumpleaños.edad}} años</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Contacto:</td>
                        <td style="color: #333; font-size: 14px; text-align: right;">{{empleado.correoElectronico}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Suggestion Box -->
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  🎁 <strong>Idea:</strong> ¿Por qué no organizar una sorpresa o enviar un mensaje de felicitación?
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 13px;">
                Este es un mensaje automático del sistema de gestión de RRHH {{sistema.nombre}}
              </p>
              <p style="color: #ccc; margin: 0; font-size: 11px;">
                © {{sistema.ano}} {{sistema.nombre}}. Todos los derechos reservados.
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

  private getFestiveEmployeeTextTemplate(): string {
    return `
🎈 ¡Feliz Cumpleaños {{empleado.nombre}}!

¡Que este nuevo año de vida esté lleno de éxitos, alegría y momentos inolvidables!

🎂 ¡Cumples {{cumpleaños.edad}} años!
Que sea un día espectacular

¡Disfruta cada momento de tu día especial! Que la alegría y la felicidad te acompañen siempre.

--
{{sistema.nombre}} - Sistema de Gestión de RRHH
© {{sistema.ano}} {{sistema.nombre}}. Todos los derechos reservados.
    `.trim();
  }

  private getFestiveBossTextTemplate(): string {
    return `
🎂 ¡Cumpleaños Próximo!

¡Se acerca una fecha muy especial! {{empleado.nombreCompleto}} cumple años en {{cumpleaños.diasRestantes}} día{{cumpleaños.diasRestantes !== '1' ? 's' : ''}}.

🎂 {{cumpleaños.fecha}}
Fecha de cumpleaños

INFORMACIÓN:
- Empleado: {{empleado.nombreCompleto}}
- Edad: {{cumpleaños.edad}} años
- Contacto: {{empleado.correoElectronico}}

🎁 IDEA: ¿Por qué no organizar una sorpresa o enviar un mensaje de felicitación?

--
{{sistema.nombre}} - Sistema de Gestión de RRHH
© {{sistema.ano}} {{sistema.nombre}}. Todos los derechos reservados.
    `.trim();
  }
}
