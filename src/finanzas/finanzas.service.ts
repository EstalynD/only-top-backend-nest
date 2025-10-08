import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FinanzasModeloEntity, FinanzasModeloDocument } from './finanzas-modelo.schema.js';
import { PeriodoConsolidadoEntity, PeriodoConsolidadoDocument } from './periodo-consolidado.schema.js';
import { BankOnlyTopEntity, BankOnlyTopDocument } from './bank-onlytop.schema.js';
import { ChatterSaleEntity, ChatterSaleDocument } from '../chatter/chatter-sale.schema.js';
import { ModeloEntity, ModeloDocument } from '../rrhh/modelo.schema.js';
import { ContratoModeloEntity, ContratoModeloDocument, TipoComision } from '../rrhh/contrato-modelo.schema.js';
import { CommissionScaleEntity, CommissionScaleDocument } from '../sistema/commission-scale.schema.js';
import { MoneyService } from '../money/money.service.js';
import { BankOnlyTopService } from './bank-onlytop.service.js';
import { OrigenTransaccion } from './transaccion-movimiento.schema.js';
import { CurrencyCode } from '../money/money.types.js';
import {
  CalcularFinanzasDto,
  RecalcularFinanzasDto,
  ActualizarEstadoFinanzasDto,
  ActualizarComisionBancoDto,
  FiltrarFinanzasDto,
  ObtenerResumenDto,
  FinanzasFormateadaDto,
  ModeloConGananciasDto,
  EstadisticasFinanzasDto,
} from './dto/finanzas.dto.js';

/**
 * FinanzasService - Servicio profesional de cálculo financiero
 * 
 * Integra:
 * - ChatterSales: Ventas registradas de las modelos
 * - ContratoModelo: % de comisión de la agencia
 * - MoneyService: Cálculos precisos con BigInt
 * 
 * Funcionalidad:
 * - Calcular ganancias mensuales automáticamente
 * - Recalcular cuando se registran nuevas ventas
 * - Generar reportes financieros
 * - Estadísticas por modelo y generales
 */
@Injectable()
export class FinanzasService {
  private readonly logger = new Logger(FinanzasService.name);
  private readonly DEFAULT_COMISION_BANCO = 2; // 2% por defecto

  constructor(
    @InjectModel(FinanzasModeloEntity.name)
    private finanzasModel: Model<FinanzasModeloDocument>,
    @InjectModel(PeriodoConsolidadoEntity.name)
    private periodoConsolidadoModel: Model<PeriodoConsolidadoDocument>,
    @InjectModel(BankOnlyTopEntity.name)
    private bankOnlyTopModel: Model<BankOnlyTopDocument>,
    @InjectModel(ChatterSaleEntity.name)
    private chatterSaleModel: Model<ChatterSaleDocument>,
    @InjectModel(ModeloEntity.name)
    private modeloModel: Model<ModeloDocument>,
    @InjectModel(ContratoModeloEntity.name)
    private contratoModel: Model<ContratoModeloDocument>,
    @InjectModel(CommissionScaleEntity.name)
    private commissionScaleModel: Model<CommissionScaleDocument>,
    private readonly moneyService: MoneyService,
    private readonly bankService: BankOnlyTopService,
  ) {
    // Ya no necesitamos inicializar bank_onlytop aquí, BankOnlyTopService lo hace
  }

  // ========== CÁLCULO DE FINANZAS ==========

