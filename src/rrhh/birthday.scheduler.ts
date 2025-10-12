import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BirthdayEmailService } from './birthday-email.service.js';
import { BirthdayTemplateEntity, BirthdayTemplateDocument } from './birthday-template.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from './empleado.schema.js';
import { EmailConfigService } from '../sistema/email-config.service.js';

/**
 * Scheduler para recordatorios automáticos de cumpleaños
 * 
 * Funcionalidades:
 * - Verificación diaria de cumpleaños próximos
 * - Envío automático de recordatorios
 * - Notificación a jefes inmediatos
 * - Logging detallado de actividades
 */
@Injectable()
export class BirthdayScheduler {
  private readonly logger = new Logger(BirthdayScheduler.name);

  constructor(
    private readonly birthdayEmailService: BirthdayEmailService,
    private readonly emailConfigService: EmailConfigService,
    @InjectModel(BirthdayTemplateEntity.name) private birthdayTemplateModel: Model<BirthdayTemplateDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
  ) {}

  /**
   * Tarea programada que se ejecuta diariamente a las 9:00 AM
   * Verifica empleados con cumpleaños próximos y envía recordatorios
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkBirthdayReminders(): Promise<void> {
    this.logger.log('🎂 Iniciando verificación de recordatorios de cumpleaños...');

    try {
      // Verificar si el servicio de email está habilitado
      const emailEnabled = await this.emailConfigService.isEnabled();
      if (!emailEnabled) {
        this.logger.warn('⚠️ Servicio de email deshabilitado. Saltando verificación de cumpleaños.');
        return;
      }

      // Obtener plantilla activa por defecto
      const template = await this.birthdayEmailService.getDefaultTemplate();
      if (!template) {
        this.logger.warn('⚠️ No hay plantilla de cumpleaños activa. Saltando verificación.');
        return;
      }

      this.logger.log(`📧 Usando plantilla: ${template.name}`);

      // Buscar empleados con cumpleaños próximos
      const empleadosConCumpleaños = await this.findEmployeesWithUpcomingBirthdays(template.daysBeforeBirthday);
      
      if (empleadosConCumpleaños.length === 0) {
        this.logger.log('✅ No hay empleados con cumpleaños próximos hoy.');
        return;
      }

      this.logger.log(`🎉 Encontrados ${empleadosConCumpleaños.length} empleado(s) con cumpleaños próximos`);

      // Procesar cada empleado
      let successCount = 0;
      let errorCount = 0;

      for (const empleado of empleadosConCumpleaños) {
        try {
          await this.processBirthdayReminder(empleado, template);
          successCount++;
        } catch (error: any) {
          this.logger.error(`❌ Error procesando cumpleaños de ${empleado.nombre} ${empleado.apellido}: ${error.message}`);
          errorCount++;
        }
      }

      this.logger.log(`✅ Verificación completada. Exitosos: ${successCount}, Errores: ${errorCount}`);

    } catch (error: any) {
      this.logger.error(`❌ Error en verificación de cumpleaños: ${error.message}`, error.stack);
    }
  }

  /**
   * Busca empleados con cumpleaños próximos según los días configurados
   */
  private async findEmployeesWithUpcomingBirthdays(daysBefore: number): Promise<EmpleadoDocument[]> {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysBefore);

    // Crear fechas de búsqueda (ignorando año)
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    const targetMonth = targetDate.getMonth();
    const targetDay = targetDate.getDate();

    const query: any = {
      estado: 'ACTIVO',
      $expr: {
        $and: [
          { $eq: [{ $month: '$fechaNacimiento' }, targetMonth + 1] }, // MongoDB months are 1-based
          { $eq: [{ $dayOfMonth: '$fechaNacimiento' }, targetDay] }
        ]
      }
    };

