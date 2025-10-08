import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CostosFijosMensualesEntity,
  CostosFijosMensualesDocument,
  GastoFijo,
} from './costos-fijos-mensuales.schema.js';
import { CategoriaGastoEntity, CategoriaGastoDocument } from './categoria-gasto.schema.js';
import { PeriodoConsolidadoEntity, PeriodoConsolidadoDocument } from './periodo-consolidado.schema.js';
import { BankOnlyTopEntity, BankOnlyTopDocument } from './bank-onlytop.schema.js';
import { MoneyService } from '../money/money.service.js';
import { BankOnlyTopService } from './bank-onlytop.service.js';
import { OrigenTransaccion } from './transaccion-movimiento.schema.js';
import { CurrencyCode } from '../money/money.types.js';
import {
  RegistrarGastoDto,
  CrearCategoriaDto,
  ActualizarGastoDto,
  EliminarGastoDto,
  EliminarCategoriaDto,
  ConsolidarCostosDto,
  CostosFijosFormateadoDto,
  ConsolidarCostosRespuestaDto,
} from './dto/costos-fijos.dto.js';

/**
 * CostosFijosService - Servicio profesional de gestión de costos fijos mensuales
 * 
 * ARQUITECTURA CORREGIDA:
 * - Categorías en colección global (finanzas_categorias_gastos)
 * - Gastos directamente en el documento mensual con referencia a categoría
 * - Auto-creación de categorías base al iniciar el módulo
 */
@Injectable()
export class CostosFijosService implements OnModuleInit {
  private readonly logger = new Logger(CostosFijosService.name);

  // Categorías predeterminadas del sistema
  private readonly CATEGORIAS_BASE = [
    { nombre: 'Administrativos', descripcion: 'Alquiler, servicios, mantenimiento', color: '#3b82f6', icon: '🏢' },
    { nombre: 'Marketing', descripcion: 'Publicidad, redes, diseño, campañas', color: '#8b5cf6', icon: '📢' },
    { nombre: 'Tráfico', descripcion: 'Plataformas, pasarelas, tráfico web', color: '#f59e0b', icon: '🌐' },
    { nombre: 'RRHH', descripcion: 'Nómina, comisiones, beneficios', color: '#10b981', icon: '👥' },
    { nombre: 'Otros', descripcion: 'Gastos no clasificados', color: '#6b7280', icon: '📦' },
  ];

  constructor(
    @InjectModel(CostosFijosMensualesEntity.name)
    private costosModel: Model<CostosFijosMensualesDocument>,
    @InjectModel(CategoriaGastoEntity.name)
    private categoriaModel: Model<CategoriaGastoDocument>,
    @InjectModel(PeriodoConsolidadoEntity.name)
    private periodoConsolidadoModel: Model<PeriodoConsolidadoDocument>,
    @InjectModel(BankOnlyTopEntity.name)
    private bankOnlyTopModel: Model<BankOnlyTopDocument>,
    private readonly moneyService: MoneyService,
    private readonly bankService: BankOnlyTopService,
  ) {}

  /**
   * Inicializa las categorías base al iniciar el módulo
   */
  async onModuleInit() {
    await this.inicializarCategoriasBase();
  }

  /**
   * Crea las categorías base si no existen
   */
  private async inicializarCategoriasBase() {
    for (const cat of this.CATEGORIAS_BASE) {
      const existe = await this.categoriaModel.findOne({ nombre: cat.nombre }).exec();
      
      if (!existe) {
        await this.categoriaModel.create({
          nombre: cat.nombre,
          descripcion: cat.descripcion,
          color: cat.color,
          icon: cat.icon,
          esPersonalizada: false,
          activa: true,
          fechaCreacion: new Date(),
        });
        
        this.logger.log(`✅ Categoría base creada: ${cat.nombre}`);
      }
    }
  }

  // ========== OBTENCIÓN Y CREACIÓN ==========