  /**
   * Calcula las finanzas de una modelo para un mes/año específico
   * @param dto Datos del cálculo
   * @param userId Usuario que realiza el cálculo
   * @returns Finanzas calculadas y formateadas
   */
  async calcularFinanzas(
    dto: CalcularFinanzasDto,
    userId?: string,
  ): Promise<FinanzasFormateadaDto> {
    this.logger.log(
      `Calculando finanzas para modelo ${dto.modeloId} - ${dto.mes}/${dto.anio}`,
    );

    // Validar que la modelo existe
    const modelo = await this.modeloModel.findById(dto.modeloId).exec();
    if (!modelo) {
      throw new NotFoundException('Modelo no encontrada');
    }

    // Obtener contrato activo de la modelo
    const contrato = await this.obtenerContratoActivo(dto.modeloId);
    if (!contrato) {
      throw new BadRequestException(
        'La modelo no tiene un contrato activo con porcentaje de comisión definido',
      );
    }

    // Obtener todas las ventas del mes
    const ventas = await this.obtenerVentasDelMes(
      dto.modeloId,
      dto.mes,
      dto.anio,
    );

    // Calcular ventas netas totales (suma de todos los montos)
    const ventasNetasUSD = ventas.reduce(
      (total, venta) => this.moneyService.add(total, venta.monto),
      0,
    );

    this.logger.log(
      `Ventas netas: ${this.moneyService.formatForUser(ventasNetasUSD, CurrencyCode.USD)}`,
    );

    // Obtener porcentaje de comisión de la agencia desde el contrato
    // Para comisión escalonada, se calcula según el monto de ventas
    const porcentajeComisionAgencia = await this.obtenerPorcentajeComision(contrato, ventasNetasUSD);

    // Calcular comisión de la agencia
    const comisionAgenciaUSD = this.moneyService.multiply(
      ventasNetasUSD,
      porcentajeComisionAgencia / 100,
    );

    // Calcular ganancia de la modelo (ventas - comisionAgencia)
    const gananciaModeloUSD = this.moneyService.subtract(
      ventasNetasUSD,
      comisionAgenciaUSD,
    );

    // Obtener porcentaje de comisión bancaria
    const porcentajeComisionBanco =
      dto.porcentajeComisionBanco ?? this.DEFAULT_COMISION_BANCO;

    // Calcular comisión bancaria SOLO sobre la comisión de agencia (Ganancia OT)
    const comisionBancoUSD = this.moneyService.multiply(
      comisionAgenciaUSD,
      porcentajeComisionBanco / 100,
    );

    // Calcular ganancia de OnlyTop (comisionAgencia - comisionBanco)
    const gananciaOnlyTopUSD = this.moneyService.subtract(
      comisionAgenciaUSD,
      comisionBancoUSD,
    );

    // Buscar si ya existe un registro para este período
    const existente = await this.finanzasModel
      .findOne({
        modeloId: new Types.ObjectId(dto.modeloId),
        mes: dto.mes,
        anio: dto.anio,
      })
      .exec();

    const finanzasData = {
      modeloId: new Types.ObjectId(dto.modeloId),
      mes: dto.mes,
      anio: dto.anio,
      ventasNetasUSD: this.moneyService.toDatabase(ventasNetasUSD, CurrencyCode.USD),
      porcentajeComisionAgencia,
      comisionAgenciaUSD: this.moneyService.toDatabase(comisionAgenciaUSD, CurrencyCode.USD),
      porcentajeComisionBanco,
      comisionBancoUSD: this.moneyService.toDatabase(comisionBancoUSD, CurrencyCode.USD),
      gananciaModeloUSD: this.moneyService.toDatabase(gananciaModeloUSD, CurrencyCode.USD),
      gananciaOnlyTopUSD: this.moneyService.toDatabase(gananciaOnlyTopUSD, CurrencyCode.USD),
      cantidadVentas: ventas.length,
      contratoId: contrato._id,
      estado: 'CALCULADO',
      fechaUltimoCalculo: new Date(),
      calculadoPor: userId ? new Types.ObjectId(userId) : null,
      meta: {
        desglosePorTipoVenta: this.calcularDesglosePorTipoVenta(ventas),
        promedioVentaDiaria: this.moneyService.divide(ventasNetasUSD, this.getDiasDelMes(dto.mes, dto.anio)),
        diasActivos: this.calcularDiasActivos(ventas),
      },
    };

    let finanzas: FinanzasModeloDocument;

    if (existente) {
      // Actualizar existente
      Object.assign(existente, finanzasData);
      finanzas = await existente.save();
      this.logger.log(`Finanzas actualizadas para ${modelo.nombreCompleto}`);
    } else {
      // Crear nuevo registro
      finanzas = new this.finanzasModel(finanzasData);
      await finanzas.save();
      this.logger.log(`Finanzas creadas para ${modelo.nombreCompleto}`);
    }

    // Registrar transacción INGRESO por la ganancia de OnlyTop
    const periodo = `${dto.anio}-${String(dto.mes).padStart(2, '0')}`;
    await this.bankService.aplicarMovimiento({
      tipo: 'INGRESO',
      montoUSD: this.moneyService.toDatabase(gananciaOnlyTopUSD, CurrencyCode.USD),
      motivo: `Ganancia OnlyTop - ${modelo.nombreCompleto} - ${periodo}`,
      origen: OrigenTransaccion.GANANCIA_MODELO,
      referencia: finanzas._id.toString(),
      referenciaModelo: 'FinanzasModelo',
      modeloId: dto.modeloId,
      userId,
      meta: {
        ventasNetas: ventasNetasUSD,
        comisionAgencia: comisionAgenciaUSD,
        comisionBanco: comisionBancoUSD,
        porcentajeComision: porcentajeComisionAgencia,
      },
    });

    return this.formatearFinanzas(finanzas, modelo);
  }

