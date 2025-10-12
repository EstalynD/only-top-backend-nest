import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AreaEntity, AreaDocument } from '../area.schema.js';
import { CargoEntity, CargoDocument } from '../cargo.schema.js';

@Injectable()
export class AssignTemplatesMigration {
  private readonly logger = new Logger(AssignTemplatesMigration.name);

  constructor(
    @InjectModel(AreaEntity.name) private areaModel: Model<AreaDocument>,
    @InjectModel(CargoEntity.name) private cargoModel: Model<CargoDocument>,
  ) {}

  /**
   * Asigna las plantillas de contratos a las áreas y cargos correspondientes
   */
  async assignContractTemplates(): Promise<void> {
    this.logger.log('Starting contract templates assignment migration...');

    try {
      // Asignar plantillas a áreas
      await this.assignTemplatesToAreas();
      
      // Asignar plantillas a cargos
      await this.assignTemplatesToCargos();
      
      this.logger.log('Contract templates assignment migration completed successfully');
    } catch (error) {
      this.logger.error('Error during contract templates assignment migration:', error);
      throw error;
    }
  }

  private async assignTemplatesToAreas(): Promise<void> {
    this.logger.log('Assigning contract templates to areas...');

    const areaUpdates = [
      {
        code: 'MKT',
        defaultContractTemplateId: 'community_manager_contract',
      },
      {
        code: 'TRF',
        defaultContractTemplateId: 'trafficker_contract',
      },
      {
        code: 'SLS',
        defaultContractTemplateId: 'chatter_contract',
      },
      {
        code: 'ADM',
        defaultContractTemplateId: 'manager_contract',
      },
    ];

    for (const update of areaUpdates) {
      const result = await this.areaModel.updateOne(
        { code: update.code },
        { defaultContractTemplateId: update.defaultContractTemplateId }
      );

      if (result.matchedCount > 0) {
        this.logger.log(`Updated area ${update.code} with template ${update.defaultContractTemplateId}`);
      } else {
        this.logger.warn(`Area ${update.code} not found`);
      }
    }
  }

  private async assignTemplatesToCargos(): Promise<void> {
    this.logger.log('Assigning contract templates to cargos...');

    const cargoUpdates = [
      {
        code: 'MKT_CM',
        contractTemplateId: 'community_manager_contract',
      },
      {
        code: 'TRF_TRF',
        contractTemplateId: 'trafficker_contract',
      },
      {
        code: 'SLS_CHT',
        contractTemplateId: 'chatter_contract',
      },
      {
        code: 'ADM_MGR',
        contractTemplateId: 'manager_contract',
      },
    ];

    for (const update of cargoUpdates) {
      const result = await this.cargoModel.updateOne(
        { code: update.code },
        { contractTemplateId: update.contractTemplateId }
      );

      if (result.matchedCount > 0) {
        this.logger.log(`Updated cargo ${update.code} with template ${update.contractTemplateId}`);
      } else {
        this.logger.warn(`Cargo ${update.code} not found`);
      }
    }
  }

  /**
   * Verifica el estado de las asignaciones de plantillas
   */
  async verifyTemplateAssignments(): Promise<any> {
    this.logger.log('Verifying contract template assignments...');

    const areas = await this.areaModel.find({}).select('name code defaultContractTemplateId').lean();
    const cargos = await this.cargoModel.find({}).select('name code contractTemplateId').lean();

    const report = {
      areas: areas.map(area => ({
        name: area.name,
        code: area.code,
        hasTemplate: !!area.defaultContractTemplateId,
        templateId: area.defaultContractTemplateId,
      })),
      cargos: cargos.map(cargo => ({
        name: cargo.name,
        code: cargo.code,
        hasTemplate: !!cargo.contractTemplateId,
        templateId: cargo.contractTemplateId,
      })),
      summary: {
        totalAreas: areas.length,
        areasWithTemplates: areas.filter(a => a.defaultContractTemplateId).length,
        totalCargos: cargos.length,
        cargosWithTemplates: cargos.filter(c => c.contractTemplateId).length,
      },
    };

    this.logger.log('Template assignments verification completed');
    return report;
  }

  /**
   * Limpia las asignaciones de plantillas (para rollback)
   */
  async clearTemplateAssignments(): Promise<void> {
    this.logger.log('Clearing contract template assignments...');

    await this.areaModel.updateMany(
      {},
      { $unset: { defaultContractTemplateId: 1 } }
    );

    await this.cargoModel.updateMany(
      {},
      { $unset: { contractTemplateId: 1 } }
    );

    this.logger.log('Contract template assignments cleared');
  }
}
