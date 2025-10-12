import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MoneyService } from '../money/money.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { CarteraEmailService } from './cartera-email.service.js';
import { CarteraPdfService } from './cartera-pdf.service.js';
import { FacturaEntity, FacturaDocument, EstadoFactura, ItemFactura } from './factura.schema.js';
import { PagoEntity, PagoDocument, MetodoPago } from './pago.schema.js';
import { RecordatorioEntity, RecordatorioDocument, TipoRecordatorio, EstadoRecordatorio } from './recordatorio.schema.js';
import { ConfiguracionCarteraEntity, ConfiguracionCarteraDocument } from './configuracion-cartera.schema.js';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { ContratoModeloEntity, ContratoModeloDocument, TipoComision, PeriodicidadPago } from '../rrhh/contrato-modelo.schema.js';
import { ChatterSaleEntity, ChatterSaleDocument } from '../chatter/chatter-sale.schema.js';
import { CommissionScaleEntity } from '../sistema/commission-scale.schema.js';
import {
  CreateFacturaDto,
  UpdateFacturaDto,
  FiltrosFacturasDto,
  GenerarFacturasPorPeriodoDto,
  RegistrarPagoDto,
  FiltrosPagosDto,
  EnviarRecordatorioDto,
  FiltrosRecordatoriosDto,
  ObtenerEstadoCuentaDto,
  UpdateConfiguracionCarteraDto,
} from './dto/cartera.dto.js';

/**
 * CarteraService - Servicio completo para gestión de cartera
 * 
 * Responsabilidades:
 * 1. Facturación automática basada en contratos y ventas
 * 2. Registro de pagos con comprobantes (Cloudinary)
 * 3. Estado de cuenta y exportación PDF
 * 4. Alertas y recordatorios automáticos
 * 5. Dashboard y estadísticas
 * 
 * Reglas de negocio:
 * - Todas las operaciones monetarias usan MoneyService
 * - Valores se almacenan como BigInt escalado (5 decimales)
 * - Formateo dinámico según configuración de moneda en BD
 * - Comisiones se calculan según contrato (FIJA o ESCALONADA)
 * - Estado de factura se actualiza automáticamente según pagos
 */
@Injectable()
export class CarteraService {
  private readonly logger = new Logger(CarteraService.name);

  constructor(
    @InjectModel(FacturaEntity.name) private facturaModel: Model<FacturaDocument>,
    @InjectModel(PagoEntity.name) private pagoModel: Model<PagoDocument>,
    @InjectModel(RecordatorioEntity.name) private recordatorioModel: Model<RecordatorioDocument>,
    @InjectModel(ConfiguracionCarteraEntity.name) private configuracionModel: Model<ConfiguracionCarteraDocument>,
    @InjectModel(ModeloEntity.name) private modeloModel: Model<ModeloDocument>,
    @InjectModel(ContratoModeloEntity.name) private contratoModel: Model<ContratoModeloDocument>,
    @InjectModel(ChatterSaleEntity.name) private chatterSaleModel: Model<ChatterSaleDocument>,
    @InjectModel(CommissionScaleEntity.name) private commissionScaleModel: Model<any>,
    private readonly moneyService: MoneyService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly emailService: CarteraEmailService,
    private readonly pdfService: CarteraPdfService,
  ) {}

  // ========== PARTE 1: FACTURACIÓN ==========

  /**
   * Genera una factura automática para una modelo en un periodo específico
   * 
  /**
   * Genera una factura automática para una modelo en un periodo específico
   * 
   * NUEVA LÓGICA con Sistema de Seguimiento:
   * 1. Valida que la modelo existe y está activa
   * 2. Obtiene el contrato activo de la modelo
   * 3. Verifica que NO exista ya una factura para este periodo (evita duplicados)
   * 4. Calcula fechaCorte según la periodicidad del contrato
   * 5. Consulta las ventas desde fechaInicio hasta el día antes de fechaCorte
   * 6. Calcula la comisión según el tipo de contrato (FIJA o ESCALONADA)
   * 7. Crea la factura en estado SEGUIMIENTO (no PENDIENTE)
   * 8. La factura cambiará a PENDIENTE automáticamente cuando llegue fechaCorte (via scheduler)
   * 
   * @param modeloId ID de la modelo
   * @param periodo Periodo de facturación (DEPRECADO - se calcula automáticamente)
   * @param creadaPor ID del usuario que genera la factura
   * @returns Factura generada en estado SEGUIMIENTO
   */
  async generarFacturaAutomatica(
    modeloId: string,
    periodo: { anio: number; mes: number; quincena?: number },
    creadaPor: string,
  ): Promise<FacturaDocument> {
    // 1. Validar modelo
    const modelo = await this.modeloModel.findById(modeloId).lean();
    if (!modelo) {
      throw new NotFoundException(`Modelo con ID ${modeloId} no encontrada`);
    }

    // 2. Obtener contrato activo
    const contrato = await this.contratoModel
      .findOne({
        modeloId: new Types.ObjectId(modeloId),
        estado: 'FIRMADO',
      })
      .populate('comisionEscalonada.escalaId')
      .lean();

    if (!contrato) {
      throw new BadRequestException(
        `La modelo ${modelo.nombreCompleto} no tiene un contrato activo firmado`
      );
    }

    if (!contrato.fechaInicio) {
      throw new BadRequestException(
        `El contrato de ${modelo.nombreCompleto} no tiene fechaInicio definida`
      );
    }

    // 3. Calcular fechaCorte según periodicidad del contrato
    const periodicidad = contrato.periodicidadPago; // 'QUINCENAL' o 'MENSUAL'
    const fechaInicioContrato = new Date(contrato.fechaInicio);
    const fechaCorte = this.calcularFechaCorte(periodicidad, fechaInicioContrato);

    // 4. Calcular periodo real de facturación
    const periodoReal = this.calcularPeriodo(fechaInicioContrato, fechaCorte, periodicidad);

    // 5. Verificar si ya existe una factura para este periodo (evitar duplicados)
    const existeDuplicado = await this.existeFacturaEnPeriodo(modeloId, periodoReal);

    if (existeDuplicado) {
      throw new BadRequestException(
        `Ya existe una factura para ${modelo.nombreCompleto} en el periodo ${periodoReal.anio}-${String(periodoReal.mes).padStart(2, '0')}${periodoReal.quincena ? `-Q${periodoReal.quincena}` : ''}`
      );
    }

    // 6. Calcular rango de fechas para consultar ventas
    // Desde fechaInicio hasta el día ANTERIOR a fechaCorte
    let fechaInicio: Date;
    const fechaFin = new Date(fechaCorte);
    fechaFin.setDate(fechaFin.getDate() - 1); // Día anterior al corte
    fechaFin.setHours(23, 59, 59, 999); // Hasta el final del día

    if (periodoReal.quincena === 1) {
      // Primera quincena: día 1 al 15
      fechaInicio = new Date(periodoReal.anio, periodoReal.mes - 1, 1, 0, 0, 0);
    } else if (periodoReal.quincena === 2) {
      // Segunda quincena: día 16 al fin de mes
      fechaInicio = new Date(periodoReal.anio, periodoReal.mes - 1, 16, 0, 0, 0);
    } else {
      // Mes completo
      fechaInicio = new Date(periodoReal.anio, periodoReal.mes - 1, 1, 0, 0, 0);
    }

    // Ajustar fechaInicio si el contrato inició durante el periodo
    if (fechaInicioContrato > fechaInicio && fechaInicioContrato <= fechaFin) {
      fechaInicio = new Date(
        fechaInicioContrato.getFullYear(),
        fechaInicioContrato.getMonth(),
        fechaInicioContrato.getDate(),
        0,
        0,
        0
      );
      
      this.logger.log(
        `Ajustando fechaInicio al inicio del contrato: ${fechaInicio.toISOString()}`
      );
    }

    // 7. Consultar ventas del periodo
    const ventasQuery: any = {
      modeloId: new Types.ObjectId(modeloId),
      fechaVenta: {
        $gte: fechaInicio,
        $lte: fechaFin,
      },
    };

    this.logger.log(
      `Buscando ventas para modelo ${modeloId} desde ${fechaInicio.toISOString()} hasta ${fechaFin.toISOString()}`
    );

    const ventas = await this.chatterSaleModel.find(ventasQuery).lean();

    this.logger.log(`Ventas encontradas: ${ventas.length}`);

    if (ventas.length === 0) {
      throw new BadRequestException(
        `No hay ventas registradas para el periodo ${periodoReal.anio}-${periodoReal.mes}${periodoReal.quincena ? `-Q${periodoReal.quincena}` : ''}`
      );
    }

    // 8. Calcular total de ventas en USD
    const totalVentasUSD = ventas.reduce((acc, venta) => {
      return this.moneyService.add(acc, venta.monto);
    }, 0);

    this.logger.log(
      `Total ventas ${modelo.nombreCompleto} en periodo: ${this.moneyService.formatForUser(totalVentasUSD, 'USD')}`
    );

    // 9. Calcular comisión según tipo de contrato
    let montoComision: number;
    let conceptoDetalle: string;

    if (contrato.tipoComision === TipoComision.FIJO) {
      const porcentaje = contrato.comisionFija!.porcentaje;
      montoComision = this.moneyService.multiply(totalVentasUSD, porcentaje / 100);
      conceptoDetalle = `Comisión ${porcentaje}% sobre ventas`;

      this.logger.log(`Tipo de comisión: FIJA (${porcentaje}%)`);
    } else {
      const escala = contrato.comisionEscalonada!.escalaId as any;

      this.logger.log(`Tipo de comisión: ESCALONADA`);
      this.logger.log(`Escala obtenida: ${JSON.stringify(escala)}`);

      if (!escala) {
        throw new BadRequestException(
          `El contrato de ${modelo.nombreCompleto} no tiene una escala de comisión asignada`
        );
      }

      montoComision = this.calcularComisionEscalonada(totalVentasUSD, escala);
      conceptoDetalle = `Comisión escalonada (${escala.name || 'Sin nombre'})`;
    }

    // Redondear comisión según moneda USD (2 decimales)
    montoComision = this.moneyService.roundForCurrency(montoComision, 'USD');

    this.logger.log(
      `Comisión calculada: ${this.moneyService.formatForUser(montoComision, 'USD')}`
    );

    // 10. Crear items de la factura
    const items: ItemFactura[] = [
      {
        concepto: conceptoDetalle,
        cantidad: 1,
        valorUnitario: this.moneyService.toDatabase(montoComision, 'USD'),
        subtotal: this.moneyService.toDatabase(montoComision, 'USD'),
        notas: `Ventas totales: ${this.moneyService.formatForUser(totalVentasUSD, 'USD')}`,
      },
    ];

    // 11. Calcular fechas
    const config = await this.obtenerConfiguracion();
    const hoy = new Date();
    const fechaEmision = new Date(hoy); // Fecha de creación (hoy)
    fechaEmision.setHours(0, 0, 0, 0);

    const fechaVencimiento = new Date(fechaCorte);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + config.diasVencimientoFactura);
    fechaVencimiento.setHours(23, 59, 59, 999);