  /**
   * Recalcula finanzas para múltiples modelos en un período
   * Al finalizar, inicializa/actualiza el bank_onlytop con el dinero en movimiento
   */
  async recalcularFinanzas(
    dto: RecalcularFinanzasDto,
    userId?: string,
  ): Promise<{ procesadas: number; exitosas: number; errores: string[] }> {
    this.logger.log(`Recalculando finanzas para ${dto.mes}/${dto.anio}`);

    const modeloIds = dto.modeloIds?.length
      ? dto.modeloIds
      : await this.obtenerModelosActivas();

    const resultados = {
      procesadas: 0,
      exitosas: 0,
      errores: [] as string[],
    };

    for (const modeloId of modeloIds) {
      resultados.procesadas++;
      try {
        await this.calcularFinanzas(
          {
            modeloId,
            mes: dto.mes,
            anio: dto.anio,
            porcentajeComisionBanco: dto.porcentajeComisionBanco,
          },
          userId,
        );
        resultados.exitosas++;
      } catch (error: any) {
        this.logger.error(
          `Error al calcular finanzas para modelo ${modeloId}: ${error.message}`,
        );
        resultados.errores.push(`${modeloId}: ${error.message}`);
      }
    }

    this.logger.log(
      `Recálculo completado: ${resultados.exitosas}/${resultados.procesadas} exitosas`,
    );

    // Las transacciones ya fueron registradas por cada calcularFinanzas()
    // BankOnlyTopService mantiene el dinero en movimiento sincronizado

    return resultados;
  }

  // ========== CONSULTAS ==========

  /**
   * Obtiene finanzas de una modelo para un período específico
   */
  async obtenerFinanzasPorPeriodo(
    modeloId: string,
    mes: number,
    anio: number,
  ): Promise<FinanzasFormateadaDto> {
    const finanzas = await this.finanzasModel
      .findOne({
        modeloId: new Types.ObjectId(modeloId),
        mes,
        anio,
      })
      .populate('modeloId', 'nombreCompleto usuarioOnlyFans fotoPerfil estado')
      .exec();

    if (!finanzas) {
      throw new NotFoundException(
        `No se encontraron finanzas para el período ${mes}/${anio}`,
      );
    }

    const modelo = await this.modeloModel.findById(modeloId).exec();
    if (!modelo) {
      throw new NotFoundException('Modelo no encontrada');
    }

    return this.formatearFinanzas(finanzas, modelo);
  }

