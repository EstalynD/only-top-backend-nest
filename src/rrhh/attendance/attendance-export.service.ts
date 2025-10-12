import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { AttendanceEntity } from './attendance.schema.js';
import { EmpleadosService } from '../empleados.service.js';

export interface ExportFilters {
  startDate: Date;
  endDate: Date;
  areaId?: string;
  cargoId?: string;
  userId?: string;
  status?: string;
  hasJustification?: boolean;
}

@Injectable()
export class AttendanceExportService {
  private readonly logger = new Logger(AttendanceExportService.name);

  constructor(
    @InjectModel(AttendanceEntity.name) private readonly attendanceModel: Model<AttendanceEntity>,
    private readonly empleadosService: EmpleadosService,
  ) {}

  /**
   * Exporta registros de asistencia a Excel con filtros
   */
  async exportAttendanceToExcel(filters: ExportFilters): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Crear hojas
    const summarySheet = workbook.addWorksheet('Resumen');
    const recordsSheet = workbook.addWorksheet('Registros Detallados');
    const pendingSheet = workbook.addWorksheet('Justificaciones Pendientes');

    // Obtener datos
    const [records, pendingRecords, summaryStats] = await Promise.all([
      this.getAttendanceRecords(filters),
      this.getPendingJustifications(filters),
      this.getSummaryStatistics(filters)
    ]);

    // Configurar hojas
    this.setupSummarySheet(summarySheet, summaryStats);
    this.setupRecordsSheet(recordsSheet, records);
    this.setupPendingSheet(pendingSheet, pendingRecords);

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exporta resumen individual de un empleado
   */
  async exportSummaryToExcel(userId: string, startDate: Date, endDate: Date): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Resumen Individual');

    // Obtener datos del empleado
    const empleado = await this.empleadosService.findEmpleadoByUserId(userId);
    if (!empleado) {
      throw new Error('Empleado no encontrado');
    }

    // Obtener registros del período
    const records = await this.getAttendanceRecords({
      startDate,
      endDate,
      userId
    });

    // Configurar hoja
    this.setupIndividualSummarySheet(sheet, empleado, records, startDate, endDate);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exporta reporte de equipo por área o cargo
   */
  async exportTeamReportToExcel(
    startDate: Date, 
    endDate: Date,
    areaId?: string, 
    cargoId?: string
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    const summarySheet = workbook.addWorksheet('Resumen Equipo');
    const recordsSheet = workbook.addWorksheet('Registros Equipo');

    // Obtener datos
    const filters: ExportFilters = { startDate, endDate, areaId, cargoId };
    const [records, teamStats] = await Promise.all([
      this.getAttendanceRecords(filters),
      this.getTeamStatistics(filters)
    ]);

    // Configurar hojas
    this.setupTeamSummarySheet(summarySheet, teamStats, areaId, cargoId);
    this.setupRecordsSheet(recordsSheet, records);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async getAttendanceRecords(filters: ExportFilters) {
    const query: any = {
      timestamp: {
        $gte: filters.startDate,
        $lte: filters.endDate
      }
    };

    if (filters.areaId) query.areaId = filters.areaId;
    if (filters.cargoId) query.cargoId = filters.cargoId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.status) query.status = filters.status;
    if (filters.hasJustification !== undefined) {
      if (filters.hasJustification) {
        query.justification = { $exists: true, $ne: null };
      } else {
        query.$or = [
          { justification: { $exists: false } },
          { justification: null }
        ];
      }
    }

    return this.attendanceModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .sort({ timestamp: -1 })
      .lean();
  }

  private async getPendingJustifications(filters: ExportFilters) {
    const query: any = {
      justificationStatus: 'PENDING',
      timestamp: {
        $gte: filters.startDate,
        $lte: filters.endDate
      }
    };

    if (filters.areaId) query.areaId = filters.areaId;
    if (filters.cargoId) query.cargoId = filters.cargoId;
    if (filters.userId) query.userId = filters.userId;

    return this.attendanceModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .sort({ timestamp: -1 })
      .lean();
  }

