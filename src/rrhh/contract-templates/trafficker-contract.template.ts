import { Injectable } from '@nestjs/common';
import { BaseContractTemplate } from './base-contract-template.js';
import { ContractTemplateData, ContractTerms } from './contract-template.interface.js';

@Injectable()
export class TraffickerContractTemplate extends BaseContractTemplate {
  readonly templateId = 'trafficker_contract';
  readonly name = 'Contrato Trafficker - Traffic';
  readonly areaCode = 'TRF';
  readonly cargoCode = 'TRF_TRF';
  readonly description = 'Plantilla de contrato para Trafficker en el área de Traffic';

  getContractTerms(data: ContractTemplateData): ContractTerms {
    // Obtener configuración de horarios del área
    const attendanceConfig = data.attendanceConfig;
    const workSchedule = this.getWorkScheduleForTraffic(attendanceConfig);

    return {
      workSchedule,
      responsibilities: [
        'Gestionar y optimizar el tráfico web de las plataformas de las modelos, incluyendo sitios web, landing pages y perfiles en redes sociales.',
        'Implementar estrategias de SEO y SEM para mejorar el posicionamiento orgánico y de pago en motores de búsqueda.',
        'Crear y ejecutar campañas publicitarias en Google Ads, Facebook Ads, Instagram Ads y otras plataformas de publicidad digital.',
        'Analizar métricas de tráfico, conversión y ROI utilizando herramientas como Google Analytics, Facebook Business Manager y otras plataformas de análisis.',
        'Optimizar la experiencia del usuario (UX) en las plataformas web para maximizar conversiones y retención.',
        'Gestionar presupuestos publicitarios y realizar seguimiento detallado de costos por adquisición (CPA) y valor de vida del cliente (LTV).',
        'Colaborar con el equipo de marketing para desarrollar estrategias de contenido que generen tráfico orgánico.',
        'Implementar técnicas de remarketing y retargeting para maximizar conversiones de usuarios que ya han visitado las plataformas.',
        'Monitorear la competencia y realizar análisis comparativos de estrategias de tráfico.',
        'Generar reportes semanales y mensuales sobre el rendimiento del tráfico y proponer mejoras continuas.',
        'Mantener actualizado el conocimiento sobre cambios en algoritmos de motores de búsqueda y plataformas publicitarias.',
        'Coordinar con desarrolladores web para implementar mejoras técnicas que optimicen el tráfico.'
      ],
      benefits: [
        'Salario competitivo según el mercado de marketing digital y tráfico web.',
        'Prestaciones de ley (cesantías, prima de servicios, vacaciones).',
        'Seguridad social completa (salud, pensión, ARL).',
        'Bonificación por cumplimiento de metas de tráfico y conversión.',
        'Acceso a herramientas profesionales de análisis y publicidad digital.',
        'Capacitación continua en nuevas técnicas de SEO, SEM y marketing digital.',
        'Ambiente de trabajo dinámico y orientado a resultados.',
        'Posibilidad de crecimiento profesional y especialización en áreas específicas.',
        'Participación en conferencias y eventos del sector digital.',
        'Equipamiento tecnológico necesario para el desempeño de funciones.'
      ],
      obligations: [
        'Cumplir con los horarios de trabajo establecidos y mantener disponibilidad para campañas que requieran monitoreo 24/7.',
        'Mantener la confidencialidad absoluta sobre estrategias de tráfico, presupuestos publicitarios y datos de rendimiento.',
        'Presentar reportes detallados sobre el rendimiento de campañas y estrategias implementadas.',
        'Responder a alertas de rendimiento y problemas técnicos en un tiempo máximo de 1 hora durante horario laboral.',
        'Mantener actualizado el conocimiento sobre cambios en plataformas publicitarias y algoritmos.',
        'Cumplir con las políticas de las plataformas publicitarias y evitar prácticas que puedan resultar en suspensiones.',
        'Asistir a todas las reuniones programadas y capacitaciones obligatorias.',
        'Colaborar efectivamente con otros miembros del equipo de traffic y marketing.',
        'Mantener registros detallados de todas las campañas y estrategias implementadas.',
        'Respetar los presupuestos asignados y justificar cualquier desviación significativa.',
        'Implementar mejores prácticas de seguridad en el manejo de datos y cuentas publicitarias.',
        'Mantener un enfoque ético en todas las estrategias de tráfico implementadas.'
      ],
      termination: {
        noticePeriod: '15 días calendario',
        conditions: [
          'El contrato podrá ser terminado por cualquiera de las partes con preaviso de 15 días calendario.',
          'En caso de incumplimiento grave de las obligaciones o mal uso de presupuestos publicitarios, la terminación podrá ser inmediata.',
          'La empresa se reserva el derecho de terminar el contrato por causas justificadas según el Código Sustantivo del Trabajo.',
          'El empleado deberá entregar todas las cuentas publicitarias, accesos y documentación al momento de la terminación.',
          'Se mantendrá la confidencialidad por un período de 2 años posteriores a la terminación del contrato.',
          'El empleado no podrá trabajar para competidores directos por un período de 6 meses posteriores a la terminación.'
        ]
      },
      confidentiality: [
        'El empleado se compromete a mantener estricta confidencialidad sobre todas las estrategias de tráfico, presupuestos publicitarios y datos de rendimiento.',
        'No podrá divulgar información sobre costos por adquisición, estrategias de SEO/SEM, o datos financieros de campañas publicitarias.',
        'Toda la información sobre algoritmos, técnicas de optimización y metodologías desarrolladas es propiedad exclusiva de OnlyTop.',
        'El empleado no podrá utilizar las estrategias o contactos de la empresa para beneficio personal o de terceros.',
        'Cualquier violación de confidencialidad será considerada causa justa para terminación inmediata del contrato.',
        'Se prohíbe la divulgación de información sobre modelos, clientes o partners comerciales de la empresa.'
      ],
      intellectualProperty: [
        'Todo el contenido, estrategias y metodologías desarrolladas durante la relación laboral son propiedad exclusiva de OnlyTop.',
        'Las técnicas de optimización, scripts de análisis y herramientas desarrolladas pertenecen a la empresa.',
        'El empleado no podrá reutilizar, modificar o distribuir las estrategias desarrolladas sin autorización expresa.',
        'Los reportes, análisis y documentación creados durante el trabajo son propiedad de la empresa.',
        'El empleado deberá entregar todos los archivos, documentos y materiales al momento de la terminación del contrato.',
        'Se prohíbe el uso de herramientas, contactos o información de la empresa para proyectos personales o de terceros.',
        'Las mejoras implementadas en las plataformas web y estrategias de tráfico son propiedad de OnlyTop.'
      ]
    };
  }

