import { Injectable } from '@nestjs/common';
import { BaseContractTemplate } from './base-contract-template.js';
import { ContractTemplateData, ContractTerms } from './contract-template.interface.js';

@Injectable()
export class ManagerContractTemplate extends BaseContractTemplate {
  readonly templateId = 'manager_contract';
  readonly name = 'Contrato Manager - Administrativo';
  readonly areaCode = 'ADM';
  readonly cargoCode = 'ADM_MGR';
  readonly description = 'Plantilla de contrato para Manager en el área Administrativa';

  getContractTerms(data: ContractTemplateData): ContractTerms {
    // Obtener configuración de horarios del área
    const attendanceConfig = data.attendanceConfig;
    const workSchedule = this.getWorkScheduleForAdministrative(attendanceConfig);

    return {
      workSchedule,
      responsibilities: [
        'Supervisar y coordinar las operaciones diarias de la empresa, asegurando el cumplimiento de objetivos y metas establecidas.',
        'Gestionar y liderar equipos de trabajo, proporcionando orientación, capacitación y evaluación del desempeño del personal.',
        'Desarrollar e implementar estrategias operativas y administrativas para optimizar la eficiencia y productividad de la empresa.',
        'Coordinar con diferentes áreas (Marketing, Traffic, Sales) para asegurar la integración efectiva de procesos y objetivos.',
        'Gestionar recursos humanos, incluyendo reclutamiento, selección, capacitación y desarrollo del personal.',
        'Supervisar el cumplimiento de políticas internas, procedimientos operativos y regulaciones legales aplicables.',
        'Mantener comunicación efectiva con la dirección ejecutiva, reportando resultados, problemas y propuestas de mejora.',
        'Gestionar presupuestos operativos y controlar costos para asegurar la rentabilidad de las operaciones.',
        'Implementar sistemas de control y seguimiento para monitorear el rendimiento de diferentes áreas de la empresa.',
        'Resolver conflictos internos y externos, manteniendo un ambiente de trabajo positivo y productivo.',
        'Desarrollar y mantener relaciones con proveedores, clientes y socios comerciales.',
        'Participar en la planificación estratégica de la empresa y en la toma de decisiones importantes.',
        'Asegurar el cumplimiento de estándares de calidad en todos los procesos y servicios de la empresa.',
        'Mantener actualizado el conocimiento sobre regulaciones laborales, fiscales y comerciales aplicables.'
      ],
      benefits: [
        'Salario competitivo según el mercado de gestión y administración empresarial.',
        'Prestaciones de ley (cesantías, prima de servicios, vacaciones).',
        'Seguridad social completa (salud, pensión, ARL).',
        'Bonificación por cumplimiento de objetivos y metas de la empresa.',
        'Acceso a herramientas de gestión y software administrativo profesional.',
        'Capacitación continua en liderazgo, gestión empresarial y nuevas tecnologías.',
        'Ambiente de trabajo profesional y orientado al crecimiento.',
        'Posibilidad de crecimiento profesional y desarrollo de carrera ejecutiva.',
        'Participación en decisiones estratégicas de la empresa.',
        'Equipamiento tecnológico y recursos necesarios para el desempeño de funciones.',
        'Programa de incentivos y reconocimientos por excelencia en gestión.',
        'Oportunidades de networking y participación en eventos del sector.',
        'Flexibilidad en horarios según necesidades operativas de la empresa.'
      ],
      obligations: [
        'Cumplir con los horarios de trabajo establecidos y mantener disponibilidad para situaciones que requieran atención inmediata.',
        'Mantener la confidencialidad absoluta sobre información estratégica, financiera y operativa de la empresa.',
        'Liderar con integridad, ética y profesionalismo, siendo ejemplo para el resto del personal.',
        'Asegurar el cumplimiento de objetivos y metas establecidas por la dirección ejecutiva.',
        'Mantener un ambiente de trabajo positivo, respetuoso y productivo para todos los empleados.',
        'Cumplir con todas las regulaciones laborales, fiscales y comerciales aplicables.',
        'Asistir a todas las reuniones ejecutivas y presentar reportes detallados sobre el rendimiento de la empresa.',
        'Mantener registros precisos y actualizados de todas las operaciones y decisiones administrativas.',
        'Colaborar efectivamente con otros gerentes y la dirección ejecutiva.',
        'Implementar y hacer cumplir las políticas y procedimientos establecidos por la empresa.',
        'Mantener actualizado el conocimiento sobre mejores prácticas de gestión empresarial.',
        'Reportar cualquier situación irregular o problema operativo de inmediato a la dirección.',
        'Asegurar la protección de los activos y recursos de la empresa.',
        'Mantener relaciones profesionales y éticas con empleados, clientes y proveedores.',
        'Participar activamente en la planificación estratégica y toma de decisiones importantes.'
      ],
      termination: {
        noticePeriod: '30 días calendario',
        conditions: [
          'El contrato podrá ser terminado por cualquiera de las partes con preaviso de 30 días calendario.',
          'En caso de incumplimiento grave de las obligaciones o violación de confidencialidad, la terminación podrá ser inmediata.',
          'La empresa se reserva el derecho de terminar el contrato por causas justificadas según el Código Sustantivo del Trabajo.',
          'El empleado deberá entregar todas las cuentas, accesos, documentación y activos al momento de la terminación.',
          'Se mantendrá la confidencialidad por un período de 3 años posteriores a la terminación del contrato.',
          'El empleado no podrá trabajar para competidores directos por un período de 12 meses posteriores a la terminación.',
          'Se prohíbe el uso de información estratégica, contactos o recursos de la empresa para beneficio personal o de terceros.',
          'El empleado deberá transferir todos los conocimientos y procesos desarrollados durante su gestión.'
        ]
      },
      confidentiality: [
        'El empleado se compromete a mantener estricta confidencialidad sobre toda la información estratégica, financiera y operativa de la empresa.',
        'No podrá divulgar información sobre estrategias comerciales, datos financieros, planes de expansión o información de clientes.',
        'Toda la información sobre operaciones, procesos, metodologías y estrategias es propiedad exclusiva de OnlyTop.',
        'El empleado no podrá utilizar la información estratégica o contactos para beneficio personal o de terceros.',
        'Cualquier violación de confidencialidad será considerada causa justa para terminación inmediata del contrato.',
        'Se prohíbe la divulgación de información sobre modelos, clientes, proveedores o socios comerciales.',
        'El empleado deberá mantener la confidencialidad incluso después de la terminación del contrato por un período de 3 años.',
        'Se incluye la protección de información sobre tecnología, procesos internos y ventajas competitivas de la empresa.'
      ],
      intellectualProperty: [
        'Todo el contenido, procesos, metodologías y estrategias desarrolladas durante la relación laboral son propiedad exclusiva de OnlyTop.',
        'Las mejoras operativas, sistemas de gestión y procesos administrativos desarrollados pertenecen a la empresa.',
        'El empleado no podrá reutilizar, modificar o distribuir las metodologías de gestión sin autorización expresa.',
        'Los reportes, análisis, planes estratégicos y documentación administrativa son propiedad de la empresa.',
        'El empleado deberá entregar todos los archivos, documentos, bases de datos y materiales al momento de la terminación del contrato.',
        'Se prohíbe el uso de herramientas, contactos, información o recursos de la empresa para proyectos personales o de terceros.',
        'Las mejoras implementadas en procesos operativos, sistemas de gestión y metodologías administrativas son propiedad de OnlyTop.',
        'El empleado no podrá utilizar la información estratégica, contactos comerciales o metodologías para competir con la empresa.',
        'Se incluye la protección de know-how, procesos internos y ventajas competitivas desarrolladas durante la gestión.'
      ]
    };
  }

