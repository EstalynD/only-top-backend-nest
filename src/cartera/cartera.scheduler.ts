import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CarteraService } from './cartera.service.js';

/**
 * Scheduler para procesar alertas automáticas de cartera
 * 
 * Ejecuta tareas programadas para:
 * - Activar facturas en seguimiento cuando llega la fechaCorte
 * - Enviar recordatorios de facturas próximas a vencer
 * - Enviar alertas de facturas vencidas
 * - Enviar alertas de facturas en mora
 * 
 * @author OnlyTop Development Team
 * @version 2.0.0
 * @since 2024
 */
@Injectable()
export class CarteraScheduler {
  private readonly logger = new Logger(CarteraScheduler.name);

  constructor(private readonly carteraService: CarteraService) {}

  /**
   * Activa facturas en seguimiento cuando llega su fechaCorte
   * 
   * Se ejecuta cada hora para verificar si hay facturas en SEGUIMIENTO
   * cuya fechaCorte ya llegó y cambiarlas a estado PENDIENTE.
   * 
   * Esto implementa el sistema profesional de seguimiento donde las facturas
   * se crean anticipadamente pero solo se activan en la fecha real de corte
   * (día 16, día 1, etc.)
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'activar-facturas-seguimiento',
    timeZone: 'America/Bogota',
  })
  async handleActivarFacturasSeguimiento() {
    this.logger.log('📋 Iniciando cron job: Activar facturas en seguimiento');

    try {
      const inicio = Date.now();

      // Llamar al método del servicio que activará las facturas
      const resultado = await this.carteraService.activarFacturasEnSeguimiento();

      const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

      if (resultado.activadas > 0) {
        this.logger.log(
          `✅ Cron job completado en ${duracion}s: ${resultado.activadas} facturas activadas`
        );
      } else {
        this.logger.debug(`✅ Cron job completado en ${duracion}s: Sin facturas para activar`);
      }

      return resultado;
    } catch (error: any) {
      this.logger.error(
        `❌ Error activando facturas en seguimiento: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Procesa alertas automáticas diariamente a las 8:00 AM
   * 
   * Este cron job ejecuta:
   * 1. Revisión de facturas próximas a vencer (según diasAntesAlerta1 y diasAntesAlerta2)
   * 2. Revisión de facturas vencidas ayer (marca estado y envía alerta)
   * 3. Revisión de facturas en mora (envía alerta semanal)
   * 
   * El horario es configurable según zona horaria del servidor.
   * Para producción en UTC, ajustar según timezone deseado.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM, {
    name: 'procesar-alertas-cartera',
    timeZone: 'America/Bogota', // Ajustar según timezone
  })
  async handleAlertasDiarias() {
    this.logger.log('🔔 Iniciando cron job: Alertas automáticas de cartera');

    try {
      const inicio = Date.now();

      // Ejecutar procesamiento de alertas
      const resultado = await this.carteraService.procesarAlertasAutomaticas();

      const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

      this.logger.log(
        `✅ Cron job completado en ${duracion}s: ${resultado.total} recordatorios enviados`,
      );
      this.logger.log(
        `   📊 Desglose: ${resultado.proximosVencimiento} próximos, ${resultado.vencidos} vencidos, ${resultado.mora} mora, ${resultado.errores} errores`,
      );

      // Si hay errores, loguear advertencia
      if (resultado.errores > 0) {
        this.logger.warn(
          `⚠️  Se encontraron ${resultado.errores} errores durante el procesamiento. Revisar logs.`,
        );
      }

      return resultado;
    } catch (error: any) {
      this.logger.error(`❌ Error en cron job de alertas: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Procesa marcado de facturas vencidas a medianoche
   * 
   * Este cron job se ejecuta a las 00:00 (medianoche) para:
   * - Marcar facturas como VENCIDO si la fecha de vencimiento pasó
   * 
   * Esto asegura que el estado de las facturas esté actualizado
   * antes de que el cron de las 8 AM envíe las alertas.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'marcar-facturas-vencidas',
    timeZone: 'America/Bogota',
  })
  async handleMarcarVencidas() {
    this.logger.log('🕛 Iniciando cron job: Marcar facturas vencidas');

    try {
      const inicio = Date.now();

      // Este método será llamado automáticamente por el cron de las 8 AM
      // pero lo ejecutamos a medianoche para tener estados actualizados
      const resultado = await this.carteraService.procesarAlertasAutomaticas();

      const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

      this.logger.log(`✅ Marcado de vencidas completado en ${duracion}s`);

      return resultado;
    } catch (error: any) {
      this.logger.error(`❌ Error marcando facturas vencidas: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Resumen semanal de cartera (Lunes a las 9:00 AM)
   * 
   * Genera un resumen semanal con estadísticas de:
   * - Total de facturas pendientes
   * - Total de facturas vencidas
   * - Total de facturas en mora
   * - Total por cobrar
   * 
   * (Futuro: Enviar por email a administradores)
   */
  /**
   * TODO: Implementar cuando exista obtenerEstadisticasGenerales()
   */
  // @Cron(CronExpression.MONDAY_TO_FRIDAY_AT_9AM, {
  //   name: 'resumen-semanal-cartera',
  //   timeZone: 'America/Bogota',
  // })
  // async handleResumenSemanal() {
  //   this.logger.log('📊 Generando resumen semanal de cartera (lunes a viernes)');

  //   try {
  //     // Obtener estadísticas generales
  //     const estadisticas = await this.carteraService.obtenerEstadisticasGenerales();

  //     this.logger.log('📈 Resumen de cartera:');
  //     this.logger.log(`   💰 Total por cobrar: $${estadisticas.totalPorCobrar.toFixed(2)}`);
  //     this.logger.log(`   📄 Facturas pendientes: ${estadisticas.facturasPendientes}`);
  //     this.logger.log(`   ⚠️  Facturas vencidas: ${estadisticas.facturasVencidas}`);
  //     this.logger.log(`   🚨 Facturas en mora: ${estadisticas.facturasMora}`);

  //     // TODO: Implementar envío de resumen por email a administradores
  //     // await this.emailService.enviarResumenSemanal(estadisticas);

  //     return estadisticas;
  //   } catch (error: any) {
  //     this.logger.error(`❌ Error generando resumen semanal: ${error.message}`, error.stack);
  //     throw error;
  //   }
  // }
}
