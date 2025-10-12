import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmpleadoEntity, EmpleadoDocument } from '../empleado.schema.js';
import { AreaEntity, AreaDocument } from '../area.schema.js';
import { CargoEntity, CargoDocument } from '../cargo.schema.js';
import { AttendanceConfigService } from '../../sistema/attendance-config.service.js';
import { ContractTemplate, ContractTemplateData } from './contract-template.interface.js';
import { CommunityManagerContractTemplate } from './community-manager-contract.template.js';
import { TraffickerContractTemplate } from './trafficker-contract.template.js';
import { ChatterContractTemplate } from './chatter-contract.template.js';
import { ManagerContractTemplate } from './manager-contract.template.js';

@Injectable()
export class ContractTemplatesService {
  private readonly logger = new Logger(ContractTemplatesService.name);
  private readonly templates: Map<string, ContractTemplate> = new Map();

  constructor(
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(AreaEntity.name) private areaModel: Model<AreaDocument>,
    @InjectModel(CargoEntity.name) private cargoModel: Model<CargoDocument>,
    private readonly attendanceConfigService: AttendanceConfigService,
    private readonly communityManagerTemplate: CommunityManagerContractTemplate,
    private readonly traffickerTemplate: TraffickerContractTemplate,
    private readonly chatterTemplate: ChatterContractTemplate,
    private readonly managerTemplate: ManagerContractTemplate,
  ) {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.templates.set(this.communityManagerTemplate.templateId, this.communityManagerTemplate);
    this.templates.set(this.traffickerTemplate.templateId, this.traffickerTemplate);
    this.templates.set(this.chatterTemplate.templateId, this.chatterTemplate);
    this.templates.set(this.managerTemplate.templateId, this.managerTemplate);
    
    this.logger.log('Contract templates initialized successfully');
  }

  /**
   * Genera un contrato laboral para un empleado específico
   */
  async generateContractForEmployee(empleadoId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    // Obtener información completa del empleado
    const empleado = await this.empleadoModel
      .findById(empleadoId)
      .populate('areaId')
      .populate('cargoId')
      .exec();

    if (!empleado) {
      throw new NotFoundException(`Employee with ID '${empleadoId}' not found`);
    }

    // Obtener configuración de asistencia
    const attendanceConfig = await this.attendanceConfigService.getAttendanceConfig();

    // Determinar la plantilla apropiada
    const template = this.getTemplateForEmployee(empleado);
    if (!template) {
      throw new BadRequestException(`No contract template found for area: ${(empleado.areaId as any).code} and cargo: ${(empleado.cargoId as any).code}`);
    }

    // Generar número de contrato
    const contractNumber = await this.generateContractNumber();

    // Preparar datos para la plantilla
    const contractData: ContractTemplateData = {
      empleado,
      area: empleado.areaId as any,
      cargo: empleado.cargoId as any,
      attendanceConfig,
      contractNumber,
      generatedAt: new Date(),
    };

    // Generar el contrato
    this.logger.log(`Generating contract for employee: ${empleado.nombre} ${empleado.apellido} using template: ${template.name}`);
    return await template.generateContract(contractData);
  }

  /**
   * Genera un contrato usando una plantilla específica
   */
  async generateContractPdfForTemplate(empleadoId: string, templateId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    const empleado = await this.empleadoModel
      .findById(empleadoId)
      .populate('areaId')
      .populate('cargoId')
      .exec();

    if (!empleado) {
      throw new NotFoundException(`Employee with ID '${empleadoId}' not found`);
    }

    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new BadRequestException(`Contract template '${templateId}' not found`);
    }

    const attendanceConfig = await this.attendanceConfigService.getAttendanceConfig();
    const contractNumber = await this.generateContractNumber();
    const contractData: ContractTemplateData = {
      empleado,
      area: empleado.areaId as any,
      cargo: empleado.cargoId as any,
      attendanceConfig,
      contractNumber,
      generatedAt: new Date(),
    };

