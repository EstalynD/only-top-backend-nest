import { Injectable } from '@nestjs/common';
import { BaseContractTemplate } from './base-contract-template.js';
import { ContractTemplateData, ContractTerms } from './contract-template.interface.js';

@Injectable()
export class ChatterContractTemplate extends BaseContractTemplate {
  readonly templateId = 'chatter_contract';
  readonly name = 'Contrato Chatter - Sales';
  readonly areaCode = 'SLS';
  readonly cargoCode = 'SLS_CHT';
  readonly description = 'Plantilla de contrato para Chatter en el área de Sales';

  getContractTerms(data: ContractTemplateData): ContractTerms {
    // Obtener configuración de horarios del área
    const attendanceConfig = data.attendanceConfig;
    const workSchedule = this.getWorkScheduleForSales(attendanceConfig);

    return {
      workSchedule,
      responsibilities: [
        'Gestionar conversaciones con clientes potenciales y existentes a través de plataformas de chat en vivo y mensajería.',
        'Proporcionar información detallada sobre servicios, precios y disponibilidad de las modelos asignadas.',
        'Convertir leads en ventas mediante técnicas de persuasión y cierre efectivas.',
        'Mantener un tono profesional, amigable y persuasivo en todas las interacciones con clientes.',
        'Responder a consultas sobre servicios, horarios, precios y políticas de la empresa de manera oportuna.',
        'Gestionar reservas y citas, coordinando con el equipo de operaciones para confirmar disponibilidad.',
        'Manejar objeciones de clientes y proporcionar soluciones efectivas para cerrar ventas.',
        'Mantener registros detallados de todas las conversaciones y seguimientos con clientes.',
        'Colaborar con el equipo de marketing para identificar oportunidades de mejora en el proceso de ventas.',
        'Alcanzar y superar metas mensuales de ventas y conversión establecidas por la empresa.',
        'Mantener actualizado el conocimiento sobre servicios, precios y promociones vigentes.',
        'Proporcionar soporte post-venta y gestionar reclamaciones o consultas de clientes existentes.',
        'Participar en capacitaciones sobre técnicas de ventas y productos/servicios de la empresa.',
        'Mantener la confidencialidad absoluta sobre información de clientes y modelos.'
      ],
      benefits: [
        'Salario base competitivo más comisiones por ventas realizadas.',
        'Prestaciones de ley (cesantías, prima de servicios, vacaciones).',
        'Seguridad social completa (salud, pensión, ARL).',
        'Sistema de comisiones atractivo basado en metas y rendimiento.',
        'Bonificaciones por superación de objetivos mensuales y trimestrales.',
        'Capacitación continua en técnicas de ventas y productos.',
        'Ambiente de trabajo dinámico y orientado a resultados.',
        'Posibilidad de crecimiento profesional dentro del área comercial.',
        'Herramientas tecnológicas necesarias para el desempeño de funciones.',
        'Programa de incentivos y reconocimientos por excelencia en ventas.',
        'Flexibilidad horaria según necesidades del negocio.',
        'Oportunidades de desarrollo de carrera en gestión comercial.'
      ],
      obligations: [
        'Cumplir con los horarios de trabajo establecidos y mantener disponibilidad durante los turnos asignados.',
        'Mantener la confidencialidad absoluta sobre información de clientes, modelos y estrategias comerciales.',
        'Alcanzar las metas de ventas mensuales establecidas por la empresa.',
        'Responder a mensajes de clientes en un tiempo máximo de 2 minutos durante horario laboral.',
        'Mantener un tono profesional y respetuoso en todas las interacciones con clientes.',
        'Cumplir con las políticas de la empresa y las regulaciones aplicables al sector.',
        'Asistir a todas las reuniones programadas y capacitaciones obligatorias.',
        'Mantener registros precisos y actualizados de todas las interacciones comerciales.',
        'Colaborar efectivamente con otros miembros del equipo de ventas y operaciones.',
        'Respetar los procedimientos establecidos para el manejo de pagos y transacciones.',
        'Mantener actualizado el conocimiento sobre servicios, precios y promociones.',
        'Reportar cualquier situación irregular o problema con clientes de inmediato.',
        'Cumplir con los estándares de calidad en el servicio al cliente establecidos por la empresa.',
        'Mantener la integridad y ética profesional en todas las actividades comerciales.'
      ],
      termination: {
        noticePeriod: '15 días calendario',
        conditions: [
          'El contrato podrá ser terminado por cualquiera de las partes con preaviso de 15 días calendario.',
          'En caso de incumplimiento grave de las obligaciones o violación de confidencialidad, la terminación podrá ser inmediata.',
          'La empresa se reserva el derecho de terminar el contrato por causas justificadas según el Código Sustantivo del Trabajo.',
          'El empleado deberá entregar todas las cuentas, accesos y documentación al momento de la terminación.',
          'Se mantendrá la confidencialidad por un período de 2 años posteriores a la terminación del contrato.',
          'El empleado no podrá trabajar para competidores directos por un período de 6 meses posteriores a la terminación.',
          'Se prohíbe el uso de información de clientes o contactos de la empresa para beneficio personal o de terceros.'
        ]
      },
      confidentiality: [
        'El empleado se compromete a mantener estricta confidencialidad sobre toda la información de clientes, incluyendo datos personales, preferencias y historial de servicios.',
        'No podrá divulgar información sobre precios, comisiones, estrategias comerciales o datos financieros de la empresa.',
        'Toda la información sobre clientes, modelos y operaciones comerciales es propiedad exclusiva de OnlyTop.',
        'El empleado no podrá utilizar la información de clientes o contactos para beneficio personal o de terceros.',
        'Cualquier violación de confidencialidad será considerada causa justa para terminación inmediata del contrato.',
        'Se prohíbe la divulgación de información sobre modelos, servicios específicos o estrategias comerciales.',
        'El empleado deberá mantener la confidencialidad incluso después de la terminación del contrato por un período de 2 años.'
      ],
      intellectualProperty: [
        'Todo el contenido, scripts de ventas y metodologías desarrolladas durante la relación laboral son propiedad exclusiva de OnlyTop.',
        'Las técnicas de ventas, argumentarios y procesos comerciales desarrollados pertenecen a la empresa.',
        'El empleado no podrá reutilizar, modificar o distribuir las estrategias comerciales sin autorización expresa.',
        'Los registros de conversaciones, análisis de clientes y documentación comercial son propiedad de la empresa.',
        'El empleado deberá entregar todos los archivos, documentos y materiales al momento de la terminación del contrato.',
        'Se prohíbe el uso de herramientas, contactos o información de la empresa para proyectos personales o de terceros.',
        'Las mejoras implementadas en procesos comerciales y técnicas de ventas son propiedad de OnlyTop.',
        'El empleado no podrá utilizar la base de datos de clientes o información comercial para competir con la empresa.'
      ]
    };
  }