  /**
   * Obtiene lista de todas las modelos con sus ganancias del mes actual
   */
  async obtenerModelosConGanancias(
    mes?: number,
    anio?: number,
  ): Promise<ModeloConGananciasDto[]> {
    const ahora = new Date();
    const mesActual = mes ?? ahora.getMonth() + 1;
    const anioActual = anio ?? ahora.getFullYear();

    this.logger.log(`Obteniendo modelos con ganancias para ${mesActual}/${anioActual}`);

    // Obtener todas las modelos activas
    const modelos = await this.modeloModel
      .find({ estado: 'ACTIVA' })
      .select('nombreCompleto usuarioOnlyFans fotoPerfil estado email')
      .lean()
      .exec();

    const resultado: ModeloConGananciasDto[] = [];

    for (const modelo of modelos) {
      // Obtener finanzas del mes actual
      const finanzasMes = await this.finanzasModel
        .findOne({
          modeloId: modelo._id,
          mes: mesActual,
          anio: anioActual,
        })
        .exec();

      // Calcular totales históricos
      const totalesHistoricos = await this.finanzasModel
        .aggregate([
          {
            $match: { modeloId: modelo._id },
          },
          {
            $group: {
              _id: null,
              totalVentas: { $sum: { $toLong: '$ventasNetasUSD' } },
              totalGananciaOnlyTop: { $sum: { $toLong: '$gananciaOnlyTopUSD' } },
              meses: { $sum: 1 },
            },
          },
        ])
        .exec();

      const historico = totalesHistoricos[0] || {
        totalVentas: 0,
        totalGananciaOnlyTop: 0,
        meses: 0,
      };

      resultado.push({
        modeloId: modelo._id.toString(),
        nombreCompleto: modelo.nombreCompleto,
        email: (modelo as any).email || '',
        usuarioOnlyFans: (modelo as any).usuarioOnlyFans || undefined,
        fotoPerfil: modelo.fotoPerfil || undefined,
        estado: modelo.estado,
        tieneFinanzas: finanzasMes !== null,
        mesActual: mesActual,
        anioActual: anioActual,
        // Alias para compatibilidad con frontend
        finanzas: finanzasMes
          ? {
              _id: finanzasMes._id.toString(),
              modeloId: modelo._id.toString(),
              mes: finanzasMes.mes,
              anio: finanzasMes.anio,
              ventasNetas: this.moneyService.formatForUser(
                this.moneyService.fromDatabase(finanzasMes.ventasNetasUSD),
                CurrencyCode.USD,
              ),
              comisionAgencia: this.moneyService.formatForUser(
                this.moneyService.fromDatabase(finanzasMes.comisionAgenciaUSD),
                CurrencyCode.USD,
              ),
              comisionBanco: this.moneyService.formatForUser(
                this.moneyService.fromDatabase(finanzasMes.comisionBancoUSD),
                CurrencyCode.USD,
              ),
              gananciaModelo: this.moneyService.formatForUser(
                this.moneyService.fromDatabase(finanzasMes.gananciaModeloUSD),
                CurrencyCode.USD,
              ),
              gananciaOnlyTop: this.moneyService.formatForUser(
                this.moneyService.fromDatabase(finanzasMes.gananciaOnlyTopUSD),
                CurrencyCode.USD,
              ),
              porcentajeComisionAgencia: finanzasMes.porcentajeComisionAgencia,
              porcentajeComisionBanco: finanzasMes.porcentajeComisionBanco,
              estado: finanzasMes.estado,
              fechaCalculo: finanzasMes.fechaUltimoCalculo?.toISOString() || '',
              calculadoPor: finanzasMes.calculadoPor?.toString() || '',
              notas: finanzasMes.notasInternas || undefined,
              meta: finanzasMes.meta,
            }
          : undefined,
        finanzasMesActual: finanzasMes
          ? {
              mes: finanzasMes.mes,
              anio: finanzasMes.anio,
              ventasNetasUSD: this.moneyService.fromDatabase(finanzasMes.ventasNetasUSD),
              gananciaModeloUSD: this.moneyService.fromDatabase(finanzasMes.gananciaModeloUSD),
              gananciaOnlyTopUSD: this.moneyService.fromDatabase(finanzasMes.gananciaOnlyTopUSD),
              cantidadVentas: finanzasMes.cantidadVentas,
              estado: finanzasMes.estado,
              ventasNetasFormateado: this.moneyService.formatForUser(
                this.moneyService.fromDatabase(finanzasMes.ventasNetasUSD),
                CurrencyCode.USD,
              ),
              gananciaModeloFormateado: this.moneyService.formatForUser(
                this.moneyService.fromDatabase(finanzasMes.gananciaModeloUSD),
                CurrencyCode.USD,
              ),
              gananciaOnlyTopFormateado: this.moneyService.formatForUser(
                this.moneyService.fromDatabase(finanzasMes.gananciaOnlyTopUSD),
                CurrencyCode.USD,
              ),
            }
          : null,
        totalHistoricoVentasUSD: this.moneyService.fromDatabase(historico.totalVentas),
        totalHistoricoGananciaOnlyTopUSD: this.moneyService.fromDatabase(
          historico.totalGananciaOnlyTop,
        ),
        mesesConVentas: historico.meses,
      });
    }

    // Ordenar por ganancias del mes actual (descendente)
    resultado.sort((a, b) => {
      const gananciaA = a.finanzasMesActual?.gananciaOnlyTopUSD || 0;
      const gananciaB = b.finanzasMesActual?.gananciaOnlyTopUSD || 0;
      return gananciaB - gananciaA;
    });

    return resultado;
  }