    this.logger.log(`Generating contract (explicit template=${templateId}) for employee: ${empleado.nombre} ${empleado.apellido}`);
    return await template.generateContract(contractData);
  }

  /**
   * Obtiene información del contrato sin generar el PDF
   */
  async getContractInfoForEmployee(empleadoId: string): Promise<any> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    const empleado = await this.empleadoModel
      .findById(empleadoId)
      .populate('areaId')
      .populate('cargoId')
      .exec();

    if (!empleado) {
      throw new NotFoundException(`Employee with ID '${empleadoId}' not found`);
    }

    const attendanceConfig = await this.attendanceConfigService.getAttendanceConfig();
    const template = this.getTemplateForEmployee(empleado);
    
    if (!template) {
      throw new BadRequestException(`No contract template found for area: ${(empleado.areaId as any).code} and cargo: ${(empleado.cargoId as any).code}`);
    }

    const contractNumber = await this.generateContractNumber();
    const contractData: ContractTemplateData = {
      empleado,
      area: empleado.areaId as any,
      cargo: empleado.cargoId as any,
      attendanceConfig,
      contractNumber,
      generatedAt: new Date(),
    };

    return template.getContractInfo(contractData);
  }

  /**
   * Obtiene la información de contrato usando una plantilla específica
   */
  async getContractInfoForTemplate(empleadoId: string, templateId: string): Promise<any> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    const empleado = await this.empleadoModel
      .findById(empleadoId)
      .populate('areaId')
      .populate('cargoId')
      .exec();

    if (!empleado) {
      throw new NotFoundException(`Employee with ID '${empleadoId}' not found`);
    }

    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new BadRequestException(`Contract template '${templateId}' not found`);
    }

    const attendanceConfig = await this.attendanceConfigService.getAttendanceConfig();
    const contractNumber = await this.generateContractNumber();
    const contractData: ContractTemplateData = {
      empleado,
      area: empleado.areaId as any,
      cargo: empleado.cargoId as any,
      attendanceConfig,
      contractNumber,
      generatedAt: new Date(),
    };

    return template.getContractInfo(contractData);
  }

  /**
   * Obtiene todas las plantillas disponibles
   */
  getAvailableTemplates(): any[] {
    return Array.from(this.templates.values()).map(template => ({
      templateId: template.templateId,
      name: template.name,
      areaCode: template.areaCode,
      cargoCode: template.cargoCode,
      description: template.description,
    }));
  }

  /**
   * Obtiene una plantilla específica por ID
   */
  getTemplateById(templateId: string): ContractTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Obtiene plantillas por área
   */
  getTemplatesByArea(areaCode: string): any[] {
    return Array.from(this.templates.values())
      .filter(template => template.areaCode === areaCode)
      .map(template => ({
        templateId: template.templateId,
        name: template.name,
        areaCode: template.areaCode,
        cargoCode: template.cargoCode,
        description: template.description,
      }));
  }

  /**
   * Obtiene plantillas por cargo
   */
  getTemplatesByCargo(cargoCode: string): any[] {
    return Array.from(this.templates.values())
      .filter(template => template.cargoCode === cargoCode)
      .map(template => ({
        templateId: template.templateId,
        name: template.name,
        areaCode: template.areaCode,
        cargoCode: template.cargoCode,
        description: template.description,
      }));
  }

  /**
   * Determina la plantilla apropiada para un empleado
   */
  private getTemplateForEmployee(empleado: EmpleadoDocument): ContractTemplate | null {
    const areaCode = (empleado.areaId as any)?.code;
    const cargoCode = (empleado.cargoId as any)?.code;

    if (!areaCode || !cargoCode) {
      return null;
    }

    // Buscar plantilla específica por área y cargo
    for (const template of this.templates.values()) {
      if (template.areaCode === areaCode && template.cargoCode === cargoCode) {
        return template;
      }
    }

    // Si no se encuentra una plantilla específica, buscar por área
    for (const template of this.templates.values()) {
      if (template.areaCode === areaCode) {
        return template;
      }
    }

    return null;
  }

  /**
   * Genera un número único de contrato
   */
  private async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos del timestamp
    return `CT${year}${timestamp}`;
  }

  /**
   * Valida si existe una plantilla para un área y cargo específicos
   */
  async validateTemplateExists(areaCode: string, cargoCode: string): Promise<boolean> {
    for (const template of this.templates.values()) {
      if (template.areaCode === areaCode && template.cargoCode === cargoCode) {
        return true;
      }
    }
    return false;
  }

  /**
   * Obtiene estadísticas de plantillas
   */
  getTemplatesStats(): any {
    const templates = Array.from(this.templates.values());
    const stats = {
      totalTemplates: templates.length,
      templatesByArea: {},
      templatesByCargo: {},
    };

    templates.forEach(template => {
      // Contar por área
      if (!stats.templatesByArea[template.areaCode]) {
        stats.templatesByArea[template.areaCode] = 0;
      }
      stats.templatesByArea[template.areaCode]++;

      // Contar por cargo
      if (!stats.templatesByCargo[template.cargoCode]) {
        stats.templatesByCargo[template.cargoCode] = 0;
      }
      stats.templatesByCargo[template.cargoCode]++;
    });

    return stats;
  }
}
