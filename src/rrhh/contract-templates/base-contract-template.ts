import { Injectable, Logger } from '@nestjs/common';
import { ContractTemplate, ContractTemplateData, ContractTerms } from './contract-template.interface.js';
import { PdfGeneratorService } from '../../pdf/pdf-generator.service.js';

@Injectable()
export abstract class BaseContractTemplate implements ContractTemplate {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly pdfGeneratorService: PdfGeneratorService) {}

  abstract readonly templateId: string;
  abstract readonly name: string;
  abstract readonly areaCode: string;
  abstract readonly cargoCode: string;
  abstract readonly description: string;

  abstract getContractTerms(data: ContractTemplateData): ContractTerms;

  async generateContract(data: ContractTemplateData): Promise<Buffer> {
    try {
      this.logger.log(`Generating contract for ${data.empleado.nombre} ${data.empleado.apellido} - ${this.name}`);
      
      const contractTerms = this.getContractTerms(data);
      const pdfData = this.preparePdfData(data, contractTerms);
      
      return await this.pdfGeneratorService.generateLaborContractPdf(pdfData);
    } catch (error) {
      this.logger.error(`Error generating contract for ${data.empleado.nombre} ${data.empleado.apellido}`, error);
      throw new Error(`No se pudo generar el contrato: ${error.message}`);
    }
  }

  getContractInfo(data: ContractTemplateData): any {
    const contractTerms = this.getContractTerms(data);
    
    return {
      templateId: this.templateId,
      templateName: this.name,
      area: data.area.name,
      cargo: data.cargo.name,
      contractNumber: data.contractNumber,
      employeeName: `${data.empleado.nombre} ${data.empleado.apellido}`,
      employeeId: data.empleado.numeroIdentificacion,
      workSchedule: contractTerms.workSchedule,
      responsibilities: contractTerms.responsibilities,
      benefits: contractTerms.benefits,
      obligations: contractTerms.obligations,
      generatedAt: data.generatedAt,
    };
  }

  protected preparePdfData(data: ContractTemplateData, terms: ContractTerms): any {
    return {
      // Información del empleado
      empleado: {
        nombreCompleto: `${data.empleado.nombre} ${data.empleado.apellido}`,
        numeroIdentificacion: data.empleado.numeroIdentificacion,
        correoElectronico: data.empleado.correoElectronico,
        telefono: data.empleado.telefono,
        direccion: data.empleado.direccion,
        ciudad: data.empleado.ciudad,
        pais: data.empleado.pais,
        fechaNacimiento: data.empleado.fechaNacimiento,
        fechaInicio: data.empleado.fechaInicio,
      },
      
      // Información laboral
      laboral: {
        area: data.area.name,
        cargo: data.cargo.name,
        tipoContrato: data.empleado.tipoContrato,
        salario: data.empleado.salario,
        numeroContrato: data.contractNumber,
        fechaInicio: data.empleado.fechaInicio,
      },
      
      // Términos del contrato
      terminos: terms,
      
      // Configuración de asistencia
      horarios: data.attendanceConfig,
      
      // Metadatos
      generadoEn: data.generatedAt,
      templateId: this.templateId,
      templateName: this.name,
    };
  }

  protected formatCurrency(amount: number, currency: string = 'COP'): string {
    if (currency === 'COP') {
      return `$${amount.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  protected formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  protected formatDateTime(date: Date): string {
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