  private async getSummaryStatistics(filters: ExportFilters) {
    const pipeline = [
      {
        $match: {
          timestamp: {
            $gte: filters.startDate,
            $lte: filters.endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'LATE'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
          excused: { $sum: { $cond: [{ $eq: ['$status', 'EXCUSED'] }, 1, 0] } },
          pendingJustifications: { $sum: { $cond: [{ $eq: ['$justificationStatus', 'PENDING'] }, 1, 0] } },
          justified: { $sum: { $cond: [{ $eq: ['$justificationStatus', 'JUSTIFIED'] }, 1, 0] } }
        }
      }
    ];

    const result = await this.attendanceModel.aggregate(pipeline);
    return result[0] || {
      totalRecords: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      pendingJustifications: 0,
      justified: 0
    };
  }

  private async getTeamStatistics(filters: ExportFilters) {
    const pipeline: any[] = [
      {
        $match: {
          timestamp: {
            $gte: filters.startDate,
            $lte: filters.endDate
          }
        }
      },
      {
        $group: {
          _id: {
            areaId: '$areaId',
            cargoId: '$cargoId',
            userId: '$userId'
          },
          totalRecords: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'LATE'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'empleados',
          localField: '_id.userId',
          foreignField: 'userId',
          as: 'empleado'
        }
      },
      {
        $unwind: '$empleado'
      },
      {
        $lookup: {
          from: 'areas',
          localField: '_id.areaId',
          foreignField: '_id',
          as: 'area'
        }
      },
      {
        $lookup: {
          from: 'cargos',
          localField: '_id.cargoId',
          foreignField: '_id',
          as: 'cargo'
        }
      },
      {
        $project: {
          empleadoNombre: { $concat: ['$empleado.nombre', ' ', '$empleado.apellido'] },
          areaName: { $arrayElemAt: ['$area.name', 0] },
          cargoName: { $arrayElemAt: ['$cargo.name', 0] },
          totalRecords: 1,
          present: 1,
          late: 1,
          absent: 1,
          attendanceRate: {
            $multiply: [
              { $divide: ['$present', '$totalRecords'] },
              100
            ]
          }
        }
      },
      {
        $sort: { attendanceRate: -1 }
      }
    ];

    return this.attendanceModel.aggregate(pipeline);
  }

  private setupSummarySheet(sheet: ExcelJS.Worksheet, stats: any) {
    // Título
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'RESUMEN DE ASISTENCIA';
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    // Estadísticas
    const data = [
      ['Métrica', 'Valor'],
      ['Total de Registros', stats.totalRecords],
      ['Presentes', stats.present],
      ['Tardanzas', stats.late],
      ['Ausencias', stats.absent],
      ['Justificados', stats.excused],
      ['Justificaciones Pendientes', stats.pendingJustifications],
      ['Justificaciones Aprobadas', stats.justified]
    ];

    sheet.addRows(data);

    // Estilos
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { bold: true };
    sheet.columns = [
      { width: 25 },
      { width: 15 }
    ];
  }

  private setupRecordsSheet(sheet: ExcelJS.Worksheet, records: any[]) {
    // Encabezados
    const headers = [
      'Fecha', 'Hora', 'Empleado', 'Área', 'Cargo', 'Tipo', 'Estado',
      'Justificación', 'Estado Justificación', 'Justificado Por', 'Fecha Justificación'
    ];

    sheet.addRow(headers);

    // Datos
    records.forEach(record => {
      const empleado = record.empleadoId;
      const area = record.areaId;
      const cargo = record.cargoId;
      
      sheet.addRow([
        new Date(record.timestamp).toLocaleDateString('es-CO'),
        new Date(record.timestamp).toLocaleTimeString('es-CO'),
        empleado ? `${empleado.nombre} ${empleado.apellido}` : 'N/A',
        area ? area.name : 'N/A',
        cargo ? cargo.name : 'N/A',
        record.type,
        record.status,
        record.justification || '',
        record.justificationStatus || '',
        record.justifiedBy || '',
        record.justifiedAt ? new Date(record.justifiedAt).toLocaleString('es-CO') : ''
      ]);
    });

    // Estilos
    sheet.getRow(1).font = { bold: true };
    sheet.columns = [
      { width: 12 }, // Fecha
      { width: 10 }, // Hora
      { width: 25 }, // Empleado
      { width: 20 }, // Área
      { width: 20 }, // Cargo
      { width: 15 }, // Tipo
      { width: 12 }, // Estado
      { width: 30 }, // Justificación
      { width: 20 }, // Estado Justificación
      { width: 20 }, // Justificado Por
      { width: 20 }  // Fecha Justificación
    ];

    // Colores por estado
    records.forEach((record, index) => {
      const row = sheet.getRow(index + 2);
      switch (record.status) {
        case 'LATE':
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE066' } };
          break;
        case 'ABSENT':
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFB3B3' } };
          break;
        case 'PRESENT':
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB3FFB3' } };
          break;
      }
    });
  }

  private setupPendingSheet(sheet: ExcelJS.Worksheet, records: any[]) {
    // Encabezados
    const headers = [
      'Fecha', 'Hora', 'Empleado', 'Área', 'Cargo', 'Tipo', 'Estado', 'Días Pendiente'
    ];

    sheet.addRow(headers);

    // Datos
    records.forEach(record => {
      const empleado = record.empleadoId;
      const area = record.areaId;
      const cargo = record.cargoId;
      const daysPending = Math.floor((new Date().getTime() - new Date(record.timestamp).getTime()) / (1000 * 60 * 60 * 24));
      
      sheet.addRow([
        new Date(record.timestamp).toLocaleDateString('es-CO'),
        new Date(record.timestamp).toLocaleTimeString('es-CO'),
        empleado ? `${empleado.nombre} ${empleado.apellido}` : 'N/A',
        area ? area.name : 'N/A',
        cargo ? cargo.name : 'N/A',
        record.type,
        record.status,
        daysPending
      ]);
    });

    // Estilos
    sheet.getRow(1).font = { bold: true };
    sheet.columns = [
      { width: 12 }, // Fecha
      { width: 10 }, // Hora
      { width: 25 }, // Empleado
      { width: 20 }, // Área
      { width: 20 }, // Cargo
      { width: 15 }, // Tipo
      { width: 12 }, // Estado
      { width: 15 }  // Días Pendiente
    ];

    // Colores por días pendiente
    records.forEach((record, index) => {
      const row = sheet.getRow(index + 2);
      const daysPending = Math.floor((new Date().getTime() - new Date(record.timestamp).getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysPending > 3) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFB3B3' } }; // Rojo
      } else if (daysPending > 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE066' } }; // Amarillo
      }
    });
  }

  private setupIndividualSummarySheet(sheet: ExcelJS.Worksheet, empleado: any, records: any[], startDate: Date, endDate: Date) {
    // Título
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = `RESUMEN INDIVIDUAL - ${empleado.nombre} ${empleado.apellido}`;
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    // Período
    sheet.getCell('A2').value = `Período: ${startDate.toLocaleDateString('es-CO')} - ${endDate.toLocaleDateString('es-CO')}`;
    sheet.getCell('A2').font = { bold: true };

    // Estadísticas
    const stats = this.calculateIndividualStats(records);
    const data = [
      ['Métrica', 'Valor'],
      ['Total de Registros', stats.totalRecords],
      ['Presentes', stats.present],
      ['Tardanzas', stats.late],
      ['Ausencias', stats.absent],
      ['Tasa de Asistencia', `${stats.attendanceRate.toFixed(1)}%`],
      ['Justificaciones Pendientes', stats.pendingJustifications]
    ];

    sheet.addRows(data);

    // Registros detallados
    sheet.addRow([]); // Línea en blanco
    sheet.addRow(['REGISTROS DETALLADOS']);
    sheet.getRow(sheet.rowCount).font = { bold: true };

    const headers = ['Fecha', 'Hora', 'Tipo', 'Estado', 'Justificación'];
    sheet.addRow(headers);
    sheet.getRow(sheet.rowCount).font = { bold: true };

    records.forEach(record => {
      sheet.addRow([
        new Date(record.timestamp).toLocaleDateString('es-CO'),
        new Date(record.timestamp).toLocaleTimeString('es-CO'),
        record.type,
        record.status,
        record.justification || ''
      ]);
    });

    // Estilos
    sheet.columns = [
      { width: 12 },
      { width: 10 },
      { width: 15 },
      { width: 12 },
      { width: 30 }
    ];
  }

  private setupTeamSummarySheet(sheet: ExcelJS.Worksheet, teamStats: any[], areaId?: string, cargoId?: string) {
    // Título
    const title = areaId ? 'RESUMEN POR ÁREA' : cargoId ? 'RESUMEN POR CARGO' : 'RESUMEN DE EQUIPO';
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    // Encabezados
    const headers = ['Empleado', 'Área', 'Cargo', 'Total Registros', 'Presentes', 'Tasa Asistencia'];
    sheet.addRow(headers);
    sheet.getRow(2).font = { bold: true };

    // Datos
    teamStats.forEach(stat => {
      sheet.addRow([
        stat.empleadoNombre,
        stat.areaName || 'N/A',
        stat.cargoName || 'N/A',
        stat.totalRecords,
        stat.present,
        `${stat.attendanceRate.toFixed(1)}%`
      ]);
    });

    // Estilos
    sheet.columns = [
      { width: 25 }, // Empleado
      { width: 20 }, // Área
      { width: 20 }, // Cargo
      { width: 15 }, // Total Registros
      { width: 12 }, // Presentes
      { width: 15 }  // Tasa Asistencia
    ];
  }

  private calculateIndividualStats(records: any[]) {
    const totalRecords = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const pendingJustifications = records.filter(r => r.justificationStatus === 'PENDING').length;
    const attendanceRate = totalRecords > 0 ? (present / totalRecords) * 100 : 0;

    return {
      totalRecords,
      present,
      late,
      absent,
      attendanceRate,
      pendingJustifications
    };
  }
}
