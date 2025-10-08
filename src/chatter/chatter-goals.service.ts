import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatterGoalEntity, ChatterGoalDocument, GoalStatus } from './chatter-goal.schema.js';
import { ChatterSaleEntity, ChatterSaleDocument } from './chatter-sale.schema.js';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';
import {
  CreateChatterGoalDto,
  UpdateChatterGoalDto,
  CloseChatterGoalDto,
  FilterChatterGoalsDto,
} from './dto/chatter-goal.dto.js';

export interface GoalProgress {
  goal: ChatterGoalDocument;
  currentAmount: number;
  percentage: number;
  remaining: number;
  daysRemaining: number;
  shouldNotify: boolean;
  nextNotificationLevel?: number;
}

@Injectable()
export class ChatterGoalsService {
  private readonly logger = new Logger(ChatterGoalsService.name);

  constructor(
    @InjectModel(ChatterGoalEntity.name) private chatterGoalModel: Model<ChatterGoalDocument>,
    @InjectModel(ChatterSaleEntity.name) private chatterSaleModel: Model<ChatterSaleDocument>,
    @InjectModel(ModeloEntity.name) private modeloModel: Model<ModeloDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
  ) {}

  // ========== CREAR META ==========

  async createGoal(createDto: CreateChatterGoalDto, userId?: string): Promise<ChatterGoalDocument> {
    // Validar que la modelo existe
    const modelo = await this.modeloModel.findById(createDto.modeloId).exec();
    if (!modelo) {
      throw new NotFoundException('Model not found');
    }

    // Validar fechas
    const fechaInicio = new Date(createDto.fechaInicio);
    const fechaFin = new Date(createDto.fechaFin);

    if (fechaFin <= fechaInicio) {
      throw new BadRequestException('End date must be after start date');
    }

    // Verificar si ya existe una meta activa para este grupo en el mismo periodo
    const existingGoal = await this.chatterGoalModel.findOne({
      modeloId: new Types.ObjectId(createDto.modeloId),
      estado: GoalStatus.ACTIVA,
      $or: [
        { fechaInicio: { $lte: fechaFin }, fechaFin: { $gte: fechaInicio } },
      ],
    }).exec();

    if (existingGoal) {
      throw new BadRequestException('There is already an active goal for this group in the specified period');
    }

    const goal = new this.chatterGoalModel({
      ...createDto,
      modeloId: new Types.ObjectId(createDto.modeloId),
      fechaInicio,
      fechaFin,
      moneda: createDto.moneda || 'USD',
      estado: GoalStatus.ACTIVA,
      montoActual: 0,
      porcentajeCumplimiento: 0,
      nivelesNotificacion: createDto.nivelesNotificacion || [25, 50, 75, 90, 100],
      notificacionesActivas: createDto.notificacionesActivas ?? true,
      notificacionesEnviadas: [],
      creadoPor: userId ? new Types.ObjectId(userId) : null,
      ultimaActualizacion: new Date(),
    });

    const saved = await goal.save();
    
    // Calcular progreso inicial
    await this.updateGoalProgress(saved._id.toString());

    this.logger.log(`Chatter goal created for model ${modelo.nombreCompleto}: $${createDto.montoObjetivo}`);

    return saved;
  }

  // ========== OBTENER METAS ==========

  async findGoals(filters: FilterChatterGoalsDto): Promise<ChatterGoalDocument[]> {
    const query: any = {};

    if (filters.modeloId) {
      if (!Types.ObjectId.isValid(filters.modeloId)) {
        throw new BadRequestException('Invalid model ID format');
      }
      query.modeloId = new Types.ObjectId(filters.modeloId);
    }

    if (filters.estado) {
      query.estado = filters.estado;
    }

    if (filters.fechaInicio || filters.fechaFin) {
      query.fechaInicio = {};
      if (filters.fechaInicio) query.fechaInicio.$gte = new Date(filters.fechaInicio);
      if (filters.fechaFin) query.fechaInicio.$lte = new Date(filters.fechaFin);
    }

    return await this.chatterGoalModel
      .find(query)
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .populate('creadoPor', 'username displayName')
      .populate('cerradoPor', 'username displayName')
      .sort({ fechaInicio: -1 })
      .exec();
  }

  async findGoalById(id: string): Promise<ChatterGoalDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.chatterGoalModel
      .findById(id)
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .populate('creadoPor', 'username displayName')
      .populate('cerradoPor', 'username displayName')
      .exec();

    if (!goal) {
      throw new NotFoundException(`Goal with ID '${id}' not found`);
    }