    // 12. Generar número de factura único (con retry logic)
    const numeroFactura = await this.generarNumeroFactura();

    // 13. Crear factura en estado SEGUIMIENTO
    const factura = new this.facturaModel({
      numeroFactura,
      modeloId: new Types.ObjectId(modeloId),
      contratoId: contrato._id,
      periodo: {
        anio: periodoReal.anio,
        mes: periodoReal.mes,
        quincena: periodoReal.quincena || null,
      },
      fechaEmision, // Fecha de creación (hoy)
      fechaCorte, // Fecha real de facturación (día 16, día 1, etc.)
      fechaVencimiento, // fechaCorte + diasVencimiento
      estado: EstadoFactura.SEGUIMIENTO, // ⭐ Estado inicial SEGUIMIENTO
      moneda: 'USD',
      items,
      subtotal: this.moneyService.toDatabase(montoComision, 'USD'),
      descuento: 0n,
      total: this.moneyService.toDatabase(montoComision, 'USD'),
      pagos: [],
      saldoPendiente: this.moneyService.toDatabase(montoComision, 'USD'),
      notas: `Factura en seguimiento. Se activará automáticamente el ${fechaCorte.toISOString().split('T')[0]}`,
      creadaPor: new Types.ObjectId(creadaPor),
      modificadaPor: null,
      meta: {
        totalVentasUSD: totalVentasUSD,
        cantidadVentas: ventas.length,
        tipoComision: contrato.tipoComision,
        periodicidad: periodicidad,
        periodoInicio: fechaInicio.toISOString(),
        periodoFin: fechaFin.toISOString(),
        fechaCorte: fechaCorte.toISOString(),
        generadaEnSeguimiento: true,
      },
    });

    await factura.save();

    this.logger.log(
      `✅ Factura ${numeroFactura} generada en SEGUIMIENTO para ${modelo.nombreCompleto}: ${this.moneyService.formatForUser(montoComision, 'USD')} | Activación: ${fechaCorte.toISOString().split('T')[0]}`
    );

