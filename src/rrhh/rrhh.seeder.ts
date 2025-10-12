import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AreaEntity, AreaDocument } from './area.schema.js';
import { CargoEntity, CargoDocument } from './cargo.schema.js';
// import { PlantillaContratoEntity, PlantillaContratoDocument } from './plantilla-contrato.schema.js'; // No usamos plantillas
import { DEFAULT_AREAS, DEFAULT_CARGOS } from './rrhh.data.js';
// import { DEFAULT_PLANTILLAS_CONTRATO } from './plantillas-contrato.data.js'; // No usamos plantillas

@Injectable()
export class RrhhSeederService {
  private readonly logger = new Logger(RrhhSeederService.name);

  constructor(
    @InjectModel(AreaEntity.name) private areaModel: Model<AreaDocument>,
    @InjectModel(CargoEntity.name) private cargoModel: Model<CargoDocument>,
    // @InjectModel(PlantillaContratoEntity.name) private plantillaModel: Model<PlantillaContratoDocument>, // No usamos plantillas
  ) {}

  async seedDefaultData(): Promise<void> {
    try {
      await this.seedAreas();
      await this.seedCargos();
      // await this.seedPlantillasContrato(); // No usamos plantillas
      this.logger.log('RRHH default data seeded successfully');
    } catch (error) {
      this.logger.error('Error seeding RRHH default data:', error);
      throw error;
    }
  }

  private async seedAreas(): Promise<void> {
    const existingAreasCount = await this.areaModel.countDocuments().exec();
    
    if (existingAreasCount > 0) {
      this.logger.log('Areas already exist, skipping seeding');
      return;
    }

    this.logger.log('Seeding default areas...');
    
    for (const areaData of DEFAULT_AREAS) {
      const area = new this.areaModel({
        ...areaData,
        isActive: true,
        meta: {
          seeded: true,
          seededAt: new Date()
        }
      });
      
      await area.save();
      this.logger.log(`Created area: ${area.name} (${area.code})`);
    }
  }

  private async seedCargos(): Promise<void> {
    const existingCargosCount = await this.cargoModel.countDocuments().exec();
    
    if (existingCargosCount > 0) {
      this.logger.log('Cargos already exist, skipping seeding');
      return;
    }

    this.logger.log('Seeding default cargos...');

    // Crear un mapa de códigos de área a IDs
    const areas = await this.areaModel.find().exec();
    const areaCodeToId = new Map();
    
    areas.forEach(area => {
      areaCodeToId.set(area.code, area._id);
    });

    for (const cargoData of DEFAULT_CARGOS) {
      const areaId = areaCodeToId.get(cargoData.areaCode);
      
      if (!areaId) {
        this.logger.warn(`Area with code ${cargoData.areaCode} not found for cargo ${cargoData.name}`);
        continue;
      }

      const cargo = new this.cargoModel({
        name: cargoData.name,
        code: cargoData.code,
        areaId: areaId,
        description: cargoData.description,
        hierarchyLevel: cargoData.hierarchyLevel,
        sortOrder: cargoData.sortOrder,
        isActive: true,
        meta: {
          seeded: true,
          seededAt: new Date()
        }
      });
      
      await cargo.save();
      this.logger.log(`Created cargo: ${cargo.name} (${cargo.code}) in area ${cargoData.areaCode}`);
    }
  }

  // Método removido: seedPlantillasContrato - ya no usamos plantillas

  async resetData(): Promise<void> {
    this.logger.log('Resetting RRHH data...');
    
    // await this.plantillaModel.deleteMany().exec(); // No usamos plantillas
    await this.cargoModel.deleteMany().exec();
    await this.areaModel.deleteMany().exec();
    
    this.logger.log('RRHH data reset completed');
    
    await this.seedDefaultData();
  }
}
