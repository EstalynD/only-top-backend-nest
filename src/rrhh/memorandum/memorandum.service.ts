import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import PDFDocument from 'pdfkit';
import { AttendanceEntity } from '../attendance/attendance.schema.js';
import { EmpleadosService } from '../empleados.service.js';
import type { EmpleadoDocument } from '../empleado.schema.js';
import { MemorandumEntity, MemorandumStatus, MemorandumDocument } from './memorandum.schema.js';
import { 
  SUBSANATION_DEADLINE_DAYS,
  generateMemorandumCode,
  MemorandumGenerationData,
  AnomalyType
} from '../attendance/attendance.constants.js';

export type MemorandumType = 'AUSENCIA' | 'LLEGADA_TARDE' | 'SALIDA_ANTICIPADA' | 'SALIDA_SIN_REGISTRO';

export interface MemorandumData {
  empleadoNombre: string;
  empleadoCargo: string;
  fecha: string;
  horaRegistrada?: string;
  horaEsperada?: string;
  jefe: string;
  cargoJefe: string;
}

export interface SubsaneMemorandumDto {
  justification: string;
  attachments?: {
    filename: string;
    url: string;
    mimeType: string;
    size: number;
  }[];
}

export interface ReviewMemorandumDto {
  approved: boolean;
  comments?: string;
  rejectionReason?: string;
}

@Injectable()
export class MemorandumService {
  private readonly logger = new Logger(MemorandumService.name);

  constructor(
    @InjectModel(AttendanceEntity.name) private readonly attendanceModel: Model<AttendanceEntity>,
    @InjectModel(MemorandumEntity.name) private readonly memorandumModel: Model<MemorandumEntity>,
    private readonly empleadosService: EmpleadosService,
  ) {}

  // === CREATE MEMORANDUM ===

