import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AreaEntity, AreaDocument } from './area.schema.js';
import { CargoEntity, CargoDocument } from './cargo.schema.js';
import { PlantillaContratoEntity, PlantillaContratoDocument } from './plantilla-contrato.schema.js';
import { DEFAULT_AREAS, DEFAULT_CARGOS } from './rrhh.data.js';
import { DEFAULT_PLANTILLAS_CONTRATO } from './plantillas-contrato.data.js';

@Injectable()
export class RrhhSeederService {
  private readonly logger = new Logger(RrhhSeederService.name);

  constructor(
    @InjectModel(AreaEntity.name) private areaModel: Model<AreaDocument>,
    @InjectModel(CargoEntity.name) private cargoModel: Model<CargoDocument>,
    @InjectModel(PlantillaContratoEntity.name) private plantillaModel: Model<PlantillaContratoDocument>,
  ) {}

  async seedDefaultData(): Promise<void> {
    try {
      await this.seedAreas();
      await this.seedCargos();
      await this.seedPlantillasContrato();
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
        requirements: cargoData.requirements,
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

  private async seedPlantillasContrato(): Promise<void> {
    const existingPlantillasCount = await this.plantillaModel.countDocuments().exec();
    
    if (existingPlantillasCount > 0) {
      this.logger.log('Contract templates already exist, skipping seeding');
      return;
    }

    this.logger.log('Seeding default contract templates...');

    // Crear mapas de códigos a IDs
    const areas = await this.areaModel.find().exec();
    const cargos = await this.cargoModel.find().exec();
    
    const areaCodeToId = new Map();
    const cargoCodeToId = new Map();
    
    areas.forEach(area => areaCodeToId.set(area.code, area._id));
    cargos.forEach(cargo => cargoCodeToId.set(cargo.code, cargo._id));

    for (const plantillaData of DEFAULT_PLANTILLAS_CONTRATO) {
      const areaId = areaCodeToId.get(plantillaData.areaCode);
      const cargoId = cargoCodeToId.get(plantillaData.cargoCode);
      
      if (!areaId || !cargoId) {
        this.logger.warn(`Area or position not found for template ${plantillaData.nombre}`);
        continue;
      }

      const plantilla = new this.plantillaModel({
        nombre: plantillaData.nombre,
        descripcion: plantillaData.descripcion,
        areaId: areaId,
        cargoId: cargoId,
        tipoContrato: plantillaData.tipoContrato,
        contenidoPlantilla: plantillaData.contenidoPlantilla,
        variables: plantillaData.variables,
        activa: true,
        version: 1,
        meta: {
          seeded: true,
          seededAt: new Date()
        }
      });
      
      await plantilla.save();
      this.logger.log(`Created contract template: ${plantilla.nombre}`);
    }
  }

  async resetData(): Promise<void> {
    this.logger.log('Resetting RRHH data...');
    
    await this.plantillaModel.deleteMany().exec();
    await this.cargoModel.deleteMany().exec();
    await this.areaModel.deleteMany().exec();
    
    this.logger.log('RRHH data reset completed');
    
    await this.seedDefaultData();
  }
}
