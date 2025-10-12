import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ModeloEntity, ModeloDocument } from './modelo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from './empleado.schema.js';
import { CargoEntity, CargoDocument } from './cargo.schema.js';
import { CreateModeloDto } from './dto/create-modelo.dto.js';
import { UpdateModeloDto } from './dto/update-modelo.dto.js';
import { ChatterSaleEntity, ChatterSaleDocument } from '../chatter/chatter-sale.schema.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

@Injectable()
export class ModelosService {
  constructor(
    @InjectModel(ModeloEntity.name) private modeloModel: Model<ModeloDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(CargoEntity.name) private cargoModel: Model<CargoDocument>,
    @InjectModel(ChatterSaleEntity.name) private chatterSaleModel: Model<ChatterSaleDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ========== UTILIDADES ==========

  /**
   * Normaliza las URLs de las imágenes en un modelo
   */
  private normalizeModeloImageUrls(modelo: any): any {
    if (modelo.fotoPerfil) {
      modelo.fotoPerfil = this.cloudinaryService.normalizeImageUrl(modelo.fotoPerfil);
    }
    return modelo;
  }

  // ========== CRUD DE MODELOS ==========

  async createModelo(createModeloDto: CreateModeloDto): Promise<ModeloDocument> {
    // Verificar que el correo no exista
    const existingEmail = await this.modeloModel.findOne({
      correoElectronico: createModeloDto.correoElectronico.toLowerCase(),
    }).exec();

    if (existingEmail) {
      throw new ConflictException(`Model with email '${createModeloDto.correoElectronico}' already exists`);
    }

    // Verificar que el número de identificación no exista
    const existingId = await this.modeloModel.findOne({
      numeroIdentificacion: createModeloDto.numeroIdentificacion,
    }).exec();

    if (existingId) {
      throw new ConflictException(`Model with ID '${createModeloDto.numeroIdentificacion}' already exists`);
    }

    // Validar Sales Closer
    await this.validateSalesCloser(createModeloDto.salesCloserAsignado);

    // Validar Chatters
    await this.validateChatters(
      createModeloDto.equipoChatters.turnoAM,
      createModeloDto.equipoChatters.turnoPM,
      createModeloDto.equipoChatters.turnoMadrugada,
      createModeloDto.equipoChatters.supernumerario,
    );

    // Validar Trafficker
    await this.validateTrafficker(createModeloDto.traffickerAsignado);

    // Crear modelo
    const modelo = new this.modeloModel({
      ...createModeloDto,
      correoElectronico: createModeloDto.correoElectronico.toLowerCase(),
      fechaNacimiento: new Date(createModeloDto.fechaNacimiento),
      fechaInicio: createModeloDto.fechaInicio ? new Date(createModeloDto.fechaInicio) : null,
      estado: createModeloDto.estado || 'ACTIVA',
      salesCloserAsignado: new Types.ObjectId(createModeloDto.salesCloserAsignado),
      traffickerAsignado: new Types.ObjectId(createModeloDto.traffickerAsignado),
      equipoChatters: {
        turnoAM: new Types.ObjectId(createModeloDto.equipoChatters.turnoAM),
        turnoPM: new Types.ObjectId(createModeloDto.equipoChatters.turnoPM),
        turnoMadrugada: new Types.ObjectId(createModeloDto.equipoChatters.turnoMadrugada),
        supernumerario: new Types.ObjectId(createModeloDto.equipoChatters.supernumerario),
      },
    });

    return await modelo.save();
  }

  async findAllModelos(
    includeInactive = false,
    salesCloserId?: string,
    traffickerId?: string,
  ): Promise<ModeloDocument[]> {
    const filter: any = includeInactive ? {} : { estado: 'ACTIVA' };

    if (salesCloserId) {
      if (!Types.ObjectId.isValid(salesCloserId)) {
        throw new BadRequestException('Invalid Sales Closer ID format');
      }
      filter.salesCloserAsignado = new Types.ObjectId(salesCloserId);
    }

    if (traffickerId) {
      if (!Types.ObjectId.isValid(traffickerId)) {
        throw new BadRequestException('Invalid Trafficker ID format');
      }
      filter.traffickerAsignado = new Types.ObjectId(traffickerId);
    }

    const modelos = await this.modeloModel
      .find(filter)
      .populate('salesCloserAsignado', 'nombre apellido correoElectronico cargoId')
      .populate('traffickerAsignado', 'nombre apellido correoElectronico cargoId')
      .populate('equipoChatters.turnoAM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoPM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoMadrugada', 'nombre apellido correoElectronico')
      .populate('equipoChatters.supernumerario', 'nombre apellido correoElectronico')
      .sort({ fechaRegistro: -1, nombreCompleto: 1 })
      .exec();

    // Normalizar URLs de imágenes
    return modelos.map(modelo => this.normalizeModeloImageUrls(modelo.toObject()));
  }

  async findModeloById(id: string): Promise<ModeloDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid model ID format');
    }

    const modelo = await this.modeloModel
      .findById(id)
      .populate('salesCloserAsignado', 'nombre apellido correoElectronico telefono cargoId')
      .populate('traffickerAsignado', 'nombre apellido correoElectronico telefono cargoId')
      .populate('equipoChatters.turnoAM', 'nombre apellido correoElectronico telefono')
      .populate('equipoChatters.turnoPM', 'nombre apellido correoElectronico telefono')
      .populate('equipoChatters.turnoMadrugada', 'nombre apellido correoElectronico telefono')
      .populate('equipoChatters.supernumerario', 'nombre apellido correoElectronico telefono')
      .exec();

    if (!modelo) {
      throw new NotFoundException(`Model with ID '${id}' not found`);
    }