  /**
   * Obtiene o crea el documento de costos fijos para un mes/año específico
   */
  async obtenerOCrearCostosMes(mes: number, anio: number): Promise<CostosFijosMensualesDocument> {
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

    let costos = await this.costosModel.findOne({ mes, anio }).exec();

    if (!costos) {
      this.logger.log(`Creando documento de costos fijos para ${periodo}`);

      costos = await this.costosModel.findOneAndUpdate(
        { mes, anio },
        {
          $setOnInsert: {
            mes,
            anio,
            periodo,
            estado: 'ABIERTO',
            gastos: [],
            totalGastosUSD: 0n,
            consolidado: false,
            fechaUltimaActualizacion: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ).exec();

      this.logger.log(`✅ Costos fijos creados para ${periodo}`);
    }

    return costos!;
  }

  /**
   * Obtiene los costos fijos de un mes específico (formateados)
   */
  async obtenerCostosMes(mes: number, anio: number): Promise<CostosFijosFormateadoDto> {
    const costos = await this.obtenerOCrearCostosMes(mes, anio);
    return this.formatearCostos(costos);
  }

  // ========== GESTIÓN DE CATEGORÍAS ==========

  /**
   * Obtiene todas las categorías activas
   */
  async obtenerCategorias(): Promise<CategoriaGastoDocument[]> {
    return this.categoriaModel.find({ activa: true }).exec();
  }

  /**
   * Crea una nueva categoría personalizada
   */
  async crearCategoria(
    mes: number,
    anio: number,
    dto: CrearCategoriaDto,
    userId?: string,
  ): Promise<CostosFijosFormateadoDto> {
    const costos = await this.obtenerOCrearCostosMes(mes, anio);

    if (costos.consolidado) {
      throw new BadRequestException('No se puede modificar un periodo consolidado');
    }

    // Verificar que no exista ya
    const existe = await this.categoriaModel.findOne({ nombre: dto.nombre }).exec();
    if (existe) {
      throw new BadRequestException(`Ya existe una categoría con el nombre "${dto.nombre}"`);
    }

    // Crear categoría global
    await this.categoriaModel.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion || null,
      color: dto.color || '#6b7280',
      icon: null,
      esPersonalizada: true,
      activa: true,
      creadoPor: userId ? new Types.ObjectId(userId) : null,
      fechaCreacion: new Date(),
    });

    costos.fechaUltimaActualizacion = new Date();
    costos.actualizadoPor = userId ? new Types.ObjectId(userId) : null;
    await costos.save();

    this.logger.log(`✅ Categoría "${dto.nombre}" creada`);

    return this.formatearCostos(costos);
  }

  /**
   * Elimina una categoría (solo si no tiene gastos en ningún mes)
   */
  async eliminarCategoria(
    mes: number,
    anio: number,
    dto: EliminarCategoriaDto,
    userId?: string,
  ): Promise<CostosFijosFormateadoDto> {
    const costos = await this.obtenerOCrearCostosMes(mes, anio);

    if (costos.consolidado) {
      throw new BadRequestException('No se puede modificar un periodo consolidado');
    }

    const categoria = await this.categoriaModel.findOne({ nombre: dto.nombreCategoria }).exec();
    if (!categoria) {
      throw new NotFoundException(`Categoría "${dto.nombreCategoria}" no encontrada`);
    }

    if (!categoria.esPersonalizada) {
      throw new BadRequestException('No se pueden eliminar categorías del sistema');
    }

    // Verificar que no tenga gastos en NINGÚN documento
    const tieneGastos = await this.costosModel.findOne({
      'gastos.categoriaId': categoria._id.toString(),
    }).exec();

    if (tieneGastos) {
      throw new BadRequestException(
        `No se puede eliminar la categoría "${dto.nombreCategoria}" porque tiene gastos registrados`,
      );
    }

    // Desactivar en lugar de eliminar
    categoria.activa = false;
    await categoria.save();

    costos.fechaUltimaActualizacion = new Date();
    costos.actualizadoPor = userId ? new Types.ObjectId(userId) : null;
    await costos.save();

    this.logger.log(`✅ Categoría "${dto.nombreCategoria}" desactivada`);

    return this.formatearCostos(costos);
  }

  // ========== GESTIÓN DE GASTOS ==========