    return goal;
  }

  async getActiveGoalForModel(modeloId: string): Promise<ChatterGoalDocument | null> {
    if (!Types.ObjectId.isValid(modeloId)) {
      throw new BadRequestException('Invalid model ID format');
    }

    const now = new Date();
    return await this.chatterGoalModel
      .findOne({
        modeloId: new Types.ObjectId(modeloId),
        estado: GoalStatus.ACTIVA,
        fechaInicio: { $lte: now },
        fechaFin: { $gte: now },
      })
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .exec();
  }

  // ========== ACTUALIZAR META ==========

  async updateGoal(id: string, updateDto: UpdateChatterGoalDto): Promise<ChatterGoalDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.chatterGoalModel.findById(id).exec();
    if (!goal) {
      throw new NotFoundException(`Goal with ID '${id}' not found`);
    }

    // No permitir actualizar metas cerradas o canceladas
    if (goal.estado === GoalStatus.COMPLETADA || goal.estado === GoalStatus.CANCELADA) {
      throw new BadRequestException('Cannot update completed or cancelled goals');
    }

    const updateData: any = { ...updateDto };

    if (updateDto.fechaInicio) {
      updateData.fechaInicio = new Date(updateDto.fechaInicio);
    }

    if (updateDto.fechaFin) {
      updateData.fechaFin = new Date(updateDto.fechaFin);
    }

    const updated = await this.chatterGoalModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Goal with ID '${id}' not found`);
    }

    // Recalcular progreso si cambiaron fechas o monto
    if (updateDto.fechaInicio || updateDto.fechaFin || updateDto.montoObjetivo) {
      await this.updateGoalProgress(id);
    }

    this.logger.log(`Chatter goal ${id} updated`);

    return updated;
  }

  // ========== CERRAR META ==========

  async closeGoal(id: string, closeDto: CloseChatterGoalDto, userId?: string): Promise<ChatterGoalDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.chatterGoalModel.findById(id).exec();
    if (!goal) {
      throw new NotFoundException(`Goal with ID '${id}' not found`);
    }

    if (goal.estado !== GoalStatus.ACTIVA) {
      throw new BadRequestException('Only active goals can be closed');
    }

    // Calcular totales finales
    const progress = await this.calculateGoalProgress(goal);

    const updated = await this.chatterGoalModel
      .findByIdAndUpdate(
        id,
        {
          estado: GoalStatus.COMPLETADA,
          montoFinal: progress.currentAmount,
          porcentajeFinal: progress.percentage,
          fechaCierre: new Date(),
          cerradoPor: userId ? new Types.ObjectId(userId) : null,
          notas: closeDto.notas || goal.notas,
        },
        { new: true },
      )
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .exec();

    this.logger.log(`Chatter goal ${id} closed with ${progress.percentage}% completion`);

    return updated!;
  }

  async cancelGoal(id: string, reason?: string, userId?: string): Promise<ChatterGoalDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.chatterGoalModel.findById(id).exec();
    if (!goal) {
      throw new NotFoundException(`Goal with ID '${id}' not found`);
    }

    if (goal.estado !== GoalStatus.ACTIVA) {
      throw new BadRequestException('Only active goals can be cancelled');
    }

    const updated = await this.chatterGoalModel
      .findByIdAndUpdate(
        id,
        {
          estado: GoalStatus.CANCELADA,
          fechaCierre: new Date(),
          cerradoPor: userId ? new Types.ObjectId(userId) : null,
          notas: reason || goal.notas,
        },
        { new: true },
      )
      .populate('modeloId', 'nombreCompleto correoElectronico fotoPerfil estado')
      .exec();

    this.logger.log(`Chatter goal ${id} cancelled`);

    return updated!;
  }

  // ========== ELIMINAR META ==========

  async deleteGoal(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.chatterGoalModel.findById(id).exec();
    if (!goal) {
      throw new NotFoundException(`Goal with ID '${id}' not found`);
    }

    // Solo permitir eliminar metas canceladas
    if (goal.estado !== GoalStatus.CANCELADA) {
      throw new BadRequestException('Only cancelled goals can be deleted');
    }

    await this.chatterGoalModel.findByIdAndDelete(id).exec();
    this.logger.log(`Chatter goal ${id} deleted`);
  }

  // ========== PROGRESO Y TRACKING ==========

  async updateGoalProgress(goalId: string): Promise<GoalProgress> {
    const goal = await this.chatterGoalModel.findById(goalId).exec();
    if (!goal) {
      throw new NotFoundException(`Goal with ID '${goalId}' not found`);
    }

    const progress = await this.calculateGoalProgress(goal);

    // Actualizar la meta con el progreso actual
    await this.chatterGoalModel.findByIdAndUpdate(goalId, {
      montoActual: progress.currentAmount,
      porcentajeCumplimiento: progress.percentage,
      ultimaActualizacion: new Date(),
    });

    // Verificar si debe enviarse notificación
    if (progress.shouldNotify && progress.nextNotificationLevel && goal.notificacionesActivas) {
      await this.sendGoalNotification(goal, progress);
    }

    return progress;
  }

  private async calculateGoalProgress(goal: ChatterGoalDocument): Promise<GoalProgress> {
    // Obtener todas las ventas del grupo en el periodo de la meta
    const ventas = await this.chatterSaleModel
      .find({
        modeloId: goal.modeloId,
        fechaVenta: {
          $gte: goal.fechaInicio,
          $lte: goal.fechaFin,
        },
      })
      .exec();

    const currentAmount = ventas.reduce((sum, venta) => sum + venta.monto, 0);
    const percentage = goal.montoObjetivo > 0 ? (currentAmount / goal.montoObjetivo) * 100 : 0;
    const remaining = Math.max(0, goal.montoObjetivo - currentAmount);

    // Calcular días restantes
    const now = new Date();
    const endDate = new Date(goal.fechaFin);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Determinar si debe notificarse
    const shouldNotify = this.shouldSendNotification(goal, percentage);
    const nextNotificationLevel = this.getNextNotificationLevel(goal, percentage);

    return {
      goal,
      currentAmount,
      percentage: Math.round(percentage * 100) / 100,
      remaining,
      daysRemaining,
      shouldNotify,
      nextNotificationLevel,
    };
  }

  private shouldSendNotification(goal: ChatterGoalDocument, currentPercentage: number): boolean {
    if (!goal.notificacionesActivas) return false;

    // Encontrar el nivel de notificación que corresponde al % actual
    const applicableLevel = goal.nivelesNotificacion
      .filter(level => currentPercentage >= level)
      .sort((a, b) => b - a)[0];

    if (!applicableLevel) return false;

    // Verificar si ya se envió notificación para este nivel
    const alreadySent = goal.notificacionesEnviadas.some(
      notif => notif.percentage === applicableLevel,
    );

    return !alreadySent;
  }

  private getNextNotificationLevel(goal: ChatterGoalDocument, currentPercentage: number): number | undefined {
    return goal.nivelesNotificacion
      .filter(level => currentPercentage >= level)
      .sort((a, b) => b - a)[0];
  }

  private async sendGoalNotification(goal: ChatterGoalDocument, progress: GoalProgress): Promise<void> {
    try {
      // Obtener información del modelo y chatters
      const modelo = await this.modeloModel
        .findById(goal.modeloId)
        .populate('equipoChatters.turnoAM', 'nombre apellido correoElectronico')
        .populate('equipoChatters.turnoPM', 'nombre apellido correoElectronico')
        .populate('equipoChatters.turnoMadrugada', 'nombre apellido correoElectronico')
        .populate('equipoChatters.supernumerario', 'nombre apellido correoElectronico')
        .exec();

      if (!modelo) return;

      // Recopilar emails de los chatters del grupo
      const chatters = [
        modelo.equipoChatters.turnoAM,
        modelo.equipoChatters.turnoPM,
        modelo.equipoChatters.turnoMadrugada,
        modelo.equipoChatters.supernumerario,
      ].filter(Boolean);

      const emails = chatters
        .map((chatter: any) => chatter?.correoElectronico)
        .filter(Boolean);

      if (emails.length === 0) {
        this.logger.warn(`No emails found for goal ${goal._id}`);
        return;
      }

      const percentage = progress.percentage;
      const nivel = progress.nextNotificationLevel!;

      // Generar mensaje motivacional
      const message = this.generateMotivationalMessage(
        modelo.nombreCompleto,
        percentage,
        progress.remaining,
        progress.daysRemaining,
        goal.montoObjetivo,
      );

      // Registrar la notificación
      await this.chatterGoalModel.findByIdAndUpdate(goal._id, {
        $push: {
          notificacionesEnviadas: {
            percentage: nivel,
            sentAt: new Date(),
            message,
            recipients: emails,
          },
        },
      });

      this.logger.log(`Goal notification sent for ${modelo.nombreCompleto} at ${percentage}% completion`);

      // TODO: Integrar con servicio de email cuando esté disponible
      // await this.emailService.sendGoalProgressEmail(emails, message, {...});

    } catch (error) {
      this.logger.error(`Failed to send goal notification: ${error.message}`, error.stack);
    }
  }

  private generateMotivationalMessage(
    modeloName: string,
    percentage: number,
    remaining: number,
    daysRemaining: number,
    total: number,
  ): string {
    const percentRounded = Math.round(percentage);

    if (percentRounded >= 100) {
      return `🎉 ¡FELICITACIONES! El grupo de ${modeloName} ha alcanzado la meta de $${total.toLocaleString()} USD. ¡Excelente trabajo en equipo!`;
    }

    if (percentRounded >= 90) {
      return `🔥 ¡Casi ahí! El grupo de ${modeloName} va al ${percentRounded}% de la meta. Solo faltan $${remaining.toLocaleString()} USD. ¡Un último empujón y lo logran!`;
    }

    if (percentRounded >= 75) {
      return `💪 ¡Gran progreso! El grupo de ${modeloName} ha alcanzado el ${percentRounded}% de la meta. Quedan $${remaining.toLocaleString()} USD y ${daysRemaining} días. ¡Sigan así!`;
    }

    if (percentRounded >= 50) {
      return `📈 ¡Vamos bien! El grupo de ${modeloName} va al ${percentRounded}% de la meta. Faltan $${remaining.toLocaleString()} USD. Quedan ${daysRemaining} días, ¡aún hay tiempo!`;
    }

    if (percentRounded >= 25) {
      return `🚀 ¡Buen comienzo! El grupo de ${modeloName} ha logrado el ${percentRounded}% de la meta. Faltan $${remaining.toLocaleString()} USD y quedan ${daysRemaining} días. ¡Sigamos adelante!`;
    }

    return `💼 El grupo de ${modeloName} va al ${percentRounded}% de la meta de $${total.toLocaleString()} USD. Faltan $${remaining.toLocaleString()} y quedan ${daysRemaining} días. ¡A por ello!`;
  }

  // ========== ESTADÍSTICAS ==========

  async getGoalStatistics(modeloId?: string, fechaInicio?: string, fechaFin?: string): Promise<any> {
    const query: any = {};

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

    const goals = await this.chatterGoalModel.find(query).exec();

    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.estado === GoalStatus.COMPLETADA).length;
    const activeGoals = goals.filter(g => g.estado === GoalStatus.ACTIVA).length;
    const cancelledGoals = goals.filter(g => g.estado === GoalStatus.CANCELADA).length;

    const completedGoalsData = goals.filter(g => g.estado === GoalStatus.COMPLETADA);
    const avgCompletion = completedGoalsData.length > 0
      ? completedGoalsData.reduce((sum, g) => sum + (g.porcentajeFinal || 0), 0) / completedGoalsData.length
      : 0;

    const goalsAchieved = completedGoalsData.filter(g => (g.porcentajeFinal || 0) >= 100).length;
    const achievementRate = completedGoals > 0 ? (goalsAchieved / completedGoals) * 100 : 0;

    return {
      totalGoals,
      activeGoals,
      completedGoals,
      cancelledGoals,
      goalsAchieved,
      achievementRate: Math.round(achievementRate * 100) / 100,
      avgCompletion: Math.round(avgCompletion * 100) / 100,
    };
  }

  // ========== CRON: ACTUALIZAR PROGRESO AUTOMÁTICAMENTE ==========

  @Cron(CronExpression.EVERY_HOUR)
  async updateAllActiveGoalsProgress(): Promise<void> {
    try {
      const activeGoals = await this.chatterGoalModel.find({ estado: GoalStatus.ACTIVA }).exec();
      
      this.logger.log(`Updating progress for ${activeGoals.length} active chatter goals`);

      for (const goal of activeGoals) {
        try {
          await this.updateGoalProgress(goal._id.toString());
        } catch (error) {
          this.logger.error(`Failed to update progress for goal ${goal._id}: ${error.message}`);
        }
      }

      this.logger.log('Finished updating all active chatter goals progress');
    } catch (error) {
      this.logger.error(`Failed to update active goals progress: ${error.message}`, error.stack);
    }
  }

  // ========== CRON: CERRAR METAS VENCIDAS ==========

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async closeExpiredGoals(): Promise<void> {
    try {
      const now = new Date();
      const expiredGoals = await this.chatterGoalModel.find({
        estado: GoalStatus.ACTIVA,
        fechaFin: { $lt: now },
      }).exec();

      this.logger.log(`Found ${expiredGoals.length} expired chatter goals to close`);

      for (const goal of expiredGoals) {
        try {
          await this.chatterGoalModel.findByIdAndUpdate(goal._id, {
            estado: GoalStatus.VENCIDA,
            fechaCierre: now,
          });
          
          this.logger.log(`Chatter goal ${goal._id} marked as expired`);
        } catch (error) {
          this.logger.error(`Failed to close expired goal ${goal._id}: ${error.message}`);
        }
      }

      this.logger.log('Finished processing expired chatter goals');
    } catch (error) {
      this.logger.error(`Failed to close expired goals: ${error.message}`, error.stack);
    }
  }
}