    return this.facturaToPlainObject(factura) as any;
  }

  /**
   * Genera facturas para todas las modelos activas en un periodo
   * 
   * @param dto Datos del periodo y modelos específicas (opcional)
   * @returns Resultado con facturas generadas y errores
   */
  async generarFacturasPorPeriodo(
    dto: GenerarFacturasPorPeriodoDto,
    creadaPor: string,
  ): Promise<{
    generadas: number;
    errores: number;
    facturas: any[]; // Plain objects sin BigInt
    erroresDetalle: Array<{ modeloId: string; error: string }>;
  }> {
    // Obtener modelos a facturar
  let modelos: ModeloDocument[];

    if (dto.modeloIds && dto.modeloIds.length > 0) {
      // Facturar solo las modelos especificadas
      modelos = await this.modeloModel
        .find({
          _id: { $in: dto.modeloIds.map(id => new Types.ObjectId(id)) },
          estado: 'ACTIVA',
        });
    } else {
      // Facturar todas las modelos activas
  modelos = await this.modeloModel.find({ estado: 'ACTIVA' });
    }

    this.logger.log(`Generando facturas para ${modelos.length} modelos...`);

    const facturas: any[] = [];
    const erroresDetalle: Array<{ modeloId: string; error: string }> = [];

    // Generar facturas SECUENCIALMENTE para evitar colisiones de numeroFactura
    // La generación en paralelo causa race conditions donde múltiples facturas obtienen el mismo número
    for (const modelo of modelos) {
      try {
        const factura = await this.generarFacturaAutomatica(
          (modelo as any)._id.toString(),
          {
            anio: dto.anio,
            mes: dto.mes,
            quincena: dto.quincena,
          },
          creadaPor,
        );
        
        // Convertir a objeto plano sin BigInt
        const facturaPlain = this.facturaToPlainObject(factura);
        facturas.push(facturaPlain);
      } catch (error: any) {
        this.logger.error(
          `Error generando factura para ${modelo.nombreCompleto}: ${error.message}`
        );
        erroresDetalle.push({
          modeloId: (modelo as any)._id.toString(),
          error: error.message,
        });
      }
    }

    this.logger.log(
      `✅ Facturación masiva completada: ${facturas.length} generadas, ${erroresDetalle.length} errores`
    );

    return {
      generadas: facturas.length,
      errores: erroresDetalle.length,
      facturas,
      erroresDetalle,
    };
  }

  /**
   * Crea una factura manualmente
   * 
   * @param dto Datos de la factura
  /**
   * Crea una factura manualmente
   * 
   * @param dto Datos de la factura
   * @param creadaPor ID del usuario
   * @returns Factura creada
   */
  async crearFacturaManual(
    dto: CreateFacturaDto,
    creadaPor: string,
  ): Promise<FacturaDocument> {
    // Validar modelo
    const modelo = await this.modeloModel.findById(dto.modeloId).lean();
    if (!modelo) {
      throw new NotFoundException(`Modelo con ID ${dto.modeloId} no encontrada`);
    }

    // Verificar si ya existe una factura para este periodo (evitar duplicados)
    if (dto.periodo) {
      const existeDuplicado = await this.existeFacturaEnPeriodo(dto.modeloId, dto.periodo);

      if (existeDuplicado) {
        throw new BadRequestException(
          `Ya existe una factura para ${modelo.nombreCompleto} en el periodo ${dto.periodo.anio}-${String(dto.periodo.mes).padStart(2, '0')}${dto.periodo.quincena ? `-Q${dto.periodo.quincena}` : ''}`
        );
      }
    }

    // Obtener contrato
    const contrato = await this.contratoModel
      .findOne({
        modeloId: new Types.ObjectId(dto.modeloId),
        estado: 'FIRMADO',
      })
      .lean();

    if (!contrato) {
      throw new BadRequestException(
        `La modelo ${modelo.nombreCompleto} no tiene un contrato activo`
      );
    }

    // Procesar items
    let subtotal = 0;
    const itemsProcessed: ItemFactura[] = [];

    for (const item of dto.items) {
      const valorUnitario = this.moneyService.roundForCurrency(item.valorUnitario, 'USD');
      const subtotalItem = this.moneyService.multiply(valorUnitario, item.cantidad);
      const subtotalItemRedondeado = this.moneyService.roundForCurrency(subtotalItem, 'USD');

      itemsProcessed.push({
        concepto: item.concepto,
        cantidad: item.cantidad,
        valorUnitario: this.moneyService.toDatabase(valorUnitario, 'USD'),
        subtotal: this.moneyService.toDatabase(subtotalItemRedondeado, 'USD'),
        notas: item.notas || null,
      });

      subtotal = this.moneyService.add(subtotal, subtotalItemRedondeado);
    }

    // Aplicar descuento si existe
    const descuento = dto.descuento ? this.moneyService.roundForCurrency(dto.descuento, 'USD') : 0;
    const total = this.moneyService.subtract(subtotal, descuento);

    if (total < 0) {
      throw new BadRequestException('El descuento no puede ser mayor al subtotal');
    }

    // Fechas
    const config = await this.obtenerConfiguracion();
    const fechaEmision = dto.fechaEmision ? new Date(dto.fechaEmision) : new Date();
    
    // fechaCorte: Para facturas manuales, por defecto es la misma que fechaEmision
    // (ya que se crean manualmente, no en modo seguimiento)
    const fechaCorte = dto.fechaEmision ? new Date(dto.fechaEmision) : new Date();
    
    const diasVencimiento = dto.diasVencimiento || config.diasVencimientoFactura;
    const fechaVencimiento = new Date(fechaCorte);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasVencimiento);

    // Número de factura (con retry logic)
    const numeroFactura = await this.generarNumeroFactura();

    // Crear factura
    // Las facturas manuales por defecto van en estado PENDIENTE (no SEGUIMIENTO)
    // porque el usuario las crea directamente para enviar de inmediato
    const factura = new this.facturaModel({
      numeroFactura,
      modeloId: new Types.ObjectId(dto.modeloId),
      contratoId: contrato._id,
      periodo: dto.periodo,
      fechaEmision,
      fechaCorte, // Nueva campo requerido
      fechaVencimiento,
      estado: EstadoFactura.PENDIENTE, // Manual = PENDIENTE directo
      moneda: 'USD', // Por defecto USD
      items: itemsProcessed,
      subtotal: this.moneyService.toDatabase(subtotal, 'USD'),
      descuento: this.moneyService.toDatabase(descuento, 'USD'),
      total: this.moneyService.toDatabase(total, 'USD'),
      pagos: [],
      saldoPendiente: this.moneyService.toDatabase(total, 'USD'),
      notas: dto.notas || null,
      creadaPor: new Types.ObjectId(creadaPor),
      modificadaPor: null,
      meta: { creacionManual: true },
    });

    await factura.save();

    this.logger.log(`✅ Factura manual ${numeroFactura} creada: ${this.moneyService.formatForUser(total, 'USD')}`);

    return this.facturaToPlainObject(factura) as any;
  }

  /**
   * Obtiene facturas con filtros
   * 
   * @param filtros Filtros de búsqueda
   * @returns Lista de facturas con populate de modelo y contrato
   */
  async obtenerFacturas(filtros: FiltrosFacturasDto): Promise<{
    total: number;
    facturas: any[];
    page: number;
    limit: number;
  }> {
    const query: any = {};

    // Aplicar filtros
    if (filtros.modeloId) query.modeloId = new Types.ObjectId(filtros.modeloId);
    if (filtros.contratoId) query.contratoId = new Types.ObjectId(filtros.contratoId);
    if (filtros.estado) query.estado = filtros.estado;
    if (filtros.anio) query['periodo.anio'] = filtros.anio;
    if (filtros.mes) query['periodo.mes'] = filtros.mes;
    if (filtros.quincena) query['periodo.quincena'] = filtros.quincena;

    // Filtros de fechas
    if (filtros.fechaEmisionDesde || filtros.fechaEmisionHasta) {
      query.fechaEmision = {};
      if (filtros.fechaEmisionDesde) query.fechaEmision.$gte = new Date(filtros.fechaEmisionDesde);
      if (filtros.fechaEmisionHasta) query.fechaEmision.$lte = new Date(filtros.fechaEmisionHasta);
    }

    if (filtros.fechaVencimientoDesde || filtros.fechaVencimientoHasta) {
      query.fechaVencimiento = {};
      if (filtros.fechaVencimientoDesde) query.fechaVencimiento.$gte = new Date(filtros.fechaVencimientoDesde);
      if (filtros.fechaVencimientoHasta) query.fechaVencimiento.$lte = new Date(filtros.fechaVencimientoHasta);
    }

    // Paginación
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const skip = (page - 1) * limit;

    // Contar total
    const total = await this.facturaModel.countDocuments(query);

    // Obtener facturas
    const facturas = await this.facturaModel
      .find(query)
      .populate('modeloId', 'nombreCompleto correoElectronico')
      .populate('contratoId', 'numeroContrato tipoComision periodicidadPago')
      .populate('creadaPor', 'username')
      .sort({ fechaEmision: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    // Serializar facturas con valores formateados
    const facturasSerializadas = facturas.map(factura => this.facturaToPlainObject(factura));

    return { total, facturas: facturasSerializadas, page, limit };
  }

  /**
   * Obtiene una factura por ID
   */
  async obtenerFacturaPorId(id: string): Promise<any> {
    const factura = await this.facturaModel
      .findById(id)
      .populate('modeloId')
      .populate('contratoId')
      .populate('pagos')
      .populate('creadaPor', 'username')
      .exec();

    if (!factura) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    return this.facturaToPlainObject(factura);
  }

  /**
   * Obtiene una factura con toda la información necesaria para generar PDF
   * 
   * @param id ID de la factura
   * @returns Datos formateados para el PDF de factura
   */
  async obtenerFacturaParaPdf(id: string): Promise<any> {
    const factura = await this.facturaModel
      .findById(id)
      .populate('modeloId')
      .populate('contratoId')
      .lean()
      .exec();

    if (!factura) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    // Obtener pagos de la factura
    const pagos = await this.pagoModel
      .find({ facturaId: new Types.ObjectId(id) })
      .sort({ fechaPago: -1 })
      .lean()
      .exec();

    const modelo = factura.modeloId as any;
    const contrato = factura.contratoId as any;

    // Formatear items con MoneyService
    const itemsFormateados = factura.items.map((item: any) => ({
      concepto: item.concepto,
      cantidad: item.cantidad,
      valorUnitario: this.moneyService.fromDatabase(item.valorUnitario),
      subtotal: this.moneyService.fromDatabase(item.subtotal),
      notas: item.notas || null,
    }));

    // Formatear pagos con MoneyService
    const pagosFormateados = pagos.map((pago: any) => ({
      numeroRecibo: pago.numeroRecibo,
      fechaPago: pago.fechaPago,
      monto: this.moneyService.fromDatabase(pago.monto),
      moneda: pago.moneda,
      metodoPago: pago.metodoPago,
      referencia: pago.referencia || null,
      comprobanteUrl: pago.comprobanteUrl || null,
    }));

    // Calcular monto pagado
    const montoPagado = pagos.reduce((acc, pago: any) => {
      return this.moneyService.add(acc, this.moneyService.fromDatabase(pago.monto));
    }, 0);

    return {
      factura: {
        numeroFactura: factura.numeroFactura,
        fechaEmision: factura.fechaEmision,
        fechaVencimiento: factura.fechaVencimiento,
        estado: factura.estado,
        moneda: factura.moneda,
        items: itemsFormateados,
        subtotal: this.moneyService.fromDatabase(factura.subtotal),
        descuento: this.moneyService.fromDatabase(factura.descuento),
        total: this.moneyService.fromDatabase(factura.total),
        saldoPendiente: this.moneyService.fromDatabase(factura.saldoPendiente),
        montoPagado,
        notas: factura.notas || null,
        periodo: factura.periodo,
      },
      modelo: {
        nombreCompleto: modelo.nombreCompleto,
        numeroIdentificacion: modelo.numeroIdentificacion,
        correoElectronico: modelo.correoElectronico,
        telefono: modelo.telefono || null,
      },
      contrato: {
        numeroContrato: contrato.numeroContrato,
        fechaInicio: contrato.fechaInicio,
        periodicidadPago: contrato.periodicidadPago,
        tipoComision: contrato.tipoComision,
      },
      pagos: pagosFormateados,
    };
  }

  /**
   * Actualiza una factura
   */
  async actualizarFactura(
    id: string,
    dto: UpdateFacturaDto,
    modificadaPor: string,
  ): Promise<any> {
    const factura = await this.facturaModel.findById(id);

    if (!factura) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    // Validar estado
    if (factura.estado === EstadoFactura.PAGADO) {
      throw new BadRequestException('No se puede modificar una factura pagada');
    }

    // Aplicar cambios
    if (dto.estado) factura.estado = dto.estado;
    if (dto.notas !== undefined) factura.notas = dto.notas;
    if (dto.fechaVencimiento) factura.fechaVencimiento = new Date(dto.fechaVencimiento);

    factura.modificadaPor = new Types.ObjectId(modificadaPor);

    await factura.save();

    this.logger.log(`✅ Factura ${factura.numeroFactura} actualizada`);

    return this.facturaToPlainObject(factura);
  }

  /**
   * Calcula totales de cartera
   */
  async calcularTotalCartera(): Promise<{
    moneda: 'USD' | 'COP';
    // Valores raw (BigInt como string)
    totalFacturado: string;
    totalPagado: string;
    saldoPendiente: string;
    montoVencido: string;
    // Valores formateados dinámicamente
    totalFacturadoFormateado: string;
    totalPagadoFormateado: string;
    saldoPendienteFormateado: string;
    montoVencidoFormateado: string;
    // Estadísticas
    facturasPendientes: number;
    facturasParciales: number;
    facturasVencidas: number;
    facturasPagadas: number;
    tasaCobranza: number;
  }> {
    // Nota: Por ahora asumimos USD, pero debería venir de configuración o ser parametrizable
    const moneda = 'USD';

    // Totales
    const resultados = await this.facturaModel.aggregate([
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 },
          total: { $sum: { $toLong: '$total' } },
          saldoPendiente: { $sum: { $toLong: '$saldoPendiente' } },
        },
      },
    ]);

    let totalFacturado = 0;
    let totalPagado = 0;
    let saldoPendiente = 0;
    let montoVencido = 0;
    let facturasPendientes = 0;
    let facturasParciales = 0;
    let facturasVencidas = 0;
    let facturasPagadas = 0;

    for (const res of resultados) {
      const totalDecimal = this.moneyService.fromDatabase(BigInt(res.total));
      const saldoDecimal = this.moneyService.fromDatabase(BigInt(res.saldoPendiente));
      const pagadoDecimal = this.moneyService.subtract(totalDecimal, saldoDecimal);

      totalFacturado = this.moneyService.add(totalFacturado, totalDecimal);

      if (res._id === EstadoFactura.PAGADO) {
        totalPagado = this.moneyService.add(totalPagado, totalDecimal);
        facturasPagadas += res.count;
      } else if (res._id === EstadoFactura.PENDIENTE) {
        saldoPendiente = this.moneyService.add(saldoPendiente, saldoDecimal);
        totalPagado = this.moneyService.add(totalPagado, pagadoDecimal);
        facturasPendientes += res.count;
      } else if (res._id === EstadoFactura.PARCIAL) {
        saldoPendiente = this.moneyService.add(saldoPendiente, saldoDecimal);
        totalPagado = this.moneyService.add(totalPagado, pagadoDecimal);
        facturasParciales += res.count;
      } else if (res._id === EstadoFactura.VENCIDO) {
        saldoPendiente = this.moneyService.add(saldoPendiente, saldoDecimal);
        montoVencido = this.moneyService.add(montoVencido, saldoDecimal);
        totalPagado = this.moneyService.add(totalPagado, pagadoDecimal);
        facturasVencidas += res.count;
      }
    }

    // Calcular tasa de cobranza (porcentaje de lo pagado sobre lo facturado)
    const tasaCobranza = totalFacturado > 0 
      ? (totalPagado / totalFacturado) * 100 
      : 0;

    // Convertir a BigInt serializado como string Y formatear
    return {
      moneda,
      // Valores raw
      totalFacturado: this.moneyService.toDatabase(totalFacturado, moneda).toString(),
      totalPagado: this.moneyService.toDatabase(totalPagado, moneda).toString(),
      saldoPendiente: this.moneyService.toDatabase(saldoPendiente, moneda).toString(),
      montoVencido: this.moneyService.toDatabase(montoVencido, moneda).toString(),
      // Valores formateados dinámicamente usando MoneyService
      totalFacturadoFormateado: this.moneyService.formatForUser(totalFacturado, moneda),
      totalPagadoFormateado: this.moneyService.formatForUser(totalPagado, moneda),
      saldoPendienteFormateado: this.moneyService.formatForUser(saldoPendiente, moneda),
      montoVencidoFormateado: this.moneyService.formatForUser(montoVencido, moneda),
      // Estadísticas
      facturasPendientes,
      facturasParciales,
      facturasVencidas,
      facturasPagadas,
      tasaCobranza: Math.round(tasaCobranza * 10) / 10, // Redondear a 1 decimal
    };
  }

  // ========== MÉTODOS AUXILIARES PRIVADOS ==========

  /**
   * Calcula comisión escalonada según la escala definida
   */
  private calcularComisionEscalonada(totalVentas: number, escala: any): number {
    if (!escala || !escala.rules || escala.rules.length === 0) {
      throw new BadRequestException('Escala de comisión inválida o sin niveles definidos');
    }

    let comisionTotal = 0;

    // Ordenar rules por minUsd
    const rules = [...escala.rules].sort((a: any, b: any) => a.minUsd - b.minUsd);

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const nextRule = rules[i + 1];

      const minUsd = rule.minUsd;
      const maxUsd = rule.maxUsd || (nextRule ? nextRule.minUsd : Infinity);
      const percentage = rule.percentage;

      if (totalVentas >= minUsd) {
        let montoEnRango: number;

        if (totalVentas > maxUsd) {
          // Aplica a todo el rango del rule
          montoEnRango = this.moneyService.subtract(maxUsd, minUsd);
        } else {
          // Aplica solo hasta el total de ventas
          montoEnRango = this.moneyService.subtract(totalVentas, minUsd);
        }

        const comisionRango = this.moneyService.multiply(montoEnRango, percentage / 100);
        comisionTotal = this.moneyService.add(comisionTotal, comisionRango);

        // Si ya procesamos todo el monto, salir
        if (totalVentas <= maxUsd) break;
      }
    }

    return comisionTotal;
  }

  /**
   * Genera un número de factura único con manejo de colisiones
   * 
   * Estrategia MEJORADA:
   * 1. Obtiene todas las facturas existentes del año
   * 2. Encuentra el próximo número secuencial disponible (1, 2, 3, 4, ...)
   * 3. Si hay huecos en la secuencia, los llena primero
   * 4. Verifica que el número elegido no existe (doble verificación)
   * 5. Si después de 50 intentos falla, usa timestamp como fallback
   * 
   * Ejemplos:
   * - Existen: 0001, 0002, 0003 → Genera: 0004
   * - Existen: 0001, 0003, 0005 → Genera: 0002 (llena hueco)
   * - Existen: 0001 → Genera: 0002
   * - No existen facturas → Genera: 0001
   * 
   * @param maxIntentos Número máximo de intentos (default: 50)
   * @returns Número de factura único
   */
  private async generarNumeroFactura(maxIntentos: number = 50): Promise<string> {
    const anio = new Date().getFullYear();
    const patron = new RegExp(`^FACT-${anio}-(\\d+)$`);

    try {
      // Obtener todas las facturas del año ordenadas numéricamente
      const facturasExistentes = await this.facturaModel
        .find({ numeroFactura: new RegExp(`^FACT-${anio}-\\d+$`) })
        .select('numeroFactura')
        .sort({ numeroFactura: 1 })
        .lean();

      // Extraer los números existentes
      const numerosExistentes = new Set<number>();
      for (const factura of facturasExistentes) {
        const match = factura.numeroFactura.match(patron);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num)) {
            numerosExistentes.add(num);
          }
        }
      }

      // Buscar el próximo número disponible (secuencial)
      let numeroDisponible = 1;
      for (let candidato = 1; candidato <= maxIntentos; candidato++) {
        if (!numerosExistentes.has(candidato)) {
          numeroDisponible = candidato;
          break;
        }
      }

      // Si llegamos al límite, usar el siguiente después del máximo existente
      if (numerosExistentes.has(numeroDisponible)) {
        const maxExistente = Math.max(...Array.from(numerosExistentes));
        numeroDisponible = maxExistente + 1;
      }

      const numeroFacturaCandidate = `FACT-${anio}-${String(numeroDisponible).padStart(4, '0')}`;

      // Doble verificación: asegurar que no existe (prevenir race conditions)
      const existe = await this.facturaModel.exists({ numeroFactura: numeroFacturaCandidate });

      if (!existe) {
        this.logger.debug(`✅ Número de factura generado: ${numeroFacturaCandidate}`);
        return numeroFacturaCandidate;
      }

      // Si existe después de la verificación, es una race condition
      // Buscar el siguiente disponible con retry
      this.logger.warn(`⚠️  Race condition detectada en ${numeroFacturaCandidate}, buscando siguiente...`);

      for (let intento = 1; intento <= 10; intento++) {
        const siguienteNumero = numeroDisponible + intento;
        const siguienteCandidate = `FACT-${anio}-${String(siguienteNumero).padStart(4, '0')}`;
        
        const existeSiguiente = await this.facturaModel.exists({ numeroFactura: siguienteCandidate });
        
        if (!existeSiguiente) {
          this.logger.debug(`✅ Número de factura generado (retry ${intento}): ${siguienteCandidate}`);
          return siguienteCandidate;
        }
      }

      // Fallback: Usar timestamp para garantizar unicidad absoluta
      const timestamp = Date.now().toString().slice(-6);
      const numeroFacturaFallback = `FACT-${anio}-T${timestamp}`;
      
      this.logger.warn(`⚠️  Usando fallback con timestamp: ${numeroFacturaFallback}`);
      
      return numeroFacturaFallback;

    } catch (error: any) {
      // Error catastrófico: usar timestamp
      const timestamp = Date.now().toString().slice(-6);
      const numeroFacturaFallback = `FACT-${anio}-T${timestamp}`;
      
      this.logger.error(`❌ Error generando número de factura: ${error.message}. Usando fallback: ${numeroFacturaFallback}`);
      
      return numeroFacturaFallback;
    }
  }

  /**
   * Calcula la fecha de corte según la periodicidad del contrato
   * 
   * Reglas:
   * - QUINCENAL:
   *   - Si fechaInicio está entre 1-15: próximo corte es día 16 del mismo mes
   *   - Si fechaInicio está entre 16-31: próximo corte es día 1 del mes siguiente
   * - MENSUAL:
   *   - Siempre es el día 1 del mes siguiente a la fecha actual
   * 
   * @param periodicidad 'QUINCENAL' | 'MENSUAL'
   * @param fechaInicioContrato Fecha de inicio del contrato
   * @returns Fecha de corte (día que se enviará la factura)
   */
  private calcularFechaCorte(periodicidad: 'QUINCENAL' | 'MENSUAL', fechaInicioContrato: Date): Date {
    const hoy = new Date();
    const diaInicio = fechaInicioContrato.getDate();

    if (periodicidad === 'QUINCENAL') {
      // Si el contrato inició entre 1-15, el corte es el 16 del mismo mes
      if (diaInicio >= 1 && diaInicio <= 15) {
        const fechaCorte = new Date(hoy.getFullYear(), hoy.getMonth(), 16);
        
        // Si ya pasó el día 16 de este mes, ir al día 16 del próximo mes
        if (hoy > fechaCorte) {
          return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 16);
        }
        
        return fechaCorte;
      }

      // Si el contrato inició entre 16-31, el corte es el 1 del mes siguiente
      const fechaCorte = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
      return fechaCorte;
    }

    // MENSUAL: siempre es el 1 del mes siguiente
    return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  }

  /**
   * Calcula el periodo de facturación según fechaInicio y fechaCorte
   * 
   * @param fechaInicioContrato Fecha de inicio del contrato
   * @param fechaCorte Fecha de corte calculada
   * @param periodicidad 'QUINCENAL' | 'MENSUAL'
   * @returns Objeto con año, mes y quincena (si aplica)
   */
  private calcularPeriodo(
    fechaInicioContrato: Date,
    fechaCorte: Date,
    periodicidad: 'QUINCENAL' | 'MENSUAL',
  ): { anio: number; mes: number; quincena?: number | null } {
    const mesCorte = fechaCorte.getMonth() + 1; // getMonth() retorna 0-11
    const anioCorte = fechaCorte.getFullYear();

    if (periodicidad === 'QUINCENAL') {
      const diaCorte = fechaCorte.getDate();
      
      // Si el corte es día 16, es la primera quincena del mes actual
      if (diaCorte === 16) {
        return { anio: anioCorte, mes: mesCorte, quincena: 1 };
      }

      // Si el corte es día 1, es la segunda quincena del mes anterior
      if (diaCorte === 1) {
        const mesAnterior = mesCorte === 1 ? 12 : mesCorte - 1;
        const anioAnterior = mesCorte === 1 ? anioCorte - 1 : anioCorte;
        return { anio: anioAnterior, mes: mesAnterior, quincena: 2 };
      }
    }

    // MENSUAL: mes anterior al corte
    const mesFacturado = mesCorte === 1 ? 12 : mesCorte - 1;
    const anioFacturado = mesCorte === 1 ? anioCorte - 1 : anioCorte;

    return { anio: anioFacturado, mes: mesFacturado, quincena: null };
  }

  /**
   * Verifica si ya existe una factura para el modelo en el periodo especificado
   * Previene duplicados
   * 
   * @param modeloId ID de la modelo
   * @param periodo Periodo a verificar
   * @returns true si ya existe, false si no
   */
  private async existeFacturaEnPeriodo(
    modeloId: Types.ObjectId | string,
    periodo: { anio: number; mes: number; quincena?: number | null },
  ): Promise<boolean> {
    const query: any = {
      modeloId,
      'periodo.anio': periodo.anio,
      'periodo.mes': periodo.mes,
      estado: { $ne: EstadoFactura.CANCELADO }, // No contar facturas canceladas
    };

    if (periodo.quincena) {
      query['periodo.quincena'] = periodo.quincena;
    } else {
      query['periodo.quincena'] = null;
    }

    const existe = await this.facturaModel.exists(query);
    return !!existe;
  }

  /**
   * Obtiene la configuración de cartera (crea una por defecto si no existe)
   */
  private async obtenerConfiguracion(): Promise<ConfiguracionCarteraDocument> {
    let config = await this.configuracionModel.findOne().lean();

    if (!config) {
      // Crear configuración por defecto
      const nuevaConfig = new this.configuracionModel({
        diasVencimientoFactura: 15,
        diasAntesAlerta1: 5,
        diasAntesAlerta2: 2,
        diasDespuesAlertaMora: 3,
        diasDespuesAlertaMora2: 7,
        emailCC: [],
        emailFrom: 'OnlyTop Cartera <cartera@onlytop.com>',
        generacionAutomaticaActiva: true,
        diaGeneracionFacturas: 1,
        recordatoriosAutomaticosActivos: true,
        horaEjecucionRecordatorios: '08:00',
        activo: true,
        formatosComprobantePermitidos: ['jpg', 'jpeg', 'png', 'pdf'],
        tamanoMaximoComprobante: 5 * 1024 * 1024, // 5MB
        meta: {},
      });

      config = (await nuevaConfig.save()) as any;
      this.logger.log('✅ Configuración de cartera creada por defecto');
    }

    return config as any;
  }

  // ========== CONFIGURACIÓN (PÚBLICO) ==========

  /**
   * Obtiene la configuración actual de cartera
   * Crea una por defecto si no existe.
   */
  async obtenerConfiguracionPublica(): Promise<ConfiguracionCarteraDocument> {
    const config = await this.obtenerConfiguracion();
    return config as any;
  }

  /**
   * Actualiza la configuración de cartera
   * Solo actualiza los campos provistos en el DTO.
   */
  async actualizarConfiguracion(
    dto: Partial<UpdateConfiguracionCarteraDto>,
    actualizadoPor: string,
  ): Promise<ConfiguracionCarteraDocument> {
    // Asegurar que exista configuración
    await this.obtenerConfiguracion();

    // Sanitizar DTO: quitar propiedades undefined para no sobreescribir
    const toSet: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto || {})) {
      if (v !== undefined) toSet[k] = v as unknown;
    }

    const updated = await this.configuracionModel
      .findOneAndUpdate(
        {},
        { $set: { ...toSet } },
        { new: true }
      )
      .lean();

    this.logger?.log?.(
      `Configuración de cartera actualizada por ${actualizadoPor}: ${Object.keys(toSet).join(', ')}`
    );

    return updated as any;
  }

  /**
   * Activa facturas en seguimiento cuando llega su fechaCorte
   * 
   * Busca facturas con estado=SEGUIMIENTO y fechaCorte <= hoy,
   * las cambia a estado=PENDIENTE y opcionalmente envía notificación.
   * 
   * @returns Resultado con cantidad de facturas activadas
   */
  async activarFacturasEnSeguimiento(): Promise<{
    activadas: number;
    errores: number;
    facturas: Array<{ id: string; numeroFactura: string; modeloNombre: string; error?: string }>;
  }> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a inicio del día

    try {
      // Buscar facturas en seguimiento con fechaCorte <= hoy
      const facturasEnSeguimiento = await this.facturaModel
        .find({
          estado: EstadoFactura.SEGUIMIENTO,
          fechaCorte: { $lte: hoy },
        })
        .populate('modeloId', 'nombreCompleto correoElectronico')
        .lean();

      if (facturasEnSeguimiento.length === 0) {
        this.logger.debug('📋 No hay facturas en seguimiento para activar');
        return { activadas: 0, errores: 0, facturas: [] };
      }

      this.logger.log(
        `📋 Encontradas ${facturasEnSeguimiento.length} facturas en seguimiento para activar`
      );

      const resultado = {
        activadas: 0,
        errores: 0,
        facturas: [] as Array<{ id: string; numeroFactura: string; modeloNombre: string; error?: string }>,
      };

      // Activar cada factura
      for (const factura of facturasEnSeguimiento) {
        try {
          const modelo = factura.modeloId as any;

          // Cambiar estado a PENDIENTE
          await this.facturaModel.findByIdAndUpdate(factura._id, {
            $set: {
              estado: EstadoFactura.PENDIENTE,
              notas: `Factura activada automáticamente el ${hoy.toISOString().split('T')[0]}`,
            },
          });

          resultado.activadas++;
          resultado.facturas.push({
            id: factura._id.toString(),
            numeroFactura: factura.numeroFactura,
            modeloNombre: modelo?.nombreCompleto || 'Desconocido',
          });

          this.logger.log(
            `✅ Factura ${factura.numeroFactura} activada para ${modelo?.nombreCompleto || 'Desconocido'}`
          );

          // TODO: Enviar notificación por email a la modelo
          // await this.emailService.enviarNotificacionFacturaActivada(factura);
        } catch (error: any) {
          this.logger.error(
            `❌ Error activando factura ${factura.numeroFactura}: ${error.message}`
          );
          resultado.errores++;
          resultado.facturas.push({
            id: factura._id.toString(),
            numeroFactura: factura.numeroFactura,
            modeloNombre: (factura.modeloId as any)?.nombreCompleto || 'Desconocido',
            error: error.message,
          });
        }
      }

      this.logger.log(
        `📊 Activación completada: ${resultado.activadas} activadas, ${resultado.errores} errores`
      );

      return resultado;
    } catch (error: any) {
      this.logger.error(`❌ Error en activarFacturasEnSeguimiento: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ========== PARTE 2: PAGOS ==========

  /**
   * Registra un pago para una factura
   * 
   * Flujo:
   * 1. Valida que la factura existe y no está cancelada
   * 2. Sube el comprobante a Cloudinary (si existe)
   * 3. Crea el registro de pago con MoneyService
   * 4. Actualiza el saldo de la factura
   * 5. Cambia el estado de la factura según saldo restante
   * 6. (Futuro) Envía email de confirmación
   * 
   * @param dto Datos del pago
   * @param file Archivo de comprobante (opcional)
   * @param registradoPor ID del usuario
   * @returns Pago registrado
   */
  async registrarPago(
    dto: RegistrarPagoDto,
    file: any | undefined,
    registradoPor: string,
  ): Promise<PagoDocument> {
    // 1. Validar factura
    const factura = await this.facturaModel.findById(dto.facturaId);

    if (!factura) {
      throw new NotFoundException(`Factura con ID ${dto.facturaId} no encontrada`);
    }

    if (factura.estado === EstadoFactura.CANCELADO) {
      throw new BadRequestException('No se puede registrar un pago a una factura cancelada');
    }

    if (factura.estado === EstadoFactura.PAGADO) {
      throw new BadRequestException('Esta factura ya está completamente pagada');
    }

    // 2. Validar monto del pago
    const montoPago = this.moneyService.roundForCurrency(dto.monto, 'USD');
    this.moneyService.validatePositive(montoPago, 'Monto del pago');

    const saldoPendiente = this.moneyService.fromDatabase(factura.saldoPendiente);

    if (montoPago > saldoPendiente) {
      throw new BadRequestException(
        `El monto del pago (${this.moneyService.formatForUser(montoPago, 'USD')}) excede el saldo pendiente (${this.moneyService.formatForUser(saldoPendiente, 'USD')})`
      );
    }

    // 3. Subir comprobante a Cloudinary (si existe)
    let comprobanteInfo: any = null;

    if (file) {
      // Validar archivo
      const config = await this.obtenerConfiguracion();
      const formatosPermitidos = config.formatosComprobantePermitidos || ['jpg', 'jpeg', 'png', 'pdf'];
      const tamanoMaximo = config.tamanoMaximoComprobante || 5 * 1024 * 1024;

      const extension = this.cloudinaryService.getFileExtension(file.originalname).toLowerCase();
      
      if (!formatosPermitidos.includes(extension)) {
        throw new BadRequestException(
          `Formato de archivo no permitido. Formatos aceptados: ${formatosPermitidos.join(', ')}`
        );
      }

      if (file.size > tamanoMaximo) {
        throw new BadRequestException(
          `El archivo excede el tamaño máximo permitido (${tamanoMaximo / (1024 * 1024)} MB)`
        );
      }

      // Subir a Cloudinary
      const modelo = await this.modeloModel.findById(factura.modeloId).lean();
      const carpeta = `cartera/comprobantes/${modelo?.nombreCompleto.replace(/\s+/g, '_') || factura.modeloId}`;

      const uploadResult = await this.cloudinaryService.uploadFromBuffer(
        file.buffer,
        file.originalname,
        {
          folder: carpeta,
          resource_type: 'auto',
          tags: ['comprobante_pago', factura.numeroFactura],
        }
      );

      if (!uploadResult.success || !uploadResult.data) {
        throw new BadRequestException('Error al subir el comprobante de pago');
      }

      // Generar URL firmada para descarga
      const downloadUrl = this.cloudinaryService.getSignedDownloadUrl(
        uploadResult.data.publicId,
        {
          resourceType: uploadResult.data.resourceType as any,
          format: uploadResult.data.format,
          filename: `comprobante_${factura.numeroFactura}.${uploadResult.data.format}`,
        }
      );

      comprobanteInfo = {
        publicId: uploadResult.data.publicId,
        url: uploadResult.data.url,
        downloadUrl,
        format: uploadResult.data.format || extension,
        size: file.size,
        fechaSubida: new Date(),
      };
    }

    // 4. Generar número de recibo
    const numeroRecibo = await this.generarNumeroRecibo();

    // 5. Crear registro de pago
    const pago = new this.pagoModel({
      numeroRecibo,
      facturaId: new Types.ObjectId(dto.facturaId),
      fechaPago: new Date(dto.fechaPago),
      moneda: 'USD', // Por defecto USD
      monto: this.moneyService.toDatabase(montoPago, 'USD'),
      metodoPago: dto.metodoPago,
      referencia: dto.referencia || null,
      comprobante: comprobanteInfo,
      observaciones: dto.observaciones || null,
      registradoPor: new Types.ObjectId(registradoPor),
      modificadoPor: null,
      meta: {},
    });

    await pago.save();

    // 6. Actualizar factura
    factura.pagos.push(pago._id);

    // Recalcular saldo pendiente
    const nuevoSaldo = this.moneyService.subtract(saldoPendiente, montoPago);
    factura.saldoPendiente = this.moneyService.toDatabase(nuevoSaldo, 'USD');

    // Actualizar estado según saldo
    if (nuevoSaldo === 0) {
      factura.estado = EstadoFactura.PAGADO;
    } else if (nuevoSaldo < this.moneyService.fromDatabase(factura.total)) {
      factura.estado = EstadoFactura.PARCIAL;
    }

    await factura.save();

    this.logger.log(
      `✅ Pago ${numeroRecibo} registrado: ${this.moneyService.formatForUser(montoPago, 'USD')} para factura ${factura.numeroFactura}. Nuevo saldo: ${this.moneyService.formatForUser(nuevoSaldo, 'USD')}`
    );

    // TODO: Enviar email de confirmación de pago

    // Retornar pago serializado con valores formateados
    return this.pagoToPlainObject(pago);
  }

  /**
   * Obtiene los pagos de una factura
   */
  async obtenerPagosPorFactura(facturaId: string): Promise<any[]> {
    const pagos = await this.pagoModel
      .find({ facturaId: new Types.ObjectId(facturaId) })
      .populate('registradoPor', 'username')
      .sort({ fechaPago: -1 })
      .exec();
    
    // Serializar pagos con valores formateados
    return pagos.map(pago => this.pagoToPlainObject(pago));
  }

  /**
   * Obtiene todos los pagos con filtros
   */
  async obtenerPagos(filtros: FiltrosPagosDto): Promise<{
    total: number;
    pagos: PagoDocument[];
    page: number;
    limit: number;
  }> {
    const query: any = {};

    // Aplicar filtros
    if (filtros.facturaId) query.facturaId = new Types.ObjectId(filtros.facturaId);
    if (filtros.metodoPago) query.metodoPago = filtros.metodoPago;

    // Si hay filtro por modelo, buscar facturas de esa modelo
    if (filtros.modeloId) {
      const facturas = await this.facturaModel
        .find({ modeloId: new Types.ObjectId(filtros.modeloId) })
        .select('_id')
        .lean();
      
      query.facturaId = { $in: facturas.map(f => f._id) };
    }

    // Filtros de fechas
    if (filtros.fechaPagoDesde || filtros.fechaPagoHasta) {
      query.fechaPago = {};
      if (filtros.fechaPagoDesde) query.fechaPago.$gte = new Date(filtros.fechaPagoDesde);
      if (filtros.fechaPagoHasta) query.fechaPago.$lte = new Date(filtros.fechaPagoHasta);
    }

    // Paginación
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const skip = (page - 1) * limit;

    // Contar total
    const total = await this.pagoModel.countDocuments(query);

    // Obtener pagos
    const pagos = await this.pagoModel
      .find(query)
      .populate('facturaId', 'numeroFactura modeloId totalFormateado')
      .populate('registradoPor', 'username')
      .sort({ fechaPago: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return { total, pagos, page, limit };
  }

  /**
   * Obtiene un pago por ID
   */
  async obtenerPagoPorId(id: string): Promise<PagoDocument> {
    const pago = await this.pagoModel
      .findById(id)
      .populate({
        path: 'facturaId',
        populate: { path: 'modeloId', select: 'nombreCompleto correoElectronico' },
      })
      .populate('registradoPor', 'username')
      .exec();

    if (!pago) {
      throw new NotFoundException(`Pago con ID ${id} no encontrado`);
    }

    return pago;
  }

  /**
   * Genera un número de recibo único
   */
  private async generarNumeroRecibo(): Promise<string> {
    const anio = new Date().getFullYear();
    const ultimoPago = await this.pagoModel
      .findOne({ numeroRecibo: new RegExp(`^REC-${anio}-`) })
      .sort({ numeroRecibo: -1 })
      .lean();

    let numero = 1;

    if (ultimoPago) {
      const match = ultimoPago.numeroRecibo.match(/REC-\d{4}-(\d+)/);
      if (match) {
        numero = parseInt(match[1], 10) + 1;
      }
    }

    return `REC-${anio}-${String(numero).padStart(4, '0')}`;
  }

  // ========== PARTE 3: ESTADO DE CUENTA ==========

  /**
   * Obtiene el estado de cuenta de una modelo
   * 
   * @param modeloId ID de la modelo
   * @param dto Filtros de fecha
   * @returns Estado de cuenta completo
   */
  async obtenerEstadoCuentaModelo(
    modeloId: string,
    dto: ObtenerEstadoCuentaDto,
  ): Promise<{
    modelo: ModeloDocument;
    periodo: { inicio: string; fin: string };
    facturas: FacturaDocument[];
    pagos: PagoDocument[];
    totales: {
      totalFacturado: string;
      totalPagado: string;
      saldoPendiente: string;
      facturasPendientes: number;
      facturasVencidas: number;
      facturasPagadas: number;
    };
  }> {
    // Validar modelo
    const modelo = await this.modeloModel.findById(modeloId).lean();
    if (!modelo) {
      throw new NotFoundException(`Modelo con ID ${modeloId} no encontrada`);
    }

    // Determinar periodo
    const fechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : new Date(0);
    const fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : new Date();

    // Obtener facturas
    const facturas = await this.facturaModel
      .find({
        modeloId: new Types.ObjectId(modeloId),
        fechaEmision: {
          $gte: fechaInicio,
          $lte: fechaFin,
        },
      })
      .populate('pagos')
      .sort({ fechaEmision: -1 })
      .exec();

    // Obtener IDs de facturas
    const facturasIds = facturas.map(f => f._id);

    // Obtener pagos
    const pagos = await this.pagoModel
      .find({
        facturaId: { $in: facturasIds },
      })
      .sort({ fechaPago: -1 })
      .exec();

    // Calcular totales
    let totalFacturado = 0;
    let totalPagado = 0;
    let saldoPendiente = 0;
    let facturasPendientes = 0;
    let facturasVencidas = 0;
    let facturasPagadas = 0;

    for (const factura of facturas) {
      const total = this.moneyService.fromDatabase(factura.total);
      const saldo = this.moneyService.fromDatabase(factura.saldoPendiente);

      totalFacturado = this.moneyService.add(totalFacturado, total);
      totalPagado = this.moneyService.add(totalPagado, this.moneyService.subtract(total, saldo));
      saldoPendiente = this.moneyService.add(saldoPendiente, saldo);

      if (factura.estado === EstadoFactura.PAGADO) {
        facturasPagadas++;
      } else if (factura.estado === EstadoFactura.VENCIDO) {
        facturasVencidas++;
      } else if (factura.estado === EstadoFactura.PENDIENTE || factura.estado === EstadoFactura.PARCIAL) {
        facturasPendientes++;
      }
    }

    return {
      modelo: modelo as any,
      periodo: {
        inicio: fechaInicio.toISOString().split('T')[0],
        fin: fechaFin.toISOString().split('T')[0],
      },
      facturas,
      pagos,
      totales: {
        totalFacturado: this.moneyService.formatForUser(totalFacturado, 'USD'),
        totalPagado: this.moneyService.formatForUser(totalPagado, 'USD'),
        saldoPendiente: this.moneyService.formatForUser(saldoPendiente, 'USD'),
        facturasPendientes,
        facturasVencidas,
        facturasPagadas,
      },
    };
  }

  // ========== PARTE 4: ALERTAS Y RECORDATORIOS ==========

  /**
   * Obtiene facturas próximas a vencer
   */
  async obtenerFacturasProximasVencer(diasAntes: number): Promise<FacturaDocument[]> {
    const hoy = new Date();
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() + diasAntes);

    return await this.facturaModel
      .find({
        estado: { $in: [EstadoFactura.PENDIENTE, EstadoFactura.PARCIAL] },
        fechaVencimiento: {
          $gte: hoy,
          $lte: fechaLimite,
        },
      })
      .populate('modeloId', 'nombreCompleto correoElectronico')
      .sort({ fechaVencimiento: 1 })
      .exec();
  }

  /**
   * Obtiene facturas vencidas y marca su estado
   */
  async obtenerFacturasVencidas(): Promise<FacturaDocument[]> {
    const hoy = new Date();

    const facturas = await this.facturaModel
      .find({
        estado: { $in: [EstadoFactura.PENDIENTE, EstadoFactura.PARCIAL] },
        fechaVencimiento: { $lt: hoy },
      })
      .populate('modeloId', 'nombreCompleto correoElectronico')
      .sort({ fechaVencimiento: 1 })
      .exec();

    // Marcar como vencidas
    for (const factura of facturas) {
      if (factura.estado !== EstadoFactura.VENCIDO) {
        factura.estado = EstadoFactura.VENCIDO;
        await factura.save();
        this.logger.log(`Factura ${factura.numeroFactura} marcada como VENCIDA`);
      }
    }

    return facturas;
  }

  /**
   * Obtiene el historial de recordatorios de una modelo
   */
  async obtenerHistorialRecordatorios(
    filtros: FiltrosRecordatoriosDto,
  ): Promise<{
    total: number;
    recordatorios: RecordatorioDocument[];
    page: number;
    limit: number;
  }> {
    const query: any = {};

    // Aplicar filtros
    if (filtros.facturaId) query.facturaId = new Types.ObjectId(filtros.facturaId);
    if (filtros.tipo) query.tipo = filtros.tipo;

    // Si hay filtro por modelo, buscar facturas de esa modelo
    if (filtros.modeloId) {
      const facturas = await this.facturaModel
        .find({ modeloId: new Types.ObjectId(filtros.modeloId) })
        .select('_id')
        .lean();
      
      query.facturaId = { $in: facturas.map(f => f._id) };
    }

    // Filtros de fechas
    if (filtros.fechaEnvioDesde || filtros.fechaEnvioHasta) {
      query.fechaEnvio = {};
      if (filtros.fechaEnvioDesde) query.fechaEnvio.$gte = new Date(filtros.fechaEnvioDesde);
      if (filtros.fechaEnvioHasta) query.fechaEnvio.$lte = new Date(filtros.fechaEnvioHasta);
    }

    // Paginación
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const skip = (page - 1) * limit;

    // Contar total
    const total = await this.recordatorioModel.countDocuments(query);

    // Obtener recordatorios
    const recordatorios = await this.recordatorioModel
      .find(query)
      .populate({
        path: 'facturaId',
        populate: { path: 'modeloId', select: 'nombreCompleto correoElectronico' },
      })
      .sort({ fechaEnvio: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return { total, recordatorios, page, limit };
  }

  /**
   * Envía un recordatorio de pago para una factura
   * 
   * @param facturaId ID de la factura
   * @param tipo Tipo de recordatorio (PROXIMO_VENCIMIENTO, VENCIDO, MORA)
   * @param enviadoPor ID del usuario que envía (opcional, para recordatorios automáticos)
   * @returns Recordatorio creado
   */
  async enviarRecordatorioPago(
    facturaId: string,
    tipo: TipoRecordatorio = TipoRecordatorio.PROXIMO_VENCIMIENTO,
    enviadoPor?: string,
  ): Promise<RecordatorioDocument> {
    // Obtener factura con modelo
    const factura = await this.facturaModel
      .findById(facturaId)
      .populate('modeloId')
      .exec();

    if (!factura) {
      throw new NotFoundException(`Factura con ID ${facturaId} no encontrada`);
    }

    const modelo = factura.modeloId as any;

    if (!modelo || !modelo.correoElectronico) {
      throw new BadRequestException('Modelo no tiene correo electrónico registrado');
    }

    // Calcular días según tipo
    let diasDiferencia = 0;
    const hoy = new Date();
    const fechaVencimiento = new Date(factura.fechaVencimiento);

    if (tipo === TipoRecordatorio.PROXIMO_VENCIMIENTO) {
      diasDiferencia = Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    } else if (tipo === TipoRecordatorio.VENCIDO || tipo === TipoRecordatorio.MORA) {
      diasDiferencia = Math.ceil((hoy.getTime() - fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Enviar email según tipo
    let result: { success: boolean; messageId?: string; error?: string; token?: string };
    let asunto = '';
    let contenidoHTML = '';

    try {
      switch (tipo) {
        case TipoRecordatorio.PROXIMO_VENCIMIENTO:
          result = await this.emailService.enviarRecordatorioProximoVencimiento(
            factura,
            modelo,
            diasDiferencia,
          );
          asunto = `Recordatorio: Factura ${factura.numeroFactura} vence en ${diasDiferencia} día(s)`;
          break;

        case TipoRecordatorio.VENCIDO:
          result = await this.emailService.enviarAlertaFacturaVencida(factura, modelo, diasDiferencia);
          asunto = `URGENTE: Factura ${factura.numeroFactura} vencida hace ${diasDiferencia} día(s)`;
          break;

        case TipoRecordatorio.MORA:
          result = await this.emailService.enviarAlertaMora(factura, modelo, diasDiferencia);
          asunto = `CUENTA EN MORA: Factura ${factura.numeroFactura} - ${diasDiferencia} días de atraso`;
          break;

        default:
          throw new BadRequestException(`Tipo de recordatorio inválido: ${tipo}`);
      }

      // Generar contenido HTML básico para el recordatorio (resumen)
      contenidoHTML = `<p>Recordatorio de tipo ${tipo} para factura ${factura.numeroFactura}</p>`;
      
      // Crear registro de recordatorio con token en metadata
      const recordatorio = new this.recordatorioModel({
        facturaId: new Types.ObjectId(facturaId),
        tipo,
        fechaEnvio: new Date(),
        emailDestino: modelo.correoElectronico, // Campo correcto según schema
        asunto,
        contenidoHTML, // No puede estar vacío según schema
        estado: result.success ? EstadoRecordatorio.ENVIADO : EstadoRecordatorio.ERROR,
        errorMensaje: result.error || null, // Campo correcto según schema
        enviadoPor: enviadoPor ? new Types.ObjectId(enviadoPor) : 'SISTEMA',
        meta: {
          tokenAcceso: result.token || null, // Guardar token para auditoría
          messageId: result.messageId || null,
          modeloId: modelo._id.toString(),
          facturaNumero: factura.numeroFactura,
        },
      });

      await recordatorio.save();

      if (result.success) {
        this.logger.log(
          `✅ Recordatorio ${tipo} enviado para factura ${factura.numeroFactura} a ${modelo.correoElectronico}`,
        );
      } else {
        this.logger.error(
          `❌ Error enviando recordatorio ${tipo} para factura ${factura.numeroFactura}: ${result.error}`,
        );
      }

      return recordatorio;
    } catch (error: any) {
      this.logger.error(`Error en enviarRecordatorioPago: ${error.message}`, error.stack);
      
      // Registrar error en recordatorio
      const recordatorio = new this.recordatorioModel({
        facturaId: new Types.ObjectId(facturaId),
        tipo,
        fechaEnvio: new Date(),
        emailDestino: modelo.correoElectronico, // Campo correcto según schema
        asunto: `Error enviando recordatorio ${tipo}`,
        contenidoHTML: `<p>Error al enviar: ${error.message}</p>`, // No puede estar vacío
        estado: EstadoRecordatorio.ERROR,
        errorMensaje: error.message, // Campo correcto según schema
        enviadoPor: enviadoPor ? new Types.ObjectId(enviadoPor) : 'SISTEMA',
      });

      await recordatorio.save();
      throw error;
    }
  }

  /**
   * Procesa alertas automáticas para facturas próximas a vencer y vencidas
   * 
   * Este método debe ser ejecutado por un cron job diariamente.
   * 
   * Flujo:
   * 1. Obtiene configuración de alertas
   * 2. Busca facturas próximas a vencer según diasAntesAlerta1 y diasAntesAlerta2
   * 3. Busca facturas vencidas
   * 4. Busca facturas en mora según diasDespuesAlertaMora
   * 5. Evita enviar duplicados (verifica último recordatorio)
   * 6. Envía emails y registra recordatorios
   * 
   * @returns Resumen de recordatorios enviados
   */
  async procesarAlertasAutomaticas(): Promise<{
    proximosVencimiento: number;
    vencidos: number;
    mora: number;
    errores: number;
    total: number;
  }> {
    this.logger.log('🔄 Iniciando procesamiento de alertas automáticas...');

    const config = await this.obtenerConfiguracion();

    if (!config.recordatoriosAutomaticosActivos) {
      this.logger.log('⏸️  Recordatorios automáticos desactivados en configuración');
      return { proximosVencimiento: 0, vencidos: 0, mora: 0, errores: 0, total: 0 };
    }

    let proximosVencimiento = 0;
    let vencidos = 0;
    let mora = 0;
    let errores = 0;

    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // 1. Alertas de próximo vencimiento (diasAntesAlerta1 y diasAntesAlerta2)
      for (const diasAntes of [config.diasAntesAlerta1, config.diasAntesAlerta2]) {
        const fechaAlerta = new Date(hoy);
        fechaAlerta.setDate(fechaAlerta.getDate() + diasAntes);

        const facturasProximas = await this.facturaModel
          .find({
            estado: { $in: [EstadoFactura.PENDIENTE, EstadoFactura.PARCIAL] },
            fechaVencimiento: {
              $gte: fechaAlerta,
              $lt: new Date(fechaAlerta.getTime() + 24 * 60 * 60 * 1000), // Mismo día
            },
          })
          .populate('modeloId')
          .exec();

        for (const factura of facturasProximas) {
          try {
            // Verificar si ya se envió recordatorio hoy
            const recordatorioHoy = await this.recordatorioModel.findOne({
              facturaId: factura._id,
              tipo: TipoRecordatorio.PROXIMO_VENCIMIENTO,
              fechaEnvio: { $gte: hoy },
            });

            if (recordatorioHoy) {
              this.logger.log(
                `⏭️  Recordatorio ya enviado hoy para factura ${factura.numeroFactura}`,
              );
              continue;
            }

            await this.enviarRecordatorioPago(
              factura._id.toString(),
              TipoRecordatorio.PROXIMO_VENCIMIENTO,
            );
            proximosVencimiento++;
          } catch (error: any) {
            this.logger.error(
              `Error enviando recordatorio próximo vencimiento: ${error.message}`,
            );
            errores++;
          }
        }
      }

      // 2. Alertas de facturas vencidas (1 día después)
      const ayerMidnight = new Date(hoy);
      ayerMidnight.setDate(ayerMidnight.getDate() - 1);

      const facturasVencidas = await this.facturaModel
        .find({
          estado: { $in: [EstadoFactura.PENDIENTE, EstadoFactura.PARCIAL] },
          fechaVencimiento: {
            $gte: ayerMidnight,
            $lt: hoy,
          },
        })
        .populate('modeloId')
        .exec();

      for (const factura of facturasVencidas) {
        try {
          // Marcar como vencida si aún no lo está
          if (factura.estado !== EstadoFactura.VENCIDO) {
            factura.estado = EstadoFactura.VENCIDO;
            await factura.save();
          }

          // Verificar si ya se envió recordatorio de vencida
          const recordatorioVencido = await this.recordatorioModel.findOne({
            facturaId: factura._id,
            tipo: TipoRecordatorio.VENCIDO,
            estado: EstadoRecordatorio.ENVIADO,
          });

          if (recordatorioVencido) {
            this.logger.log(`⏭️  Ya se envió alerta de vencida para factura ${factura.numeroFactura}`);
            continue;
          }

          await this.enviarRecordatorioPago(factura._id.toString(), TipoRecordatorio.VENCIDO);
          vencidos++;
        } catch (error: any) {
          this.logger.error(`Error enviando alerta vencida: ${error.message}`);
          errores++;
        }
      }

      // 3. Alertas de mora (según diasDespuesAlertaMora)
      if (config.diasDespuesAlertaMora > 0) {
        const fechaMora = new Date(hoy);
        fechaMora.setDate(fechaMora.getDate() - config.diasDespuesAlertaMora);

        const facturasMora = await this.facturaModel
          .find({
            estado: { $in: [EstadoFactura.VENCIDO, EstadoFactura.PARCIAL] },
            fechaVencimiento: { $lte: fechaMora },
          })
          .populate('modeloId')
          .exec();

        for (const factura of facturasMora) {
          try {
            // Verificar última alerta de mora (no enviar más de 1 por semana)
            const ultimaAlertaMora = await this.recordatorioModel
              .findOne({
                facturaId: factura._id,
                tipo: TipoRecordatorio.MORA,
                estado: EstadoRecordatorio.ENVIADO,
              })
              .sort({ fechaEnvio: -1 });

            if (ultimaAlertaMora) {
              const diasDesdeUltimaAlerta = Math.ceil(
                (hoy.getTime() - ultimaAlertaMora.fechaEnvio.getTime()) / (1000 * 60 * 60 * 24),
              );

              if (diasDesdeUltimaAlerta < 7) {
                this.logger.log(
                  `⏭️  Alerta de mora enviada hace ${diasDesdeUltimaAlerta} días para factura ${factura.numeroFactura}`,
                );
                continue;
              }
            }

            await this.enviarRecordatorioPago(factura._id.toString(), TipoRecordatorio.MORA);
            mora++;
          } catch (error: any) {
            this.logger.error(`Error enviando alerta mora: ${error.message}`);
            errores++;
          }
        }
      }

      const total = proximosVencimiento + vencidos + mora;

      this.logger.log(
        `✅ Procesamiento de alertas completado: ${total} recordatorios enviados (${proximosVencimiento} próximos, ${vencidos} vencidos, ${mora} mora, ${errores} errores)`,
      );

      return { proximosVencimiento, vencidos, mora, errores, total };
    } catch (error: any) {
      this.logger.error(`Error en procesarAlertasAutomaticas: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Exporta el estado de cuenta de una modelo en formato PDF
   * 
   * @param modeloId ID de la modelo
   * @param dto Filtros de periodo
   * @returns Buffer del PDF generado
   */
  async exportarEstadoCuentaPDF(modeloId: string, dto: ObtenerEstadoCuentaDto): Promise<Buffer> {
    try {
      // Obtener estado de cuenta con datos completos
      const estadoCuenta = await this.obtenerEstadoCuentaModelo(modeloId, dto);

      // Preparar datos para el PDF con conversión correcta de BigInt
      const pdfData = {
        modelo: {
          nombreCompleto: estadoCuenta.modelo.nombreCompleto,
          numeroIdentificacion: estadoCuenta.modelo.numeroIdentificacion,
          correoElectronico: estadoCuenta.modelo.correoElectronico,
          telefono: estadoCuenta.modelo.telefono,
        },
        facturas: estadoCuenta.facturas.map((f: any) => {
          // Convertir BigInt escalado a número decimal usando MoneyService
          const montoTotal = this.moneyService.fromDatabase(f.total);
          const saldoPendiente = this.moneyService.fromDatabase(f.saldoPendiente);
          const montoPagado = this.moneyService.subtract(montoTotal, saldoPendiente);

          // Calcular días vencido si está vencida
          let diasVencido = 0;
          if (f.estado === EstadoFactura.VENCIDO) {
            const hoy = new Date();
            const fechaVenc = new Date(f.fechaVencimiento);
            diasVencido = Math.floor((hoy.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
          }

          return {
            numeroFactura: f.numeroFactura,
            fechaEmision: f.fechaEmision,
            fechaVencimiento: f.fechaVencimiento,
            concepto: f.items?.[0]?.concepto || 'Comisión del periodo',
            moneda: f.moneda || 'USD', // Incluir moneda de la factura
            montoTotal,
            montoPagado,
            saldoPendiente,
            estado: f.estado,
            diasVencido: diasVencido > 0 ? diasVencido : undefined,
          };
        }),
        pagos: estadoCuenta.pagos.map((p: any) => {
          // Convertir BigInt escalado a número decimal
          const montoPagado = this.moneyService.fromDatabase(p.monto);

          return {
            numeroRecibo: p.numeroRecibo,
            fechaPago: p.fechaPago,
            moneda: p.moneda || 'USD', // Incluir moneda del pago
            montoPagado,
            facturaNumero: p.facturaId?.numeroFactura || 'N/A',
            metodoPago: p.metodoPago,
            referencia: p.referencia || undefined,
            comprobanteUrl: p.comprobante?.url || undefined,
          };
        }),
        totales: {
          moneda: 'USD' as 'USD' | 'COP', // Moneda principal del estado de cuenta
          // Remover el símbolo $ y convertir a número
          totalFacturado: parseFloat(estadoCuenta.totales.totalFacturado.replace(/[^0-9.-]/g, '')),
          totalPagado: parseFloat(estadoCuenta.totales.totalPagado.replace(/[^0-9.-]/g, '')),
          saldoPendiente: parseFloat(estadoCuenta.totales.saldoPendiente.replace(/[^0-9.-]/g, '')),
          facturasVencidas: estadoCuenta.totales.facturasVencidas,
          montoVencido: 0, // Calcular suma de saldos de facturas vencidas
        },
        periodo: {
          desde: estadoCuenta.periodo.inicio,
          hasta: estadoCuenta.periodo.fin,
        },
      };

      // Calcular monto vencido sumando saldos de facturas vencidas
      pdfData.totales.montoVencido = pdfData.facturas
        .filter((f: any) => f.estado === EstadoFactura.VENCIDO)
        .reduce((sum: number, f: any) => sum + f.saldoPendiente, 0);

      // Generar PDF
      const pdfBuffer = await this.pdfService.generateEstadoCuentaPdf(pdfData);

      this.logger.log(`✅ PDF de estado de cuenta generado para modelo ${modeloId}`);

      return pdfBuffer;
    } catch (error: any) {
      this.logger.error(`❌ Error exportando estado de cuenta a PDF: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Convierte una factura de Mongoose Document a objeto plano serializable
   * Convierte BigInt a string para evitar errores de JSON.stringify
   */
  /**
   * Convierte una factura a objeto plano con valores BigInt serializados
   * y valores formateados usando MoneyService
   */
  private facturaToPlainObject(factura: FacturaDocument | any): any {
    // Si ya es un objeto plano, usarlo directamente
    const plain = typeof factura.toObject === 'function' ? factura.toObject() : factura;
    const moneda = plain.moneda || 'USD';
    
    // Convertir BigInt a string y añadir versiones formateadas en items
    if (plain.items) {
      plain.items = plain.items.map((item: any) => {
        const valorUnitarioNum = this.moneyService.fromDatabase(item.valorUnitario);
        const subtotalNum = this.moneyService.fromDatabase(item.subtotal);
        
        return {
          ...item,
          // Valores raw (BigInt como string)
          valorUnitario: item.valorUnitario?.toString() || '0',
          subtotal: item.subtotal?.toString() || '0',
          // Valores formateados dinámicamente
          valorUnitarioFormateado: this.moneyService.formatForUser(valorUnitarioNum, moneda),
          subtotalFormateado: this.moneyService.formatForUser(subtotalNum, moneda),
        };
      });
    }

    // Convertir BigInt a números para formatear
    const subtotalNum = this.moneyService.fromDatabase(plain.subtotal);
    const descuentoNum = this.moneyService.fromDatabase(plain.descuento);
    const totalNum = this.moneyService.fromDatabase(plain.total);
    const saldoPendienteNum = this.moneyService.fromDatabase(plain.saldoPendiente);
    const pagadoNum = this.moneyService.subtract(totalNum, saldoPendienteNum);

    // Retornar objeto con valores raw y formateados
    return {
      ...plain,
      // Valores raw (BigInt como string) - para cálculos en frontend si es necesario
      subtotal: plain.subtotal?.toString() || '0',
      descuento: plain.descuento?.toString() || '0',
      total: plain.total?.toString() || '0',
      saldoPendiente: plain.saldoPendiente?.toString() || '0',
      
      // Valores formateados dinámicamente - para mostrar directamente
      subtotalFormateado: this.moneyService.formatForUser(subtotalNum, moneda),
      descuentoFormateado: this.moneyService.formatForUser(descuentoNum, moneda),
      totalFormateado: this.moneyService.formatForUser(totalNum, moneda),
      saldoPendienteFormateado: this.moneyService.formatForUser(saldoPendienteNum, moneda),
      montoPagadoFormateado: this.moneyService.formatForUser(pagadoNum, moneda),
    };
  }

  /**
   * Convierte un pago a objeto plano con valores BigInt serializados
   * y valores formateados usando MoneyService
   */
  private pagoToPlainObject(pago: PagoDocument | any): any {
    // Si ya es un objeto plano, usarlo directamente
    const plain = typeof pago.toObject === 'function' ? pago.toObject() : pago;
    const moneda = plain.moneda || 'USD';
    
    // Convertir BigInt a número para formatear
    const montoNum = this.moneyService.fromDatabase(plain.monto);
    
    // Retornar objeto con valores raw y formateados
    return {
      ...plain,
      // Valor raw (BigInt como string)
      monto: plain.monto?.toString() || '0',
      // Valor formateado dinámicamente
      montoFormateado: this.moneyService.formatForUser(montoNum, moneda),
    };
  }
}