  /**
   * Obtiene estadísticas generales de finanzas
   */
  async obtenerEstadisticas(
    mes?: number,
    anio?: number,
  ): Promise<EstadisticasFinanzasDto> {
    const ahora = new Date();
    const mesActual = mes ?? ahora.getMonth() + 1;
    const anioActual = anio ?? ahora.getFullYear();

    const finanzas = await this.finanzasModel
      .find({ mes: mesActual, anio: anioActual })
      .populate('modeloId', 'nombreCompleto')
      .exec();

    // Calcular totales
    let totalVentas = 0;
    let totalGananciaOnlyTop = 0;
    let totalComisionesBanco = 0;
    let totalGananciaModelos = 0;
    let totalCantidadVentas = 0;

    const porEstado: Record<string, number> = {};

    finanzas.forEach((f) => {
      totalVentas = this.moneyService.add(
        totalVentas,
        this.moneyService.fromDatabase(f.ventasNetasUSD),
      );
      totalGananciaOnlyTop = this.moneyService.add(
        totalGananciaOnlyTop,
        this.moneyService.fromDatabase(f.gananciaOnlyTopUSD),
      );
      totalComisionesBanco = this.moneyService.add(
        totalComisionesBanco,
        this.moneyService.fromDatabase(f.comisionBancoUSD),
      );
      totalGananciaModelos = this.moneyService.add(
        totalGananciaModelos,
        this.moneyService.fromDatabase(f.gananciaModeloUSD),
      );
      totalCantidadVentas += f.cantidadVentas;

      porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;
    });

    const modelosActivas = finanzas.length;

    // Top 10 modelos por ventas
    const topModelos = finanzas
      .map((f) => {
        const modeloData = f.modeloId as any;
        return {
          modeloId: typeof f.modeloId === 'object' ? f.modeloId.toString() : f.modeloId,
          nombreModelo: modeloData?.nombreCompleto || 'Desconocido',
          ventasNetasUSD: this.moneyService.fromDatabase(f.ventasNetasUSD),
          gananciaOnlyTopUSD: this.moneyService.fromDatabase(f.gananciaOnlyTopUSD),
          porcentajeComisionAgencia: f.porcentajeComisionAgencia,
          ventasNetasFormateado: this.moneyService.formatForUser(
            this.moneyService.fromDatabase(f.ventasNetasUSD),
            CurrencyCode.USD,
          ),
          gananciaOnlyTopFormateado: this.moneyService.formatForUser(
            this.moneyService.fromDatabase(f.gananciaOnlyTopUSD),
            CurrencyCode.USD,
          ),
        };
      })
      .sort((a, b) => b.ventasNetasUSD - a.ventasNetasUSD)
      .slice(0, 10);

    return {
      periodo: { mes: mesActual, anio: anioActual },
      totales: {
        ventasNetasUSD: totalVentas,
        gananciaOnlyTopUSD: totalGananciaOnlyTop,
        comisionesBancoUSD: totalComisionesBanco,
        gananciaModelosUSD: totalGananciaModelos,
        ventasNetasFormateado: this.moneyService.formatForUser(totalVentas, CurrencyCode.USD),
        gananciaOnlyTopFormateado: this.moneyService.formatForUser(
          totalGananciaOnlyTop,
          CurrencyCode.USD,
        ),
        comisionesBancoFormateado: this.moneyService.formatForUser(
          totalComisionesBanco,
          CurrencyCode.USD,
        ),
        gananciaModelosFormateado: this.moneyService.formatForUser(
          totalGananciaModelos,
          CurrencyCode.USD,
        ),
      },
      promedios: {
        ventasPorModelo: modelosActivas > 0 ? totalVentas / modelosActivas : 0,
        gananciaOnlyTopPorModelo:
          modelosActivas > 0 ? totalGananciaOnlyTop / modelosActivas : 0,
      },
      modelosActivas,
      totalVentas: totalCantidadVentas,
      topModelos,
      porEstado,
    };
  }

  /**
   * Actualiza el estado de un registro de finanzas
   */
  async actualizarEstado(
    id: string,
    dto: ActualizarEstadoFinanzasDto,
  ): Promise<FinanzasFormateadaDto> {
    const finanzas = await this.finanzasModel.findById(id).exec();
    if (!finanzas) {
      throw new NotFoundException('Registro de finanzas no encontrado');
    }

    finanzas.estado = dto.estado;
    if (dto.notasInternas !== undefined) {
      finanzas.notasInternas = dto.notasInternas;
    }

    await finanzas.save();

    const modelo = await this.modeloModel.findById(finanzas.modeloId).exec();
    if (!modelo) {
      throw new NotFoundException('Modelo no encontrada');
    }

    return this.formatearFinanzas(finanzas, modelo);
  }

  // ========== MÉTODOS AUXILIARES ==========