  private getWorkScheduleForTraffic(attendanceConfig?: any): ContractTerms['workSchedule'] {
    // Si hay configuración de asistencia, usarla; sino, horario fijo por defecto
    if (attendanceConfig?.fixedSchedule) {
      return {
        type: 'FIXED',
        schedule: attendanceConfig.fixedSchedule
      };
    } else if (attendanceConfig?.rotatingShifts) {
      // Filtrar turnos asignados al área de traffic
      const trafficShifts = attendanceConfig.rotatingShifts.filter((shift: any) => 
        shift.assignedAreas?.includes('TRF') || 
        shift.assignedCargos?.includes('TRF_TRF')
      );
      
      if (trafficShifts.length > 0) {
        return {
          type: 'ROTATING',
          shifts: trafficShifts
        };
      }
    }

    // Horario fijo por defecto para traffic (puede requerir monitoreo extendido)
    return {
      type: 'FIXED',
      schedule: {
        monday: { startTime: '08:00', endTime: '18:00' },
        tuesday: { startTime: '08:00', endTime: '18:00' },
        wednesday: { startTime: '08:00', endTime: '18:00' },
        thursday: { startTime: '08:00', endTime: '18:00' },
        friday: { startTime: '08:00', endTime: '18:00' },
        saturday: { startTime: '09:00', endTime: '15:00' },
        sunday: undefined,
        lunchBreakEnabled: true,
        lunchBreak: { startTime: '13:00', endTime: '14:00' }
      }
    };
  }
}