    // Normalizar URLs de imágenes
    return this.normalizeModeloImageUrls(modelo.toObject());
  }

  async updateModelo(id: string, updateModeloDto: UpdateModeloDto): Promise<ModeloDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid model ID format');
    }

    // Si se actualiza el correo, verificar que no exista
    if (updateModeloDto.correoElectronico) {
      const existingEmail = await this.modeloModel.findOne({
        correoElectronico: updateModeloDto.correoElectronico.toLowerCase(),
        _id: { $ne: new Types.ObjectId(id) },
      }).exec();

      if (existingEmail) {
        throw new ConflictException(`Model with email '${updateModeloDto.correoElectronico}' already exists`);
      }
    }

    // Si se actualiza el número de identificación, verificar que no exista
    if (updateModeloDto.numeroIdentificacion) {
      const existingId = await this.modeloModel.findOne({
        numeroIdentificacion: updateModeloDto.numeroIdentificacion,
        _id: { $ne: new Types.ObjectId(id) },
      }).exec();

      if (existingId) {
        throw new ConflictException(`Model with ID '${updateModeloDto.numeroIdentificacion}' already exists`);
      }
    }

    // Validar asignaciones si se actualizan
    if (updateModeloDto.salesCloserAsignado) {
      await this.validateSalesCloser(updateModeloDto.salesCloserAsignado);
    }

    if (updateModeloDto.equipoChatters) {
      await this.validateChatters(
        updateModeloDto.equipoChatters.turnoAM,
        updateModeloDto.equipoChatters.turnoPM,
        updateModeloDto.equipoChatters.turnoMadrugada,
        updateModeloDto.equipoChatters.supernumerario,
      );
    }

    if (updateModeloDto.traffickerAsignado) {
      await this.validateTrafficker(updateModeloDto.traffickerAsignado);
    }

    // Preparar datos actualizados
    const updatedData: any = {
      ...updateModeloDto,
      ...(updateModeloDto.correoElectronico && { 
        correoElectronico: updateModeloDto.correoElectronico.toLowerCase() 
      }),
      ...(updateModeloDto.fechaNacimiento && { 
        fechaNacimiento: new Date(updateModeloDto.fechaNacimiento) 
      }),
      ...(updateModeloDto.fechaInicio && { 
        fechaInicio: new Date(updateModeloDto.fechaInicio) 
      }),
      ...(updateModeloDto.salesCloserAsignado && {
        salesCloserAsignado: new Types.ObjectId(updateModeloDto.salesCloserAsignado),
      }),
      ...(updateModeloDto.traffickerAsignado && {
        traffickerAsignado: new Types.ObjectId(updateModeloDto.traffickerAsignado),
      }),
      ...(updateModeloDto.equipoChatters && {
        equipoChatters: {
          turnoAM: new Types.ObjectId(updateModeloDto.equipoChatters.turnoAM),
          turnoPM: new Types.ObjectId(updateModeloDto.equipoChatters.turnoPM),
          turnoMadrugada: new Types.ObjectId(updateModeloDto.equipoChatters.turnoMadrugada),
          supernumerario: new Types.ObjectId(updateModeloDto.equipoChatters.supernumerario),
        },
      }),
    };

    const modelo = await this.modeloModel
      .findByIdAndUpdate(id, updatedData, { new: true, runValidators: true })
      .populate('salesCloserAsignado', 'nombre apellido correoElectronico cargoId')
      .populate('traffickerAsignado', 'nombre apellido correoElectronico cargoId')
      .populate('equipoChatters.turnoAM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoPM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoMadrugada', 'nombre apellido correoElectronico')
      .populate('equipoChatters.supernumerario', 'nombre apellido correoElectronico')
      .exec();

    if (!modelo) {
      throw new NotFoundException(`Model with ID '${id}' not found`);
    }

    // Normalizar URLs de imágenes
    return this.normalizeModeloImageUrls(modelo.toObject());
  }

  async deleteModelo(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid model ID format');
    }

    // En lugar de eliminar, marcar como TERMINADA
    const result = await this.modeloModel
      .findByIdAndUpdate(id, { estado: 'TERMINADA' }, { new: true })
      .exec();

    if (!result) {
      throw new NotFoundException(`Model with ID '${id}' not found`);
    }
  }

  // ========== VALIDACIONES ==========

  private async validateSalesCloser(salesCloserId: string): Promise<void> {
    if (!Types.ObjectId.isValid(salesCloserId)) {
      throw new BadRequestException('Invalid Sales Closer ID format');
    }

    const empleado = await this.empleadoModel
      .findById(salesCloserId)
      .populate('cargoId')
      .exec();

    if (!empleado || empleado.estado !== 'ACTIVO') {
      throw new BadRequestException('Invalid or inactive Sales Closer');
    }

    // Verificar que sea Sales Closer por código o nombre de cargo
    const cargo = empleado.cargoId as any;
    if (!cargo || (cargo.code !== 'REC_SC' && cargo.name !== 'Sales Closer')) {
      throw new BadRequestException('Employee is not a Sales Closer');
    }
  }

  private async validateChatters(...chatterIds: string[]): Promise<void> {
    for (const chatterId of chatterIds) {
      if (!Types.ObjectId.isValid(chatterId)) {
        throw new BadRequestException(`Invalid Chatter ID format: ${chatterId}`);
      }

      const empleado = await this.empleadoModel
        .findById(chatterId)
        .populate('cargoId')
        .exec();

      if (!empleado || empleado.estado !== 'ACTIVO') {
        throw new BadRequestException(`Invalid or inactive Chatter: ${chatterId}`);
      }

      // Verificar que sea Chatter o Chatter Supernumerario por código o nombre
      const cargo = empleado.cargoId as any;
      const validCodes = ['SLS_CHT', 'SLS_CHS'];
      const validNames = ['Chatter', 'Chatter Supernumerario'];
      
      if (!cargo || (!validCodes.includes(cargo.code) && !validNames.includes(cargo.name))) {
        throw new BadRequestException(`Employee ${chatterId} is not a Chatter`);
      }
    }

    // Verificar que no haya chatters duplicados
    const uniqueIds = new Set(chatterIds);
    if (uniqueIds.size !== chatterIds.length) {
      throw new BadRequestException('Duplicate chatters are not allowed');
    }
  }

  private async validateTrafficker(traffickerId: string): Promise<void> {
    if (!Types.ObjectId.isValid(traffickerId)) {
      throw new BadRequestException('Invalid Trafficker ID format');
    }

    const empleado = await this.empleadoModel
      .findById(traffickerId)
      .populate('cargoId')
      .exec();

    if (!empleado || empleado.estado !== 'ACTIVO') {
      throw new BadRequestException('Invalid or inactive Trafficker');
    }

    // Verificar que sea Trafficker por código o nombre
    const cargo = empleado.cargoId as any;
    if (!cargo || (cargo.code !== 'TRF_TRF' && cargo.name !== 'Trafficker')) {
      throw new BadRequestException('Employee is not a Trafficker');
    }
  }

  // ========== UTILIDADES ==========

  async getModelosStats(): Promise<any> {
    const totalModelos = await this.modeloModel.countDocuments().exec();
    const modelosActivas = await this.modeloModel.countDocuments({ estado: 'ACTIVA' }).exec();

    // Promedio de facturación de todas las modelos activas
    const avgFacturacion = await this.modeloModel.aggregate([
      { $match: { estado: 'ACTIVA' } },
      { $group: { _id: null, avgMensual: { $avg: '$promedioFacturacionMensual' } } },
    ]).exec();

    // Modelos por Sales Closer
    const modelosPorSalesCloser = await this.modeloModel.aggregate([
      { $match: { estado: 'ACTIVA' } },
      { $group: { _id: '$salesCloserAsignado', count: { $sum: 1 } } },
      { $lookup: { from: 'rrhh_empleados', localField: '_id', foreignField: '_id', as: 'empleado' } },
      { $unwind: '$empleado' },
      { $project: { _id: 0, empleado: { $concat: ['$empleado.nombre', ' ', '$empleado.apellido'] }, count: 1 } },
    ]).exec();

    // Modelos por Trafficker
    const modelosPorTrafficker = await this.modeloModel.aggregate([
      { $match: { estado: 'ACTIVA' } },
      { $group: { _id: '$traffickerAsignado', count: { $sum: 1 } } },
      { $lookup: { from: 'rrhh_empleados', localField: '_id', foreignField: '_id', as: 'empleado' } },
      { $unwind: '$empleado' },
      { $project: { _id: 0, empleado: { $concat: ['$empleado.nombre', ' ', '$empleado.apellido'] }, count: 1 } },
    ]).exec();

    return {
      totalModelos,
      modelosActivas,
      modelosInactivas: totalModelos - modelosActivas,
      promedioFacturacionMensual: avgFacturacion.length > 0 ? avgFacturacion[0].avgMensual : 0,
      modelosPorSalesCloser,
      modelosPorTrafficker,
    };
  }

  // Obtener empleados disponibles por cargo
  async getEmpleadosPorCargo(cargoCode: string): Promise<EmpleadoDocument[]> {
    const cargo = await this.cargoModel.findOne({ 
      code: cargoCode.toUpperCase(),
      isActive: true 
    }).exec();

    if (!cargo) {
      // Intentar buscar por nombre
      const cargoByName = await this.cargoModel.findOne({ 
        name: cargoCode,
        isActive: true 
      }).exec();
      
      if (!cargoByName) {
        throw new NotFoundException(`Position with code or name '${cargoCode}' not found`);
      }

      return await this.empleadoModel
        .find({ cargoId: cargoByName._id, estado: 'ACTIVO' })
        .populate('cargoId', 'name code')
        .sort({ nombre: 1, apellido: 1 })
        .exec();
    }

    return await this.empleadoModel
      .find({ cargoId: cargo._id, estado: 'ACTIVO' })
      .populate('cargoId', 'name code')
      .sort({ nombre: 1, apellido: 1 })
      .exec();
  }

  // ========== MÓDULO DE VENTAS DE MODELOS ==========

  /**
   * Obtener ventas individuales de una modelo con filtros avanzados
   */
  async getModeloSales(
    modeloId: string,
    filters?: {
      fechaInicio?: string;
      fechaFin?: string;
      chatterId?: string;
      turno?: string;
      tipoVenta?: string;
      plataforma?: string;
    }
  ): Promise<any> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('Invalid model ID format');
    }

    const modelo = await this.modeloModel
      .findById(modeloId)
      .populate('salesCloserAsignado', 'nombre apellido correoElectronico')
      .populate('traffickerAsignado', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoAM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoPM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoMadrugada', 'nombre apellido correoElectronico')
      .populate('equipoChatters.supernumerario', 'nombre apellido correoElectronico')
      .exec();

    if (!modelo) {
      throw new NotFoundException(`Model with ID '${modeloId}' not found`);
    }

    // Construir query
    const query: any = { modeloId: new Types.ObjectId(modeloId) };

    if (filters?.fechaInicio || filters?.fechaFin) {
      query.fechaVenta = {};
      if (filters.fechaInicio) query.fechaVenta.$gte = new Date(filters.fechaInicio);
      if (filters.fechaFin) query.fechaVenta.$lte = new Date(filters.fechaFin);
    }

    if (filters?.chatterId && Types.ObjectId.isValid(filters.chatterId)) {
      query.chatterId = new Types.ObjectId(filters.chatterId);
    }

    if (filters?.turno) {
      query.turno = filters.turno;
    }

    if (filters?.tipoVenta) {
      query.tipoVenta = filters.tipoVenta;
    }

    if (filters?.plataforma) {
      query.plataforma = filters.plataforma;
    }

    // Obtener ventas
    const ventas = await this.chatterSaleModel
      .find(query)
      .populate('chatterId', 'nombre apellido correoElectronico cargoId')
      .populate('registradoPor', 'username displayName')
      .sort({ fechaVenta: -1 })
      .exec();

    // Calcular totales
    const totalVentas = ventas.length;
    const totalMonto = ventas.reduce((sum, v) => sum + v.monto, 0);
    const promedioVenta = totalVentas > 0 ? totalMonto / totalVentas : 0;

    // Agrupar por chatter
    const ventasPorChatter = ventas.reduce((acc: any, venta) => {
      const chatterId = venta.chatterId?._id?.toString() || 'unknown';
      if (!acc[chatterId]) {
        acc[chatterId] = {
          chatter: venta.chatterId,
          ventas: [],
          total: 0,
          count: 0,
        };
      }
      acc[chatterId].ventas.push(venta);
      acc[chatterId].total += venta.monto;
      acc[chatterId].count += 1;
      return acc;
    }, {});

    // Agrupar por turno
    const ventasPorTurno = ventas.reduce((acc: any, venta) => {
      const turno = venta.turno;
      if (!acc[turno]) {
        acc[turno] = { total: 0, count: 0 };
      }
      acc[turno].total += venta.monto;
      acc[turno].count += 1;
      return acc;
    }, {});

    // Agrupar por tipo de venta
    const ventasPorTipo = ventas.reduce((acc: any, venta) => {
      const tipo = venta.tipoVenta;
      if (!acc[tipo]) {
        acc[tipo] = { total: 0, count: 0 };
      }
      acc[tipo].total += venta.monto;
      acc[tipo].count += 1;
      return acc;
    }, {});

    return {
      modelo: {
        id: modelo._id,
        nombreCompleto: modelo.nombreCompleto,
        correoElectronico: modelo.correoElectronico,
        fotoPerfil: modelo.fotoPerfil,
        estado: modelo.estado,
        salesCloser: modelo.salesCloserAsignado,
        trafficker: modelo.traffickerAsignado,
        equipoChatters: modelo.equipoChatters,
      },
      ventas,
      resumen: {
        totalVentas,
        totalMonto,
        promedioVenta,
        ventasPorChatter: Object.values(ventasPorChatter),
        ventasPorTurno,
        ventasPorTipo,
      },
      filtros: filters,
    };
  }

  /**
   * Obtener estadísticas de ventas de una modelo por periodo
   */
  async getModeloSalesStatistics(
    modeloId: string,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<any> {
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

    // Estadísticas generales
    const [generalStats] = await this.chatterSaleModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: 1 },
          totalMonto: { $sum: '$monto' },
          promedioVenta: { $avg: '$monto' },
          ventaMaxima: { $max: '$monto' },
          ventaMinima: { $min: '$monto' },
        },
      },
    ]).exec();

    // Ventas por mes
    const ventasPorMes = await this.chatterSaleModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            mes: { $month: '$fechaVenta' },
            anio: { $year: '$fechaVenta' },
          },
          total: { $sum: '$monto' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.anio': 1, '_id.mes': 1 } },
    ]).exec();

    // Ventas por día de la semana
    const ventasPorDiaSemana = await this.chatterSaleModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dayOfWeek: '$fechaVenta' },
          total: { $sum: '$monto' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();

    // Ventas por chatter (top performers)
    const ventasPorChatter = await this.chatterSaleModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$chatterId',
          total: { $sum: '$monto' },
          count: { $sum: 1 },
          promedio: { $avg: '$monto' },
        },
      },
      {
        $lookup: {
          from: 'rrhh_empleados',
          localField: '_id',
          foreignField: '_id',
          as: 'chatter',
        },
      },
      { $unwind: '$chatter' },
      {
        $project: {
          chatterId: '$_id',
          nombre: { $concat: ['$chatter.nombre', ' ', '$chatter.apellido'] },
          total: 1,
          count: 1,
          promedio: 1,
        },
      },
      { $sort: { total: -1 } },
    ]).exec();

    // Ventas por turno
    const ventasPorTurno = await this.chatterSaleModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$turno',
          total: { $sum: '$monto' },
          count: { $sum: 1 },
          promedio: { $avg: '$monto' },
        },
      },
      { $sort: { total: -1 } },
    ]).exec();

    // Ventas por tipo
    const ventasPorTipo = await this.chatterSaleModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$tipoVenta',
          total: { $sum: '$monto' },
          count: { $sum: 1 },
          promedio: { $avg: '$monto' },
        },
      },
      { $sort: { total: -1 } },
    ]).exec();

    // Ventas por plataforma
    const ventasPorPlataforma = await this.chatterSaleModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$plataforma',
          total: { $sum: '$monto' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]).exec();

    return {
      modelo: {
        id: modelo._id,
        nombreCompleto: modelo.nombreCompleto,
        correoElectronico: modelo.correoElectronico,
        fotoPerfil: modelo.fotoPerfil,
      },
      periodo: { fechaInicio, fechaFin },
      estadisticas: {
        general: generalStats || {
          totalVentas: 0,
          totalMonto: 0,
          promedioVenta: 0,
          ventaMaxima: 0,
          ventaMinima: 0,
        },
        ventasPorMes,
        ventasPorDiaSemana,
        ventasPorChatter,
        ventasPorTurno,
        ventasPorTipo,
        ventasPorPlataforma,
      },
    };
  }

  /**
   * Comparar ventas entre múltiples modelos
   */
  async compareModelosSales(
    modeloIds: string[],
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<any> {
    const comparaciones: any[] = [];

    for (const modeloId of modeloIds) {
      if (!Types.ObjectId.isValid(modeloId)) {
        continue; // Skip invalid IDs
      }

      const modelo = await this.modeloModel.findById(modeloId).exec();
      if (!modelo) continue;

      const query: any = { modeloId: new Types.ObjectId(modeloId) };
      if (fechaInicio || fechaFin) {
        query.fechaVenta = {};
        if (fechaInicio) query.fechaVenta.$gte = new Date(fechaInicio);
        if (fechaFin) query.fechaVenta.$lte = new Date(fechaFin);
      }

      const [stats] = await this.chatterSaleModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalVentas: { $sum: 1 },
            totalMonto: { $sum: '$monto' },
            promedioVenta: { $avg: '$monto' },
          },
        },
      ]).exec();

      comparaciones.push({
        modelo: {
          id: modelo._id,
          nombreCompleto: modelo.nombreCompleto,
          correoElectronico: modelo.correoElectronico,
          fotoPerfil: modelo.fotoPerfil,
          estado: modelo.estado,
        },
        stats: stats || {
          totalVentas: 0,
          totalMonto: 0,
          promedioVenta: 0,
        },
      });
    }

    // Ordenar por total de ventas
    comparaciones.sort((a, b) => b.stats.totalMonto - a.stats.totalMonto);

    return {
      comparaciones,
      totalModelos: comparaciones.length,
      periodo: { fechaInicio, fechaFin },
      ranking: comparaciones.map((c, index) => ({
        posicion: index + 1,
        modeloId: c.modelo.id,
        nombreCompleto: c.modelo.nombreCompleto,
        totalMonto: c.stats.totalMonto,
        totalVentas: c.stats.totalVentas,
      })),
    };
  }

  /**
   * Obtener ventas agrupadas por diferentes criterios
   */
  async getModelosSalesGrouped(
    groupBy: 'salesCloser' | 'trafficker' | 'estado' | 'mes',
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<any> {
    const dateQuery: any = {};
    if (fechaInicio || fechaFin) {
      dateQuery.fechaVenta = {};
      if (fechaInicio) dateQuery.fechaVenta.$gte = new Date(fechaInicio);
      if (fechaFin) dateQuery.fechaVenta.$lte = new Date(fechaFin);
    }

    switch (groupBy) {
      case 'salesCloser':
        return await this.groupBySalesCloser(dateQuery);
      
      case 'trafficker':
        return await this.groupByTrafficker(dateQuery);
      
      case 'estado':
        return await this.groupByEstado(dateQuery);
      
      case 'mes':
        return await this.groupByMes(dateQuery);
      
      default:
        throw new BadRequestException(`Invalid groupBy parameter: ${groupBy}`);
    }
  }

  private async groupBySalesCloser(dateQuery: any): Promise<any> {
    const ventas = await this.chatterSaleModel
      .find(dateQuery)
      .populate({
        path: 'modeloId',
        populate: {
          path: 'salesCloserAsignado',
          select: 'nombre apellido correoElectronico',
        },
      })
      .exec();

    const grouped = ventas.reduce((acc: any, venta: any) => {
      const salesCloser = venta.modeloId?.salesCloserAsignado;
      if (!salesCloser) return acc;

      const id = salesCloser._id.toString();
      if (!acc[id]) {
        acc[id] = {
          salesCloser: {
            id: salesCloser._id,
            nombre: `${salesCloser.nombre} ${salesCloser.apellido}`,
            correoElectronico: salesCloser.correoElectronico,
          },
          totalMonto: 0,
          totalVentas: 0,
          modelos: new Set(),
        };
      }

      acc[id].totalMonto += venta.monto;
      acc[id].totalVentas += 1;
      acc[id].modelos.add(venta.modeloId._id.toString());

      return acc;
    }, {});

    return {
      groupBy: 'salesCloser',
      grupos: Object.values(grouped).map((g: any) => ({
        ...g,
        totalModelos: g.modelos.size,
        modelos: undefined,
      })),
    };
  }

  private async groupByTrafficker(dateQuery: any): Promise<any> {
    const ventas = await this.chatterSaleModel
      .find(dateQuery)
      .populate({
        path: 'modeloId',
        populate: {
          path: 'traffickerAsignado',
          select: 'nombre apellido correoElectronico',
        },
      })
      .exec();

    const grouped = ventas.reduce((acc: any, venta: any) => {
      const trafficker = venta.modeloId?.traffickerAsignado;
      if (!trafficker) return acc;

      const id = trafficker._id.toString();
      if (!acc[id]) {
        acc[id] = {
          trafficker: {
            id: trafficker._id,
            nombre: `${trafficker.nombre} ${trafficker.apellido}`,
            correoElectronico: trafficker.correoElectronico,
          },
          totalMonto: 0,
          totalVentas: 0,
          modelos: new Set(),
        };
      }

      acc[id].totalMonto += venta.monto;
      acc[id].totalVentas += 1;
      acc[id].modelos.add(venta.modeloId._id.toString());

      return acc;
    }, {});

    return {
      groupBy: 'trafficker',
      grupos: Object.values(grouped).map((g: any) => ({
        ...g,
        totalModelos: g.modelos.size,
        modelos: undefined,
      })),
    };
  }

  private async groupByEstado(dateQuery: any): Promise<any> {
    const ventas = await this.chatterSaleModel
      .find(dateQuery)
      .populate('modeloId', 'estado nombreCompleto')
      .exec();

    const grouped = ventas.reduce((acc: any, venta: any) => {
      const estado = venta.modeloId?.estado || 'UNKNOWN';
      
      if (!acc[estado]) {
        acc[estado] = {
          estado,
          totalMonto: 0,
          totalVentas: 0,
          modelos: new Set(),
        };
      }

      acc[estado].totalMonto += venta.monto;
      acc[estado].totalVentas += 1;
      acc[estado].modelos.add(venta.modeloId?._id.toString());

      return acc;
    }, {});

    return {
      groupBy: 'estado',
      grupos: Object.values(grouped).map((g: any) => ({
        ...g,
        totalModelos: g.modelos.size,
        modelos: undefined,
      })),
    };
  }

  private async groupByMes(dateQuery: any): Promise<any> {
    const ventas = await this.chatterSaleModel.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: {
            mes: { $month: '$fechaVenta' },
            anio: { $year: '$fechaVenta' },
          },
          totalMonto: { $sum: '$monto' },
          totalVentas: { $sum: 1 },
          modelos: { $addToSet: '$modeloId' },
        },
      },
      {
        $project: {
          _id: 0,
          mes: '$_id.mes',
          anio: '$_id.anio',
          totalMonto: 1,
          totalVentas: 1,
          totalModelos: { $size: '$modelos' },
        },
      },
      { $sort: { anio: 1, mes: 1 } },
    ]).exec();

    return {
      groupBy: 'mes',
      grupos: ventas,
    };
  }

  /**
   * Dashboard de ventas general (todas las modelos)
   */
  async getGeneralSalesDashboard(fechaInicio?: string, fechaFin?: string): Promise<any> {
    const dateQuery: any = {};
    if (fechaInicio || fechaFin) {
      dateQuery.fechaVenta = {};
      if (fechaInicio) dateQuery.fechaVenta.$gte = new Date(fechaInicio);
      if (fechaFin) dateQuery.fechaVenta.$lte = new Date(fechaFin);
    }

    // Estadísticas generales
    const [generalStats] = await this.chatterSaleModel.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: 1 },
          totalMonto: { $sum: '$monto' },
          promedioVenta: { $avg: '$monto' },
        },
      },
    ]).exec();

    // Total de modelos activas
    const totalModelosActivas = await this.modeloModel.countDocuments({ estado: 'ACTIVA' }).exec();

    // Top 10 modelos por ventas
    const topModelos = await this.chatterSaleModel.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$modeloId',
          total: { $sum: '$monto' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'rrhh_modelos',
          localField: '_id',
          foreignField: '_id',
          as: 'modelo',
        },
      },
      { $unwind: '$modelo' },
      {
        $project: {
          modeloId: '$_id',
          nombreCompleto: '$modelo.nombreCompleto',
          fotoPerfil: '$modelo.fotoPerfil',
          total: 1,
          count: 1,
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]).exec();

    // Ventas por mes (últimos 12 meses)
    const ventasPorMes = await this.chatterSaleModel.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: {
            mes: { $month: '$fechaVenta' },
            anio: { $year: '$fechaVenta' },
          },
          total: { $sum: '$monto' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.anio': -1, '_id.mes': -1 } },
      { $limit: 12 },
    ]).exec();

    return {
      periodo: { fechaInicio, fechaFin },
      estadisticas: {
        general: generalStats || { totalVentas: 0, totalMonto: 0, promedioVenta: 0 },
        totalModelosActivas,
      },
      topModelos,
      ventasPorMes: ventasPorMes.reverse(),
    };
  }

  // ========== INDICADORES Y MÉTRICAS AVANZADAS ==========

  /**
   * Obtener indicadores completos de ventas y rentabilidad
   * Incluye datos de finanzas, crecimiento mensual, retención, etc.
   */
  async getIndicadoresVentas(fechaInicio?: string, fechaFin?: string): Promise<any> {
    const dateQuery: any = {};
    if (fechaInicio || fechaFin) {
      dateQuery.fechaVenta = {};
      if (fechaInicio) dateQuery.fechaVenta.$gte = new Date(fechaInicio);
      if (fechaFin) dateQuery.fechaVenta.$lte = new Date(fechaFin);
    }

    // Total de modelos por estado
    const modelosPorEstado = await this.modeloModel.aggregate([
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 },
        },
      },
    ]).exec();

    const estadosModelos = {
      activas: modelosPorEstado.find(e => e._id === 'ACTIVA')?.count || 0,
      inactivas: modelosPorEstado.find(e => e._id === 'INACTIVA')?.count || 0,
      suspendidas: modelosPorEstado.find(e => e._id === 'SUSPENDIDA')?.count || 0,
      terminadas: modelosPorEstado.find(e => e._id === 'TERMINADA')?.count || 0,
    };

    // Modelos nuevas por periodo (últimos 3 meses)
    const modelosNuevasPorPeriodo = await this.getModelosNuevasPorPeriodo();

    // Tasa de retención (modelos activas después de 3 meses)
    const tasaRetencion = await this.getTasaRetencionModelos();

    // Comparativo de crecimiento mensual
    const crecimientoMensual = await this.getCrecimientoMensualVentas();

    // Ranking de rentabilidad (top 10 modelos más rentables)
    const rankingRentabilidad = await this.getRankingRentabilidad(fechaInicio, fechaFin);

    return {
      periodo: { fechaInicio, fechaFin },
      modelosPorEstado: estadosModelos,
      modelosNuevasPorPeriodo,
      tasaRetencion,
      crecimientoMensual,
      rankingRentabilidad,
    };
  }

  /**
   * Obtener modelos nuevas por periodo
   */
  private async getModelosNuevasPorPeriodo(): Promise<any> {
    const hoy = new Date();
    const hace3Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);

    const modelosPorMes = await this.modeloModel.aggregate([
      {
        $match: {
          fechaRegistro: { $gte: hace3Meses },
        },
      },
      {
        $group: {
          _id: {
            mes: { $month: '$fechaRegistro' },
            anio: { $year: '$fechaRegistro' },
          },
          count: { $sum: 1 },
          modelos: { $push: { id: '$_id', nombre: '$nombreCompleto' } },
        },
      },
      { $sort: { '_id.anio': 1, '_id.mes': 1 } },
    ]).exec();

    return {
      ultimos3Meses: modelosPorMes,
      totalUltimos3Meses: modelosPorMes.reduce((sum, m) => sum + m.count, 0),
    };
  }

  /**
   * Calcular tasa de retención de modelos
   * Fórmula: (Modelos activas después de 3 meses / modelos ingresadas en ese periodo) × 100
   */
  private async getTasaRetencionModelos(): Promise<any> {
    const hoy = new Date();
    const hace3Meses = new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate());

    // Modelos registradas hace 3 meses o más
    const modelosRegistradasHace3Meses = await this.modeloModel.countDocuments({
      fechaRegistro: { $lte: hace3Meses },
    }).exec();

    // De esas, cuántas siguen activas
    const modelosActivasDepues3Meses = await this.modeloModel.countDocuments({
      fechaRegistro: { $lte: hace3Meses },
      estado: 'ACTIVA',
    }).exec();

    const tasaRetencion = modelosRegistradasHace3Meses > 0
      ? (modelosActivasDepues3Meses / modelosRegistradasHace3Meses) * 100
      : 0;

    return {
      modelosRegistradasHace3Meses,
      modelosActivasDepues3Meses,
      tasaRetencion: Math.round(tasaRetencion * 100) / 100, // 2 decimales
      porcentajeFormateado: `${tasaRetencion.toFixed(2)}%`,
    };
  }

  /**
   * Obtener comparativo de crecimiento mensual de ventas
   */
  private async getCrecimientoMensualVentas(): Promise<any> {
    const ventasPorMes = await this.chatterSaleModel.aggregate([
      {
        $group: {
          _id: {
            mes: { $month: '$fechaVenta' },
            anio: { $year: '$fechaVenta' },
          },
          totalVentas: { $sum: 1 },
          totalMonto: { $sum: '$monto' },
        },
      },
      { $sort: { '_id.anio': -1, '_id.mes': -1 } },
      { $limit: 12 },
    ]).exec();

    // Calcular crecimiento mes a mes
    const crecimientoConDetalle = ventasPorMes.map((mes, index) => {
      const mesAnterior = ventasPorMes[index + 1];
      let crecimientoVentas = 0;
      let crecimientoMonto = 0;

      if (mesAnterior) {
        crecimientoVentas = mesAnterior.totalVentas > 0
          ? ((mes.totalVentas - mesAnterior.totalVentas) / mesAnterior.totalVentas) * 100
          : 0;
        
        crecimientoMonto = mesAnterior.totalMonto > 0
          ? ((mes.totalMonto - mesAnterior.totalMonto) / mesAnterior.totalMonto) * 100
          : 0;
      }

      return {
        mes: mes._id.mes,
        anio: mes._id.anio,
        totalVentas: mes.totalVentas,
        totalMonto: mes.totalMonto,
        crecimientoVentas: Math.round(crecimientoVentas * 100) / 100,
        crecimientoMonto: Math.round(crecimientoMonto * 100) / 100,
      };
    });

    return crecimientoConDetalle.reverse();
  }

  /**
   * Obtener ranking de modelos más rentables
   * Combina ventas con datos de finanzas para calcular rentabilidad real
   */
  private async getRankingRentabilidad(fechaInicio?: string, fechaFin?: string): Promise<any> {
    // Aquí necesitamos inyectar FinanzasModeloEntity para acceder a datos de rentabilidad
    // Por ahora, calculamos basándonos en ventas
    const dateQuery: any = {};
    if (fechaInicio || fechaFin) {
      dateQuery.fechaVenta = {};
      if (fechaInicio) dateQuery.fechaVenta.$gte = new Date(fechaInicio);
      if (fechaFin) dateQuery.fechaVenta.$lte = new Date(fechaFin);
    }

    const ranking = await this.chatterSaleModel.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$modeloId',
          totalVentas: { $sum: 1 },
          totalMonto: { $sum: '$monto' },
          promedioVenta: { $avg: '$monto' },
        },
      },
      {
        $lookup: {
          from: 'rrhh_modelos',
          localField: '_id',
          foreignField: '_id',
          as: 'modelo',
        },
      },
      { $unwind: '$modelo' },
      {
        $project: {
          modeloId: '$_id',
          nombreCompleto: '$modelo.nombreCompleto',
          correoElectronico: '$modelo.correoElectronico',
          fotoPerfil: '$modelo.fotoPerfil',
          estado: '$modelo.estado',
          totalVentas: 1,
          totalMonto: 1,
          promedioVenta: 1,
        },
      },
      { $sort: { totalMonto: -1 } },
      { $limit: 20 },
    ]).exec();

    return ranking.map((item, index) => ({
      ranking: index + 1,
      ...item,
    }));
  }

  // ========== EXPORTACIÓN A EXCEL ==========

  /**
   * Exportar ventas de modelos a Excel
   */
  async exportVentasToExcel(filters?: {
    modeloId?: string;
    fechaInicio?: string;
    fechaFin?: string;
    chatterId?: string;
    turno?: string;
    tipoVenta?: string;
  }): Promise<Buffer> {
    // Construir query
    const query: any = {};

    if (filters?.modeloId && Types.ObjectId.isValid(filters.modeloId)) {
      query.modeloId = new Types.ObjectId(filters.modeloId);
    }

    if (filters?.fechaInicio || filters?.fechaFin) {
      query.fechaVenta = {};
      if (filters.fechaInicio) query.fechaVenta.$gte = new Date(filters.fechaInicio);
      if (filters.fechaFin) query.fechaVenta.$lte = new Date(filters.fechaFin);
    }

    if (filters?.chatterId && Types.ObjectId.isValid(filters.chatterId)) {
      query.chatterId = new Types.ObjectId(filters.chatterId);
    }

    if (filters?.turno) query.turno = filters.turno;
    if (filters?.tipoVenta) query.tipoVenta = filters.tipoVenta;

    // Obtener ventas con populate
    const ventas = await this.chatterSaleModel
      .find(query)
      .populate('modeloId', 'nombreCompleto correoElectronico estado')
      .populate('chatterId', 'nombre apellido correoElectronico')
      .sort({ fechaVenta: -1 })
      .exec();

    // Lazy load ExcelJS
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ventas de Modelos');

    // Metadatos
    workbook.creator = 'OnlyTop';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Configurar columnas
    worksheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 18 },
      { header: 'Modelo', key: 'modelo', width: 30 },
      { header: 'Chatter', key: 'chatter', width: 30 },
      { header: 'Turno', key: 'turno', width: 15 },
      { header: 'Tipo Venta', key: 'tipoVenta', width: 15 },
      { header: 'Plataforma', key: 'plataforma', width: 15 },
      { header: 'Monto (USD)', key: 'monto', width: 15 },
      { header: 'Estado Modelo', key: 'estadoModelo', width: 15 },
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Agregar datos
    let totalMonto = 0;
    ventas.forEach((venta) => {
      const modelo = venta.modeloId as any;
      const chatter = venta.chatterId as any;

      worksheet.addRow({
        fecha: venta.fechaVenta.toLocaleString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        modelo: modelo?.nombreCompleto || 'N/A',
        chatter: chatter ? `${chatter.nombre} ${chatter.apellido}` : 'N/A',
        turno: venta.turno,
        tipoVenta: venta.tipoVenta,
        plataforma: venta.plataforma || 'N/A',
        monto: venta.monto,
        estadoModelo: modelo?.estado || 'N/A',
      });

      totalMonto += venta.monto;
    });

    // Agregar fila de totales
    const lastRow = worksheet.addRow({
      fecha: '',
      modelo: '',
      chatter: '',
      turno: '',
      tipoVenta: '',
      plataforma: 'TOTAL:',
      monto: totalMonto,
      estadoModelo: '',
    });

    lastRow.font = { bold: true, size: 12 };
    lastRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };

    // Formatear columna de monto como moneda
    worksheet.getColumn('monto').numFmt = '"$"#,##0.00';

    // Ajustar altura de filas
    worksheet.eachRow((row) => {
      row.height = 20;
    });

    // Agregar bordes a todas las celdas
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Agregar resumen en hoja separada
    const summarySheet = workbook.addWorksheet('Resumen');
    summarySheet.addRow(['Reporte de Ventas - OnlyTop']);
    summarySheet.addRow(['Generado:', new Date().toLocaleString('es-ES')]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total de ventas:', ventas.length]);
    summarySheet.addRow(['Monto total (USD):', totalMonto]);
    summarySheet.addRow(['Promedio por venta (USD):', ventas.length > 0 ? totalMonto / ventas.length : 0]);

    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 25;
    summarySheet.getRow(1).font = { bold: true, size: 14 };

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ========== EXPORTACIÓN A PDF ==========

  /**
   * Exportar ventas de modelos a PDF
   */
  async exportVentasToPdf(filters?: {
    modeloId?: string;
    fechaInicio?: string;
    fechaFin?: string;
    chatterId?: string;
    turno?: string;
    tipoVenta?: string;
  }): Promise<Buffer> {
    // Construir query
    const query: any = {};

    if (filters?.modeloId && Types.ObjectId.isValid(filters.modeloId)) {
      query.modeloId = new Types.ObjectId(filters.modeloId);
    }

    if (filters?.fechaInicio || filters?.fechaFin) {
      query.fechaVenta = {};
      if (filters.fechaInicio) query.fechaVenta.$gte = new Date(filters.fechaInicio);
      if (filters.fechaFin) query.fechaVenta.$lte = new Date(filters.fechaFin);
    }

    if (filters?.chatterId && Types.ObjectId.isValid(filters.chatterId)) {
      query.chatterId = new Types.ObjectId(filters.chatterId);
    }

    if (filters?.turno) query.turno = filters.turno;
    if (filters?.tipoVenta) query.tipoVenta = filters.tipoVenta;

    // Obtener ventas con populate
    const ventas = await this.chatterSaleModel
      .find(query)
      .populate('modeloId', 'nombreCompleto correoElectronico estado')
      .populate('chatterId', 'nombre apellido correoElectronico')
      .sort({ fechaVenta: -1 })
      .exec();

    // Lazy load PDFKit
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
    });

    // Metadatos
    doc.info = {
      Title: 'Reporte de Ventas de Modelos - OnlyTop',
      Author: 'OnlyTop',
      Subject: 'Reporte de Ventas',
      Creator: 'OnlyTop Sistema de Gestión',
      Producer: 'OnlyTop PDF Generator',
      CreationDate: new Date(),
    };

    // Generar contenido del PDF
    this.addPdfHeader(doc);
    this.addPdfFilters(doc, filters);
    this.addPdfSummary(doc, ventas);
    this.addPdfTable(doc, ventas);
    this.addPdfFooter(doc);

    // Generar buffer
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      doc.end();
    });
  }

  private addPdfHeader(doc: any): void {
    // Título principal
    doc.fontSize(24)
       .fillColor('#1e40af')
       .font('Helvetica-Bold')
       .text('REPORTE DE VENTAS DE MODELOS', { align: 'center' })
       .moveDown(0.5);

    // Subtítulo
    doc.fontSize(14)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text('OnlyTop - Gestión de Contenido Digital', { align: 'center' })
       .moveDown(1);

    // Línea separadora
    doc.strokeColor('#e5e7eb')
       .lineWidth(1)
       .moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .stroke();
    
    doc.moveDown(1);
  }

  private addPdfFilters(doc: any, filters?: any): void {
    if (!filters || Object.keys(filters).length === 0) return;

    doc.fontSize(12)
       .fillColor('#374151')
       .font('Helvetica-Bold')
       .text('Filtros Aplicados:', { underline: true })
       .moveDown(0.3);

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#6b7280');

    const filterTexts: string[] = [];
    if (filters.fechaInicio) filterTexts.push(`Fecha inicio: ${filters.fechaInicio}`);
    if (filters.fechaFin) filterTexts.push(`Fecha fin: ${filters.fechaFin}`);
    if (filters.turno) filterTexts.push(`Turno: ${filters.turno}`);
    if (filters.tipoVenta) filterTexts.push(`Tipo venta: ${filters.tipoVenta}`);

    if (filterTexts.length > 0) {
      doc.text(filterTexts.join(' • '));
    } else {
      doc.text('Sin filtros específicos');
    }

    doc.moveDown(0.5);
  }

  private addPdfSummary(doc: any, ventas: any[]): void {
    const totalVentas = ventas.length;
    const totalMonto = ventas.reduce((sum, v) => sum + v.monto, 0);
    const promedioVenta = totalVentas > 0 ? totalMonto / totalVentas : 0;

    doc.fontSize(12)
       .fillColor('#374151')
       .font('Helvetica-Bold')
       .text('Resumen Ejecutivo', { underline: true })
       .moveDown(0.3);

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#6b7280');

    const summaryData = [
      { label: 'Total de Ventas:', value: totalVentas.toString() },
      { label: 'Monto Total (USD):', value: `$${totalMonto.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
      { label: 'Promedio por Venta:', value: `$${promedioVenta.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    ];

    summaryData.forEach(item => {
      doc.text(`${item.label} ${item.value}`);
    });

    doc.moveDown(1);
  }

  private addPdfTable(doc: any, ventas: any[]): void {
    if (ventas.length === 0) {
      doc.fontSize(12)
         .fillColor('#6b7280')
         .font('Helvetica')
         .text('No hay ventas para mostrar con los filtros aplicados.', { align: 'center' });
      return;
    }

    doc.fontSize(12)
       .fillColor('#374151')
       .font('Helvetica-Bold')
       .text('Detalle de Ventas', { underline: true })
       .moveDown(0.5);

    // Configurar tabla
    const tableTop = doc.y;
    const itemHeight = 20;
    const pageHeight = 800;
    let currentY = tableTop;

    // Headers
    doc.fontSize(8)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .rect(50, currentY, 495, itemHeight)
       .fill('#1e40af')
       .text('Fecha', 55, currentY + 6)
       .text('Modelo', 120, currentY + 6)
       .text('Chatter', 250, currentY + 6)
       .text('Turno', 350, currentY + 6)
       .text('Tipo', 400, currentY + 6)
       .text('Monto', 450, currentY + 6);

    currentY += itemHeight;

    // Datos
    doc.fontSize(8)
       .fillColor('#374151')
       .font('Helvetica');

    ventas.forEach((venta, index) => {
      // Verificar si necesitamos nueva página
      if (currentY + itemHeight > pageHeight) {
        doc.addPage();
        currentY = 50;
        
        // Repetir headers en nueva página
        doc.fontSize(8)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .rect(50, currentY, 495, itemHeight)
           .fill('#1e40af')
           .text('Fecha', 55, currentY + 6)
           .text('Modelo', 120, currentY + 6)
           .text('Chatter', 250, currentY + 6)
           .text('Turno', 350, currentY + 6)
           .text('Tipo', 400, currentY + 6)
           .text('Monto', 450, currentY + 6);
        
        currentY += itemHeight;
      }

      const modelo = venta.modeloId as any;
      const chatter = venta.chatterId as any;
      
      const fecha = venta.fechaVenta.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Alternar colores de fila
      const isEven = index % 2 === 0;
      doc.rect(50, currentY, 495, itemHeight)
         .fill(isEven ? '#f9fafb' : '#ffffff');

      doc.fillColor('#374151')
         .text(fecha, 55, currentY + 6)
         .text(modelo?.nombreCompleto || 'N/A', 120, currentY + 6, { width: 120 })
         .text(chatter ? `${chatter.nombre} ${chatter.apellido}` : 'N/A', 250, currentY + 6, { width: 90 })
         .text(venta.turno, 350, currentY + 6, { width: 40 })
         .text(venta.tipoVenta, 400, currentY + 6, { width: 40 })
         .text(`$${venta.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 450, currentY + 6, { width: 80, align: 'right' });

      currentY += itemHeight;
    });

    // Línea final
    doc.strokeColor('#e5e7eb')
       .lineWidth(1)
       .moveTo(50, currentY)
       .lineTo(545, currentY)
       .stroke();
  }

  private addPdfFooter(doc: any): void {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      const footerY = 750;
      
      // Línea separadora
      doc.strokeColor('#e5e7eb')
         .lineWidth(1)
         .moveTo(50, footerY)
         .lineTo(545, footerY)
         .stroke();

      // Información del footer
      doc.fontSize(8)
         .fillColor('#6b7280')
         .font('Helvetica')
         .text('OnlyTop - Gestión de Contenido Digital', 50, footerY + 10)
         .text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 50, footerY + 25)
         .text(`Página ${i + 1} de ${pageCount}`, 450, footerY + 10, { align: 'right' });
    }
  }
}

