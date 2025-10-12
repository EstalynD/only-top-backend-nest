import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  EndowmentCategoryEntity, 
  EndowmentCategoryDocument,
  EndowmentItemEntity,
  EndowmentItemDocument,
  EndowmentTrackingEntity,
  EndowmentTrackingDocument
} from './endowment.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../empleado.schema.js';
import { UserEntity } from '../../users/user.schema.js';
import {
  CreateEndowmentCategoryDto,
  UpdateEndowmentCategoryDto,
  CreateEndowmentItemDto,
  UpdateEndowmentItemDto,
  CreateEndowmentTrackingDto,
  UpdateEndowmentTrackingDto,
  EndowmentTrackingQueryDto,
  EndowmentStatsQueryDto,
  EndowmentAction,
  EndowmentTrackingResponseDto,
  EndowmentStatsResponseDto
} from './dto/endowment.dto.js';

@Injectable()
export class EndowmentService {
  constructor(
    @InjectModel(EndowmentCategoryEntity.name) private categoryModel: Model<EndowmentCategoryDocument>,
    @InjectModel(EndowmentItemEntity.name) private itemModel: Model<EndowmentItemDocument>,
    @InjectModel(EndowmentTrackingEntity.name) private trackingModel: Model<EndowmentTrackingDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(UserEntity.name) private userModel: Model<any>,
  ) {}

  // ========== CATEGORÍAS ==========

  async createCategory(createCategoryDto: CreateEndowmentCategoryDto): Promise<EndowmentCategoryDocument> {
    // Verificar que el nombre no exista
    const existingCategory = await this.categoryModel.findOne({
      name: { $regex: new RegExp(`^${createCategoryDto.name}$`, 'i') }
    }).exec();

    if (existingCategory) {
      throw new ConflictException(`Category with name '${createCategoryDto.name}' already exists`);
    }

    const category = new this.categoryModel({
      ...createCategoryDto,
      isActive: createCategoryDto.isActive ?? true,
    });

    return await category.save();
  }

  async findAllCategories(includeInactive = false): Promise<EndowmentCategoryDocument[]> {
    const filter = includeInactive ? {} : { isActive: true };
    
    return await this.categoryModel
      .find(filter)
      .sort({ name: 1 })
      .exec();
  }