  /**
   * Registra un nuevo gasto
   */
  async registrarGasto(
    mes: number,
    anio: number,
    dto: RegistrarGastoDto,
    userId?: string,
  ): Promise<CostosFijosFormateadoDto> {
    const costos = await this.obtenerOCrearCostosMes(mes, anio);

    if (costos.consolidado) {
      throw new BadRequestException('No se puede modificar un periodo consolidado');
    }

    // Buscar categoría global
    const categoria = await this.categoriaModel.findOne({ 
      nombre: dto.nombreCategoria,
      activa: true,
    }).exec();

    if (!categoria) {
      throw new NotFoundException(`Categoría "${dto.nombreCategoria}" no encontrada`);
    }

    // Crear el gasto
    const nuevoGasto: GastoFijo = {
      categoriaId: categoria._id.toString(),
      concepto: dto.concepto,
      montoUSD: this.moneyService.toDatabase(dto.montoUSD, CurrencyCode.USD),
      fechaRegistro: new Date(),
      registradoPor: userId ? new Types.ObjectId(userId) : null,
      notas: dto.notas || null,
    };

    // CORRECCIÓN: Agregar directamente al array de gastos
    costos.gastos.push(nuevoGasto);

    // Recalcular total
    await this.recalcularTotales(costos);

    costos.fechaUltimaActualizacion = new Date();
    costos.actualizadoPor = userId ? new Types.ObjectId(userId) : null;

    await costos.save();

    // Registrar transacción EGRESO
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
    await this.bankService.aplicarMovimiento({
      tipo: 'EGRESO',
      montoUSD: this.moneyService.toDatabase(dto.montoUSD, CurrencyCode.USD),
      motivo: `Gasto fijo - ${dto.concepto} (${categoria.nombre})`,
      origen: OrigenTransaccion.COSTO_FIJO,
      referencia: costos._id.toString(),
      referenciaModelo: 'CostosFijosMensuales',
      userId,
      meta: {
        nombreCategoria: categoria.nombre,
        conceptoGasto: dto.concepto,
        notas: dto.notas,
      },
    });

    this.logger.log(
      `✅ Gasto registrado: "${dto.concepto}" - ${this.moneyService.formatForUser(dto.montoUSD, CurrencyCode.USD)} en categoría "${dto.nombreCategoria}"`,
    );

    return this.formatearCostos(costos);
  }

  /**
   * Actualiza un gasto existente
   */
  async actualizarGasto(
    mes: number,
    anio: number,
    dto: ActualizarGastoDto,
    userId?: string,
  ): Promise<CostosFijosFormateadoDto> {
    const costos = await this.obtenerOCrearCostosMes(mes, anio);

    if (costos.consolidado) {
      throw new BadRequestException('No se puede modificar un periodo consolidado');
    }

    // Buscar categoría
    const categoria = await this.categoriaModel.findOne({ nombre: dto.nombreCategoria }).exec();
    if (!categoria) {
      throw new NotFoundException(`Categoría "${dto.nombreCategoria}" no encontrada`);
    }

    // Encontrar gastos de esa categoría
    const gastosCategoria = costos.gastos.filter(g => g.categoriaId === categoria._id.toString());
    
    if (dto.indiceGasto >= gastosCategoria.length || dto.indiceGasto < 0) {
      throw new NotFoundException(`Gasto en índice ${dto.indiceGasto} no encontrado en categoría "${dto.nombreCategoria}"`);
    }

    // Encontrar el gasto en el array completo
    const gastoGlobal = costos.gastos.find((g, idx) => {
      if (g.categoriaId !== categoria._id.toString()) return false;
      const indexEnCategoria = costos.gastos.filter((gg, i) => i <= idx && gg.categoriaId === categoria._id.toString()).length - 1;
      return indexEnCategoria === dto.indiceGasto;
    });

    if (!gastoGlobal) {
      throw new NotFoundException('Gasto no encontrado');
    }

    // Actualizar campos
    if (dto.concepto !== undefined) gastoGlobal.concepto = dto.concepto;
    if (dto.montoUSD !== undefined) {
      gastoGlobal.montoUSD = this.moneyService.toDatabase(dto.montoUSD, CurrencyCode.USD);
    }
    if (dto.notas !== undefined) gastoGlobal.notas = dto.notas;

    // Recalcular total
    await this.recalcularTotales(costos);

    costos.fechaUltimaActualizacion = new Date();
    costos.actualizadoPor = userId ? new Types.ObjectId(userId) : null;

    await costos.save();

    this.logger.log(`✅ Gasto actualizado en categoría "${dto.nombreCategoria}"`);

    return this.formatearCostos(costos);
  }

