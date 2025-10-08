import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatterSaleEntity, ChatterSaleDocument, TurnoChatter } from './chatter-sale.schema.js';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';
import { CreateChatterSaleDto } from './dto/create-chatter-sale.dto.js';
import { UpdateChatterSaleDto } from './dto/update-chatter-sale.dto.js';
import { FilterSalesDto } from './dto/filter-sales.dto.js';

@Injectable()
export class ChatterSalesService {
  constructor(
    @InjectModel(ChatterSaleEntity.name) private chatterSaleModel: Model<ChatterSaleDocument>,
    @InjectModel(ModeloEntity.name) private modeloModel: Model<ModeloDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
  ) {}

  // ========== CREAR VENTA ==========

  async createSale(createDto: CreateChatterSaleDto, userId?: string): Promise<ChatterSaleDocument> {
    // Validar que la modelo existe y está activa
    const modelo = await this.modeloModel.findById(createDto.modeloId).exec();
    if (!modelo || modelo.estado !== 'ACTIVA') {
      throw new BadRequestException('Invalid or inactive model');
    }

    // Validar que el chatter existe y está activo
    const chatter = await this.empleadoModel.findById(createDto.chatterId).exec();
    if (!chatter || chatter.estado !== 'ACTIVO') {
      throw new BadRequestException('Invalid or inactive chatter');
    }

    // Verificar que el chatter está asignado a esta modelo
    const isAssigned = await this.isChatterAssignedToModel(createDto.chatterId, createDto.modeloId);
    if (!isAssigned) {
      throw new BadRequestException('This chatter is not assigned to the specified model');
    }

    // Crear la venta
    const sale = new this.chatterSaleModel({
      ...createDto,
      modeloId: new Types.ObjectId(createDto.modeloId),
      chatterId: new Types.ObjectId(createDto.chatterId),
      fechaVenta: new Date(createDto.fechaVenta),
      moneda: createDto.moneda || 'USD',
      registradoPor: userId ? new Types.ObjectId(userId) : null,
    });

    return await sale.save();
  }

  // ========== OBTENER VENTAS CON FILTROS ==========

  async findSales(filters: FilterSalesDto): Promise<ChatterSaleDocument[]> {
    const query: any = {};

    if (filters.modeloId) {
      if (!Types.ObjectId.isValid(filters.modeloId)) {
        throw new BadRequestException('Invalid model ID format');
      }
      query.modeloId = new Types.ObjectId(filters.modeloId);
    }

    if (filters.chatterId) {
      if (!Types.ObjectId.isValid(filters.chatterId)) {
        throw new BadRequestException('Invalid chatter ID format');
      }
      query.chatterId = new Types.ObjectId(filters.chatterId);
    }

    if (filters.tipoVenta) {
      query.tipoVenta = filters.tipoVenta;
    }

    if (filters.turno) {
      query.turno = filters.turno;
    }

    if (filters.plataforma) {
      query.plataforma = filters.plataforma;
    }

    // Filtro de fechas
    if (filters.fechaInicio || filters.fechaFin) {
      query.fechaVenta = {};
      if (filters.fechaInicio) {
        query.fechaVenta.$gte = new Date(filters.fechaInicio);
      }
      if (filters.fechaFin) {
        query.fechaVenta.$lte = new Date(filters.fechaFin);
      }
    }

    return await this.chatterSaleModel
      .find(query)
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .populate('chatterId', 'nombre apellido correoElectronico cargoId')
      .populate('registradoPor', 'username displayName')
      .sort({ fechaVenta: -1 })
      .exec();
  }

  // ========== OBTENER VENTA POR ID ==========

