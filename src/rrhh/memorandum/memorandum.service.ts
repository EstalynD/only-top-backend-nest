import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import PDFDocument from 'pdfkit';
import { AttendanceEntity } from '../attendance/attendance.schema.js';
import { EmpleadosService } from '../empleados.service.js';
import type { EmpleadoDocument } from '../empleado.schema.js';

export type MemorandumType = 'AUSENCIA' | 'LLEGADA_TARDE' | 'SALIDA_ANTICIPADA';

export interface MemorandumData {
  empleadoNombre: string;
  empleadoCargo: string;
  fecha: string;
  horaRegistrada?: string;
  horaEsperada?: string;
  jefe: string;
  cargoJefe: string;
}

@Injectable()
export class MemorandumService {
  private readonly logger = new Logger(MemorandumService.name);

  constructor(
    @InjectModel(AttendanceEntity.name) private readonly attendanceModel: Model<AttendanceEntity>,
    private readonly empleadosService: EmpleadosService,
  ) {}

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