  /**
   * Elimina un gasto
   */
  async eliminarGasto(
    mes: number,
    anio: number,
    dto: EliminarGastoDto,
    userId?: string,
  ): Promise<CostosFijosFormateadoDto> {
    const costos = await this.obtenerOCrearCostosMes(mes, anio);

    if (costos.consolidado) {
      throw new BadRequestException('No se puede modificar un periodo consolidado');
    }

    const categoria = await this.categoriaModel.findOne({ nombre: dto.nombreCategoria }).exec();
    if (!categoria) {
      throw new NotFoundException(`Categoría "${dto.nombreCategoria}" no encontrada`);
    }

    // Encontrar y eliminar el gasto
    const gastosCategoria = costos.gastos.filter(g => g.categoriaId === categoria._id.toString());
    
    if (dto.indiceGasto >= gastosCategoria.length || dto.indiceGasto < 0) {
      throw new NotFoundException(`Gasto en índice ${dto.indiceGasto} no encontrado`);
    }

    // Encontrar índice global
    let indiceEncontrado = -1;
    let contadorCategoria = 0;
    
    for (let i = 0; i < costos.gastos.length; i++) {
      if (costos.gastos[i].categoriaId === categoria._id.toString()) {
        if (contadorCategoria === dto.indiceGasto) {
          indiceEncontrado = i;
          break;
        }
        contadorCategoria++;
      }
    }

    if (indiceEncontrado === -1) {
      throw new NotFoundException('Gasto no encontrado');
    }

    const gastoEliminado = costos.gastos[indiceEncontrado];
    costos.gastos.splice(indiceEncontrado, 1);

    // Recalcular total
    await this.recalcularTotales(costos);

    costos.fechaUltimaActualizacion = new Date();
    costos.actualizadoPor = userId ? new Types.ObjectId(userId) : null;

    await costos.save();

    this.logger.log(
      `✅ Gasto eliminado: "${gastoEliminado.concepto}" de categoría "${dto.nombreCategoria}"`,
    );

    return this.formatearCostos(costos);
  }

  // ========== CONSOLIDACIÓN ==========

  async consolidarCostos(
    dto: ConsolidarCostosDto,
    userId?: string,
  ): Promise<ConsolidarCostosRespuestaDto> {
    const periodo = `${dto.anio}-${String(dto.mes).padStart(2, '0')}`;
    this.logger.log(`Consolidando costos fijos para ${periodo}...`);

    const costos = await this.obtenerOCrearCostosMes(dto.mes, dto.anio);

    if (costos.consolidado) {
      throw new BadRequestException(`Los costos del periodo ${periodo} ya están consolidados`);
    }

    await this.recalcularTotales(costos);
    const totalGastosNum = this.moneyService.fromDatabase(costos.totalGastosUSD);

    costos.consolidado = true;
    costos.fechaConsolidacion = new Date();
    costos.consolidadoPor = userId ? new Types.ObjectId(userId) : null;
    costos.estado = 'CONSOLIDADO';
    if (dto.notasCierre) {
      costos.notasInternas = dto.notasCierre;
    }

    await costos.save();
    // Ya no es necesario descontar del bank aquí, las transacciones individuales
    // de cada gasto ya aplicaron los EGRESOS. La consolidación solo marca estado.
    await this.vincularConPeriodoConsolidado(periodo, costos.totalGastosUSD);

    this.logger.log(
      `✅ Costos fijos consolidados: ${periodo} - ${this.moneyService.formatForUser(totalGastosNum, CurrencyCode.USD)}`,
    );

    return {
      periodo,
      totalGastosUSD: totalGastosNum,
      totalGastosFormateado: this.moneyService.formatForUser(totalGastosNum, CurrencyCode.USD),
      categorias: (await this.categoriaModel.countDocuments({ activa: true })),
      gastos: costos.gastos.length,
      consolidado: true,
      fechaConsolidacion: costos.fechaConsolidacion!.toISOString(),
      message: `Costos fijos de ${periodo} consolidados exitosamente`,
    };
  }

  // ========== MÉTODOS AUXILIARES ==========

  private async recalcularTotales(costos: CostosFijosMensualesDocument): Promise<void> {
    const totalGeneral = costos.gastos.reduce(
      (sum, gasto) => sum + BigInt(gasto.montoUSD),
      0n,
    );
    costos.totalGastosUSD = totalGeneral;
  }

