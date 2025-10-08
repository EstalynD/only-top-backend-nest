import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChatterCommissionEntity,
  ChatterCommissionDocument,
  CommissionStatus,
  CommissionType,
} from './chatter-commission.schema.js';
import { ChatterSaleEntity, ChatterSaleDocument, TurnoChatter } from './chatter-sale.schema.js';
import { ChatterGoalEntity, ChatterGoalDocument, GoalStatus } from './chatter-goal.schema.js';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';
import { FinanceConfigService } from '../sistema/finance-config.service.js';
import {
  GenerateCommissionsDto,
  ApproveCommissionDto,
  RejectCommissionDto,
  PayCommissionDto,
  FilterCommissionsDto,
  BulkApproveCommissionsDto,
  BulkPayCommissionsDto,
} from './dto/chatter-commission.dto.js';

interface CommissionCalculationResult {
  chatterId: Types.ObjectId;
  chatterName: string;
  modeloId: Types.ObjectId;
  modeloName: string;
  turno: TurnoChatter;
  totalVentas: number;
  montoVentas: number;
  tipoComision: CommissionType;
  porcentajeComision: number;
  montoComision: number;
  goalId?: Types.ObjectId;
  metaGrupo?: number;
  ventasGrupo?: number;
  porcentajeCumplimientoGrupo?: number;
}

@Injectable()
export class ChatterCommissionsService {
  private readonly logger = new Logger(ChatterCommissionsService.name);

  constructor(
    @InjectModel(ChatterCommissionEntity.name)
    private chatterCommissionModel: Model<ChatterCommissionDocument>,
    @InjectModel(ChatterSaleEntity.name)
    private chatterSaleModel: Model<ChatterSaleDocument>,
    @InjectModel(ChatterGoalEntity.name)
    private chatterGoalModel: Model<ChatterGoalDocument>,
    @InjectModel(ModeloEntity.name)
    private modeloModel: Model<ModeloDocument>,
    @InjectModel(EmpleadoEntity.name)
    private empleadoModel: Model<EmpleadoDocument>,
    private financeConfigService: FinanceConfigService,
  ) {}

  // ========== GENERAR COMISIONES ==========

