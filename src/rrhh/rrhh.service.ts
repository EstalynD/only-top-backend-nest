import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AreaEntity, AreaDocument } from './area.schema.js';
import { CargoEntity, CargoDocument } from './cargo.schema.js';
import { CreateAreaDto } from './dto/create-area.dto.js';
import { UpdateAreaDto } from './dto/update-area.dto.js';
import { CreateCargoDto } from './dto/create-cargo.dto.js';
import { UpdateCargoDto } from './dto/update-cargo.dto.js';

@Injectable()
export class RrhhService {
  constructor(
    @InjectModel(AreaEntity.name) private areaModel: Model<AreaDocument>,
    @InjectModel(CargoEntity.name) private cargoModel: Model<CargoDocument>,
  ) {}

  // ========== ÁREAS ==========

  async createArea(createAreaDto: CreateAreaDto): Promise<AreaDocument> {
    // Verificar que el código no exista
    const existingArea = await this.areaModel.findOne({ 
      code: createAreaDto.code.toUpperCase() 
    }).exec();
    
    if (existingArea) {
      throw new ConflictException(`Area with code '${createAreaDto.code}' already exists`);
    }

    const area = new this.areaModel({
      ...createAreaDto,
      code: createAreaDto.code.toUpperCase(),
      color: createAreaDto.color || '#6B7280',
      isActive: createAreaDto.isActive ?? true,
      sortOrder: createAreaDto.sortOrder ?? 0,
    });

    return await area.save();
  }

  async findAllAreas(includeInactive = false): Promise<AreaDocument[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return await this.areaModel
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findAreaById(id: string): Promise<AreaDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid area ID format');
    }

    const area = await this.areaModel.findById(id).exec();
    if (!area) {
      throw new NotFoundException(`Area with ID '${id}' not found`);
    }

    return area;
  }

  async findAreaByCode(code: string): Promise<AreaDocument> {
    const area = await this.areaModel.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    }).exec();
    
    if (!area) {
      throw new NotFoundException(`Area with code '${code}' not found`);
    }

    return area;
  }

  async updateArea(id: string, updateAreaDto: UpdateAreaDto): Promise<AreaDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid area ID format');
    }

    // Si se actualiza el código, verificar que no exista
    if (updateAreaDto.code) {
      const existingArea = await this.areaModel.findOne({
        code: updateAreaDto.code.toUpperCase(),
        _id: { $ne: new Types.ObjectId(id) }
      }).exec();

      if (existingArea) {
        throw new ConflictException(`Area with code '${updateAreaDto.code}' already exists`);
      }
    }

    const updatedData = {
      ...updateAreaDto,
      ...(updateAreaDto.code && { code: updateAreaDto.code.toUpperCase() }),
    };

    const area = await this.areaModel.findByIdAndUpdate(
      id,
      updatedData,
      { new: true, runValidators: true }
    ).exec();

    if (!area) {
      throw new NotFoundException(`Area with ID '${id}' not found`);
    }

    return area;
  }

  async deleteArea(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid area ID format');
    }

    // Verificar si hay cargos asociados
    const cargosCount = await this.cargoModel.countDocuments({ 
      areaId: new Types.ObjectId(id),
      isActive: true 
    }).exec();

    if (cargosCount > 0) {
      throw new ConflictException(`Cannot delete area. There are ${cargosCount} active positions associated with this area`);
    }

    const result = await this.areaModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Area with ID '${id}' not found`);
    }
  }

  // ========== CARGOS ==========

  async createCargo(createCargoDto: CreateCargoDto): Promise<CargoDocument> {
    // Verificar que el área existe
    const area = await this.findAreaById(createCargoDto.areaId.toString());
    if (!area.isActive) {
      throw new BadRequestException('Cannot create position for inactive area');
    }

    // Verificar que el código no exista
    const existingCargo = await this.cargoModel.findOne({ 
      code: createCargoDto.code.toUpperCase() 
    }).exec();
    
    if (existingCargo) {
      throw new ConflictException(`Position with code '${createCargoDto.code}' already exists`);
    }

    const cargo = new this.cargoModel({
      ...createCargoDto,
      code: createCargoDto.code.toUpperCase(),
      hierarchyLevel: createCargoDto.hierarchyLevel ?? 1,
      isActive: createCargoDto.isActive ?? true,
      sortOrder: createCargoDto.sortOrder ?? 0,
    });

    return await cargo.save();
  }

  async findAllCargos(includeInactive = false, areaId?: string): Promise<CargoDocument[]> {
    const filter: any = includeInactive ? {} : { isActive: true };
    
    if (areaId) {
      if (!Types.ObjectId.isValid(areaId)) {
        throw new BadRequestException('Invalid area ID format');
      }
      filter.areaId = new Types.ObjectId(areaId);
    }

    return await this.cargoModel
      .find(filter)
      .populate('areaId', 'name code color')
      .sort({ hierarchyLevel: 1, sortOrder: 1, name: 1 })
      .exec();
  }

  async findCargoById(id: string): Promise<CargoDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid position ID format');
    }

    const cargo = await this.cargoModel
      .findById(id)
      .populate('areaId', 'name code color')
      .exec();
      
    if (!cargo) {
      throw new NotFoundException(`Position with ID '${id}' not found`);
    }

    return cargo;
  }

  async findCargoByCode(code: string): Promise<CargoDocument> {
    const cargo = await this.cargoModel
      .findOne({ 
        code: code.toUpperCase(),
        isActive: true 
      })
      .populate('areaId', 'name code color')
      .exec();
    
    if (!cargo) {
      throw new NotFoundException(`Position with code '${code}' not found`);
    }

    return cargo;
  }

  async updateCargo(id: string, updateCargoDto: UpdateCargoDto): Promise<CargoDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid position ID format');
    }

    // Si se actualiza el área, verificar que existe
    if (updateCargoDto.areaId) {
      const area = await this.findAreaById(updateCargoDto.areaId.toString());
      if (!area.isActive) {
        throw new BadRequestException('Cannot assign position to inactive area');
      }
    }

    // Si se actualiza el código, verificar que no exista
    if (updateCargoDto.code) {
      const existingCargo = await this.cargoModel.findOne({
        code: updateCargoDto.code.toUpperCase(),
        _id: { $ne: new Types.ObjectId(id) }
      }).exec();

      if (existingCargo) {
        throw new ConflictException(`Position with code '${updateCargoDto.code}' already exists`);
      }
    }

    const updatedData = {
      ...updateCargoDto,
      ...(updateCargoDto.code && { code: updateCargoDto.code.toUpperCase() }),
    };

    const cargo = await this.cargoModel.findByIdAndUpdate(
      id,
      updatedData,
      { new: true, runValidators: true }
    )
    .populate('areaId', 'name code color')
    .exec();

    if (!cargo) {
      throw new NotFoundException(`Position with ID '${id}' not found`);
    }

    return cargo;
  }

  async deleteCargo(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid position ID format');
    }

    const result = await this.cargoModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Position with ID '${id}' not found`);
    }
  }

  // ========== UTILIDADES ==========

  async getAreasWithCargos(includeInactive = false): Promise<any[]> {
    const areas = await this.findAllAreas(includeInactive);
    
    const areasWithCargos = await Promise.all(
      areas.map(async (area) => {
        const cargos = await this.findAllCargos(includeInactive, area._id.toString());
        return {
          ...area.toObject(),
          cargos: cargos.map(cargo => {
            const { areaId: _omit, ...rest } = cargo.toObject();
            return rest;
          })
        };
      })
    );

    return areasWithCargos;
  }
}
