import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  RecruitmentActivityEntity, 
  RecruitmentActivityDocument,
  EstadoModeloCerrada,
} from './recruitment-activity.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { ContratoModeloEntity, ContratoModeloDocument, EstadoContrato } from '../rrhh/contrato-modelo.schema.js';
import { 
  CreateRecruitmentActivityDto, 
  UpdateRecruitmentActivityDto,
  VincularModeloDto,
} from './dto/recruitment-activity.dto.js';
import type * as ExcelJS from 'exceljs';

@Injectable()
export class RecruitmentService {
  private readonly logger = new Logger(RecruitmentService.name);

  constructor(
    @InjectModel(RecruitmentActivityEntity.name) private activityModel: Model<RecruitmentActivityDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(ModeloEntity.name) private modeloModel: Model<ModeloDocument>,
    @InjectModel(ContratoModeloEntity.name) private contratoModeloModel: Model<ContratoModeloDocument>,
  ) {}

  // ========== CRUD DE ACTIVIDADES ==========

  async createActivity(
    dto: CreateRecruitmentActivityDto,
    userId?: string,
    salesCloserId?: string,
  ): Promise<RecruitmentActivityDocument> {
    // Determinar el Sales Closer
    let finalSalesCloserId: Types.ObjectId;

    if (dto.salesCloserId) {
      // Si se proporciona explícitamente
      if (!Types.ObjectId.isValid(dto.salesCloserId)) {
        throw new BadRequestException('Invalid Sales Closer ID format');
      }
      finalSalesCloserId = new Types.ObjectId(dto.salesCloserId);
    } else if (salesCloserId) {
      // Si se obtiene del usuario logueado
      finalSalesCloserId = new Types.ObjectId(salesCloserId);
    } else {
      throw new BadRequestException('Sales Closer ID is required');
    }

    // Validar que el Sales Closer existe y está activo
    const salesCloser = await this.empleadoModel
      .findById(finalSalesCloserId)
      .populate('cargoId')
      .exec();

    if (!salesCloser || salesCloser.estado !== 'ACTIVO') {
      throw new BadRequestException('Invalid or inactive Sales Closer');
    }

    // Verificar que sea realmente un Sales Closer
    const cargo = salesCloser.cargoId as any;
    if (!cargo || (cargo.code !== 'REC_SC' && !cargo.name.toLowerCase().includes('sales closer'))) {
      throw new BadRequestException('Employee is not a Sales Closer');
    }

    // Validar modelos cerradas si las hay y ajustar estado según contratos
    let systemMessagesOnCreate: string[] = [];
    if (dto.modelosCerradas && dto.modelosCerradas.length > 0) {
      for (const m of dto.modelosCerradas) {
        // Si se proporciona modeloId, verificar que existe y revisar contrato
        if (m.modeloId) {
          if (!Types.ObjectId.isValid(m.modeloId)) {
            throw new BadRequestException(`Invalid modelo ID format: ${m.modeloId}`);
          }
          const modeloExiste = await this.modeloModel.findById(m.modeloId).exec();
          if (!modeloExiste) {
            throw new BadRequestException(`Modelo with ID ${m.modeloId} not found`);
          }

          // Por defecto registrada si tiene modeloId
          m.estado = EstadoModeloCerrada.REGISTRADA;

          // Verificar contrato firmado
          const contratoFirmado = await this.contratoModeloModel
            .findOne({ modeloId: new Types.ObjectId(m.modeloId), estado: EstadoContrato.FIRMADO })
            .sort({ fechaFirma: -1 })
            .exec();

          if (contratoFirmado) {
            m.estado = EstadoModeloCerrada.FIRMADA;
          } else {
            systemMessagesOnCreate.push(`Modelo "${m.nombreModelo}" vinculada sin contrato firmado. Estado: REGISTRADA.`);
          }
        } else {
          // Si no hay modeloId, el estado es EN_ESPERA
          m.estado = m.estado || EstadoModeloCerrada.EN_ESPERA;
        }
      }
    }

    // Crear la actividad
    const activity = new this.activityModel({
      fechaActividad: new Date(dto.fechaActividad),
      salesCloserId: finalSalesCloserId,
      cuentasTexteadas: dto.cuentasTexteadas,
      likesRealizados: dto.likesRealizados,
      comentariosRealizados: dto.comentariosRealizados,
      contactosObtenidos: dto.contactosObtenidos || [],
      reunionesAgendadas: dto.reunionesAgendadas,
      reunionesRealizadas: dto.reunionesRealizadas,
      modelosCerradas: dto.modelosCerradas?.map(m => ({
        ...m,
        fechaCierre: new Date(m.fechaCierre),
        modeloId: m.modeloId ? new Types.ObjectId(m.modeloId) : null,
        promedioFacturacion: 0, // Se calculará en el pre-save hook
      })) || [],
      notasDia: dto.notasDia,
      creadoPor: userId ? new Types.ObjectId(userId) : null,
      meta: systemMessagesOnCreate.length > 0 ? { mensajesSistema: systemMessagesOnCreate } : {},
    });

    return await activity.save();
  }