  async findCategoryById(id: string): Promise<EndowmentCategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID format');
    }

    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    return category;
  }

  async updateCategory(id: string, updateCategoryDto: UpdateEndowmentCategoryDto): Promise<EndowmentCategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID format');
    }

    // Si se actualiza el nombre, verificar que no exista
    if (updateCategoryDto.name) {
      const existingCategory = await this.categoryModel.findOne({
        name: { $regex: new RegExp(`^${updateCategoryDto.name}$`, 'i') },
        _id: { $ne: new Types.ObjectId(id) }
      }).exec();

      if (existingCategory) {
        throw new ConflictException(`Category with name '${updateCategoryDto.name}' already exists`);
      }
    }

    const category = await this.categoryModel.findByIdAndUpdate(
      id,
      updateCategoryDto,
      { new: true, runValidators: true }
    ).exec();

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID format');
    }

    // Verificar que no haya elementos asociados
    const itemsCount = await this.itemModel.countDocuments({ categoryId: new Types.ObjectId(id) }).exec();
    if (itemsCount > 0) {
      throw new ConflictException('Cannot delete category with associated items');
    }

    const result = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }
  }

  // ========== ELEMENTOS ==========

  async createItem(createItemDto: CreateEndowmentItemDto): Promise<EndowmentItemDocument> {
    // Verificar que la categoría existe
    const category = await this.categoryModel.findById(createItemDto.categoryId).exec();
    if (!category || !category.isActive) {
      throw new BadRequestException('Invalid or inactive category');
    }

    // Verificar que el número de serie no exista (si se proporciona)
    if (createItemDto.serialNumber) {
      const existingItem = await this.itemModel.findOne({
        serialNumber: createItemDto.serialNumber
      }).exec();

      if (existingItem) {
        throw new ConflictException(`Item with serial number '${createItemDto.serialNumber}' already exists`);
      }
    }

    const item = new this.itemModel({
      ...createItemDto,
      categoryId: new Types.ObjectId(createItemDto.categoryId),
      isActive: createItemDto.isActive ?? true,
    });

    return await item.save();
  }

  async findAllItems(includeInactive = false, categoryId?: string): Promise<EndowmentItemDocument[]> {
    const filter: any = includeInactive ? {} : { isActive: true };
    
    if (categoryId) {
      if (!Types.ObjectId.isValid(categoryId)) {
        throw new BadRequestException('Invalid category ID format');
      }
      filter.categoryId = new Types.ObjectId(categoryId);
    }

    return await this.itemModel
      .find(filter)
      .populate('categoryId', 'name description icon color')
      .sort({ name: 1 })
      .exec();
  }

  async findItemById(id: string): Promise<EndowmentItemDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid item ID format');
    }

    const item = await this.itemModel
      .findById(id)
      .populate('categoryId', 'name description icon color')
      .exec();

    if (!item) {
      throw new NotFoundException(`Item with ID '${id}' not found`);
    }

    return item;
  }

  async updateItem(id: string, updateItemDto: UpdateEndowmentItemDto): Promise<EndowmentItemDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid item ID format');
    }

    // Si se actualiza la categoría, verificar que existe
    if (updateItemDto.categoryId) {
      const category = await this.categoryModel.findById(updateItemDto.categoryId).exec();
      if (!category || !category.isActive) {
        throw new BadRequestException('Invalid or inactive category');
      }
    }

    // Si se actualiza el número de serie, verificar que no exista
    if (updateItemDto.serialNumber) {
      const existingItem = await this.itemModel.findOne({
        serialNumber: updateItemDto.serialNumber,
        _id: { $ne: new Types.ObjectId(id) }
      }).exec();

      if (existingItem) {
        throw new ConflictException(`Item with serial number '${updateItemDto.serialNumber}' already exists`);
      }
    }

    const updatedData = {
      ...updateItemDto,
      ...(updateItemDto.categoryId && { categoryId: new Types.ObjectId(updateItemDto.categoryId) }),
    };

    const item = await this.itemModel.findByIdAndUpdate(
      id,
      updatedData,
      { new: true, runValidators: true }
    )
    .populate('categoryId', 'name description icon color')
    .exec();

    if (!item) {
      throw new NotFoundException(`Item with ID '${id}' not found`);
    }

    return item;
  }

  async deleteItem(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid item ID format');
    }

    // Verificar que no haya seguimientos asociados
    const trackingCount = await this.trackingModel.countDocuments({ itemId: new Types.ObjectId(id) }).exec();
    if (trackingCount > 0) {
      throw new ConflictException('Cannot delete item with associated tracking records');
    }

    const result = await this.itemModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Item with ID '${id}' not found`);
    }
  }

  // ========== SEGUIMIENTO ==========

  async createTracking(createTrackingDto: CreateEndowmentTrackingDto, userId?: string): Promise<EndowmentTrackingDocument> {
    // Verificar que el empleado existe
    const empleado = await this.empleadoModel.findById(createTrackingDto.empleadoId).exec();
    if (!empleado || empleado.estado !== 'ACTIVO') {
      throw new BadRequestException('Invalid or inactive employee');
    }

    // Verificar que el elemento existe
    const item = await this.itemModel.findById(createTrackingDto.itemId).exec();
    if (!item || !item.isActive) {
      throw new BadRequestException('Invalid or inactive item');
    }

    // Generar número de referencia si no se proporciona
    const referenceNumber = createTrackingDto.referenceNumber || await this.generateReferenceNumber();

    const tracking = new this.trackingModel({
      ...createTrackingDto,
      empleadoId: new Types.ObjectId(createTrackingDto.empleadoId),
      itemId: new Types.ObjectId(createTrackingDto.itemId),
      categoryId: item.categoryId,
      actionDate: new Date(createTrackingDto.actionDate),
      processedBy: userId ? new Types.ObjectId(userId) : null,
      referenceNumber,
    });

    return await tracking.save();
  }

  async findAllTracking(query: EndowmentTrackingQueryDto): Promise<EndowmentTrackingResponseDto[]> {
    const filter: any = {};

    if (query.empleadoId) {
      if (!Types.ObjectId.isValid(query.empleadoId)) {
        throw new BadRequestException('Invalid employee ID format');
      }
      filter.empleadoId = new Types.ObjectId(query.empleadoId);
    }

    if (query.itemId) {
      if (!Types.ObjectId.isValid(query.itemId)) {
        throw new BadRequestException('Invalid item ID format');
      }
      filter.itemId = new Types.ObjectId(query.itemId);
    }

    if (query.categoryId) {
      if (!Types.ObjectId.isValid(query.categoryId)) {
        throw new BadRequestException('Invalid category ID format');
      }
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }

    if (query.action) {
      filter.action = query.action;
    }

    if (query.startDate || query.endDate) {
      filter.actionDate = {};
      if (query.startDate) {
        filter.actionDate.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.actionDate.$lte = new Date(query.endDate);
      }
    }

    const tracking = await this.trackingModel
      .find(filter)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('empleadoId.areaId', 'name code')
      .populate('empleadoId.cargoId', 'name code')
      .populate('itemId', 'name description brand model serialNumber estimatedValue')
      .populate('categoryId', 'name description icon color')
      .populate('processedBy', 'username displayName')
      .sort({ actionDate: -1 })
      .exec();

    return tracking.map(t => t.toObject() as unknown as EndowmentTrackingResponseDto);
  }

  async findTrackingById(id: string): Promise<EndowmentTrackingResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid tracking ID format');
    }

    const tracking = await this.trackingModel
      .findById(id)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('empleadoId.areaId', 'name code')
      .populate('empleadoId.cargoId', 'name code')
      .populate('itemId', 'name description brand model serialNumber estimatedValue')
      .populate('categoryId', 'name description icon color')
      .populate('processedBy', 'username displayName')
      .exec();

    if (!tracking) {
      throw new NotFoundException(`Tracking record with ID '${id}' not found`);
    }

    return tracking.toObject() as unknown as EndowmentTrackingResponseDto;
  }

  async findTrackingByEmpleado(empleadoId: string): Promise<EndowmentTrackingResponseDto[]> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    return await this.findAllTracking({ empleadoId });
  }

  async updateTracking(id: string, updateTrackingDto: UpdateEndowmentTrackingDto): Promise<EndowmentTrackingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid tracking ID format');
    }

    const updatedData = {
      ...updateTrackingDto,
      ...(updateTrackingDto.actionDate && { actionDate: new Date(updateTrackingDto.actionDate) }),
    };

    const tracking = await this.trackingModel.findByIdAndUpdate(
      id,
      updatedData,
      { new: true, runValidators: true }
    )
    .populate('empleadoId', 'nombre apellido correoElectronico')
    .populate('itemId', 'name description brand model serialNumber estimatedValue')
    .populate('categoryId', 'name description icon color')
    .populate('processedBy', 'username displayName')
    .exec();

    if (!tracking) {
      throw new NotFoundException(`Tracking record with ID '${id}' not found`);
    }

    return tracking;
  }

  async deleteTracking(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid tracking ID format');
    }

    const result = await this.trackingModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Tracking record with ID '${id}' not found`);
    }
  }

  // ========== ESTADÍSTICAS ==========

  async getEndowmentStats(query: EndowmentStatsQueryDto): Promise<EndowmentStatsResponseDto> {
    const matchFilter: any = {};

    if (query.startDate || query.endDate) {
      matchFilter.actionDate = {};
      if (query.startDate) {
        matchFilter.actionDate.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        matchFilter.actionDate.$lte = new Date(query.endDate);
      }
    }

    if (query.categoryId) {
      matchFilter.categoryId = new Types.ObjectId(query.categoryId);
    }

    if (query.areaId) {
      // Buscar empleados del área específica
      const empleados = await this.empleadoModel.find({ areaId: new Types.ObjectId(query.areaId) }).select('_id').exec();
      const empleadoIds = empleados.map(e => e._id);
      matchFilter.empleadoId = { $in: empleadoIds };
    }

    const [
      totalItems,
      totalCategories,
      totalDeliveries,
      totalReturns,
      pendingReturns,
      itemsByCategory,
      deliveriesByMonth,
      topDeliveredItems
    ] = await Promise.all([
      this.itemModel.countDocuments({ isActive: true }).exec(),
      this.categoryModel.countDocuments({ isActive: true }).exec(),
      this.trackingModel.countDocuments({ ...matchFilter, action: 'ENTREGA' }).exec(),
      this.trackingModel.countDocuments({ ...matchFilter, action: 'DEVOLUCION' }).exec(),
      this.getPendingReturnsCount(matchFilter),
      this.getItemsByCategoryStats(matchFilter),
      this.getDeliveriesByMonthStats(matchFilter),
      this.getTopDeliveredItemsStats(matchFilter)
    ]);

    return {
      totalItems,
      totalCategories,
      totalDeliveries,
      totalReturns,
      pendingReturns,
      itemsByCategory,
      deliveriesByMonth,
      topDeliveredItems,
    };
  }

  // ========== MÉTODOS PRIVADOS ==========

  private async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.trackingModel.countDocuments({
      referenceNumber: { $regex: `^END${year}` }
    }).exec();
    
    return `END${year}${String(count + 1).padStart(4, '0')}`;
  }

  private async getPendingReturnsCount(matchFilter: any): Promise<number> {
    // Contar entregas que no tienen devolución correspondiente
    const deliveries = await this.trackingModel.aggregate([
      { $match: { ...matchFilter, action: 'ENTREGA' } },
      {
        $lookup: {
          from: 'rrhh_endowment_tracking',
          let: { empleadoId: '$empleadoId', itemId: '$itemId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$empleadoId', '$$empleadoId'] },
                    { $eq: ['$itemId', '$$itemId'] },
                    { $eq: ['$action', 'DEVOLUCION'] },
                    { $gt: ['$actionDate', '$actionDate'] }
                  ]
                }
              }
            }
          ],
          as: 'returns'
        }
      },
      { $match: { returns: { $size: 0 } } },
      { $count: 'count' }
    ]).exec();

    return deliveries.length > 0 ? deliveries[0].count : 0;
  }

  private async getItemsByCategoryStats(matchFilter: any): Promise<Array<{ category: string; count: number; totalValue: number }>> {
    return await this.trackingModel.aggregate([
      { $match: { ...matchFilter, action: 'ENTREGA' } },
      {
        $lookup: {
          from: 'rrhh_endowment_categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $lookup: {
          from: 'rrhh_endowment_items',
          localField: 'itemId',
          foreignField: '_id',
          as: 'item'
        }
      },
      { $unwind: '$item' },
      {
        $group: {
          _id: '$category.name',
          count: { $sum: 1 },
          totalValue: {
            $sum: {
              $ifNull: ['$item.estimatedValue.monto', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          count: 1,
          totalValue: 1
        }
      },
      { $sort: { count: -1 } }
    ]).exec();
  }

  private async getDeliveriesByMonthStats(matchFilter: any): Promise<Array<{ month: string; count: number }>> {
    return await this.trackingModel.aggregate([
      { $match: { ...matchFilter, action: 'ENTREGA' } },
      {
        $group: {
          _id: {
            year: { $year: '$actionDate' },
            month: { $month: '$actionDate' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          month: {
            $dateToString: {
              format: '%Y-%m',
              date: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month',
                  day: 1
                }
              }
            }
          },
          count: 1
        }
      },
      { $sort: { month: 1 } }
    ]).exec();
  }

  private async getTopDeliveredItemsStats(matchFilter: any): Promise<Array<{ item: string; count: number }>> {
    return await this.trackingModel.aggregate([
      { $match: { ...matchFilter, action: 'ENTREGA' } },
      {
        $lookup: {
          from: 'rrhh_endowment_items',
          localField: 'itemId',
          foreignField: '_id',
          as: 'item'
        }
      },
      { $unwind: '$item' },
      {
        $group: {
          _id: '$item.name',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          item: '$_id',
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).exec();
  }
}