  private async obtenerContratoActivo(
    modeloId: string,
  ): Promise<ContratoModeloDocument | null> {
    return await this.contratoModel
      .findOne({
        modeloId: new Types.ObjectId(modeloId),
        estado: 'FIRMADO',
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  private async obtenerVentasDelMes(
    modeloId: string,
    mes: number,
    anio: number,
  ): Promise<ChatterSaleDocument[]> {
    const fechaInicio = new Date(anio, mes - 1, 1); // Primer día del mes
    const fechaFin = new Date(anio, mes, 0, 23, 59, 59, 999); // Último día del mes

    return await this.chatterSaleModel
      .find({
        modeloId: new Types.ObjectId(modeloId),
        fechaVenta: {
          $gte: fechaInicio,
          $lte: fechaFin,
        },
      })
      .exec();
  }

  /**
   * Obtiene el porcentaje de comisión según el tipo de contrato
   * Para comisión escalonada, calcula según el monto de ventas
   */
  private async obtenerPorcentajeComision(
    contrato: ContratoModeloDocument,
    ventasNetasUSD: number,
  ): Promise<number> {
    // Verificar comisión fija (porcentaje)
    if (contrato.tipoComision === TipoComision.FIJO && contrato.comisionFija?.porcentaje) {
      return contrato.comisionFija.porcentaje;
    }
    
    // Verificar comisión escalonada
    if (contrato.tipoComision === TipoComision.ESCALONADO && contrato.comisionEscalonada?.escalaId) {
      const escalaId = contrato.comisionEscalonada.escalaId;
      
      // Obtener la escala de comisiones
      const escala = await this.commissionScaleModel.findById(escalaId).exec();
      
      if (!escala) {
        throw new BadRequestException(
          `Escala de comisión con ID ${escalaId} no encontrada`,
        );
      }

      // Convertir ventasNetasUSD (número interno de MoneyService) a USD real
      const ventasUSD = this.moneyService.formatForUser(ventasNetasUSD, CurrencyCode.USD);
      const ventasUSDNumber = parseFloat(ventasUSD.replace(/[^0-9.-]/g, ''));

      // Buscar la regla aplicable según el monto de ventas
      const reglaAplicable = escala.rules.find((regla) => {
        const cumpleMin = ventasUSDNumber >= regla.minUsd;
        const cumpleMax = regla.maxUsd === undefined || ventasUSDNumber <= regla.maxUsd;
        return cumpleMin && cumpleMax;
      });

      if (!reglaAplicable) {
        // Si no encuentra regla, usar la última (mayor rango)
        const ultimaRegla = escala.rules[escala.rules.length - 1];
        this.logger.warn(
          `No se encontró regla aplicable para ventas de $${ventasUSDNumber}. Usando última regla: ${ultimaRegla.percentage}%`,
        );
        return ultimaRegla.percentage;
      }

      this.logger.log(
        `Comisión escalonada aplicada: ${reglaAplicable.percentage}% (ventas: $${ventasUSDNumber}, rango: $${reglaAplicable.minUsd}-${reglaAplicable.maxUsd || '∞'})`,
      );

      return reglaAplicable.percentage;
    }

    throw new BadRequestException(
      'El contrato no tiene un porcentaje de comisión definido',
    );
  }

  private async obtenerModelosActivas(): Promise<string[]> {
    const modelos = await this.modeloModel
      .find({ estado: 'ACTIVA' })
      .select('_id')
      .lean()
      .exec();

    return modelos.map((m) => m._id.toString());
  }

  private formatearFinanzas(
    finanzas: FinanzasModeloDocument,
    modelo: ModeloDocument,
  ): FinanzasFormateadaDto {
    const ventasNetas = this.moneyService.fromDatabase(finanzas.ventasNetasUSD);
    const comisionAgencia = this.moneyService.fromDatabase(finanzas.comisionAgenciaUSD);
    const comisionBanco = this.moneyService.fromDatabase(finanzas.comisionBancoUSD);
    const gananciaModelo = this.moneyService.fromDatabase(finanzas.gananciaModeloUSD);
    const gananciaOnlyTop = this.moneyService.fromDatabase(finanzas.gananciaOnlyTopUSD);

    return {
      id: finanzas._id.toString(),
      modeloId: finanzas.modeloId.toString(),
      nombreModelo: modelo.nombreCompleto,
      usuarioOnlyFans: (modelo as any).usuarioOnlyFans || undefined,
      mes: finanzas.mes,
      anio: finanzas.anio,
      ventasNetasUSD: ventasNetas,
      comisionAgenciaUSD: comisionAgencia,
      comisionBancoUSD: comisionBanco,
      gananciaModeloUSD: gananciaModelo,
      gananciaOnlyTopUSD: gananciaOnlyTop,
      ventasNetasFormateado: this.moneyService.formatForUser(ventasNetas, CurrencyCode.USD),
      comisionAgenciaFormateado: this.moneyService.formatForUser(
        comisionAgencia,
        CurrencyCode.USD,
      ),
      comisionBancoFormateado: this.moneyService.formatForUser(comisionBanco, CurrencyCode.USD),
      gananciaModeloFormateado: this.moneyService.formatForUser(
        gananciaModelo,
        CurrencyCode.USD,
      ),
      gananciaOnlyTopFormateado: this.moneyService.formatForUser(
        gananciaOnlyTop,
        CurrencyCode.USD,
      ),
      porcentajeComisionAgencia: finanzas.porcentajeComisionAgencia,
      porcentajeComisionBanco: finanzas.porcentajeComisionBanco,
      porcentajeParticipacionModelo: 100 - finanzas.porcentajeComisionAgencia,
      cantidadVentas: finanzas.cantidadVentas,
      promedioVentaDiaria: finanzas.meta?.promedioVentaDiaria,
      estado: finanzas.estado,
      fechaUltimoCalculo: finanzas.fechaUltimoCalculo ?? undefined,
      contratoId: finanzas.contratoId?.toString(),
      notasInternas: finanzas.notasInternas ?? undefined,
    };
  }

  private calcularDesglosePorTipoVenta(ventas: ChatterSaleDocument[]): Record<string, any> {
    const desglose: Record<string, { cantidad: number; total: number }> = {};

    ventas.forEach((venta) => {
      if (!desglose[venta.tipoVenta]) {
        desglose[venta.tipoVenta] = { cantidad: 0, total: 0 };
      }
      desglose[venta.tipoVenta].cantidad++;
      desglose[venta.tipoVenta].total = this.moneyService.add(
        desglose[venta.tipoVenta].total,
        venta.monto,
      );
    });

    return desglose;
  }

  private calcularDiasActivos(ventas: ChatterSaleDocument[]): number {
    const diasUnicos = new Set(
      ventas.map((v) => v.fechaVenta.toISOString().split('T')[0]),
    );
    return diasUnicos.size;
  }

  private getDiasDelMes(mes: number, anio: number): number {
    return new Date(anio, mes, 0).getDate();
  }

  /**
   * Actualiza el porcentaje de comisión bancaria para un periodo
   * y recalcula todas las finanzas afectadas
   */
  async actualizarComisionBancoPeriodo(
    mes: number,
    anio: number,
    porcentajeComisionBanco: number,
    userId?: string,
  ): Promise<{ actualizadas: number; errores: number }> {
    // Buscar todas las finanzas del periodo
    const finanzasPeriodo = await this.finanzasModel.find({
      mes,
      anio,
    }).lean();

    let actualizadas = 0;
    let errores = 0;

    // Recalcular cada finanza con el nuevo porcentaje
    for (const finanza of finanzasPeriodo) {
      try {
        // Obtener ventas netas originales (BigInt desde DB)
        const ventasNetasUSD = this.moneyService.fromDatabase(
          finanza.ventasNetasUSD,
        );

        // Obtener comisión de agencia original
        const comisionAgenciaUSD = this.moneyService.fromDatabase(
          finanza.comisionAgenciaUSD,
        );

        // Ganancia modelo NO cambia con comisión banco (ventas - comisionAgencia)
        const gananciaModeloUSD = this.moneyService.subtract(
          ventasNetasUSD,
          comisionAgenciaUSD,
        );

        // Recalcular comisión de banco SOLO sobre comisión agencia
        const comisionBancoUSD = this.moneyService.multiply(
          comisionAgenciaUSD,
          porcentajeComisionBanco / 100,
        );

        // Recalcular ganancia OnlyTop (comisionAgencia - comisionBanco)
        const gananciaOnlyTopUSD = this.moneyService.subtract(
          comisionAgenciaUSD,
          comisionBancoUSD,
        );

        // Actualizar finanza
        await this.finanzasModel.updateOne(
          { _id: finanza._id },
          {
            $set: {
              porcentajeComisionBanco,
              comisionBancoUSD: this.moneyService.toDatabase(comisionBancoUSD, CurrencyCode.USD),
              gananciaModeloUSD: this.moneyService.toDatabase(gananciaModeloUSD, CurrencyCode.USD),
              gananciaOnlyTopUSD: this.moneyService.toDatabase(gananciaOnlyTopUSD, CurrencyCode.USD),
              fechaUltimoCalculo: new Date(),
              calculadoPor: userId ? new Types.ObjectId(userId) : null,
            },
          },
        );

        actualizadas++;
      } catch (error) {
        this.logger.error(
          `Error al actualizar finanza ${finanza._id}:`,
          error,
        );
        errores++;
      }
    }

    this.logger.log(
      `Comisión bancaria actualizada: ${actualizadas} finanzas actualizadas, ${errores} errores`,
    );

    return { actualizadas, errores };
  }

  // ========== GESTIÓN DE BANK ONLYTOP ==========

  /**
   * Obtiene el estado actual del bank OnlyTop
   * Ahora delegado a BankOnlyTopService
   */
  async obtenerBankOnlyTop(): Promise<any> {
    return this.bankService.getEstado();
  }

  // ========== CONSOLIDACIÓN DE PERIODOS ==========

  /**
   * Consolida un periodo mensual, cerrándolo oficialmente
   * Transfiere el dinero en movimiento al consolidado
   */
  async consolidarPeriodo(
    mes: number,
    anio: number,
    userId?: string,
    notasCierre?: string,
  ): Promise<PeriodoConsolidadoDocument> {
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
    
    this.logger.log(`Consolidando periodo ${periodo}...`);

    // Verificar si ya existe consolidación
    const existente = await this.periodoConsolidadoModel.findOne({ periodo }).exec();
    if (existente && existente.estado === 'CONSOLIDADO') {
      throw new BadRequestException(`El periodo ${periodo} ya está consolidado`);
    }

    // Obtener todas las finanzas del periodo
    const finanzas = await this.finanzasModel
      .find({ mes, anio })
      .populate('modeloId', 'nombreCompleto')
      .exec();

    if (finanzas.length === 0) {
      throw new BadRequestException(`No hay finanzas calculadas para el periodo ${periodo}`);
    }

    // Calcular totales
    let totalVentasNetas = 0n;
    let totalComisionAgencia = 0n;
    let totalComisionBanco = 0n;
    let totalGananciaModelos = 0n;
    let totalGananciaOnlyTop = 0n;
    let cantidadVentas = 0;

    const topModelos: any[] = [];

    finanzas.forEach((f) => {
      totalVentasNetas += f.ventasNetasUSD;
      totalComisionAgencia += f.comisionAgenciaUSD;
      totalComisionBanco += f.comisionBancoUSD;
      totalGananciaModelos += f.gananciaModeloUSD;
      totalGananciaOnlyTop += f.gananciaOnlyTopUSD;
      cantidadVentas += f.cantidadVentas;

      topModelos.push({
        modeloId: f.modeloId._id.toString(),
        nombreCompleto: (f.modeloId as any).nombreCompleto,
        ventasNetas: this.moneyService.fromDatabase(f.ventasNetasUSD),
        gananciaOT: this.moneyService.fromDatabase(f.gananciaOnlyTopUSD),
      });
    });

    // Ordenar top modelos por ganancia OT
    topModelos.sort((a, b) => b.gananciaOT - a.gananciaOT);

    const promedioVentasPorModelo = finanzas.length > 0
      ? this.moneyService.fromDatabase(totalVentasNetas) / finanzas.length
      : 0;

    // Calcular promedio de comisión bancaria
    const sumaComisionBancoPorcentaje = finanzas.reduce(
      (sum, f) => sum + f.porcentajeComisionBanco,
      0
    );
    const porcentajeComisionBancoPromedio = finanzas.length > 0
      ? sumaComisionBancoPorcentaje / finanzas.length
      : 2;

    // Crear o actualizar periodo consolidado
    const periodoData = {
      periodo,
      mes,
      anio,
      totalVentasNetasUSD: totalVentasNetas,
      totalComisionAgenciaUSD: totalComisionAgencia,
      totalComisionBancoUSD: totalComisionBanco,
      totalGananciaModelosUSD: totalGananciaModelos,
      totalGananciaOnlyTopUSD: totalGananciaOnlyTop,
      cantidadModelos: finanzas.length,
      cantidadVentas,
      promedioVentasPorModelo,
      porcentajeComisionBancoPromedio,
      estado: 'CONSOLIDADO',
      fechaConsolidacion: new Date(),
      consolidadoPor: userId ? new Types.ObjectId(userId) : null,
      notasCierre,
      meta: {
        topModelos: topModelos.slice(0, 10),
      },
      finanzasIds: finanzas.map((f) => f._id),
    };

    let periodoConsolidado: PeriodoConsolidadoDocument;

    if (existente) {
      Object.assign(existente, periodoData);
      periodoConsolidado = await existente.save();
    } else {
      periodoConsolidado = await this.periodoConsolidadoModel.create(periodoData);
    }

    // Actualizar periodoId en todas las finanzas
    await this.finanzasModel.updateMany(
      { mes, anio },
      { $set: { periodoId: periodo } },
    );

    // Transferir dinero de movimiento a consolidado en bank_onlytop
    await this.bankService.consolidarPeriodo({
      periodo,
      mes,
      anio,
      usuarioId: userId,
      notas: notasCierre,
    });

    // Actualizar contadores globales del banco
    await this.bankService.actualizarContadores({
      modelos: finanzas.length,
      ventas: cantidadVentas,
    });

    this.logger.log(`Periodo ${periodo} consolidado exitosamente`);

    return periodoConsolidado;
  }

  /**
   * Obtiene lista de periodos consolidados
   */
  async obtenerPeriodosConsolidados(): Promise<any[]> {
    const periodos = await this.periodoConsolidadoModel
      .find()
      .sort({ anio: -1, mes: -1 })
      .lean()
      .exec();

    return periodos.map((p: any) => ({
      _id: p._id,
      periodo: p.periodo,
      mes: p.mes,
      anio: p.anio,
      totalVentasNetasUSD: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(p.totalVentasNetasUSD),
        CurrencyCode.USD,
      ),
      totalComisionAgenciaUSD: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(p.totalComisionAgenciaUSD),
        CurrencyCode.USD,
      ),
      totalComisionBancoUSD: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(p.totalComisionBancoUSD),
        CurrencyCode.USD,
      ),
      totalGananciaModelosUSD: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(p.totalGananciaModelosUSD),
        CurrencyCode.USD,
      ),
      totalGananciaOnlyTopUSD: this.moneyService.formatForUser(
        this.moneyService.fromDatabase(p.totalGananciaOnlyTopUSD),
        CurrencyCode.USD,
      ),
      cantidadModelos: p.cantidadModelos,
      cantidadVentas: p.cantidadVentas,
      promedioVentasPorModelo: p.promedioVentasPorModelo || 0,
      porcentajeComisionBancoPromedio: p.porcentajeComisionBancoPromedio || 2,
      estado: p.estado,
      topModelos: p.meta?.topModelos || [],
      desglosePorEstado: p.meta?.desglosePorEstado || [],
      finanzasIds: p.finanzasIds || [],
      fechaConsolidacion: p.fechaConsolidacion,
      consolidadoPor: p.consolidadoPor,
      notasCierre: p.notasCierre,
    }));
  }
}