  async findAllActivities(filters?: {
    salesCloserId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    estado?: EstadoModeloCerrada;
  }): Promise<RecruitmentActivityDocument[]> {
    const query: any = {};

    if (filters?.salesCloserId) {
      if (!Types.ObjectId.isValid(filters.salesCloserId)) {
        throw new BadRequestException('Invalid Sales Closer ID format');
      }
      query.salesCloserId = new Types.ObjectId(filters.salesCloserId);
    }

    if (filters?.fechaDesde || filters?.fechaHasta) {
      query.fechaActividad = {};
      if (filters.fechaDesde) {
        query.fechaActividad.$gte = new Date(filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        query.fechaActividad.$lte = new Date(filters.fechaHasta);
      }
    }

    if (filters?.estado) {
      query['modelosCerradas.estado'] = filters.estado;
    }

    return await this.activityModel
      .find(query)
      .populate('salesCloserId', 'nombre apellido correoElectronico cargoId')
      .populate('modelosCerradas.modeloId', 'nombreCompleto numeroIdentificacion estado')
      .sort({ fechaActividad: -1 })
      .exec();
  }

  async findActivityById(id: string): Promise<RecruitmentActivityDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid activity ID format');
    }

    const activity = await this.activityModel
      .findById(id)
      .populate('salesCloserId', 'nombre apellido correoElectronico cargoId')
      .populate('modelosCerradas.modeloId', 'nombreCompleto numeroIdentificacion estado')
      .exec();

    if (!activity) {
      throw new NotFoundException(`Activity with ID '${id}' not found`);
    }