  async generateCommissions(
    generateDto: GenerateCommissionsDto,
    userId?: string,
  ): Promise<{ generated: ChatterCommissionDocument[]; summary: any }> {
    const { fechaInicio, fechaFin, modeloId, goalId } = generateDto;

    // Validar fechas
    const startDate = new Date(fechaInicio);
    const endDate = new Date(fechaFin);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Verificar que no existan comisiones ya generadas para el mismo periodo
    const existingCommissions = await this.chatterCommissionModel.find({
      fechaInicio: { $lte: endDate },
      fechaFin: { $gte: startDate },
      ...(modeloId && { modeloId: new Types.ObjectId(modeloId) }),
    }).exec();

    if (existingCommissions.length > 0) {
      throw new BadRequestException(
        `There are already ${existingCommissions.length} commissions generated for this period. Please delete or modify them first.`,
      );
    }

    // Obtener modelos a procesar
    const query: any = { estado: 'ACTIVA' };
    if (modeloId) {
      query._id = new Types.ObjectId(modeloId);
    }

    const modelos = await this.modeloModel
      .find(query)
      .populate('equipoChatters.turnoAM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoPM', 'nombre apellido correoElectronico')
      .populate('equipoChatters.turnoMadrugada', 'nombre apellido correoElectronico')
      .populate('equipoChatters.supernumerario', 'nombre apellido correoElectronico')
      .exec();

    if (modelos.length === 0) {
      throw new NotFoundException('No active models found');
    }

    const generatedCommissions: ChatterCommissionDocument[] = [];
    const summary = {
      totalModelos: modelos.length,
      totalChatters: 0,
      totalComisiones: 0,
      montoTotalComisiones: 0,
      comisionesPorTipo: {
        SUPERNUMERARIO: 0,
        ESCALABLE: 0,
      },
    };

    // Procesar cada modelo
    for (const modelo of modelos) {
      try {
        const modeloCommissions = await this.generateCommissionsForModel(
          modelo,
          startDate,
          endDate,
          goalId,
          userId,
        );

        generatedCommissions.push(...modeloCommissions);

        for (const comm of modeloCommissions) {
          summary.totalChatters++;
          summary.totalComisiones++;
          summary.montoTotalComisiones += comm.montoComision;
          summary.comisionesPorTipo[comm.tipoComision]++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to generate commissions for model ${modelo.nombreCompleto}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Generated ${generatedCommissions.length} chatter commissions for period ${fechaInicio} - ${fechaFin}`,
    );

    return {
      generated: generatedCommissions,
      summary,
    };
  }

  private async generateCommissionsForModel(
    modelo: ModeloDocument,
    startDate: Date,
    endDate: Date,
    goalId?: string,
    userId?: string,
  ): Promise<ChatterCommissionDocument[]> {
    const commissions: ChatterCommissionDocument[] = [];

    // Obtener meta del grupo si existe
    let goal: ChatterGoalDocument | null = null;
    let goalCompletion = 0;

    if (goalId) {
      goal = await this.chatterGoalModel.findById(goalId).exec();
    } else {
      // Buscar meta activa para el modelo en el periodo
      goal = await this.chatterGoalModel
        .findOne({
          modeloId: modelo._id,
          estado: { $in: [GoalStatus.ACTIVA, GoalStatus.COMPLETADA, GoalStatus.VENCIDA] },
          fechaInicio: { $lte: endDate },
          fechaFin: { $gte: startDate },
        })
        .exec();
    }

    // Calcular cumplimiento de meta si existe
    if (goal) {
      goalCompletion = goal.porcentajeFinal || goal.porcentajeCumplimiento || 0;
    }

    // Obtener ventas del grupo en el periodo
    const ventasGrupo = await this.chatterSaleModel
      .find({
        modeloId: modelo._id,
        fechaVenta: { $gte: startDate, $lte: endDate },
      })
      .exec();

    const montoTotalGrupo = ventasGrupo.reduce((sum, v) => sum + v.monto, 0);

    // Procesar cada chatter del equipo
    const turnos: Array<{ turno: TurnoChatter; chatterId: any }> = [
      { turno: TurnoChatter.AM, chatterId: modelo.equipoChatters.turnoAM },
      { turno: TurnoChatter.PM, chatterId: modelo.equipoChatters.turnoPM },
      { turno: TurnoChatter.MADRUGADA, chatterId: modelo.equipoChatters.turnoMadrugada },
      { turno: TurnoChatter.SUPERNUMERARIO, chatterId: modelo.equipoChatters.supernumerario },
    ];

    for (const { turno, chatterId } of turnos) {
      if (!chatterId) continue;

      const chatter = typeof chatterId === 'object' && '_id' in chatterId ? chatterId : null;
      if (!chatter) continue;

      const chatterIdObj = (chatter as any)._id;

      // Calcular comisión para este chatter
      const result = await this.calculateCommissionForChatter(
        chatterIdObj,
        modelo._id,
        turno,
        startDate,
        endDate,
        goal,
        goalCompletion,
        montoTotalGrupo,
      );

      if (result.montoComision > 0) {
        // Crear registro de comisión
        const commission = new this.chatterCommissionModel({
          chatterId: result.chatterId,
          modeloId: result.modeloId,
          goalId: result.goalId,
          fechaInicio: startDate,
          fechaFin: endDate,
          tipoComision: result.tipoComision,
          turno: result.turno,
          totalVentas: result.totalVentas,
          montoVentas: result.montoVentas,
          metaGrupo: result.metaGrupo,
          ventasGrupo: result.ventasGrupo,
          porcentajeCumplimientoGrupo: result.porcentajeCumplimientoGrupo,
          porcentajeComision: result.porcentajeComision,
          montoComision: result.montoComision,
          moneda: 'USD',
          estado: CommissionStatus.PENDIENTE,
          generadoPor: userId ? new Types.ObjectId(userId) : null,
        });

        const saved = await commission.save();
        commissions.push(saved);

        this.logger.log(
          `Generated commission for ${result.chatterName} (${turno}): $${result.montoComision} (${result.porcentajeComision}%)`,
        );
      }
    }

    return commissions;
  }

  private async calculateCommissionForChatter(
    chatterId: Types.ObjectId,
    modeloId: Types.ObjectId,
    turno: TurnoChatter,
    startDate: Date,
    endDate: Date,
    goal: ChatterGoalDocument | null,
    goalCompletion: number,
    montoTotalGrupo: number,
  ): Promise<CommissionCalculationResult> {
    // Obtener ventas del chatter en el periodo
    const ventas = await this.chatterSaleModel
      .find({
        chatterId,
        modeloId,
        fechaVenta: { $gte: startDate, $lte: endDate },
      })
      .populate('chatterId', 'nombre apellido')
      .exec();

    const totalVentas = ventas.length;
    const montoVentas = ventas.reduce((sum, v) => sum + v.monto, 0);

    // Determinar tipo de comisión
    const isSupernumerario = turno === TurnoChatter.SUPERNUMERARIO;
    const tipoComision = isSupernumerario ? CommissionType.SUPERNUMERARIO : CommissionType.ESCALABLE;

    // Calcular porcentaje de comisión según tipo
    const { commissionPercent } = await this.financeConfigService.calculateChatterCommissionPercent(
      goalCompletion,
      isSupernumerario,
    );

    // Calcular monto de comisión
    const montoComision = (montoVentas * commissionPercent) / 100;

    // Obtener nombre del chatter
    const chatter = ventas.length > 0 && ventas[0].chatterId
      ? (ventas[0].chatterId as any)
      : await this.empleadoModel.findById(chatterId).exec();
    
    const chatterName = chatter
      ? `${(chatter as any).nombre} ${(chatter as any).apellido}`
      : 'Unknown';

    const modelo = await this.modeloModel.findById(modeloId).exec();
    const modeloName = modelo?.nombreCompleto || 'Unknown';

    return {
      chatterId,
      chatterName,
      modeloId,
      modeloName,
      turno,
      totalVentas,
      montoVentas,
      tipoComision,
      porcentajeComision: commissionPercent,
      montoComision,
      goalId: goal?._id,
      metaGrupo: goal?.montoObjetivo,
      ventasGrupo: montoTotalGrupo,
      porcentajeCumplimientoGrupo: goalCompletion,
    };
  }

  // ========== OBTENER COMISIONES ==========

  async findCommissions(filters: FilterCommissionsDto): Promise<ChatterCommissionDocument[]> {
    const query: any = {};

    if (filters.chatterId) {
      if (!Types.ObjectId.isValid(filters.chatterId)) {
        throw new BadRequestException('Invalid chatter ID format');
      }
      query.chatterId = new Types.ObjectId(filters.chatterId);
    }

    if (filters.modeloId) {
      if (!Types.ObjectId.isValid(filters.modeloId)) {
        throw new BadRequestException('Invalid model ID format');
      }
      query.modeloId = new Types.ObjectId(filters.modeloId);
    }

    if (filters.goalId) {
      if (!Types.ObjectId.isValid(filters.goalId)) {
        throw new BadRequestException('Invalid goal ID format');
      }
      query.goalId = new Types.ObjectId(filters.goalId);
    }

    if (filters.estado) {
      query.estado = filters.estado;
    }

    if (filters.fechaInicio || filters.fechaFin) {
      query.fechaInicio = {};
      if (filters.fechaInicio) query.fechaInicio.$gte = new Date(filters.fechaInicio);
      if (filters.fechaFin) query.fechaInicio.$lte = new Date(filters.fechaFin);
    }

    return await this.chatterCommissionModel
      .find(query)
      .populate('chatterId', 'nombre apellido correoElectronico cargoId')
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil')
      .populate('goalId')
      .populate('generadoPor', 'username displayName')
      .populate('aprobadoPor', 'username displayName')
      .populate('pagadoPor', 'username displayName')
      .sort({ fechaInicio: -1 })
      .exec();
  }

  async findCommissionById(id: string): Promise<ChatterCommissionDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid commission ID format');
    }

    const commission = await this.chatterCommissionModel
      .findById(id)
      .populate('chatterId', 'nombre apellido correoElectronico cargoId')
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil')
      .populate('goalId')
      .populate('generadoPor', 'username displayName')
      .populate('aprobadoPor', 'username displayName')
      .populate('pagadoPor', 'username displayName')
      .exec();

    if (!commission) {
      throw new NotFoundException(`Commission with ID '${id}' not found`);
    }

    return commission;
  }

  async getCommissionsForChatter(
    chatterId: string,
    estado?: CommissionStatus,
  ): Promise<ChatterCommissionDocument[]> {
    if (!Types.ObjectId.isValid(chatterId)) {
      throw new BadRequestException('Invalid chatter ID format');
    }

    const query: any = { chatterId: new Types.ObjectId(chatterId) };
    if (estado) {
      query.estado = estado;
    }

    return await this.chatterCommissionModel
      .find(query)
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil')
      .populate('goalId')
      .sort({ fechaInicio: -1 })
      .exec();
  }

  // ========== APROBAR COMISIONES ==========

  async approveCommission(
    id: string,
    approveDto: ApproveCommissionDto,
    userId?: string,
  ): Promise<ChatterCommissionDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid commission ID format');
    }

    const commission = await this.chatterCommissionModel.findById(id).exec();
    if (!commission) {
      throw new NotFoundException(`Commission with ID '${id}' not found`);
    }

    if (commission.estado !== CommissionStatus.PENDIENTE) {
      throw new BadRequestException('Only pending commissions can be approved');
    }

    const updated = await this.chatterCommissionModel
      .findByIdAndUpdate(
        id,
        {
          estado: CommissionStatus.APROBADA,
          fechaAprobacion: new Date(),
          aprobadoPor: userId ? new Types.ObjectId(userId) : null,
          notas: approveDto.notas || commission.notas,
        },
        { new: true },
      )
      .populate('chatterId', 'nombre apellido correoElectronico')
      .exec();

    this.logger.log(`Commission ${id} approved`);

    return updated!;
  }

  async rejectCommission(
    id: string,
    rejectDto: RejectCommissionDto,
    userId?: string,
  ): Promise<ChatterCommissionDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid commission ID format');
    }

    const commission = await this.chatterCommissionModel.findById(id).exec();
    if (!commission) {
      throw new NotFoundException(`Commission with ID '${id}' not found`);
    }

    if (commission.estado !== CommissionStatus.PENDIENTE) {
      throw new BadRequestException('Only pending commissions can be rejected');
    }

    const updated = await this.chatterCommissionModel
      .findByIdAndUpdate(
        id,
        {
          estado: CommissionStatus.CANCELADA,
          observaciones: rejectDto.observaciones,
          aprobadoPor: userId ? new Types.ObjectId(userId) : null,
        },
        { new: true },
      )
      .populate('chatterId', 'nombre apellido correoElectronico')
      .exec();

    this.logger.log(`Commission ${id} rejected`);

    return updated!;
  }

  async bulkApproveCommissions(
    bulkDto: BulkApproveCommissionsDto,
    userId?: string,
  ): Promise<{ approved: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    const result = { approved: 0, failed: 0, errors: [] as Array<{ id: string; error: string }> };

    for (const id of bulkDto.commissionIds) {
      try {
        await this.approveCommission(id, { notas: bulkDto.notas }, userId);
        result.approved++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id, error: error.message });
      }
    }

    this.logger.log(`Bulk approval: ${result.approved} approved, ${result.failed} failed`);

    return result;
  }

  // ========== PAGAR COMISIONES ==========

  async payCommission(
    id: string,
    payDto: PayCommissionDto,
    userId?: string,
  ): Promise<ChatterCommissionDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid commission ID format');
    }

    const commission = await this.chatterCommissionModel.findById(id).exec();
    if (!commission) {
      throw new NotFoundException(`Commission with ID '${id}' not found`);
    }

    if (commission.estado !== CommissionStatus.APROBADA) {
      throw new BadRequestException('Only approved commissions can be paid');
    }

    const updated = await this.chatterCommissionModel
      .findByIdAndUpdate(
        id,
        {
          estado: CommissionStatus.PAGADA,
          fechaPago: new Date(),
          referenciaPago: payDto.referenciaPago,
          pagadoPor: userId ? new Types.ObjectId(userId) : null,
          notas: payDto.notas || commission.notas,
        },
        { new: true },
      )
      .populate('chatterId', 'nombre apellido correoElectronico')
      .exec();

    this.logger.log(`Commission ${id} marked as paid`);

    return updated!;
  }

  async bulkPayCommissions(
    bulkDto: BulkPayCommissionsDto,
    userId?: string,
  ): Promise<{ paid: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    const result = { paid: 0, failed: 0, errors: [] as Array<{ id: string; error: string }> };

    for (const id of bulkDto.commissionIds) {
      try {
        await this.payCommission(
          id,
          { referenciaPago: bulkDto.referenciaPago, notas: bulkDto.notas },
          userId,
        );
        result.paid++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ id, error: error.message });
      }
    }

    this.logger.log(`Bulk payment: ${result.paid} paid, ${result.failed} failed`);

    return result;
  }

  // ========== ELIMINAR COMISIÓN ==========

  async deleteCommission(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid commission ID format');
    }

    const commission = await this.chatterCommissionModel.findById(id).exec();
    if (!commission) {
      throw new NotFoundException(`Commission with ID '${id}' not found`);
    }

    // Solo permitir eliminar comisiones canceladas o pendientes
    if (commission.estado === CommissionStatus.PAGADA) {
      throw new BadRequestException('Cannot delete paid commissions');
    }

    await this.chatterCommissionModel.findByIdAndDelete(id).exec();
    this.logger.log(`Commission ${id} deleted`);
  }

  // ========== ESTADÍSTICAS ==========

  async getCommissionStatistics(
    chatterId?: string,
    modeloId?: string,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<any> {
    const query: any = {};

    if (chatterId) {
      if (!Types.ObjectId.isValid(chatterId)) {
        throw new BadRequestException('Invalid chatter ID format');
      }
      query.chatterId = new Types.ObjectId(chatterId);
    }

    if (modeloId) {
      if (!Types.ObjectId.isValid(modeloId)) {
        throw new BadRequestException('Invalid model ID format');
      }
      query.modeloId = new Types.ObjectId(modeloId);
    }

    if (fechaInicio || fechaFin) {
      query.fechaInicio = {};
      if (fechaInicio) query.fechaInicio.$gte = new Date(fechaInicio);
      if (fechaFin) query.fechaInicio.$lte = new Date(fechaFin);
    }

    const commissions = await this.chatterCommissionModel.find(query).exec();

    const totalCommissions = commissions.length;
    const pendingCommissions = commissions.filter(c => c.estado === CommissionStatus.PENDIENTE).length;
    const approvedCommissions = commissions.filter(c => c.estado === CommissionStatus.APROBADA).length;
    const paidCommissions = commissions.filter(c => c.estado === CommissionStatus.PAGADA).length;

    const totalAmount = commissions.reduce((sum, c) => sum + c.montoComision, 0);
    const pendingAmount = commissions
      .filter(c => c.estado === CommissionStatus.PENDIENTE)
      .reduce((sum, c) => sum + c.montoComision, 0);
    const paidAmount = commissions
      .filter(c => c.estado === CommissionStatus.PAGADA)
      .reduce((sum, c) => sum + c.montoComision, 0);

    return {
      totalCommissions,
      pendingCommissions,
      approvedCommissions,
      paidCommissions,
      totalAmount,
      pendingAmount,
      paidAmount,
      avgCommission: totalCommissions > 0 ? totalAmount / totalCommissions : 0,
    };
  }
}