  private async vincularConPeriodoConsolidado(periodo: string, totalGastos: bigint): Promise<void> {
    const periodoConsolidado = await this.periodoConsolidadoModel.findOne({ periodo }).exec();
    if (periodoConsolidado) {
      if (!periodoConsolidado.meta) periodoConsolidado.meta = {};
      periodoConsolidado.meta.totalGastosFijosUSD = this.moneyService.fromDatabase(totalGastos);
      periodoConsolidado.meta.totalGastosFijosFormateado = this.moneyService.formatForUser(
        this.moneyService.fromDatabase(totalGastos),
        CurrencyCode.USD,
      );
      await periodoConsolidado.save();
      this.logger.log(`🔗 Costos fijos vinculados con periodo consolidado ${periodo}`);
    }
  }

  /**
   * Formatea los costos para presentación
   */
  private async formatearCostos(costos: CostosFijosMensualesDocument): Promise<CostosFijosFormateadoDto> {
    const totalGeneral = this.moneyService.fromDatabase(costos.totalGastosUSD);

    // Obtener todas las categorías activas
    const todasCategorias = await this.categoriaModel.find({ activa: true }).exec();

    const categoriasFormateadas = await Promise.all(
      todasCategorias.map(async (cat) => {
        const gastosCategoria = costos.gastos.filter(g => g.categoriaId === cat._id.toString());

        const gastosFormateados = gastosCategoria.map((gasto, index) => {
          const montoNum = this.moneyService.fromDatabase(gasto.montoUSD);
          const totalCategoria = gastosCategoria.reduce(
            (sum, g) => sum + this.moneyService.fromDatabase(g.montoUSD),
            0,
          );
          const porcentajeCategoria = totalCategoria > 0 ? (montoNum / totalCategoria) * 100 : 0;

          return {
            concepto: gasto.concepto,
            montoUSD: montoNum,
            montoFormateado: this.moneyService.formatForUser(montoNum, CurrencyCode.USD),
            fechaRegistro: gasto.fechaRegistro.toISOString(),
            notas: gasto.notas || undefined,
            porcentajeCategoria: parseFloat(porcentajeCategoria.toFixed(2)),
          };
        });

        const totalCategoriaUSD = gastosFormateados.reduce((sum, g) => sum + g.montoUSD, 0);
        const porcentajeDelTotal = totalGeneral > 0 ? (totalCategoriaUSD / totalGeneral) * 100 : 0;

        return {
          nombre: cat.nombre,
          descripcion: cat.descripcion || undefined,
          color: cat.color || undefined,
          gastos: gastosFormateados,
          totalCategoriaUSD,
          totalCategoriaFormateado: this.moneyService.formatForUser(totalCategoriaUSD, CurrencyCode.USD),
          porcentajeDelTotal: parseFloat(porcentajeDelTotal.toFixed(2)),
          cantidadGastos: gastosFormateados.length,
        };
      })
    );

    const categoriaMayorGasto = categoriasFormateadas.reduce((max, cat) =>
      cat.totalCategoriaUSD > max.totalCategoriaUSD ? cat : max,
    categoriasFormateadas[0] || { nombre: '', totalCategoriaUSD: 0 });

    const categoriaConMasGastos = categoriasFormateadas.reduce((max, cat) =>
      cat.cantidadGastos > max.cantidadGastos ? cat : max,
    categoriasFormateadas[0] || { nombre: '', cantidadGastos: 0 });

    const diasDelMes = new Date(costos.anio, costos.mes, 0).getDate();
    const promedioGastoPorDia = totalGeneral / diasDelMes;

    return {
      mes: costos.mes,
      anio: costos.anio,
      periodo: costos.periodo,
      estado: costos.estado,
      consolidado: costos.consolidado,
      categorias: categoriasFormateadas,
      totalGastosUSD: totalGeneral,
      totalGastosFormateado: this.moneyService.formatForUser(totalGeneral, CurrencyCode.USD),
      fechaConsolidacion: costos.fechaConsolidacion?.toISOString(),
      fechaUltimaActualizacion: costos.fechaUltimaActualizacion?.toISOString(),
      notasInternas: costos.notasInternas || undefined,
      meta: {
        categoriaMayorGasto: categoriaMayorGasto.nombre,
        categoriaConMasGastos: categoriaConMasGastos.nombre,
        promedioGastoPorDia,
        promedioGastoPorDiaFormateado: this.moneyService.formatForUser(promedioGastoPorDia, CurrencyCode.USD),
      },
    };
  }
}