  /**
   * Crea un nuevo memorando basado en una anomalía detectada
   */
  async createMemorandum(data: MemorandumGenerationData, generatedBy: string = 'SISTEMA', generatedByUserId?: string): Promise<MemorandumDocument> {
    this.logger.log(`Creating memorandum for user ${data.userId}, type: ${data.type}`);

    // Obtener información del empleado
    const empleado = await this.empleadosService.findEmpleadoByUserId(data.userId);
    if (!empleado) {
      throw new NotFoundException(`Employee with userId ${data.userId} not found`);
    }

    // Generar código único para el memorando
    const year = new Date().getFullYear();
    const lastMemorandum = await this.memorandumModel
      .findOne({ code: new RegExp(`^MEM-${year}-`) })
      .sort({ code: -1 })
      .lean();
    
    let sequence = 1;
    if (lastMemorandum) {
      const match = lastMemorandum.code.match(/MEM-\d{4}-(\d{4})/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    const code = generateMemorandumCode(year, sequence);

    // Calcular fecha límite de subsanación (días hábiles)
    const subsanationDeadline = this.calculateSubsanationDeadline(data.incidentDate, SUBSANATION_DEADLINE_DAYS);

    // Obtener nombres de área y cargo
    let cargoName = 'No especificado';
    if (empleado.cargoId) {
      cargoName = typeof empleado.cargoId === 'object' && (empleado.cargoId as any).name
        ? (empleado.cargoId as any).name
        : 'No especificado';
    }

    // Crear el memorando
    const memorandum = new this.memorandumModel({
      code,
      type: data.type,
      status: 'PENDIENTE',
      userId: data.userId,
      empleadoId: data.empleadoId,
      empleadoNombre: `${empleado.nombre} ${empleado.apellido}`,
      empleadoCargo: cargoName,
      areaId: empleado.areaId,
      cargoId: empleado.cargoId,
      incidentDate: data.incidentDate,
      expectedTime: data.expectedTime,
      actualTime: data.actualTime,
      delayMinutes: data.delayMinutes,
      earlyMinutes: data.earlyMinutes,
      shiftId: data.shiftId,
      shiftName: data.shiftName,
      attendanceRecordId: data.attendanceRecordId,
      subsanationDeadline,
      generatedBy,
      generatedByUserId,
      generatedAt: new Date(),
      statusHistory: [{
        status: 'PENDIENTE',
        changedBy: generatedBy,
        changedByUserId: generatedByUserId || 'SYSTEM',
        changedAt: new Date(),
        action: 'Memorando generado automáticamente por el sistema',
      }],
      affectsRecord: false,
    });

    // Si el empleado proporcionó justificación inmediata, marcar como subsanado
    if (data.employeeJustification) {
      memorandum.employeeJustification = data.employeeJustification;
      memorandum.subsanedAt = new Date();
      memorandum.status = 'SUBSANADO';
      memorandum.isSubsanedBeforeFormal = true;
      
      memorandum.statusHistory.push({
        status: 'SUBSANADO',
        changedBy: empleado.nombre,
        changedByUserId: data.userId,
        changedAt: new Date(),
        action: 'Empleado subsanó el memorando antes de la emisión formal',
      });
    }

    await memorandum.save();

    this.logger.log(`Memorandum created successfully: ${code}`);
    return memorandum;
  }

  // === SUBSANAR MEMORANDUM ===

  /**
   * Permite al empleado subsanar un memorando pendiente
   */
  async subsanarMemorandum(
    memorandumId: string,
    userId: string,
    dto: SubsaneMemorandumDto
  ): Promise<MemorandumDocument> {
    const memorandum = await this.memorandumModel.findById(memorandumId);
    
    if (!memorandum) {
      throw new NotFoundException('Memorando no encontrado');
    }

    if (memorandum.userId !== userId) {
      throw new BadRequestException('No tienes permiso para subsanar este memorando');
    }

    if (memorandum.status !== 'PENDIENTE') {
      throw new BadRequestException('Este memorando ya no puede ser subsanado');
    }

    // Verificar si está expirado
    if (memorandum.subsanationDeadline && new Date() > memorandum.subsanationDeadline) {
      throw new BadRequestException('El plazo para subsanar este memorando ha expirado');
    }

    // Actualizar información de subsanación
    memorandum.employeeJustification = dto.justification;
    memorandum.subsanedAt = new Date();
    memorandum.status = 'SUBSANADO';

    if (dto.attachments) {
      memorandum.attachments = dto.attachments.map(att => ({
        ...att,
        uploadedAt: new Date(),
      }));
    }

    // Agregar al historial
    memorandum.statusHistory.push({
      status: 'SUBSANADO',
      changedBy: memorandum.empleadoNombre,
      changedByUserId: userId,
      changedAt: new Date(),
      comments: `Justificación: ${dto.justification}`,
      action: 'Empleado subsanó el memorando',
    });

    await memorandum.save();

    this.logger.log(`Memorandum ${memorandum.code} subsanado por empleado ${userId}`);
    return memorandum;
  }

  // === REVIEW MEMORANDUM (ADMIN) ===

  /**
   * Permite a RRHH revisar y aprobar/rechazar un memorando
   */
  async reviewMemorandum(
    memorandumId: string,
    reviewedBy: string,
    reviewedByUserId: string,
    dto: ReviewMemorandumDto
  ): Promise<MemorandumDocument> {
    const memorandum = await this.memorandumModel.findById(memorandumId);
    
    if (!memorandum) {
      throw new NotFoundException('Memorando no encontrado');
    }

    // Verificar si puede ser revisado
    const canReview = memorandum.status === 'SUBSANADO' || memorandum.status === 'EN_REVISIÓN';
    if (!canReview) {
      throw new BadRequestException('Este memorando no puede ser revisado en su estado actual');
    }

    // Actualizar estado basado en la decisión
    const newStatus = dto.approved ? 'APROBADO' : 'RECHAZADO';
    memorandum.status = newStatus;
    memorandum.reviewedBy = reviewedBy;
    memorandum.reviewedByUserId = reviewedByUserId;
    memorandum.reviewedAt = new Date();
    memorandum.reviewComments = dto.comments;
    
    if (!dto.approved && dto.rejectionReason) {
      memorandum.rejectionReason = dto.rejectionReason;
    }

    // Si es rechazado, afecta el registro
    if (!dto.approved) {
      memorandum.affectsRecord = true;
    }

    // Agregar al historial
    memorandum.statusHistory.push({
      status: newStatus,
      changedBy: reviewedBy,
      changedByUserId: reviewedByUserId,
      changedAt: new Date(),
      comments: dto.comments || dto.rejectionReason,
      action: dto.approved ? 'RRHH aprobó la justificación' : 'RRHH rechazó la justificación',
    });

    // Cambiar a CERRADO después de la revisión
    memorandum.status = 'CERRADO';
    memorandum.closedAt = new Date();
    memorandum.closedBy = reviewedBy;
    memorandum.closedByUserId = reviewedByUserId;

    memorandum.statusHistory.push({
      status: 'CERRADO',
      changedBy: reviewedBy,
      changedByUserId: reviewedByUserId,
      changedAt: new Date(),
      action: 'Proceso de revisión finalizado',
    });

    await memorandum.save();

    this.logger.log(`Memorandum ${memorandum.code} revisado por ${reviewedBy}: ${dto.approved ? 'APROBADO' : 'RECHAZADO'}`);
    return memorandum;
  }

  // === AUTO EXPIRE MEMORANDUMS ===

  /**
   * Marca como expirados los memorandos pendientes que superaron el plazo
   */
  async autoExpireMemorandums(): Promise<number> {
    const now = new Date();
    
    const expiredMemorandums = await this.memorandumModel.find({
      status: 'PENDIENTE',
      subsanationDeadline: { $lt: now },
    });

    let count = 0;

    for (const memorandum of expiredMemorandums) {
      memorandum.status = 'EXPIRADO';
      memorandum.affectsRecord = true;

      memorandum.statusHistory.push({
        status: 'EXPIRADO',
        changedBy: 'SISTEMA',
        changedByUserId: 'SYSTEM',
        changedAt: new Date(),
        comments: `Plazo de subsanación vencido el ${memorandum.subsanationDeadline?.toLocaleString('es-PE')}`,
        action: 'Memorando expirado automáticamente por el sistema',
      });

      // Cambiar a revisión para que RRHH lo revise
      memorandum.status = 'EN_REVISIÓN';
      memorandum.statusHistory.push({
        status: 'EN_REVISIÓN',
        changedBy: 'SISTEMA',
        changedByUserId: 'SYSTEM',
        changedAt: new Date(),
        action: 'Movido a revisión tras expiración',
      });

      await memorandum.save();
      count++;
    }

    this.logger.log(`${count} memorandums expirados y movidos a revisión`);
    return count;
  }

  // === QUERY METHODS ===

  /**
   * Obtiene todos los memorandos de un empleado
   */
  async getUserMemorandums(
    userId: string,
    filters?: {
      status?: MemorandumStatus;
      type?: MemorandumType;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<any[]> {
    const query: any = { userId };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      query.incidentDate = {};
      if (filters.startDate) {
        query.incidentDate.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.incidentDate.$lte = filters.endDate;
      }
    }

    return this.memorandumModel
      .find(query)
      .sort({ incidentDate: -1 })
      .lean();
  }

  /**
   * Obtiene todos los memorandos de un empleado por empleadoId
   */
  async getEmployeeMemorandums(
    empleadoId: string,
    filters?: {
      status?: MemorandumStatus;
      type?: MemorandumType;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<any[]> {
    const query: any = { empleadoId };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      query.incidentDate = {};
      if (filters.startDate) {
        query.incidentDate.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.incidentDate.$lte = filters.endDate;
      }
    }

    return this.memorandumModel
      .find(query)
      .sort({ incidentDate: -1 })
      .lean();
  }

  /**
   * Obtiene memorandos pendientes de revisión (para admins)
   */
  async getPendingReviewMemorandums(filters?: {
    type?: MemorandumType;
    areaId?: string;
    cargoId?: string;
  }): Promise<any[]> {
    const query: any = {
      status: { $in: ['SUBSANADO', 'EN_REVISIÓN', 'EXPIRADO'] },
    };

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.areaId) {
      query.areaId = filters.areaId;
    }

    if (filters?.cargoId) {
      query.cargoId = filters.cargoId;
    }

    return this.memorandumModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .sort({ subsanedAt: 1 })
      .lean();
  }

  /**
   * Obtiene TODOS los memorandos del sistema con filtros (para admins)
   * A diferencia de getPendingReviewMemorandums, este método no filtra por estado automáticamente
   */
  async getAllMemorandums(filters?: {
    status?: MemorandumStatus;
    type?: MemorandumType;
    areaId?: string;
    cargoId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any[]> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.areaId) {
      query.areaId = filters.areaId;
    }

    if (filters?.cargoId) {
      query.cargoId = filters.cargoId;
    }

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    if (filters?.startDate || filters?.endDate) {
      query.incidentDate = {};
      if (filters.startDate) {
        query.incidentDate.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.incidentDate.$lte = filters.endDate;
      }
    }

    return this.memorandumModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .sort({ incidentDate: -1 })
      .lean();
  }

  /**
   * Obtiene un memorando por ID con detalles completos
   */
  async getMemorandumById(memorandumId: string): Promise<any> {
    const memorandum = await this.memorandumModel
      .findById(memorandumId)
      .populate('empleadoId', 'nombre apellido correoElectronico telefono')
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .populate('attendanceRecordId')
      .lean();

    if (!memorandum) {
      throw new NotFoundException('Memorando no encontrado');
    }

    return memorandum;
  }

  /**
   * Obtiene estadísticas de memorandos
   */
  async getMemorandumStats(filters?: {
    userId?: string;
    areaId?: string;
    cargoId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const query: any = {};

    if (filters?.userId) {
      query.userId = filters.userId;
    }

    if (filters?.areaId) {
      query.areaId = filters.areaId;
    }

    if (filters?.cargoId) {
      query.cargoId = filters.cargoId;
    }

    if (filters?.startDate || filters?.endDate) {
      query.incidentDate = {};
      if (filters.startDate) {
        query.incidentDate.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.incidentDate.$lte = filters.endDate;
      }
    }

    const [totalCount, byStatus, byType, affectingRecord] = await Promise.all([
      this.memorandumModel.countDocuments(query),
      this.memorandumModel.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.memorandumModel.aggregate([
        { $match: query },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.memorandumModel.countDocuments({ ...query, affectsRecord: true }),
    ]);

    return {
      total: totalCount,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
      affectingRecord,
    };
  }

  // === UTILITY METHODS ===

  /**
   * Calcula la fecha límite de subsanación (días hábiles)
   */
  private calculateSubsanationDeadline(startDate: Date, businessDays: number): Date {
    const deadline = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      deadline.setDate(deadline.getDate() + 1);
      const dayOfWeek = deadline.getDay();
      
      // Sáb=6, Dom=0 no cuentan como días hábiles
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }

    // Establecer hora al final del día
    deadline.setHours(23, 59, 59, 999);
    return deadline;
  }

  // === LEGACY PDF GENERATION ===

  /**
   * Genera un memorando en PDF (mantiene compatibilidad con versión anterior)
   */
  async generateMemorandum(
    type: MemorandumType,
    userId: string,
    date: Date,
    generatedBy: any
  ): Promise<Buffer> {
    // Get employee information
    const empleado = await this.empleadosService.findEmpleadoById(userId);
    if (!empleado) {
      throw new NotFoundException(`Employee with ID ${userId} not found`);
    }

    // Get attendance records for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const records = await this.attendanceModel
      .find({
        userId,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
      })
      .sort({ timestamp: 1 })
      .lean();

    // Prepare data for memorandum
    const data = await this.prepareMemorandumData(type, empleado, records, date, generatedBy);

    // Generate PDF
    return this.createMemorandumPDF(type, data);
  }

  private async prepareMemorandumData(
    type: MemorandumType,
    empleado: any,
    records: any[],
    date: Date,
    generatedBy: any
  ): Promise<MemorandumData> {
    // Get cargo name
    let cargoName = 'No especificado';
    if (empleado.cargoId) {
      const cargo = typeof empleado.cargoId === 'object' && empleado.cargoId.name
        ? empleado.cargoId.name
        : 'No especificado';
      cargoName = cargo;
    }

    // Get jefe information
    const jefeNombre = generatedBy?.username || 'Administración';
    const jefeCargo = generatedBy?.cargo || 'Recursos Humanos';

    const data: MemorandumData = {
      empleadoNombre: `${empleado.nombre} ${empleado.apellido}`,
      empleadoCargo: cargoName,
      fecha: date.toLocaleDateString('es-PE', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      jefe: jefeNombre,
      cargoJefe: jefeCargo
    };

    // Add specific data based on type
    if (type === 'LLEGADA_TARDE') {
      const checkIn = records.find(r => r.type === 'CHECK_IN');
      if (checkIn) {
        data.horaRegistrada = checkIn.timestamp.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } else if (type === 'SALIDA_ANTICIPADA') {
      const checkOut = records.find(r => r.type === 'CHECK_OUT');
      if (checkOut) {
        data.horaRegistrada = checkOut.timestamp.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }

    return data;
  }

  private createMemorandumPDF(type: MemorandumType, data: MemorandumData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 72 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Generate memorandum number (simple sequential based on date)
        const memorandumNumber = `${String(type).substring(0, 3)}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text('MEMORANDO', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').text(`N° ${memorandumNumber}`, { align: 'center' });
        doc.moveDown(0.5);
        
        // Current date
        const currentDate = new Date().toLocaleDateString('es-PE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        doc.text(`Lima, ${currentDate}`, { align: 'center' });
        doc.moveDown(2);

        // To/From section
        doc.font('Helvetica-Bold').text('PARA:', { continued: true });
        doc.font('Helvetica').text(`     ${data.empleadoNombre}`);
        
        doc.font('Helvetica-Bold').text('DE:', { continued: true });
        doc.font('Helvetica').text(`           ${data.jefe} - ${data.cargoJefe}`);
        
        doc.font('Helvetica-Bold').text('ASUNTO:', { continued: true });
        doc.font('Helvetica').text(`  ${this.getMemorandumSubject(type)}`);
        doc.moveDown(2);

        // Body
        doc.font('Helvetica').fontSize(11);
        const body = this.getMemorandumBody(type, data);
        doc.text(body, { align: 'justify', lineGap: 5 });
        doc.moveDown(3);

        // Footer
        doc.text('Atentamente,', { align: 'left' });
        doc.moveDown(2);
        doc.moveDown(1);
        doc.text('_'.repeat(40));
        doc.text(data.jefe);
        doc.text(data.cargoJefe);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private getMemorandumSubject(type: MemorandumType): string {
    switch (type) {
      case 'AUSENCIA':
        return 'Ausencia Injustificada';
      case 'LLEGADA_TARDE':
        return 'Llegada Tarde';
      case 'SALIDA_ANTICIPADA':
        return 'Salida Anticipada';
      default:
        return 'Notificación';
    }
  }

  private getMemorandumBody(type: MemorandumType, data: MemorandumData): string {
    switch (type) {
      case 'AUSENCIA':
        return `Se le comunica que en fecha ${data.fecha}, usted no asistió a su centro de labores sin presentar justificación alguna.\n\n` +
          `Le recordamos que la inasistencia sin sustento válido constituye falta de acuerdo con el Reglamento Interno de Trabajo y puede acarrear sanciones disciplinarias.\n\n` +
          `Se le exhorta a regularizar su situación y presentar la documentación respectiva en un plazo máximo de 24 horas.`;

      case 'LLEGADA_TARDE':
        return `Se ha registrado que el día ${data.fecha}, usted ingresó a su puesto de trabajo a las ${data.horaRegistrada || 'hora no registrada'}, fuera del horario establecido.\n\n` +
          `Le recordamos que la puntualidad es fundamental para el buen desempeño de las actividades laborales. La reiteración de esta conducta será considerada falta disciplinaria.`;

      case 'SALIDA_ANTICIPADA':
        return `Se informa que el día ${data.fecha}, usted se retiró de su centro de labores a las ${data.horaRegistrada || 'hora no registrada'}, antes del horario establecido, sin autorización previa.\n\n` +
          `Le reiteramos que toda salida anticipada debe contar con el permiso correspondiente, caso contrario será considerada una falta.`;

      default:
        return 'Contenido del memorando no disponible.';
    }
  }
}
