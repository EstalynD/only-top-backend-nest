import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TrafficCampaignEntity, TrafficCampaignDocument } from './traffic-campaign.schema.js';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';
import { CargoEntity, CargoDocument } from '../rrhh/cargo.schema.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';
import { FilterCampaignsDto } from './dto/filter-campaigns.dto.js';
import { EstadoCampana } from './traffic-campaign.schema.js';

@Injectable()
export class TrafficCampaignsService {
  private readonly logger = new Logger(TrafficCampaignsService.name);

  constructor(
    @InjectModel(TrafficCampaignEntity.name)
    private campaignModel: Model<TrafficCampaignDocument>,
    @InjectModel(ModeloEntity.name)
    private modeloModel: Model<ModeloDocument>,
    @InjectModel(EmpleadoEntity.name)
    private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(CargoEntity.name)
    private cargoModel: Model<CargoDocument>,
  ) {}

  // ========== CREAR CAMPAÑA ==========

  async createCampaign(
    createDto: CreateCampaignDto,
    traffickerId: string,
  ): Promise<TrafficCampaignDocument> {
    // Validar que la modelo existe y está activa
    const modelo = await this.modeloModel.findById(createDto.modeloId).exec();
    if (!modelo || modelo.estado !== 'ACTIVA') {
      throw new BadRequestException('La modelo no existe o no está activa');
    }

    // Validar que el trafficker existe y está activo
    if (!Types.ObjectId.isValid(traffickerId)) {
      throw new BadRequestException('ID de trafficker inválido');
    }

    const trafficker = await this.empleadoModel.findById(traffickerId).exec();
    if (!trafficker || trafficker.estado !== 'ACTIVO') {
      throw new BadRequestException('El trafficker no existe o no está activo');
    }

    // Validar fechas
    const fechaActivacion = new Date(createDto.fechaActivacion);
    const fechaPublicacion = new Date(createDto.fechaPublicacion);
    const fechaFinalizacion = createDto.fechaFinalizacion 
      ? new Date(createDto.fechaFinalizacion) 
      : null;

    if (fechaPublicacion < fechaActivacion) {
      throw new BadRequestException(
        'La fecha de publicación no puede ser anterior a la fecha de activación',
      );
    }

    if (fechaFinalizacion && fechaFinalizacion < fechaActivacion) {
      throw new BadRequestException(
        'La fecha de finalización no puede ser anterior a la fecha de activación',
      );
    }

    // Validar presupuesto
    const presupuestoGastado = createDto.presupuestoGastado || 0;
    if (presupuestoGastado > createDto.presupuestoAsignado) {
      throw new BadRequestException(
        'El presupuesto gastado no puede ser mayor al presupuesto asignado',
      );
    }

    // Crear campaña
    const campaign = new this.campaignModel({
      modeloId: new Types.ObjectId(createDto.modeloId),
      traffickerId: new Types.ObjectId(traffickerId),
      plataforma: createDto.plataforma,
      segmentaciones: {
        descripcion: createDto.descripcionSegmentacion || null,
        paises: createDto.segmentaciones.paises || [],
        regiones: createDto.segmentaciones.regiones || [],
        edadObjetivo: 
          createDto.segmentaciones.edadMin && createDto.segmentaciones.edadMax
            ? {
                min: parseInt(createDto.segmentaciones.edadMin),
                max: parseInt(createDto.segmentaciones.edadMax),
              }
            : null,
        intereses: createDto.segmentaciones.intereses || [],
      },
      fechaActivacion,
      fechaPublicacion,
      fechaFinalizacion,
      presupuesto: {
        asignado: createDto.presupuestoAsignado,
        gastado: presupuestoGastado,
        moneda: createDto.moneda || 'USD', // Usar moneda del DTO o USD por defecto
      },
      estado: createDto.estado || EstadoCampana.ACTIVA,
      copyUtilizado: createDto.copyUtilizado,
      linkPauta: createDto.linkPauta || null,
      trackLinkOF: createDto.trackLinkOF,
      acortadorUtilizado: createDto.acortadorUtilizado,
      rendimiento: createDto.rendimiento || null,
      notas: createDto.notas || null,
    });

    const saved = await campaign.save();

    this.logger.log(
      `Campaign created for modelo ${modelo.nombreCompleto} on platform ${createDto.plataforma}`,
    );

    return saved;
  }

  // ========== OBTENER CAMPAÑAS CON FILTROS ==========

  async findCampaigns(filters: FilterCampaignsDto): Promise<TrafficCampaignDocument[]> {
    const query: any = {};

    if (filters.modeloId) {
      if (!Types.ObjectId.isValid(filters.modeloId)) {
        throw new BadRequestException('ID de modelo inválido');
      }
      query.modeloId = new Types.ObjectId(filters.modeloId);
    }

    if (filters.traffickerId) {
      if (!Types.ObjectId.isValid(filters.traffickerId)) {
        throw new BadRequestException('ID de trafficker inválido');
      }
      query.traffickerId = new Types.ObjectId(filters.traffickerId);
    }

    if (filters.plataforma) {
      query.plataforma = filters.plataforma;
    }

    if (filters.estado) {
      query.estado = filters.estado;
    }

    if (filters.fechaInicio || filters.fechaFin) {
      query.fechaActivacion = {};
      if (filters.fechaInicio) {
        query.fechaActivacion.$gte = new Date(filters.fechaInicio);
      }
      if (filters.fechaFin) {
        query.fechaActivacion.$lte = new Date(filters.fechaFin);
      }
    }

    if (filters.pais) {
      query['segmentaciones.paises'] = filters.pais;
    }

    return await this.campaignModel
      .find(query)
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .populate('traffickerId', 'nombre apellido correoElectronico')
      .sort({ fechaActivacion: -1 })
      .exec();
  }

