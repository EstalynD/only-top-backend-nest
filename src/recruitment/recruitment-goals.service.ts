import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  RecruitmentGoalEntity, 
  RecruitmentGoalDocument,
  GoalType,
  GoalStatus,
} from './recruitment-goal.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';
import { RecruitmentActivityEntity, RecruitmentActivityDocument } from './recruitment-activity.schema.js';
import { ContratoModeloEntity, ContratoModeloDocument } from '../rrhh/contrato-modelo.schema.js';
import { 
  CreateRecruitmentGoalDto, 
  UpdateRecruitmentGoalDto,
  UpdateGoalProgressDto,
} from './dto/recruitment-goal.dto.js';
import { BrevoSmtpProvider } from '../email/brevo-smtp.provider.js';

@Injectable()
export class RecruitmentGoalsService {
  private readonly logger = new Logger(RecruitmentGoalsService.name);

  constructor(
    @InjectModel(RecruitmentGoalEntity.name) private goalModel: Model<RecruitmentGoalDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(RecruitmentActivityEntity.name) private activityModel: Model<RecruitmentActivityDocument>,
    @InjectModel(ContratoModeloEntity.name) private contratoModel: Model<ContratoModeloDocument>,
    private readonly brevoSmtpProvider: BrevoSmtpProvider,
  ) {}

  // ========== CRUD DE METAS ==========

  async createGoal(
    dto: CreateRecruitmentGoalDto,
    userId?: string,
  ): Promise<RecruitmentGoalDocument> {
    // Validar fechas
    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);

    if (fechaFin <= fechaInicio) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    // Obtener información del Sales Closer
    const salesCloser = await this.empleadoModel.findById(dto.salesCloserId).lean().exec();
    if (!salesCloser) {
      throw new NotFoundException(`Sales Closer con ID ${dto.salesCloserId} no encontrado`);
    }

    // Crear meta
    const goal = new this.goalModel({
      salesCloserId: new Types.ObjectId(dto.salesCloserId),
      titulo: dto.titulo,
      descripcion: dto.descripcion || null,
      tipo: dto.tipo,
      valorObjetivo: dto.valorObjetivo,
      moneda: dto.moneda || 'USD',
      periodo: dto.periodo,
      fechaInicio,
      fechaFin,
      estado: GoalStatus.ACTIVA,
      valorActual: 0,
      porcentajeCompletado: 0,
      notificacionesActivas: dto.notificacionesActivas ?? true,
      umbralNotificaciones: dto.umbralNotificaciones || [25, 50, 75, 90, 100],
      notificacionesEnviadas: [],
      emailSalesCloser: salesCloser.correoCorporativo || salesCloser.correoElectronico,
      nombreSalesCloser: `${salesCloser.nombre} ${salesCloser.apellido}`,
      creadoPor: userId ? new Types.ObjectId(userId) : null,
    });

    await goal.save();

    // Calcular progreso inicial
    await this.updateGoalProgress(goal._id.toString());