  private getWorkScheduleForSales(attendanceConfig?: any): ContractTerms['workSchedule'] {
    // Si hay configuración de asistencia, usarla; sino, horario fijo por defecto
    if (attendanceConfig?.fixedSchedule) {
      return {
        type: 'FIXED',
        schedule: attendanceConfig.fixedSchedule
      };
    } else if (attendanceConfig?.rotatingShifts) {
      // Filtrar turnos asignados al área de sales
      const salesShifts = attendanceConfig.rotatingShifts.filter((shift: any) => 
        shift.assignedAreas?.includes('SLS') || 
        shift.assignedCargos?.includes('SLS_CHT')
      );
      
      if (salesShifts.length > 0) {
        return {
          type: 'ROTATING',
          shifts: salesShifts
        };
      }
    }

    // Horario fijo por defecto para sales (puede requerir horarios extendidos)
    return {
      type: 'FIXED',
      schedule: {
        monday: { startTime: '09:00', endTime: '21:00' },
        tuesday: { startTime: '09:00', endTime: '21:00' },
        wednesday: { startTime: '09:00', endTime: '21:00' },
        thursday: { startTime: '09:00', endTime: '21:00' },
        friday: { startTime: '09:00', endTime: '21:00' },
        saturday: { startTime: '10:00', endTime: '20:00' },
        sunday: { startTime: '10:00', endTime: '18:00' },
        lunchBreakEnabled: true,
        lunchBreak: { startTime: '13:00', endTime: '14:00' }
      }
    };
  }
}