    return activity;
  }

  async updateActivity(id: string, dto: UpdateRecruitmentActivityDto): Promise<RecruitmentActivityDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid activity ID format');
    }

    const updateData: any = {};

    if (dto.fechaActividad) updateData.fechaActividad = new Date(dto.fechaActividad);
    if (dto.cuentasTexteadas !== undefined) updateData.cuentasTexteadas = dto.cuentasTexteadas;
    if (dto.likesRealizados !== undefined) updateData.likesRealizados = dto.likesRealizados;
    if (dto.comentariosRealizados !== undefined) updateData.comentariosRealizados = dto.comentariosRealizados;
    if (dto.contactosObtenidos) updateData.contactosObtenidos = dto.contactosObtenidos;
    if (dto.reunionesAgendadas !== undefined) updateData.reunionesAgendadas = dto.reunionesAgendadas;
    if (dto.reunionesRealizadas !== undefined) updateData.reunionesRealizadas = dto.reunionesRealizadas;
    if (dto.notasDia !== undefined) updateData.notasDia = dto.notasDia;

    if (dto.modelosCerradas) {
      const mensajesSistema: string[] = [];
      const processed = await Promise.all(dto.modelosCerradas.map(async (m) => {
        const base: any = {
          ...m,
          fechaCierre: new Date(m.fechaCierre),
          modeloId: m.modeloId ? new Types.ObjectId(m.modeloId) : null,
          promedioFacturacion: (m.facturacionUltimosTresMeses && m.facturacionUltimosTresMeses.length === 3)
            ? (m.facturacionUltimosTresMeses[0] + m.facturacionUltimosTresMeses[1] + m.facturacionUltimosTresMeses[2]) / 3
            : 0,
        };

        // Definir estado según contrato/modeloId
        if (m.modeloId) {
          if (!Types.ObjectId.isValid(m.modeloId)) {
            throw new BadRequestException(`Invalid modelo ID format: ${m.modeloId}`);
          }
          base.estado = EstadoModeloCerrada.REGISTRADA;
          const contratoFirmado = await this.contratoModeloModel
            .findOne({ modeloId: new Types.ObjectId(m.modeloId), estado: EstadoContrato.FIRMADO })
            .sort({ fechaFirma: -1 })
            .exec();
          if (contratoFirmado) {
            base.estado = EstadoModeloCerrada.FIRMADA;
          } else {
            mensajesSistema.push(`Modelo "${m.nombreModelo}" vinculada sin contrato firmado. Estado: REGISTRADA.`);
          }
        } else {
          base.estado = EstadoModeloCerrada.EN_ESPERA;
        }

        return base;
      }));

      updateData.modelosCerradas = processed;
      if (mensajesSistema.length > 0) {
        updateData['meta.mensajesSistema'] = mensajesSistema;
      }
    }

    const updated = await this.activityModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('salesCloserId', 'nombre apellido correoElectronico cargoId')
      .populate('modelosCerradas.modeloId', 'nombreCompleto numeroIdentificacion estado')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Activity with ID '${id}' not found`);
    }

    return updated;
  }

  async deleteActivity(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid activity ID format');
    }

    const result = await this.activityModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Activity with ID '${id}' not found`);
    }
  }

  // ========== VINCULAR MODELO CERRADA CON MODELO REGISTRADA ==========

  async vincularModelo(dto: VincularModeloDto): Promise<RecruitmentActivityDocument> {
    if (!Types.ObjectId.isValid(dto.actividadId)) {
      throw new BadRequestException('Invalid activity ID format');
    }

    if (!Types.ObjectId.isValid(dto.modeloId)) {
      throw new BadRequestException('Invalid modelo ID format');
    }

    const activity = await this.activityModel.findById(dto.actividadId).exec();
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    if (dto.modeloCerradaIndex < 0 || dto.modeloCerradaIndex >= activity.modelosCerradas.length) {
      throw new BadRequestException('Invalid modelo cerrada index');
    }

    // Verificar que la modelo existe
    const modelo = await this.modeloModel.findById(dto.modeloId).exec();
    if (!modelo) {
      throw new NotFoundException('Modelo not found');
    }

    // Actualizar la modelo cerrada y estado según contrato
    const newModeloId = new Types.ObjectId(dto.modeloId);
    activity.modelosCerradas[dto.modeloCerradaIndex].modeloId = newModeloId;

    const contratoFirmado = await this.contratoModeloModel
      .findOne({ modeloId: newModeloId, estado: EstadoContrato.FIRMADO })
      .sort({ fechaFirma: -1 })
      .exec();

    if (contratoFirmado) {
      activity.modelosCerradas[dto.modeloCerradaIndex].estado = EstadoModeloCerrada.FIRMADA;
    } else {
      activity.modelosCerradas[dto.modeloCerradaIndex].estado = EstadoModeloCerrada.REGISTRADA;
      // Mensaje informativo
      const nombre = activity.modelosCerradas[dto.modeloCerradaIndex].nombreModelo;
      const msg = `Modelo "${nombre}" vinculada sin contrato firmado. Estado: REGISTRADA.`;
      if (!activity.meta) activity.meta = {} as any;
      if (!Array.isArray((activity.meta as any).mensajesSistema)) (activity.meta as any).mensajesSistema = [];
      (activity.meta as any).mensajesSistema.push(msg);
    }

    return await activity.save();
  }

  // ========== ESTADÍSTICAS Y KPIs ==========

  async getStatsBySalesCloser(salesCloserId: string, fechaDesde?: string, fechaHasta?: string): Promise<any> {
    if (!Types.ObjectId.isValid(salesCloserId)) {
      throw new BadRequestException('Invalid Sales Closer ID format');
    }

    const query: any = { salesCloserId: new Types.ObjectId(salesCloserId) };

    if (fechaDesde || fechaHasta) {
      query.fechaActividad = {};
      if (fechaDesde) query.fechaActividad.$gte = new Date(fechaDesde);
      if (fechaHasta) query.fechaActividad.$lte = new Date(fechaHasta);
    }

    const activities = await this.activityModel.find(query).exec();

    // Calcular totales
    const totales = activities.reduce(
      (acc, act) => ({
        cuentasTexteadas: acc.cuentasTexteadas + act.cuentasTexteadas,
        likesRealizados: acc.likesRealizados + act.likesRealizados,
        comentariosRealizados: acc.comentariosRealizados + act.comentariosRealizados,
        contactosObtenidos: acc.contactosObtenidos + act.contactosObtenidos.length,
        reunionesAgendadas: acc.reunionesAgendadas + act.reunionesAgendadas,
        reunionesRealizadas: acc.reunionesRealizadas + act.reunionesRealizadas,
        modelosCerradas: acc.modelosCerradas + act.modelosCerradas.length,
      }),
      {
        cuentasTexteadas: 0,
        likesRealizados: 0,
        comentariosRealizados: 0,
        contactosObtenidos: 0,
        reunionesAgendadas: 0,
        reunionesRealizadas: 0,
        modelosCerradas: 0,
      }
    );

    // Calcular tasas de conversión
    const tasaContactoReunion = totales.contactosObtenidos > 0
      ? (totales.reunionesAgendadas / totales.contactosObtenidos) * 100
      : 0;

    const tasaReunionCierre = totales.reunionesRealizadas > 0
      ? (totales.modelosCerradas / totales.reunionesRealizadas) * 100
      : 0;

    const tasaAgendadaRealizada = totales.reunionesAgendadas > 0
      ? (totales.reunionesRealizadas / totales.reunionesAgendadas) * 100
      : 0;

    // Promedios de facturación de modelos cerradas
    let totalFacturacion = 0;
    let cantidadModelos = 0;

    activities.forEach(act => {
      act.modelosCerradas.forEach(modelo => {
        totalFacturacion += modelo.promedioFacturacion;
        cantidadModelos++;
      });
    });

    const promedioFacturacionModelosCerradas = cantidadModelos > 0 ? totalFacturacion / cantidadModelos : 0;

    // Modelos por estado
    const modelosPorEstado = {
      [EstadoModeloCerrada.EN_ESPERA]: 0,
      [EstadoModeloCerrada.REGISTRADA]: 0,
      [EstadoModeloCerrada.FIRMADA]: 0,
    };

    activities.forEach(act => {
      act.modelosCerradas.forEach(modelo => {
        modelosPorEstado[modelo.estado]++;
      });
    });

    return {
      totales,
      tasasConversion: {
        contactoReunion: tasaContactoReunion.toFixed(2),
        reunionCierre: tasaReunionCierre.toFixed(2),
        agendadaRealizada: tasaAgendadaRealizada.toFixed(2),
      },
      promedioFacturacionModelosCerradas: promedioFacturacionModelosCerradas.toFixed(2),
      modelosPorEstado,
      cantidadActividades: activities.length,
      rangoFechas: {
        desde: fechaDesde || null,
        hasta: fechaHasta || null,
      },
    };
  }

  async getGeneralStats(fechaDesde?: string, fechaHasta?: string): Promise<any> {
    const query: any = {};

    if (fechaDesde || fechaHasta) {
      query.fechaActividad = {};
      if (fechaDesde) query.fechaActividad.$gte = new Date(fechaDesde);
      if (fechaHasta) query.fechaActividad.$lte = new Date(fechaHasta);
    }

    const activities = await this.activityModel.find(query).populate('salesCloserId', 'nombre apellido').exec();

    // Top Sales Closers por modelos cerradas
    const salesClosersMap = new Map<string, { nombre: string; modelos: number }>();

    activities.forEach(act => {
      const sc = act.salesCloserId as any;
      const key = sc._id.toString();
      const nombre = `${sc.nombre} ${sc.apellido}`;

      if (!salesClosersMap.has(key)) {
        salesClosersMap.set(key, { nombre, modelos: 0 });
      }

      salesClosersMap.get(key)!.modelos += act.modelosCerradas.length;
    });

    const topSalesClosers = Array.from(salesClosersMap.entries())
      .map(([id, data]) => ({ salesCloserId: id, ...data }))
      .sort((a, b) => b.modelos - a.modelos)
      .slice(0, 10);

    // Totales generales
    const totalesGenerales = activities.reduce(
      (acc, act) => ({
        cuentasTexteadas: acc.cuentasTexteadas + act.cuentasTexteadas,
        contactosObtenidos: acc.contactosObtenidos + act.contactosObtenidos.length,
        reunionesRealizadas: acc.reunionesRealizadas + act.reunionesRealizadas,
        modelosCerradas: acc.modelosCerradas + act.modelosCerradas.length,
      }),
      { cuentasTexteadas: 0, contactosObtenidos: 0, reunionesRealizadas: 0, modelosCerradas: 0 }
    );

    return {
      totalesGenerales,
      topSalesClosers,
      cantidadSalesClosers: salesClosersMap.size,
      cantidadActividades: activities.length,
    };
  }

  // ========== OBTENER SALES CLOSERS DISPONIBLES ==========

  async getSalesClosers(): Promise<EmpleadoDocument[]> {
    const cargo = await this.empleadoModel
      .findOne({ 'cargoId.code': 'REC_SC' })
      .populate('cargoId')
      .exec();

    if (!cargo) {
      // Buscar por nombre si no existe el código
      const empleados = await this.empleadoModel
        .find({ estado: 'ACTIVO' })
        .populate('cargoId')
        .exec();

      return empleados.filter((emp: any) => {
        const c = emp.cargoId as any;
        return c && (c.code === 'REC_SC' || c.name?.toLowerCase().includes('sales closer'));
      });
    }

    return await this.empleadoModel
      .find({ estado: 'ACTIVO' })
      .populate('cargoId', 'name code')
      .sort({ nombre: 1, apellido: 1 })
      .exec();
  }

  // ========== EXPORTACIÓN ==========

  async exportToExcel(filters?: {
    salesCloserId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<Buffer> {
    const exceljsModule = await import('exceljs');
    const WorkbookCtor = (exceljsModule as any).Workbook ?? (exceljsModule as any).default?.Workbook;

    if (typeof WorkbookCtor !== 'function') {
      throw new Error('ExcelJS Workbook constructor no disponible en el módulo importado');
    }

    const workbook = new WorkbookCtor();

    // Configuración del libro
    workbook.creator = 'OnlyTop';
    workbook.created = new Date();

    // Obtener actividades
    const activities = await this.findAllActivities(filters);

    // Hoja 1: Resumen de Actividades
    const sheet = workbook.addWorksheet('Actividades');

    // Estilos
    const headerStyle = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1c41d9' } } as ExcelJS.Fill,
      alignment: { vertical: 'middle', horizontal: 'center' } as ExcelJS.Alignment,
      border: {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const },
      },
    };

    // Encabezados
    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Sales Closer', key: 'salesCloser', width: 25 },
      { header: 'Cuentas Texteadas', key: 'cuentasTexteadas', width: 18 },
      { header: 'Likes', key: 'likes', width: 12 },
      { header: 'Comentarios', key: 'comentarios', width: 15 },
      { header: 'Contactos', key: 'contactos', width: 15 },
      { header: 'Reuniones Agendadas', key: 'reunionesAgendadas', width: 20 },
      { header: 'Reuniones Realizadas', key: 'reunionesRealizadas', width: 20 },
      { header: 'Modelos Cerradas', key: 'modelosCerradas', width: 18 },
    ];

    // Aplicar estilos al header
    sheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Datos
    activities.forEach((activity: any) => {
      const salesCloser = typeof activity.salesCloserId === 'object'
        ? `${activity.salesCloserId.nombre} ${activity.salesCloserId.apellido}`
        : 'N/A';

      sheet.addRow({
        fecha: new Date(activity.fechaActividad).toLocaleDateString('es-ES'),
        salesCloser,
        cuentasTexteadas: activity.cuentasTexteadas,
        likes: activity.likesRealizados,
        comentarios: activity.comentariosRealizados,
        contactos: activity.contactosObtenidos.length,
        reunionesAgendadas: activity.reunionesAgendadas,
        reunionesRealizadas: activity.reunionesRealizadas,
        modelosCerradas: activity.modelosCerradas.length,
      });
    });

    // Hoja 2: Modelos Cerradas
    const modelosSheet = workbook.addWorksheet('Modelos Cerradas');
    modelosSheet.columns = [
      { header: 'Fecha Actividad', key: 'fechaActividad', width: 15 },
      { header: 'Sales Closer', key: 'salesCloser', width: 25 },
      { header: 'Nombre Modelo', key: 'nombreModelo', width: 25 },
      { header: 'Perfil Instagram', key: 'perfilInstagram', width: 30 },
      { header: 'Mes 1', key: 'mes1', width: 12 },
      { header: 'Mes 2', key: 'mes2', width: 12 },
      { header: 'Mes 3', key: 'mes3', width: 12 },
      { header: 'Promedio', key: 'promedio', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Fecha Cierre', key: 'fechaCierre', width: 15 },
    ];

    modelosSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    activities.forEach((activity: any) => {
      const salesCloser = typeof activity.salesCloserId === 'object'
        ? `${activity.salesCloserId.nombre} ${activity.salesCloserId.apellido}`
        : 'N/A';

      activity.modelosCerradas.forEach((modelo: any) => {
        modelosSheet.addRow({
          fechaActividad: new Date(activity.fechaActividad).toLocaleDateString('es-ES'),
          salesCloser,
          nombreModelo: modelo.nombreModelo,
          perfilInstagram: modelo.perfilInstagram,
          mes1: modelo.facturacionUltimosTresMeses[0],
          mes2: modelo.facturacionUltimosTresMeses[1],
          mes3: modelo.facturacionUltimosTresMeses[2],
          promedio: modelo.promedioFacturacion.toFixed(2),
          estado: modelo.estado,
          fechaCierre: new Date(modelo.fechaCierre).toLocaleDateString('es-ES'),
        });
      });
    });

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportToPdf(filters?: {
    salesCloserId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Obtener actividades
    const activities = await this.findAllActivities(filters);

    // Título
    doc
      .fontSize(20)
      .fillColor('#1c41d9')
      .text('Reporte de Actividades - Recruitment', { align: 'center' });

    doc.moveDown();

    // Info del reporte
    doc.fontSize(10).fillColor('#666666');
    if (filters?.fechaDesde) {
      doc.text(`Desde: ${new Date(filters.fechaDesde).toLocaleDateString('es-ES')}`, {
        continued: true,
      });
      doc.text(`  Hasta: ${filters.fechaHasta ? new Date(filters.fechaHasta).toLocaleDateString('es-ES') : 'Hoy'}`);
    }
    doc.text(`Total de actividades: ${activities.length}`);
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`);

    doc.moveDown(2);

    // Resumen
    const totalContactos = activities.reduce((sum: number, a: any) => sum + a.contactosObtenidos.length, 0);
    const totalReunionesAgendadas = activities.reduce((sum: number, a: any) => sum + a.reunionesAgendadas, 0);
    const totalReunionesRealizadas = activities.reduce((sum: number, a: any) => sum + a.reunionesRealizadas, 0);
    const totalModelosCerradas = activities.reduce((sum: number, a: any) => sum + a.modelosCerradas.length, 0);

    doc.fontSize(14).fillColor('#1c41d9').text('Resumen General', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000');
    doc.text(`📞 Contactos Obtenidos: ${totalContactos}`);
    doc.text(`📅 Reuniones Agendadas: ${totalReunionesAgendadas}`);
    doc.text(`✅ Reuniones Realizadas: ${totalReunionesRealizadas}`);
    doc.text(`👥 Modelos Cerradas: ${totalModelosCerradas}`);

    if (totalReunionesAgendadas > 0) {
      const tasaEfectividad = ((totalReunionesRealizadas / totalReunionesAgendadas) * 100).toFixed(1);
      doc.text(`📊 Tasa de Efectividad: ${tasaEfectividad}%`);
    }

    doc.moveDown(2);

    // Detalle de actividades
    doc.fontSize(14).fillColor('#1c41d9').text('Detalle de Actividades', { underline: true });
    doc.moveDown(0.5);

    activities.forEach((activity: any, index: number) => {
      const salesCloser = typeof activity.salesCloserId === 'object'
        ? `${activity.salesCloserId.nombre} ${activity.salesCloserId.apellido}`
        : 'N/A';

      doc.fontSize(12).fillColor('#000000').text(`${index + 1}. ${new Date(activity.fechaActividad).toLocaleDateString('es-ES')} - ${salesCloser}`);
      doc.fontSize(10).fillColor('#666666');
      doc.text(`   IG: ${activity.cuentasTexteadas} DMs, ${activity.likesRealizados} likes, ${activity.comentariosRealizados} comentarios`);
      doc.text(`   Contactos: ${activity.contactosObtenidos.length} | Reuniones: ${activity.reunionesRealizadas}/${activity.reunionesAgendadas} | Cierres: ${activity.modelosCerradas.length}`);

      if (activity.modelosCerradas.length > 0) {
        doc.fillColor('#f97316');
        activity.modelosCerradas.forEach((modelo: any) => {
          doc.text(`   🎯 ${modelo.nombreModelo} (${modelo.perfilInstagram}) - Promedio: $${modelo.promedioFacturacion.toFixed(2)}`);
        });
      }

      doc.moveDown(0.5);

      // Salto de página si es necesario
      if (doc.y > 700 && index < activities.length - 1) {
        doc.addPage();
      }
    });

    // Pie de página
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(
          `Página ${i + 1} de ${pages.count} - OnlyTop © ${new Date().getFullYear()}`,
          50,
          doc.page.height - 50,
          { align: 'center' },
        );
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);
    });
  }
}