  private getWorkScheduleForAdministrative(attendanceConfig?: any): ContractTerms['workSchedule'] {
    // Si hay configuración de asistencia, usarla; sino, horario fijo por defecto
    if (attendanceConfig?.fixedSchedule) {
      return {
        type: 'FIXED',
        schedule: attendanceConfig.fixedSchedule
      };
    } else if (attendanceConfig?.rotatingShifts) {
      // Filtrar turnos asignados al área administrativa
      const adminShifts = attendanceConfig.rotatingShifts.filter((shift: any) => 
        shift.assignedAreas?.includes('ADM') || 
        shift.assignedCargos?.includes('ADM_MGR')
      );
      
      if (adminShifts.length > 0) {
        return {
          type: 'ROTATING',
          shifts: adminShifts
        };
      }
    }

    // Horario fijo por defecto para administración (horario ejecutivo)
    return {
      type: 'FIXED',
      schedule: {
        monday: { startTime: '08:00', endTime: '18:00' },
        tuesday: { startTime: '08:00', endTime: '18:00' },
        wednesday: { startTime: '08:00', endTime: '18:00' },
        thursday: { startTime: '08:00', endTime: '18:00' },
        friday: { startTime: '08:00', endTime: '18:00' },
        saturday: { startTime: '09:00', endTime: '13:00' },
        sunday: undefined,
        lunchBreakEnabled: true,
        lunchBreak: { startTime: '13:00', endTime: '14:00' }
      }
    };
  }
}