  // ========== OBTENER CAMPAÑA POR ID ==========

  async findCampaignById(id: string): Promise<TrafficCampaignDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de campaña inválido');
    }

    const campaign = await this.campaignModel
      .findById(id)
      .populate('modeloId', 'nombreCompleto correoElectronico telefono fotoPerfil estado')
      .populate('traffickerId', 'nombre apellido correoElectronico telefono')
      .exec();

    if (!campaign) {
      throw new NotFoundException('Campaña no encontrada');
    }

    return campaign;
  }

  // ========== ACTUALIZAR CAMPAÑA ==========

  async updateCampaign(
    id: string,
    updateDto: UpdateCampaignDto,
  ): Promise<TrafficCampaignDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de campaña inválido');
    }

    const existingCampaign = await this.campaignModel.findById(id).exec();
    if (!existingCampaign) {
      throw new NotFoundException('Campaña no encontrada');
    }

    // Validar modelo si se actualiza
    if (updateDto.modeloId) {
      const modelo = await this.modeloModel.findById(updateDto.modeloId).exec();
      if (!modelo) {
        throw new BadRequestException('La modelo no existe');
      }
    }

    // Validar presupuesto si se actualiza
    if (updateDto.presupuestoGastado !== undefined || updateDto.presupuestoAsignado !== undefined) {
      const presupuestoAsignado = updateDto.presupuestoAsignado || existingCampaign.presupuesto.asignado;
      const presupuestoGastado = updateDto.presupuestoGastado ?? existingCampaign.presupuesto.gastado;

      if (presupuestoGastado > presupuestoAsignado) {
        throw new BadRequestException(
          'El presupuesto gastado no puede ser mayor al presupuesto asignado',
        );
      }
    }

    // Preparar datos actualizados
    const updatedData: any = {};

    if (updateDto.modeloId) {
      updatedData.modeloId = new Types.ObjectId(updateDto.modeloId);
    }

    if (updateDto.plataforma) {
      updatedData.plataforma = updateDto.plataforma;
    }

    if (updateDto.segmentaciones || updateDto.descripcionSegmentacion) {
      updatedData.segmentaciones = {
        descripcion: updateDto.descripcionSegmentacion ?? existingCampaign.segmentaciones.descripcion,
        paises: updateDto.segmentaciones?.paises ?? existingCampaign.segmentaciones.paises,
        regiones: updateDto.segmentaciones?.regiones ?? existingCampaign.segmentaciones.regiones,
        edadObjetivo:
          updateDto.segmentaciones?.edadMin && updateDto.segmentaciones?.edadMax
            ? {
                min: parseInt(updateDto.segmentaciones.edadMin),
                max: parseInt(updateDto.segmentaciones.edadMax),
              }
            : existingCampaign.segmentaciones.edadObjetivo,
        intereses: updateDto.segmentaciones?.intereses ?? existingCampaign.segmentaciones.intereses,
      };
    }

    if (updateDto.fechaActivacion) {
      updatedData.fechaActivacion = new Date(updateDto.fechaActivacion);
    }

    if (updateDto.fechaPublicacion) {
      updatedData.fechaPublicacion = new Date(updateDto.fechaPublicacion);
    }

    if (updateDto.fechaFinalizacion) {
      updatedData.fechaFinalizacion = new Date(updateDto.fechaFinalizacion);
    }

    if (updateDto.presupuestoAsignado !== undefined || updateDto.presupuestoGastado !== undefined || updateDto.moneda !== undefined) {
      updatedData['presupuesto.asignado'] = updateDto.presupuestoAsignado ?? existingCampaign.presupuesto.asignado;
      updatedData['presupuesto.gastado'] = updateDto.presupuestoGastado ?? existingCampaign.presupuesto.gastado;
      updatedData['presupuesto.moneda'] = updateDto.moneda ?? existingCampaign.presupuesto.moneda;
    }

    if (updateDto.estado) {
      updatedData.estado = updateDto.estado;
    }

    if (updateDto.copyUtilizado) {
      updatedData.copyUtilizado = updateDto.copyUtilizado;
    }

    if (updateDto.linkPauta !== undefined) {
      updatedData.linkPauta = updateDto.linkPauta;
    }

    if (updateDto.trackLinkOF) {
      updatedData.trackLinkOF = updateDto.trackLinkOF;
    }

    if (updateDto.acortadorUtilizado) {
      updatedData.acortadorUtilizado = updateDto.acortadorUtilizado;
    }

    if (updateDto.rendimiento !== undefined) {
      updatedData.rendimiento = updateDto.rendimiento;
    }

    if (updateDto.notas !== undefined) {
      updatedData.notas = updateDto.notas;
    }

    const updated = await this.campaignModel
      .findByIdAndUpdate(id, updatedData, { new: true, runValidators: true })
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .populate('traffickerId', 'nombre apellido correoElectronico')
      .exec();

    if (!updated) {
      throw new NotFoundException('Campaña no encontrada');
    }

    this.logger.log(`Campaign ${id} updated`);

    return updated;
  }

  // ========== ELIMINAR CAMPAÑA ==========

  async deleteCampaign(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de campaña inválido');
    }

    const result = await this.campaignModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException('Campaña no encontrada');
    }

    this.logger.log(`Campaign ${id} deleted`);
  }

  // ========== HISTÓRICO POR MODELO ==========

  async getCampaignsByModelo(modeloId: string): Promise<TrafficCampaignDocument[]> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('ID de modelo inválido');
    }

    const modelo = await this.modeloModel.findById(modeloId).exec();
    if (!modelo) {
      throw new NotFoundException('Modelo no encontrada');
    }

    return await this.campaignModel
      .find({ modeloId: new Types.ObjectId(modeloId) })
      .populate('traffickerId', 'nombre apellido correoElectronico')
      .sort({ fechaActivacion: -1 })
      .exec();
  }

  // ========== ESTADÍSTICAS GENERALES ==========

  async getCampaignsStatistics(filters?: FilterCampaignsDto): Promise<any> {
    const query: any = {};

    // Aplicar filtros si existen
    if (filters?.modeloId) {
      query.modeloId = new Types.ObjectId(filters.modeloId);
    }

    if (filters?.traffickerId) {
      query.traffickerId = new Types.ObjectId(filters.traffickerId);
    }

    if (filters?.plataforma) {
      query.plataforma = filters.plataforma;
    }

    if (filters?.estado) {
      query.estado = filters.estado;
    }

    if (filters?.fechaInicio || filters?.fechaFin) {
      query.fechaActivacion = {};
      if (filters.fechaInicio) {
        query.fechaActivacion.$gte = new Date(filters.fechaInicio);
      }
      if (filters.fechaFin) {
        query.fechaActivacion.$lte = new Date(filters.fechaFin);
      }
    }

    const campaigns = await this.campaignModel.find(query).exec();

    const stats = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.estado === EstadoCampana.ACTIVA).length,
      pausedCampaigns: campaigns.filter((c) => c.estado === EstadoCampana.PAUSADA).length,
      finishedCampaigns: campaigns.filter((c) => c.estado === EstadoCampana.FINALIZADA).length,
      totalBudgetAssigned: campaigns.reduce((sum, c) => sum + c.presupuesto.asignado, 0),
      totalBudgetSpent: campaigns.reduce((sum, c) => sum + c.presupuesto.gastado, 0),
      avgBudgetPerCampaign:
        campaigns.length > 0
          ? campaigns.reduce((sum, c) => sum + c.presupuesto.asignado, 0) / campaigns.length
          : 0,
      campaignsByPlatform: campaigns.reduce((acc: any, campaign) => {
        acc[campaign.plataforma] = (acc[campaign.plataforma] || 0) + 1;
        return acc;
      }, {}),
      topCountries: this.getTopCountries(campaigns, 5),
    };

    return stats;
  }

  // ========== UTILIDADES PRIVADAS ==========

  private getTopCountries(campaigns: TrafficCampaignDocument[], limit: number): any[] {
    const countryCount: { [key: string]: number } = {};

    campaigns.forEach((campaign) => {
      campaign.segmentaciones.paises.forEach((pais) => {
        countryCount[pais] = (countryCount[pais] || 0) + 1;
      });
    });

    return Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([pais, count]) => ({ pais, campañas: count }));
  }

  // ========== LISTAR TRAFFICKERS ==========

  async getTraffickers(): Promise<any[]> {
    // Buscar el cargo de Trafficker
    const cargos = await this.cargoModel.find({ code: 'TRF_TRF' }).exec();
    
    if (!cargos || cargos.length === 0) {
      this.logger.warn('No se encontró el cargo de Trafficker (TRF_TRF)');
      return [];
    }

    const cargoIds = cargos.map(cargo => cargo._id);

    // Buscar empleados activos con cargo de Trafficker
    const traffickers = await this.empleadoModel
      .find({
        cargoId: { $in: cargoIds },
        estado: 'ACTIVO',
      })
      .select('_id nombre apellido correoElectronico correoCorporativo fotoPerfil')
      .sort({ nombre: 1, apellido: 1 })
      .lean()
      .exec();

    return traffickers.map((t: any) => ({
      _id: t._id.toString(),
      nombre: t.nombre,
      apellido: t.apellido,
      correoElectronico: t.correoElectronico,
      correoCorporativo: t.correoCorporativo || null,
      fotoPerfil: t.fotoPerfil || null,
      nombreCompleto: `${t.nombre} ${t.apellido}`,
    }));
  }
}