    return await this.empleadoModel
      .find(query)
      .populate('jefeInmediatoId', 'nombre apellido correoElectronico')
      .exec();
  }

  /**
   * Procesa el recordatorio de cumpleaños para un empleado específico
   */
  private async processBirthdayReminder(
    empleado: EmpleadoDocument,
    template: BirthdayTemplateDocument
  ): Promise<void> {
    const diasRestantes = template.daysBeforeBirthday;
    
    this.logger.log(`🎂 Procesando cumpleaños de ${empleado.nombre} ${empleado.apellido} (${diasRestantes} días)`);

    // Enviar recordatorio al empleado
    if (template.sendToEmployee) {
      const employeeResult = await this.birthdayEmailService.enviarRecordatorioCumpleañosEmpleado(
        empleado,
        template,
        diasRestantes
      );

      if (employeeResult.success) {
        this.logger.log(`✅ Recordatorio enviado a empleado: ${empleado.nombre} ${empleado.apellido}`);
      } else {
        this.logger.error(`❌ Error enviando recordatorio a empleado: ${employeeResult.error}`);
      }
    }

    // Enviar notificación al jefe inmediato si existe
    if (template.sendToBoss && empleado.jefeInmediatoId) {
      const jefe = empleado.jefeInmediatoId as any;
      
      const bossResult = await this.birthdayEmailService.enviarNotificacionCumpleañosJefe(
        empleado,
        jefe,
        template,
        diasRestantes
      );

      if (bossResult.success) {
        this.logger.log(`✅ Notificación enviada a jefe: ${jefe.nombre} ${jefe.apellido}`);
      } else {
        this.logger.error(`❌ Error enviando notificación a jefe: ${bossResult.error}`);
      }
    }
  }

  /**
   * Tarea de mantenimiento que se ejecuta semanalmente
   * Crea plantillas predeterminadas si no existen
   */
  @Cron(CronExpression.EVERY_WEEK)
  async maintenanceTask(): Promise<void> {
    this.logger.log('🔧 Ejecutando tarea de mantenimiento de cumpleaños...');

    try {
      await this.birthdayEmailService.createDefaultTemplates();
      this.logger.log('✅ Tarea de mantenimiento completada');
    } catch (error: any) {
      this.logger.error(`❌ Error en tarea de mantenimiento: ${error.message}`, error.stack);
    }
  }

  /**
   * Método manual para verificar cumpleaños (útil para testing)
   */
  async manualBirthdayCheck(daysBefore: number = 2): Promise<{
    success: boolean;
    processed: number;
    errors: number;
    details: Array<{
      empleado?: string;
      status?: string;
      error?: string;
    }>;
  }> {
    this.logger.log(`🔍 Verificación manual de cumpleaños (${daysBefore} días antes)`);

    try {
      const template = await this.birthdayEmailService.getDefaultTemplate();
      if (!template) {
        throw new Error('No hay plantilla de cumpleaños activa');
      }

      const empleados = await this.findEmployeesWithUpcomingBirthdays(daysBefore);
      const results: Array<{
        empleado: string;
        status: string;
        error?: string;
      }> = [];

      for (const empleado of empleados) {
        try {
          await this.processBirthdayReminder(empleado, template);
          results.push({
            empleado: `${empleado.nombre} ${empleado.apellido}`,
            status: 'success'
          });
        } catch (error: any) {
          results.push({
            empleado: `${empleado.nombre} ${empleado.apellido}`,
            status: 'error',
            error: error.message
          });
        }
      }

      return {
        success: true,
        processed: empleados.length,
        errors: results.filter(r => r.status === 'error').length,
        details: results
      };

    } catch (error: any) {
      this.logger.error(`❌ Error en verificación manual: ${error.message}`, error.stack);
      return {
        success: false,
        processed: 0,
        errors: 1,
        details: [{ error: error.message }]
      };
    }
  }

  /**
   * Obtiene estadísticas de cumpleaños
   */
  async getBirthdayStats(): Promise<{
    totalTemplates: number;
    activeTemplates: number;
    defaultTemplate: string | null;
    nextBirthdays: any[];
    lastExecution: Date | null;
  }> {
    try {
      const totalTemplates = await this.birthdayTemplateModel.countDocuments().exec();
      const activeTemplates = await this.birthdayTemplateModel.countDocuments({ isActive: true }).exec();
      const defaultTemplate = await this.birthdayTemplateModel.findOne({ isDefault: true, isActive: true }).exec();
      
      // Buscar próximos cumpleaños (próximos 7 días)
      const nextBirthdays = await this.findEmployeesWithUpcomingBirthdays(7);

      return {
        totalTemplates,
        activeTemplates,
        defaultTemplate: defaultTemplate?.name || null,
        nextBirthdays: nextBirthdays.map(emp => ({
          nombre: `${emp.nombre} ${emp.apellido}`,
          fecha: emp.fechaNacimiento,
          correo: emp.correoElectronico
        })),
        lastExecution: new Date() // En una implementación real, esto vendría de un log
      };

    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo estadísticas: ${error.message}`);
      throw error;
    }
  }
}
