import { EmpleadoDocument } from '../empleado.schema.js';
import { AreaDocument } from '../area.schema.js';
import { CargoDocument } from '../cargo.schema.js';

export interface ContractTemplateData {
  empleado: EmpleadoDocument;
  area: AreaDocument;
  cargo: CargoDocument;
  attendanceConfig?: {
    fixedSchedule?: any;
    rotatingShifts?: any[];
    timezone?: string;
  };
  contractNumber: string;
  generatedAt: Date;
}

export interface ContractTemplate {
  templateId: string;
  name: string;
  areaCode: string;
  cargoCode: string;
  description: string;
  generateContract(data: ContractTemplateData): Promise<Buffer>;
  getContractInfo(data: ContractTemplateData): any;
}

export interface ContractTerms {
  // Términos laborales específicos por área/cargo
  workSchedule: {
    type: 'FIXED' | 'ROTATING';
    schedule?: any;
    shifts?: any[];
  };
  responsibilities: string[];
  benefits: string[];
  obligations: string[];
  termination: {
    noticePeriod: string;
    conditions: string[];
  };
  confidentiality: string[];
  intellectualProperty: string[];
}
