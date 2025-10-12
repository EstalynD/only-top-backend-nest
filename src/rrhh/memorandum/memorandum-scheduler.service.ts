import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MemorandumService } from './memorandum.service.js';

/**
 * Servicio de tareas programadas para el sistema de memorandos
 * Ejecuta jobs automáticos como la expiración de memorandos vencidos
 */
@Injectable()
export class MemorandumSchedulerService {
  private readonly logger = new Logger(MemorandumSchedulerService.name);

  constructor(private readonly memorandumService: MemorandumService) {}

  /**
   * Job que expira automáticamente los memorandos vencidos
   * Se ejecuta todos los días a las 00:30 AM (hora del servidor)
   * 
   * Formato Cron: segundo minuto hora díaMes mes díaSemana
   * '0 30 0 * * *' = a las 00:30:00 todos los días
   */
  @Cron('0 30 0 * * *', {
    name: 'expire-overdue-memorandums',
    timeZone: 'America/Guayaquil', // Ajusta según tu zona horaria
  })
  async handleExpireOverdueMemorandums() {
    this.logger.log('🔄 Starting scheduled job: Expire overdue memorandums');
    
    try {
      const count = await this.memorandumService.autoExpireMemorandums();
      
      if (count > 0) {
        this.logger.warn(`⚠️ Expired ${count} overdue memorandums`);
      } else {
        this.logger.log('✅ No overdue memorandums to expire');
      }
    } catch (error) {
      this.logger.error(
        `❌ Error in scheduled job (expire overdue memorandums): ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Job opcional que envía recordatorios antes de que expire el plazo de subsanación
   * Se ejecuta todos los días a las 08:00 AM
   * 
   * NOTA: Requiere implementar sistema de notificaciones
   */
  @Cron('0 0 8 * * *', {
    name: 'remind-pending-subsanations',
    timeZone: 'America/Guayaquil',
  })
  async handleRemindPendingSubsanations() {
    this.logger.log('🔔 Starting scheduled job: Remind pending subsanations');
    
    try {
      // Obtener memorandos pendientes que expiran en 1-2 días
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const twoDaysLater = new Date(now);
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);

      // TODO: Filtrar por deadline cuando se implemente el filtro
      const urgentMemorandums = await this.memorandumService.getPendingReviewMemorandums({});

      if (urgentMemorandums.length > 0) {
        this.logger.warn(
          `⏰ Found ${urgentMemorandums.length} memorandums with upcoming deadlines (1-2 days)`
        );
        
        // TODO: Implementar envío de notificaciones/emails
        // await this.notificationService.sendDeadlineReminders(urgentMemorandums);
      } else {
        this.logger.log('✅ No urgent memorandums to remind');
      }
    } catch (error) {
      this.logger.error(
        `❌ Error in scheduled job (remind pending subsanations): ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Job opcional que genera reportes semanales de memorandos
   * Se ejecuta todos los lunes a las 09:00 AM
   */
  @Cron('0 0 9 * * 1', {
    name: 'weekly-memorandum-report',
    timeZone: 'America/Guayaquil',
  })
  async handleWeeklyMemorandumReport() {
    this.logger.log('📊 Starting scheduled job: Weekly memorandum report');
    
    try {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date();
      endOfWeek.setHours(23, 59, 59, 999);

      const stats = await this.memorandumService.getMemorandumStats({
        startDate: startOfWeek,
        endDate: endOfWeek,
      });

      this.logger.log(`📈 Weekly stats: ${JSON.stringify(stats, null, 2)}`);
      
      // TODO: Implementar envío de reporte por email a RRHH
      // await this.emailService.sendWeeklyReport(stats);
    } catch (error) {
      this.logger.error(
        `❌ Error in scheduled job (weekly report): ${error.message}`,
        error.stack
      );
    }
  }
}
