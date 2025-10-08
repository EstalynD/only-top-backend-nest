import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as ExcelJS from 'exceljs';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { EmpleadoEntity, EmpleadoDocument } from '../rrhh/empleado.schema.js';
import { ChatterSaleEntity, ChatterSaleDocument, TipoVenta, TurnoChatter } from './chatter-sale.schema.js';

interface ExcelRow {
  fila: number;
  modeloNombre?: string;
  modeloId?: string;
  chatterNombre?: string;
  chatterId?: string;
  monto: number;
  moneda: string;
  tipoVenta: string;
  turno: string;
  fechaVenta: string;
  plataforma?: string;
  descripcion?: string;
}

export interface ImportResult {
  exitosas: number;
  fallidas: number;
  errores: Array<{ fila: number; mensaje: string }>;
  ventasCreadas: ChatterSaleDocument[];
}

@Injectable()
export class ChatterExcelService {
  private readonly logger = new Logger(ChatterExcelService.name);

  constructor(
    @InjectModel(ModeloEntity.name) private modeloModel: Model<ModeloDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(ChatterSaleEntity.name) private chatterSaleModel: Model<ChatterSaleDocument>,
  ) {}

  /**
   * Genera plantilla Excel para importación masiva de ventas
   */
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OnlyTop Sistema';
    workbook.created = new Date();

    // ========== HOJA PRINCIPAL: REGISTRO DE VENTAS ==========
    const worksheet = workbook.addWorksheet('Ventas', {
      properties: { tabColor: { argb: 'FF1e40af' } },
    });

    // Configurar columnas con validaciones
    worksheet.columns = [
      { header: 'ID Modelo*', key: 'modeloId', width: 25 },
      { header: 'Nombre Modelo', key: 'modeloNombre', width: 25 },
      { header: 'ID Chatter*', key: 'chatterId', width: 25 },
      { header: 'Nombre Chatter', key: 'chatterNombre', width: 25 },
      { header: 'Monto*', key: 'monto', width: 12 },
      { header: 'Moneda*', key: 'moneda', width: 10 },
      { header: 'Tipo de Venta*', key: 'tipoVenta', width: 18 },
      { header: 'Turno*', key: 'turno', width: 15 },
      { header: 'Fecha y Hora*', key: 'fechaVenta', width: 20 },
      { header: 'Plataforma', key: 'plataforma', width: 15 },
      { header: 'Descripción', key: 'descripcion', width: 30 },
    ];

    // Estilizar encabezados
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1e40af' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Agregar fila de ejemplo
    worksheet.addRow({
      modeloId: '507f1f77bcf86cd799439011',
      modeloNombre: 'María García (opcional)',
      chatterId: '507f1f77bcf86cd799439012',
      chatterNombre: 'Juan Pérez (opcional)',
      monto: 150.50,
      moneda: 'USD',
      tipoVenta: 'TIP',
      turno: 'AM',
      fechaVenta: '2025-01-15 14:30',
      plataforma: 'OnlyFans',
      descripcion: 'Venta mensual',
    });