  async findSaleById(id: string): Promise<ChatterSaleDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid sale ID format');
    }

    const sale = await this.chatterSaleModel
      .findById(id)
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .populate('chatterId', 'nombre apellido correoElectronico cargoId')
      .populate('registradoPor', 'username displayName')
      .exec();

    if (!sale) {
      throw new NotFoundException(`Sale with ID '${id}' not found`);
    }

    return sale;
  }

  // ========== ACTUALIZAR VENTA ==========

  async updateSale(id: string, updateDto: UpdateChatterSaleDto): Promise<ChatterSaleDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid sale ID format');
    }

    // Validaciones similares a createSale si se actualizan referencias
    const updateData: any = { ...updateDto };

    if (updateDto.modeloId) {
      const modelo = await this.modeloModel.findById(updateDto.modeloId).exec();
      if (!modelo || modelo.estado !== 'ACTIVA') {
        throw new BadRequestException('Invalid or inactive model');
      }
      updateData.modeloId = new Types.ObjectId(updateDto.modeloId);
    }

    if (updateDto.chatterId) {
      const chatter = await this.empleadoModel.findById(updateDto.chatterId).exec();
      if (!chatter || chatter.estado !== 'ACTIVO') {
        throw new BadRequestException('Invalid or inactive chatter');
      }
      updateData.chatterId = new Types.ObjectId(updateDto.chatterId);
    }

    if (updateDto.fechaVenta) {
      updateData.fechaVenta = new Date(updateDto.fechaVenta);
    }

    const sale = await this.chatterSaleModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .populate('chatterId', 'nombre apellido correoElectronico cargoId')
      .exec();

    if (!sale) {
      throw new NotFoundException(`Sale with ID '${id}' not found`);
    }

    return sale;
  }

  // ========== ELIMINAR VENTA ==========

  async deleteSale(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid sale ID format');
    }

    const result = await this.chatterSaleModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Sale with ID '${id}' not found`);
    }
  }

  // ========== VENTAS POR GRUPO (MODELO + SUS 4 CHATTERS) ==========

  async getSalesByGroup(modeloId: string, fechaInicio?: string, fechaFin?: string): Promise<any> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('Invalid model ID format');
    }

    const modelo = await this.modeloModel
      .findById(modeloId)
      .populate('equipoChatters.turnoAM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoPM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoMadrugada', 'nombre apellido correoElectronico')
      .populate('equipoChatters.supernumerario', 'nombre apellido correoElectronico')
      .exec();

    if (!modelo) {
      throw new NotFoundException(`Model with ID '${modeloId}' not found`);
    }

    // Construir query de fecha
    const dateQuery: any = { modeloId: new Types.ObjectId(modeloId) };
    if (fechaInicio || fechaFin) {
      dateQuery.fechaVenta = {};
      if (fechaInicio) dateQuery.fechaVenta.$gte = new Date(fechaInicio);
      if (fechaFin) dateQuery.fechaVenta.$lte = new Date(fechaFin);
    }

    // Obtener ventas del grupo completo
    const ventas = await this.chatterSaleModel
      .find(dateQuery)
      .populate('chatterId', 'nombre apellido correoElectronico')
      .sort({ fechaVenta: -1 })
      .exec();

    // Agrupar ventas por chatter
    const ventasPorChatter: Record<string, any> = {
      AM: { chatter: modelo.equipoChatters.turnoAM, ventas: [] as any[], total: 0 },
      PM: { chatter: modelo.equipoChatters.turnoPM, ventas: [] as any[], total: 0 },
      MADRUGADA: { chatter: modelo.equipoChatters.turnoMadrugada, ventas: [] as any[], total: 0 },
      SUPERNUMERARIO: { chatter: modelo.equipoChatters.supernumerario, ventas: [] as any[], total: 0 },
    };

    let totalGrupo = 0;

    for (const venta of ventas) {
      const turno = venta.turno as string;
      if (ventasPorChatter[turno]) {
        ventasPorChatter[turno].ventas.push(venta);
        ventasPorChatter[turno].total += venta.monto;
        totalGrupo += venta.monto;
      }
    }

    return {
      modelo: {
        id: modelo._id,
        nombreCompleto: modelo.nombreCompleto,
        correoElectronico: modelo.correoElectronico,
        fotoPerfil: modelo.fotoPerfil,
      },
      grupo: ventasPorChatter,
      totalGrupo,
      totalVentas: ventas.length,
      periodo: { fechaInicio, fechaFin },
    };
  }

  // ========== ESTADÍSTICAS POR CHATTER ==========

  async getChatterStats(chatterId: string, fechaInicio?: string, fechaFin?: string): Promise<any> {
    if (!Types.ObjectId.isValid(chatterId)) {
      throw new BadRequestException('Invalid chatter ID format');
    }

    const chatter = await this.empleadoModel.findById(chatterId).exec();
    if (!chatter) {
      throw new NotFoundException(`Chatter with ID '${chatterId}' not found`);
    }

    // Query de ventas
    const query: any = { chatterId: new Types.ObjectId(chatterId) };
    if (fechaInicio || fechaFin) {
      query.fechaVenta = {};
      if (fechaInicio) query.fechaVenta.$gte = new Date(fechaInicio);
      if (fechaFin) query.fechaVenta.$lte = new Date(fechaFin);
    }

    const ventas = await this.chatterSaleModel.find(query).exec();

    // Calcular estadísticas
    const totalVentas = ventas.length;
    const totalMonto = ventas.reduce((sum, v) => sum + v.monto, 0);
    const promedioVenta = totalVentas > 0 ? totalMonto / totalVentas : 0;

    // Ventas por tipo
    const ventasPorTipo = ventas.reduce((acc: any, v) => {
      acc[v.tipoVenta] = (acc[v.tipoVenta] || 0) + v.monto;
      return acc;
    }, {});

    // Ventas por modelo
    const ventasPorModelo = await this.chatterSaleModel.aggregate([
      { $match: query },
      { $group: { _id: '$modeloId', total: { $sum: '$monto' }, count: { $sum: 1 } } },
      { $lookup: { from: 'rrhh_modelos', localField: '_id', foreignField: '_id', as: 'modelo' } },
      { $unwind: '$modelo' },
      { $project: { modeloId: '$_id', nombreCompleto: '$modelo.nombreCompleto', total: 1, count: 1 } },
      { $sort: { total: -1 } },
    ]).exec();

    return {
      chatter: {
        id: chatter._id,
        nombre: `${chatter.nombre} ${chatter.apellido}`,
        correoElectronico: chatter.correoElectronico,
      },
      estadisticas: {
        totalVentas,
        totalMonto,
        promedioVenta,
        ventasPorTipo,
        ventasPorModelo,
      },
      periodo: { fechaInicio, fechaFin },
    };
  }

  // ========== ESTADÍSTICAS POR MODELO ==========

  async getModeloStats(modeloId: string, fechaInicio?: string, fechaFin?: string): Promise<any> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('Invalid model ID format');
    }

    const modelo = await this.modeloModel.findById(modeloId).exec();
    if (!modelo) {
      throw new NotFoundException(`Model with ID '${modeloId}' not found`);
    }

    const query: any = { modeloId: new Types.ObjectId(modeloId) };
    if (fechaInicio || fechaFin) {
      query.fechaVenta = {};
      if (fechaInicio) query.fechaVenta.$gte = new Date(fechaInicio);
      if (fechaFin) query.fechaVenta.$lte = new Date(fechaFin);
    }

    const ventas = await this.chatterSaleModel.find(query).exec();

    const totalVentas = ventas.length;
    const totalMonto = ventas.reduce((sum, v) => sum + v.monto, 0);
    const promedioVenta = totalVentas > 0 ? totalMonto / totalVentas : 0;

    // Ventas por tipo
    const ventasPorTipo = ventas.reduce((acc: any, v) => {
      acc[v.tipoVenta] = (acc[v.tipoVenta] || 0) + v.monto;
      return acc;
    }, {});

    // Ventas por turno
    const ventasPorTurno = ventas.reduce((acc: any, v) => {
      acc[v.turno] = (acc[v.turno] || 0) + v.monto;
      return acc;
    }, {});

    return {
      modelo: {
        id: modelo._id,
        nombreCompleto: modelo.nombreCompleto,
        correoElectronico: modelo.correoElectronico,
        fotoPerfil: modelo.fotoPerfil,
      },
      estadisticas: {
        totalVentas,
        totalMonto,
        promedioVenta,
        ventasPorTipo,
        ventasPorTurno,
      },
      periodo: { fechaInicio, fechaFin },
    };
  }

  // ========== COMPARAR GRUPOS ==========

  async compareGroups(modeloIds: string[], fechaInicio?: string, fechaFin?: string): Promise<any> {
    const comparisons: any[] = [];

    for (const modeloId of modeloIds) {
      const groupData = await this.getSalesByGroup(modeloId, fechaInicio, fechaFin);
      comparisons.push(groupData);
    }

    // Ordenar por total de ventas (de mayor a menor)
    comparisons.sort((a: any, b: any) => b.totalGrupo - a.totalGrupo);

    return {
      comparaciones: comparisons,
      totalModelos: comparisons.length,
      periodo: { fechaInicio, fechaFin },
    };
  }

  // ========== CHATTERS ACTIVOS (CON SESIÓN INICIADA) ==========

  async getActiveChatters(): Promise<any[]> {
    // Esta funcionalidad requiere tracking de sesiones activas
    // Por ahora, retornar todos los chatters activos del sistema
    // En el futuro, integrar con sistema de tracking de sesiones en tiempo real
    
    const chatters = await this.empleadoModel
      .find({
        estado: 'ACTIVO',
        cargoId: { $exists: true }
      })
      .populate('cargoId', 'name code')
      .exec();

    // Filtrar solo los que tienen cargo de Chatter
    const chattersCargo = chatters.filter((emp: any) => {
      const cargo = emp.cargoId;
      return cargo && (cargo.code === 'SLS_CHT' || cargo.code === 'SLS_CHS' || 
                      cargo.name === 'Chatter' || cargo.name === 'Chatter Supernumerario');
    });

    return chattersCargo.map((chatter: any) => ({
      id: chatter._id,
      nombre: `${chatter.nombre} ${chatter.apellido}`,
      correoElectronico: chatter.correoElectronico,
      cargo: chatter.cargoId.name,
      // TODO: Agregar estado de sesión activa cuando se implemente tracking
      sesionActiva: false,
    }));
  }

  // ========== OBTENER CHATTERS DE UNA MODELO ==========

  async getChattersForModel(modeloId: string): Promise<any> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('Invalid model ID format');
    }

    const modelo = await this.modeloModel
      .findById(modeloId)
      .populate('equipoChatters.turnoAM', 'nombre apellido correoElectronico cargoId')
      .populate('equipoChatters.turnoPM', 'nombre apellido correoElectronico cargoId')
      .populate('equipoChatters.turnoMadrugada', 'nombre apellido correoElectronico cargoId')
      .populate('equipoChatters.supernumerario', 'nombre apellido correoElectronico cargoId')
      .exec();

    if (!modelo) {
      throw new NotFoundException(`Model with ID '${modeloId}' not found`);
    }

    return {
      modeloId: modelo._id,
      nombreCompleto: modelo.nombreCompleto,
      equipoChatters: {
        AM: modelo.equipoChatters.turnoAM,
        PM: modelo.equipoChatters.turnoPM,
        MADRUGADA: modelo.equipoChatters.turnoMadrugada,
        SUPERNUMERARIO: modelo.equipoChatters.supernumerario,
      },
    };
  }

  // ========== UTILIDADES ==========

  private async isChatterAssignedToModel(chatterId: string, modeloId: string): Promise<boolean> {
    const modelo = await this.modeloModel.findById(modeloId).exec();
    if (!modelo) return false;

    const chatterIdObj = chatterId.toString();
    return (
      modelo.equipoChatters.turnoAM.toString() === chatterIdObj ||
      modelo.equipoChatters.turnoPM.toString() === chatterIdObj ||
      modelo.equipoChatters.turnoMadrugada.toString() === chatterIdObj ||
      modelo.equipoChatters.supernumerario.toString() === chatterIdObj
    );
  }

  // ========== ESTADÍSTICAS GENERALES ==========

  async getGeneralStats(fechaInicio?: string, fechaFin?: string): Promise<any> {
    const query: any = {};
    if (fechaInicio || fechaFin) {
      query.fechaVenta = {};
      if (fechaInicio) query.fechaVenta.$gte = new Date(fechaInicio);
      if (fechaFin) query.fechaVenta.$lte = new Date(fechaFin);
    }

    const totalVentas = await this.chatterSaleModel.countDocuments(query).exec();
    
    const ventasAggregate = await this.chatterSaleModel.aggregate([
      { $match: query },
      { $group: { _id: null, totalMonto: { $sum: '$monto' }, promedioVenta: { $avg: '$monto' } } },
    ]).exec();

    const totalMonto = ventasAggregate.length > 0 ? ventasAggregate[0].totalMonto : 0;
    const promedioVenta = ventasAggregate.length > 0 ? ventasAggregate[0].promedioVenta : 0;

    // Top chatters por ventas
    const topChatters = await this.chatterSaleModel.aggregate([
      { $match: query },
      { $group: { _id: '$chatterId', total: { $sum: '$monto' }, count: { $sum: 1 } } },
      { $lookup: { from: 'rrhh_empleados', localField: '_id', foreignField: '_id', as: 'chatter' } },
      { $unwind: '$chatter' },
      { $project: { 
        chatterId: '$_id', 
        nombre: { $concat: ['$chatter.nombre', ' ', '$chatter.apellido'] },
        total: 1, 
        count: 1 
      }},
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]).exec();

    // Top modelos por ventas
    const topModelos = await this.chatterSaleModel.aggregate([
      { $match: query },
      { $group: { _id: '$modeloId', total: { $sum: '$monto' }, count: { $sum: 1 } } },
      { $lookup: { from: 'rrhh_modelos', localField: '_id', foreignField: '_id', as: 'modelo' } },
      { $unwind: '$modelo' },
      { $project: { 
        modeloId: '$_id', 
        nombreCompleto: '$modelo.nombreCompleto',
        total: 1, 
        count: 1 
      }},
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]).exec();

    return {
      totalVentas,
      totalMonto,
      promedioVenta,
      topChatters,
      topModelos,
      periodo: { fechaInicio, fechaFin },
    };
  }
}