    return goal;
  }

  async findAllGoals(filters?: {
    salesCloserId?: string;
    estado?: GoalStatus;
    tipo?: GoalType;
    activas?: boolean;
  }): Promise<RecruitmentGoalDocument[]> {
    const query: any = {};

    if (filters?.salesCloserId) {
      query.salesCloserId = new Types.ObjectId(filters.salesCloserId);
    }

    if (filters?.estado) {
      query.estado = filters.estado;
    }

    if (filters?.tipo) {
      query.tipo = filters.tipo;
    }

    if (filters?.activas) {
      query.estado = GoalStatus.ACTIVA;
      query.fechaFin = { $gte: new Date() };
    }

    return await this.goalModel
      .find(query)
      .populate('salesCloserId', 'nombre apellido correoElectronico correoCorporativo')
      .sort({ fechaInicio: -1 })
      .lean()
      .exec();
  }

  async findGoalById(id: string): Promise<RecruitmentGoalDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de meta inválido');
    }

    const goal = await this.goalModel
      .findById(id)
      .populate('salesCloserId', 'nombre apellido correoElectronico correoCorporativo')
      .lean()
      .exec();

    if (!goal) {
      throw new NotFoundException(`Meta con ID ${id} no encontrada`);
    }

    return goal;
  }

  async updateGoal(
    id: string,
    dto: UpdateRecruitmentGoalDto,
    userId?: string,
  ): Promise<RecruitmentGoalDocument> {
    const goal = await this.goalModel.findById(id).exec();
    if (!goal) {
      throw new NotFoundException(`Meta con ID ${id} no encontrada`);
    }

    // Validar fechas si se actualizan
    if (dto.fechaInicio || dto.fechaFin) {
      const fechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : goal.fechaInicio;
      const fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : goal.fechaFin;

      if (fechaFin <= fechaInicio) {
        throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
      }
    }

    // Actualizar campos
    if (dto.titulo) goal.titulo = dto.titulo;
    if (dto.descripcion !== undefined) goal.descripcion = dto.descripcion;
    if (dto.valorObjetivo) goal.valorObjetivo = dto.valorObjetivo;
    if (dto.moneda) goal.moneda = dto.moneda;
    if (dto.fechaInicio) goal.fechaInicio = new Date(dto.fechaInicio);
    if (dto.fechaFin) goal.fechaFin = new Date(dto.fechaFin);
    if (dto.estado) goal.estado = dto.estado;
    if (dto.notificacionesActivas !== undefined) goal.notificacionesActivas = dto.notificacionesActivas;
    if (dto.umbralNotificaciones) goal.umbralNotificaciones = dto.umbralNotificaciones;
    
    goal.actualizadoPor = userId ? new Types.ObjectId(userId) : null;

    await goal.save();

    // Recalcular progreso si cambió el valor objetivo
    if (dto.valorObjetivo) {
      await this.updateGoalProgress(id);
    }

    return goal;
  }

  async deleteGoal(id: string): Promise<void> {
    const result = await this.goalModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Meta con ID ${id} no encontrada`);
    }
  }

  // ========== ACTUALIZACIÓN DE PROGRESO ==========

  async updateGoalProgress(goalId: string): Promise<RecruitmentGoalDocument> {
    const goal = await this.goalModel.findById(goalId).exec();
    if (!goal) {
      throw new NotFoundException(`Meta con ID ${goalId} no encontrada`);
    }

    // Calcular progreso según el tipo de meta
    let valorActual = 0;

    if (goal.tipo === GoalType.MODELOS_CERRADAS) {
      // Contar modelos cerradas en el periodo
      const contratos = await this.contratoModel.countDocuments({
        empleadoIdSalesCloser: goal.salesCloserId,
        fechaInicio: {
          $gte: goal.fechaInicio,
          $lte: goal.fechaFin,
        },
      }).exec();

      valorActual = contratos;

    } else if (goal.tipo === GoalType.FACTURACION) {
      // Sumar facturación de contratos en el periodo
      const contratos = await this.contratoModel.find({
        empleadoIdSalesCloser: goal.salesCloserId,
        fechaInicio: {
          $gte: goal.fechaInicio,
          $lte: goal.fechaFin,
        },
      }).lean().exec();

      // Sumar el valor de los contratos (asumiendo que hay un campo de valor)
      valorActual = contratos.reduce((sum, contrato: any) => {
        // Si el contrato tiene un valor monetario, sumarlo
        // Ajustar según la estructura real de tu schema de contrato
        const valor = contrato.salario?.monto || 0;
        return sum + valor;
      }, 0);
    }

    // Calcular porcentaje
    const porcentajeCompletado = Math.min(
      Math.round((valorActual / goal.valorObjetivo) * 100),
      100
    );

    // Actualizar meta
    const porcentajeAnterior = goal.porcentajeCompletado;
    goal.valorActual = valorActual;
    goal.porcentajeCompletado = porcentajeCompletado;

    // Actualizar estado si se completó
    if (porcentajeCompletado >= 100 && goal.estado === GoalStatus.ACTIVA) {
      goal.estado = GoalStatus.COMPLETADA;
    }

    await goal.save();

    // Verificar si se debe enviar notificación
    await this.checkAndSendNotifications(goal, porcentajeAnterior);

    return goal;
  }

  // ========== NOTIFICACIONES AUTOMÁTICAS ==========

  private async checkAndSendNotifications(
    goal: RecruitmentGoalDocument,
    porcentajeAnterior: number,
  ): Promise<void> {
    if (!goal.notificacionesActivas) return;
    if (!goal.emailSalesCloser) return;

    // Verificar umbrales alcanzados
    for (const umbral of goal.umbralNotificaciones) {
      // Si el porcentaje actual alcanzó el umbral y antes no lo había alcanzado
      if (goal.porcentajeCompletado >= umbral && porcentajeAnterior < umbral) {
        // Verificar si ya se envió notificación para este umbral
        const yaEnviada = goal.notificacionesEnviadas.some(n => n.porcentaje === umbral);
        
        if (!yaEnviada) {
          await this.sendProgressNotification(goal, umbral);
        }
      }
    }
  }

  private async sendProgressNotification(
    goal: RecruitmentGoalDocument,
    umbral: number,
  ): Promise<void> {
    try {
      const nombreSalesCloser = goal.nombreSalesCloser?.split(' ')[0] || 'Compañero';
      const diasRestantes = Math.ceil(
        (goal.fechaFin.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const faltante = goal.valorObjetivo - goal.valorActual;
      const tipoTexto = goal.tipo === GoalType.MODELOS_CERRADAS 
        ? 'modelos' 
        : `${goal.moneda}`;

      // Generar mensaje personalizado según el umbral
      let mensaje = '';
      let asunto = '';

      if (umbral === 25) {
        asunto = `🎯 ¡Vas en camino! ${umbral}% de tu meta alcanzada`;
        mensaje = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">¡Excelente inicio! 🚀</h1>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="font-size: 18px; color: #374151; margin-bottom: 20px;">Hola <strong>${nombreSalesCloser}</strong>,</p>
              <p style="font-size: 16px; color: #6b7280; line-height: 1.6;">
                ¡Has alcanzado el <strong style="color: #667eea; font-size: 20px;">${umbral}%</strong> de tu meta! 
                Estás haciendo un gran trabajo. 💪
              </p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0; color: #374151;"><strong>Meta:</strong> ${goal.titulo}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Progreso:</strong> ${goal.valorActual} de ${goal.valorObjetivo} ${tipoTexto}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Faltante:</strong> ${faltante} ${tipoTexto}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Días restantes:</strong> ${diasRestantes} días</p>
              </div>
              <p style="font-size: 16px; color: #6b7280; text-align: center; margin-top: 20px;">
                ¡Sigue así y alcanzarás tu objetivo! 🎯
              </p>
            </div>
          </div>
        `;
      } else if (umbral === 50) {
        asunto = `🔥 ¡A mitad de camino! ${umbral}% de tu meta`;
        mensaje = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">¡Mitad del camino! 🔥</h1>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="font-size: 18px; color: #374151; margin-bottom: 20px;">Hola <strong>${nombreSalesCloser}</strong>,</p>
              <p style="font-size: 16px; color: #6b7280; line-height: 1.6;">
                <strong style="color: #f5576c;">¡Tú puedes!</strong> Has llegado al <strong style="color: #f5576c; font-size: 20px;">${umbral}%</strong> de tu meta. 
                Te faltan <strong>${faltante} ${tipoTexto}</strong> y quedan <strong>${diasRestantes} días</strong>. 
              </p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0; color: #374151;"><strong>Meta:</strong> ${goal.titulo}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Progreso:</strong> ${goal.valorActual} de ${goal.valorObjetivo} ${tipoTexto}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Porcentaje:</strong> ${goal.porcentajeCompletado}%</p>
              </div>
              <p style="font-size: 18px; color: #374151; text-align: center; margin-top: 20px; font-weight: bold;">
                ¡Vamos con toda por esa comisión! 💰
              </p>
            </div>
          </div>
        `;
      } else if (umbral === 75) {
        asunto = `⚡ ¡Casi lo logras! ${umbral}% completado`;
        mensaje = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
            <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">¡Increíble avance! ⚡</h1>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="font-size: 18px; color: #374151; margin-bottom: 20px;">Hola <strong>${nombreSalesCloser}</strong>,</p>
              <p style="font-size: 16px; color: #6b7280; line-height: 1.6;">
                ¡Estás en la recta final! Ya completaste el <strong style="color: #fa709a; font-size: 20px;">${umbral}%</strong> de tu meta. 
                Solo te faltan <strong>${faltante} ${tipoTexto}</strong>. 
              </p>
              <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #fbbf24;">
                <p style="margin: 5px 0; color: #374151;"><strong>Meta:</strong> ${goal.titulo}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Logrado:</strong> ${goal.valorActual} ${tipoTexto}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Faltante:</strong> ${faltante} ${tipoTexto}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Días restantes:</strong> ${diasRestantes} días</p>
              </div>
              <p style="font-size: 18px; color: #374151; text-align: center; margin-top: 20px; font-weight: bold;">
                ¡El éxito está cerca! ¡No pares ahora! 🏆
              </p>
            </div>
          </div>
        `;
      } else if (umbral === 90) {
        asunto = `🎊 ¡Un último empujón! ${umbral}% alcanzado`;
        mensaje = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
            <div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: #374151; margin: 0; font-size: 28px;">¡Casi en la meta! 🎊</h1>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="font-size: 18px; color: #374151; margin-bottom: 20px;">Hola <strong>${nombreSalesCloser}</strong>,</p>
              <p style="font-size: 16px; color: #6b7280; line-height: 1.6;">
                ¡Asombroso! Has completado el <strong style="color: #06b6d4; font-size: 20px;">${umbral}%</strong>. 
                Solo te faltan <strong>${faltante} ${tipoTexto}</strong> para alcanzar tu meta. 
              </p>
              <div style="background: #ecfeff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #06b6d4;">
                <p style="margin: 5px 0; color: #374151;"><strong>Meta:</strong> ${goal.titulo}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Progreso:</strong> ${goal.valorActual} / ${goal.valorObjetivo} ${tipoTexto}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Tiempo:</strong> ${diasRestantes} días para cerrar</p>
              </div>
              <p style="font-size: 18px; color: #374151; text-align: center; margin-top: 20px; font-weight: bold;">
                ¡Un último empujón y lo lograrás! 💪🏆
              </p>
            </div>
          </div>
        `;
      } else if (umbral === 100) {
        asunto = `🏆 ¡META CUMPLIDA! ¡Felicitaciones!`;
        mensaje = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
            <div style="background: linear-gradient(135deg, #ffd89b 0%, #19547b 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px;">🎉 ¡FELICITACIONES! 🎉</h1>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="font-size: 18px; color: #374151; margin-bottom: 20px;">Hola <strong>${nombreSalesCloser}</strong>,</p>
              <p style="font-size: 18px; color: #6b7280; line-height: 1.6; text-align: center;">
                ¡Has completado el <strong style="color: #10b981; font-size: 24px;">100%</strong> de tu meta! 🏆
              </p>
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #d1fae5 100%); padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin: 10px 0; color: #374151; font-size: 18px;"><strong>Meta:</strong> ${goal.titulo}</p>
                <p style="margin: 10px 0; color: #10b981; font-size: 24px; font-weight: bold;">${goal.valorActual} ${tipoTexto}</p>
                <p style="margin: 10px 0; color: #374151;">¡Objetivo cumplido!</p>
              </div>
              <p style="font-size: 18px; color: #374151; text-align: center; margin-top: 30px; font-weight: bold;">
                ¡Eres un campeón! Tu esfuerzo y dedicación han dado frutos. 🌟💰
              </p>
              <p style="font-size: 16px; color: #6b7280; text-align: center; margin-top: 20px;">
                ¡Celebra este logro y prepárate para la próxima meta!
              </p>
            </div>
          </div>
        `;
      } else {
        // Mensaje genérico para cualquier otro umbral
        asunto = `🎯 ${umbral}% de tu meta alcanzada`;
        mensaje = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4f46e5;">¡Hola ${nombreSalesCloser}!</h2>
            <p>Has alcanzado el <strong>${umbral}%</strong> de tu meta.</p>
            <p><strong>Meta:</strong> ${goal.titulo}</p>
            <p><strong>Progreso:</strong> ${goal.valorActual} de ${goal.valorObjetivo} ${tipoTexto}</p>
            <p><strong>Faltante:</strong> ${faltante} ${tipoTexto}</p>
            <p><strong>Días restantes:</strong> ${diasRestantes} días</p>
            <p>¡Sigue adelante! 💪</p>
          </div>
        `;
      }

      // Configuración de Brevo desde variables de entorno
      const brevoConfig = {
        host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
        from: process.env.SMTP_FROM || 'noreply@onlytop.com',
        fromName: 'OnlyTop - Sistema de Metas',
      };

      // Enviar email
      const result = await this.brevoSmtpProvider.sendEmail(brevoConfig, {
        to: goal.emailSalesCloser!,
        subject: asunto,
        html: mensaje,
      });

      // Registrar notificación enviada
      goal.notificacionesEnviadas.push({
        porcentaje: umbral,
        fechaEnvio: new Date(),
        mensaje: asunto,
      });

      await goal.save();

      this.logger.log(`Notificación enviada a ${goal.emailSalesCloser} por alcanzar ${umbral}% de la meta ${goal.titulo}. ID: ${result.id}`);

    } catch (error) {
      this.logger.error(`Error enviando notificación de meta ${goal._id}:`, error);
    }
  }

  // ========== CRON JOB - ACTUALIZACIÓN AUTOMÁTICA ==========

  @Cron(CronExpression.EVERY_HOUR)
  async updateAllActiveGoals(): Promise<void> {
    this.logger.log('Iniciando actualización automática de metas activas...');

    try {
      const activeGoals = await this.goalModel.find({
        estado: GoalStatus.ACTIVA,
      }).exec();

      for (const goal of activeGoals) {
        try {
          // Verificar si la meta venció
          if (goal.fechaFin < new Date() && goal.porcentajeCompletado < 100) {
            goal.estado = GoalStatus.VENCIDA;
            await goal.save();
            this.logger.log(`Meta ${goal._id} marcada como vencida`);
            continue;
          }

          // Actualizar progreso
          await this.updateGoalProgress(goal._id.toString());
        } catch (error) {
          this.logger.error(`Error actualizando meta ${goal._id}:`, error);
        }
      }

      this.logger.log(`Actualización completada. ${activeGoals.length} metas procesadas.`);
    } catch (error) {
      this.logger.error('Error en actualización automática de metas:', error);
    }
  }

  // ========== ESTADÍSTICAS ==========

  async getGoalStats(salesCloserId?: string): Promise<any> {
    const query: any = {};
    if (salesCloserId) {
      query.salesCloserId = new Types.ObjectId(salesCloserId);
    }

    const [activas, completadas, vencidas, total] = await Promise.all([
      this.goalModel.countDocuments({ ...query, estado: GoalStatus.ACTIVA }).exec(),
      this.goalModel.countDocuments({ ...query, estado: GoalStatus.COMPLETADA }).exec(),
      this.goalModel.countDocuments({ ...query, estado: GoalStatus.VENCIDA }).exec(),
      this.goalModel.countDocuments(query).exec(),
    ]);

    // Calcular porcentaje promedio de cumplimiento
    const goals = await this.goalModel.find(query).lean().exec();
    const promedioCompletado = goals.length > 0
      ? goals.reduce((sum, g) => sum + g.porcentajeCompletado, 0) / goals.length
      : 0;

    return {
      total,
      activas,
      completadas,
      vencidas,
      promedioCompletado: Math.round(promedioCompletado),
      tasaExito: total > 0 ? Math.round((completadas / total) * 100) : 0,
    };
  }
}