    // Aplicar formato a datos
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFd1d5db' } },
            left: { style: 'thin', color: { argb: 'FFd1d5db' } },
            bottom: { style: 'thin', color: { argb: 'FFd1d5db' } },
            right: { style: 'thin', color: { argb: 'FFd1d5db' } },
          };
        });
      }
    });

    // ========== HOJA DE INSTRUCCIONES ==========
    const instructionsSheet = workbook.addWorksheet('Instrucciones', {
      properties: { tabColor: { argb: 'FF10b981' } },
    });

    instructionsSheet.columns = [{ width: 80 }];

    const instructions = [
      { text: 'INSTRUCCIONES PARA IMPORTAR VENTAS', bold: true, size: 16, color: '1e40af' },
      { text: '', bold: false, size: 11, color: '000000' },
      { text: 'CAMPOS OBLIGATORIOS (*)', bold: true, size: 12, color: 'ef4444' },
      { text: '1. ID Modelo: Identificador único de la modelo (ObjectId de MongoDB)', bold: false, size: 10, color: '374151' },
      { text: '2. ID Chatter: Identificador único del chatter (ObjectId de MongoDB)', bold: false, size: 10, color: '374151' },
      { text: '3. Monto: Cantidad numérica (decimales con punto: 150.50)', bold: false, size: 10, color: '374151' },
      { text: '4. Moneda: USD, EUR, GBP, etc.', bold: false, size: 10, color: '374151' },
      { text: '5. Tipo de Venta: TIP, MESSAGE, SUBSCRIPTION, PPV, VIDEO, PHOTO, LIVE, CALL, VIDEOCALL, CUSTOM, OTHER', bold: false, size: 10, color: '374151' },
      { text: '6. Turno: AM, PM, MADRUGADA, SUPERNUMERARIO', bold: false, size: 10, color: '374151' },
      { text: '7. Fecha y Hora: Formato YYYY-MM-DD HH:mm (ej: 2025-01-15 14:30)', bold: false, size: 10, color: '374151' },
      { text: '', bold: false, size: 11, color: '000000' },
      { text: 'CAMPOS OPCIONALES', bold: true, size: 12, color: '3b82f6' },
      { text: '• Nombre Modelo: Solo referencia visual, no se usa en la importación', bold: false, size: 10, color: '374151' },
      { text: '• Nombre Chatter: Solo referencia visual, no se usa en la importación', bold: false, size: 10, color: '374151' },
      { text: '• Plataforma: OnlyFans, Fansly, ManyVids, etc.', bold: false, size: 10, color: '374151' },
      { text: '• Descripción: Texto libre para detalles adicionales', bold: false, size: 10, color: '374151' },
      { text: '', bold: false, size: 11, color: '000000' },
      { text: 'VALIDACIONES IMPORTANTES', bold: true, size: 12, color: 'f59e0b' },
      { text: '✓ La modelo debe existir y estar activa', bold: false, size: 10, color: '374151' },
      { text: '✓ El chatter debe existir y estar activo', bold: false, size: 10, color: '374151' },
      { text: '✓ El chatter debe estar asignado a la modelo especificada', bold: false, size: 10, color: '374151' },
      { text: '✓ El monto debe ser mayor a 0', bold: false, size: 10, color: '374151' },
      { text: '✓ La fecha no puede ser futura', bold: false, size: 10, color: '374151' },
      { text: '', bold: false, size: 11, color: '000000' },
      { text: 'CÓMO OBTENER IDS', bold: true, size: 12, color: '8b5cf6' },
      { text: 'Consulte la pestaña "Catálogo" para ver los IDs disponibles de modelos y chatters', bold: false, size: 10, color: '374151' },
      { text: '', bold: false, size: 11, color: '000000' },
      { text: 'EJEMPLO DE IMPORTACIÓN', bold: true, size: 12, color: '10b981' },
      { text: 'Ver la primera fila de la pestaña "Ventas" para un ejemplo completo', bold: false, size: 10, color: '374151' },
    ];

    instructions.forEach((instruction, index) => {
      const row = instructionsSheet.getRow(index + 1);
      row.getCell(1).value = instruction.text;
      row.getCell(1).font = {
        bold: instruction.bold,
        size: instruction.size,
        color: { argb: `FF${instruction.color}` },
      };
      row.getCell(1).alignment = { vertical: 'top', wrapText: true };
      row.height = instruction.text === '' ? 10 : 20;
    });

    // ========== HOJA DE CATÁLOGO ==========
    await this.addCatalogSheet(workbook);

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Agrega hoja con catálogo de modelos y chatters activos
   */
  private async addCatalogSheet(workbook: ExcelJS.Workbook): Promise<void> {
    const catalogSheet = workbook.addWorksheet('Catálogo', {
      properties: { tabColor: { argb: 'FF8b5cf6' } },
    });

    // Obtener modelos activas con sus chatters
    const modelos = await this.modeloModel
      .find({ estado: 'ACTIVA' })
      .populate('equipoChatters.turnoAM', 'nombre apellido')
      .populate('equipoChatters.turnoPM', 'nombre apellido')
      .populate('equipoChatters.turnoMadrugada', 'nombre apellido')
      .populate('equipoChatters.supernumerario', 'nombre apellido')
      .sort({ nombreCompleto: 1 })
      .exec();

    // Configurar columnas
    catalogSheet.columns = [
      { header: 'TIPO', key: 'tipo', width: 15 },
      { header: 'ID', key: 'id', width: 27 },
      { header: 'NOMBRE COMPLETO', key: 'nombre', width: 30 },
      { header: 'RELACIÓN', key: 'relacion', width: 30 },
    ];

    // Estilizar encabezados
    const headerRow = catalogSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8b5cf6' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Agregar modelos y sus chatters
    for (const modelo of modelos) {
      // Agregar modelo
      const modeloRow = catalogSheet.addRow({
        tipo: 'MODELO',
        id: modelo._id.toString(),
        nombre: modelo.nombreCompleto,
        relacion: '—',
      });
      modeloRow.font = { bold: true, color: { argb: 'FF1e40af' } };
      modeloRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFeff6ff' },
      };

      // Agregar chatters
      const chatters = [
        { turno: 'AM', chatter: modelo.equipoChatters.turnoAM },
        { turno: 'PM', chatter: modelo.equipoChatters.turnoPM },
        { turno: 'MADRUGADA', chatter: modelo.equipoChatters.turnoMadrugada },
        { turno: 'SUPERNUMERARIO', chatter: modelo.equipoChatters.supernumerario },
      ];

      for (const { turno, chatter } of chatters) {
        if (chatter && typeof chatter === 'object' && '_id' in chatter) {
          const chatterDoc = chatter as any;
          catalogSheet.addRow({
            tipo: 'CHATTER',
            id: chatterDoc._id.toString(),
            nombre: `${chatterDoc.nombre} ${chatterDoc.apellido}`,
            relacion: `Turno ${turno} - ${modelo.nombreCompleto}`,
          });
        }
      }

      // Agregar fila en blanco
      catalogSheet.addRow({});
    }

    // Aplicar bordes
    catalogSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFd1d5db' } },
            left: { style: 'thin', color: { argb: 'FFd1d5db' } },
            bottom: { style: 'thin', color: { argb: 'FFd1d5db' } },
            right: { style: 'thin', color: { argb: 'FFd1d5db' } },
          };
        });
      }
    });
  }

  /**
   * Importa ventas desde un archivo Excel
   */
  async importSales(fileBuffer: Buffer, userId?: string): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = workbook.getWorksheet('Ventas');
    if (!worksheet) {
      throw new BadRequestException('El archivo no contiene la hoja "Ventas"');
    }

    const result: ImportResult = {
      exitosas: 0,
      fallidas: 0,
      errores: [],
      ventasCreadas: [],
    };

    const rows: ExcelRow[] = [];

    // Leer filas (empezar desde la fila 2, saltar encabezados y ejemplo)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return; // Saltar encabezado y ejemplo

      const modeloId = this.getCellValue(row.getCell(1));
      const chatterIdValue = this.getCellValue(row.getCell(3));
      const montoValue = this.getCellValue(row.getCell(5));
      const moneda = this.getCellValue(row.getCell(6));
      const tipoVenta = this.getCellValue(row.getCell(7));
      const turno = this.getCellValue(row.getCell(8));
      const fechaVenta = this.getCellValue(row.getCell(9));

      // Si la fila está completamente vacía, saltarla
      if (!modeloId && !chatterIdValue && !montoValue) {
        return;
      }

      rows.push({
        fila: rowNumber,
        modeloId: modeloId as string,
        chatterNombre: this.getCellValue(row.getCell(4)) as string,
        chatterId: chatterIdValue as string,
        monto: typeof montoValue === 'number' ? montoValue : parseFloat(String(montoValue)),
        moneda: (moneda as string) || 'USD',
        tipoVenta: tipoVenta as string,
        turno: turno as string,
        fechaVenta: this.parseDateValue(fechaVenta),
        plataforma: this.getCellValue(row.getCell(10)) as string,
        descripcion: this.getCellValue(row.getCell(11)) as string,
      });
    });

    // Procesar cada fila
    for (const rowData of rows) {
      try {
        await this.processRow(rowData, userId);
        result.exitosas++;
      } catch (error: any) {
        result.fallidas++;
        result.errores.push({
          fila: rowData.fila,
          mensaje: error.message || 'Error desconocido',
        });
        this.logger.warn(`Error en fila ${rowData.fila}: ${error.message}`);
      }
    }

    this.logger.log(
      `Importación completada: ${result.exitosas} exitosas, ${result.fallidas} fallidas`,
    );

    return result;
  }

  /**
   * Procesa una fila individual y crea la venta
   */
  private async processRow(rowData: ExcelRow, userId?: string): Promise<ChatterSaleDocument> {
    // Validar campos obligatorios
    if (!rowData.modeloId) {
      throw new BadRequestException('ID de modelo es obligatorio');
    }
    if (!rowData.chatterId) {
      throw new BadRequestException('ID de chatter es obligatorio');
    }
    if (!rowData.monto || rowData.monto <= 0) {
      throw new BadRequestException('Monto debe ser mayor a 0');
    }
    if (!rowData.tipoVenta) {
      throw new BadRequestException('Tipo de venta es obligatorio');
    }
    if (!rowData.turno) {
      throw new BadRequestException('Turno es obligatorio');
    }
    if (!rowData.fechaVenta) {
      throw new BadRequestException('Fecha de venta es obligatoria');
    }

    // Validar ObjectIds
    if (!Types.ObjectId.isValid(rowData.modeloId)) {
      throw new BadRequestException('ID de modelo no es válido');
    }
    if (!Types.ObjectId.isValid(rowData.chatterId)) {
      throw new BadRequestException('ID de chatter no es válido');
    }

    // Validar que la modelo existe y está activa
    const modelo = await this.modeloModel.findById(rowData.modeloId).exec();
    if (!modelo || modelo.estado !== 'ACTIVA') {
      throw new BadRequestException('Modelo no existe o no está activa');
    }

    // Validar que el chatter existe y está activo
    const chatter = await this.empleadoModel.findById(rowData.chatterId).exec();
    if (!chatter || chatter.estado !== 'ACTIVO') {
      throw new BadRequestException('Chatter no existe o no está activo');
    }

    // Validar que el chatter está asignado a la modelo
    const isAssigned = await this.isChatterAssignedToModel(rowData.chatterId, rowData.modeloId);
    if (!isAssigned) {
      throw new BadRequestException('Chatter no está asignado a esta modelo');
    }

    // Validar tipo de venta
    const validTipos = ['TIP', 'MESSAGE', 'SUBSCRIPTION', 'PPV', 'VIDEO', 'PHOTO', 'LIVE', 'CALL', 'VIDEOCALL', 'CUSTOM', 'OTHER'];
    if (!validTipos.includes(rowData.tipoVenta.toUpperCase())) {
      throw new BadRequestException(`Tipo de venta no válido. Debe ser uno de: ${validTipos.join(', ')}`);
    }

    // Validar turno
    const validTurnos = ['AM', 'PM', 'MADRUGADA', 'SUPERNUMERARIO'];
    if (!validTurnos.includes(rowData.turno.toUpperCase())) {
      throw new BadRequestException(`Turno no válido. Debe ser uno de: ${validTurnos.join(', ')}`);
    }

    // Validar fecha
    const fechaVentaDate = new Date(rowData.fechaVenta);
    if (isNaN(fechaVentaDate.getTime())) {
      throw new BadRequestException('Fecha de venta no es válida');
    }
    if (fechaVentaDate > new Date()) {
      throw new BadRequestException('Fecha de venta no puede ser futura');
    }

    // Crear la venta
    const sale = new this.chatterSaleModel({
      modeloId: new Types.ObjectId(rowData.modeloId),
      chatterId: new Types.ObjectId(rowData.chatterId),
      monto: rowData.monto,
      moneda: rowData.moneda,
      tipoVenta: rowData.tipoVenta.toUpperCase() as TipoVenta,
      turno: rowData.turno.toUpperCase() as TurnoChatter,
      fechaVenta: fechaVentaDate,
      plataforma: rowData.plataforma,
      descripcion: rowData.descripcion,
      registradoPor: userId ? new Types.ObjectId(userId) : null,
    });

    return await sale.save();
  }

  /**
   * Verifica si un chatter está asignado a una modelo
   */
  private async isChatterAssignedToModel(chatterId: string, modeloId: string): Promise<boolean> {
    const modelo = await this.modeloModel.findById(modeloId).exec();
    if (!modelo) return false;

    const chatterObjectId = new Types.ObjectId(chatterId);
    return (
      modelo.equipoChatters.turnoAM.equals(chatterObjectId) ||
      modelo.equipoChatters.turnoPM.equals(chatterObjectId) ||
      modelo.equipoChatters.turnoMadrugada.equals(chatterObjectId) ||
      modelo.equipoChatters.supernumerario.equals(chatterObjectId)
    );
  }

  /**
   * Obtiene el valor de una celda
   */
  private getCellValue(cell: ExcelJS.Cell): string | number | null {
    if (!cell || cell.value === null || cell.value === undefined) {
      return null;
    }

    if (typeof cell.value === 'object' && 'text' in cell.value) {
      return cell.value.text;
    }

    return cell.value as string | number;
  }

  /**
   * Parsea un valor de fecha desde Excel
   */
  private parseDateValue(value: any): string {
    if (!value) return '';

    // Si ya es un Date object de Excel
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Si es un string, intentar parsearlo
    if (typeof value === 'string') {
      // Formato esperado: YYYY-MM-DD HH:mm
      const dateRegex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/;
      const match = value.match(dateRegex);
      
      if (match) {
        const [, year, month, day, hour, minute] = match;
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`).toISOString();
      }

      // Intentar parseo directo
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    // Si es un número (Excel serial date)
    if (typeof value === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return date.toISOString();
    }

    return '';
  }
}
