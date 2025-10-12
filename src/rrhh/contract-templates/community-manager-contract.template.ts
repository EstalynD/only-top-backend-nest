import { Injectable } from '@nestjs/common';
import { BaseContractTemplate } from './base-contract-template.js';
import { ContractTemplateData, ContractTerms } from './contract-template.interface.js';

@Injectable()
export class CommunityManagerContractTemplate extends BaseContractTemplate {
  readonly templateId = 'community_manager_contract';
  readonly name = 'Contrato Community Manager - Marketing';
  readonly areaCode = 'MKT';
  readonly cargoCode = 'MKT_CM';
  readonly description = 'Plantilla de contrato para Community Manager en el área de Marketing';

  getContractTerms(data: ContractTemplateData): ContractTerms {
    // Obtener configuración de horarios del área
    const attendanceConfig = data.attendanceConfig;
    const workSchedule = this.getWorkScheduleForMarketing(attendanceConfig);

    return {
      workSchedule,
      responsibilities: [
        'Gestionar y mantener las redes sociales de las modelos asignadas, incluyendo Instagram, Twitter, TikTok y otras plataformas relevantes.',
        'Crear y ejecutar estrategias de contenido digital que maximicen el engagement y crecimiento de seguidores.',
        'Desarrollar calendarios editoriales y coordinar la publicación de contenido multimedia (fotos, videos, stories).',
        'Interactuar con la audiencia respondiendo comentarios, mensajes directos y manteniendo una comunicación activa.',
        'Monitorear métricas de rendimiento y generar reportes semanales sobre el crecimiento y engagement de las cuentas.',
        'Colaborar con el equipo de fotografía y video para planificar sesiones de contenido.',
        'Investigar tendencias en redes sociales y proponer nuevas estrategias de marketing digital.',
        'Coordinar con influencers y otras marcas para colaboraciones y partnerships.',
        'Mantener actualizado el branding y la identidad visual de las cuentas gestionadas.',
        'Asistir a reuniones semanales del equipo de marketing y presentar resultados de gestión.'
      ],
      benefits: [
        'Salario competitivo según el mercado de marketing digital.',
        'Prestaciones de ley (cesantías, prima de servicios, vacaciones).',
        'Seguridad social completa (salud, pensión, ARL).',
        'Bonificación por cumplimiento de metas de crecimiento de seguidores.',
        'Acceso a herramientas profesionales de gestión de redes sociales.',
        'Capacitación continua en nuevas tendencias de marketing digital.',
        'Ambiente de trabajo flexible y creativo.',
        'Posibilidad de crecimiento profesional dentro de la empresa.'
      ],
      obligations: [
        'Cumplir con los horarios de trabajo establecidos y mantener puntualidad.',
        'Mantener la confidencialidad absoluta sobre la información de las modelos y estrategias de la empresa.',
        'Presentar reportes semanales detallados sobre el rendimiento de las cuentas gestionadas.',
        'Responder a mensajes y comentarios en un tiempo máximo de 2 horas durante horario laboral.',
        'Mantener un tono profesional y apropiado en todas las interacciones en redes sociales.',
        'Cumplir con las políticas de la empresa y las plataformas de redes sociales.',
        'Asistir a todas las reuniones programadas y capacitaciones obligatorias.',
        'Mantener actualizado el conocimiento sobre algoritmos y cambios en las plataformas.',
        'Colaborar efectivamente con otros miembros del equipo de marketing.',
        'Respetar los derechos de autor y propiedad intelectual en todo el contenido creado.'
      ],
      termination: {
        noticePeriod: '15 días calendario',
        conditions: [
          'El contrato podrá ser terminado por cualquiera de las partes con preaviso de 15 días calendario.',
          'En caso de incumplimiento grave de las obligaciones, la terminación podrá ser inmediata.',
          'La empresa se reserva el derecho de terminar el contrato por causas justificadas según el Código Sustantivo del Trabajo.',
          'El empleado deberá entregar todas las cuentas y accesos gestionados al momento de la terminación.',
          'Se mantendrá la confidencialidad por un período de 2 años posteriores a la terminación del contrato.'
        ]
      },
      confidentiality: [
        'El empleado se compromete a mantener estricta confidencialidad sobre toda la información de las modelos, incluyendo datos personales, estrategias comerciales y contenido privado.',
        'No podrá divulgar información sobre salarios, comisiones, estrategias de marketing o datos financieros de la empresa.',
        'Toda la información obtenida durante la relación laboral es propiedad exclusiva de OnlyTop y no podrá ser utilizada para beneficio personal o de terceros.',
        'El empleado no podrá trabajar para competidores directos durante la vigencia del contrato y por 6 meses posteriores a su terminación.',
        'Cualquier violación de confidencialidad será considerada causa justa para terminación inmediata del contrato.'
      ],
      intellectualProperty: [
        'Todo el contenido creado durante la relación laboral (textos, estrategias, calendarios editoriales) es propiedad exclusiva de OnlyTop.',
        'El empleado no podrá reutilizar, modificar o distribuir el contenido creado para la empresa sin autorización expresa.',
        'Las ideas, estrategias y metodologías desarrolladas durante el trabajo pertenecen a la empresa.',
        'El empleado deberá entregar todos los archivos, documentos y materiales creados al momento de la terminación del contrato.',
        'Se prohíbe el uso de herramientas, contactos o información de la empresa para proyectos personales o de terceros.'
      ]
    };
  }

  private getWorkScheduleForMarketing(attendanceConfig?: any): ContractTerms['workSchedule'] {
    // Si hay configuración de asistencia, usarla; sino, horario fijo por defecto
    if (attendanceConfig?.fixedSchedule) {
      return {
        type: 'FIXED',
        schedule: attendanceConfig.fixedSchedule
      };
    } else if (attendanceConfig?.rotatingShifts) {
      // Filtrar turnos asignados al área de marketing
      const marketingShifts = attendanceConfig.rotatingShifts.filter((shift: any) => 
        shift.assignedAreas?.includes('MKT') || 
        shift.assignedCargos?.includes('MKT_CM')
      );
      
      if (marketingShifts.length > 0) {
        return {
          type: 'ROTATING',
          shifts: marketingShifts
        };
      }
    }

    // Horario fijo por defecto para marketing
    return {
      type: 'FIXED',
      schedule: {
        monday: { startTime: '09:00', endTime: '18:00' },
        tuesday: { startTime: '09:00', endTime: '18:00' },
        wednesday: { startTime: '09:00', endTime: '18:00' },
        thursday: { startTime: '09:00', endTime: '18:00' },
        friday: { startTime: '09:00', endTime: '18:00' },
        saturday: { startTime: '09:00', endTime: '14:00' },
        sunday: undefined,
        lunchBreakEnabled: true,
        lunchBreak: { startTime: '13:00', endTime: '14:00' }
      }
    };
  }
}
