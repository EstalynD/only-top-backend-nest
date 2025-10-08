import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContratoEntity, ContratoDocument } from './contrato.schema.js';
import { EmpleadoEntity } from './empleado.schema.js';
import { PlantillaContratoEntity } from './plantilla-contrato.schema.js';
import { CreateContratoDto, UpdateContratoDto, AprobarContratoDto, RenovarContratoDto } from './dto/create-contrato.dto.js';

@Injectable()
export class ContratosService {
  constructor(
    @InjectModel(ContratoEntity.name) private contratoModel: Model<ContratoDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoEntity>,
    @InjectModel(PlantillaContratoEntity.name) private plantillaModel: Model<PlantillaContratoEntity>,
  ) {}

  /**
   * Crear un nuevo contrato
   */
  async crearContrato(createContratoDto: CreateContratoDto, usuarioId: Types.ObjectId): Promise<ContratoEntity> {
    // Verificar que el empleado existe
    const empleado = await this.empleadoModel.findById(createContratoDto.empleadoId);
    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    // Verificar que la plantilla existe
    const plantilla = await this.plantillaModel.findById(createContratoDto.plantillaId);
    if (!plantilla) {
      throw new NotFoundException('Plantilla de contrato no encontrada');
    }

    // Verificar que no existe un contrato activo para este empleado
    const contratoExistente = await this.contratoModel.findOne({
      empleadoId: createContratoDto.empleadoId,
      estado: { $in: ['EN_REVISION', 'APROBADO'] }
    });

    if (contratoExistente) {
      throw new ConflictException('Ya existe un contrato activo para este empleado');
    }

    // Generar número de contrato único si no se proporciona
    let numeroContrato = createContratoDto.numeroContrato;
    if (!numeroContrato) {
      numeroContrato = await this.generarNumeroContrato();
    }

    // Crear el contrato
    const contrato = new this.contratoModel({
      ...createContratoDto,
      numeroContrato,
      fechaInicio: new Date(createContratoDto.fechaInicio),
      fechaFin: createContratoDto.fechaFin ? new Date(createContratoDto.fechaFin) : null,
    });

    return await contrato.save();
  }

  /**
   * Obtener todos los contratos
   */
  async obtenerContratos(filtros?: {
    empleadoId?: Types.ObjectId;
    estado?: string;
    tipoContrato?: string;
    fechaInicio?: Date;
    fechaFin?: Date;
  }): Promise<ContratoEntity[]> {
    const query: any = {};

    if (filtros?.empleadoId) {
      query.empleadoId = filtros.empleadoId;
    }

    if (filtros?.estado) {
      query.estado = filtros.estado;
    }

    if (filtros?.tipoContrato) {
      query.tipoContrato = filtros.tipoContrato;
    }

    if (filtros?.fechaInicio || filtros?.fechaFin) {
      query.fechaInicio = {};
      if (filtros.fechaInicio) {
        query.fechaInicio.$gte = filtros.fechaInicio;
      }
      if (filtros.fechaFin) {
        query.fechaInicio.$lte = filtros.fechaFin;
      }
    }

    return await this.contratoModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico cargoId areaId')
      .populate('plantillaId', 'nombre descripcion')
      .populate('aprobacion.aprobadoPor', 'nombre apellido')
      .sort({ createdAt: -1 });
  }

  /**
   * Obtener un contrato por ID
   */
  async obtenerContratoPorId(contratoId: Types.ObjectId): Promise<ContratoEntity> {
    const contrato = await this.contratoModel
      .findById(contratoId)
      .populate('empleadoId', 'nombre apellido correoElectronico cargoId areaId')
      .populate('plantillaId', 'nombre descripcion contenido')
      .populate('aprobacion.aprobadoPor', 'nombre apellido');

    if (!contrato) {
      throw new NotFoundException('Contrato no encontrado');
    }

    return contrato;
  }

  /**
   * Obtener contratos de un empleado
   */
  async obtenerContratosPorEmpleado(empleadoId: Types.ObjectId): Promise<ContratoEntity[]> {
    return await this.contratoModel
      .find({ empleadoId })
      .populate('plantillaId', 'nombre descripcion')
      .populate('aprobacion.aprobadoPor', 'nombre apellido')
      .sort({ createdAt: -1 });
  }

  /**
   * Actualizar un contrato
   */
  async actualizarContrato(
    contratoId: Types.ObjectId,
    updateContratoDto: UpdateContratoDto
  ): Promise<ContratoEntity> {
    const contrato = await this.contratoModel.findByIdAndUpdate(
      contratoId,
      { 
        $set: {
          ...updateContratoDto,
          ...(updateContratoDto.fechaInicio && { fechaInicio: new Date(updateContratoDto.fechaInicio) }),
          ...(updateContratoDto.fechaFin && { fechaFin: new Date(updateContratoDto.fechaFin) }),
        }
      },
      { new: true, runValidators: true }
    );

    if (!contrato) {
      throw new NotFoundException('Contrato no encontrado');
    }

    return contrato;
  }

  /**
   * Aprobar o rechazar un contrato
   */
  async aprobarContrato(
    contratoId: Types.ObjectId,
    aprobarContratoDto: AprobarContratoDto,
    usuarioId: Types.ObjectId
  ): Promise<ContratoEntity> {
    const contrato = await this.contratoModel.findByIdAndUpdate(
      contratoId,
      {
        $set: {
          estado: aprobarContratoDto.estado,
          'aprobacion.aprobadoPor': usuarioId,
          'aprobacion.fechaAprobacion': new Date(),
          'aprobacion.comentarios': aprobarContratoDto.comentarios,
        }
      },
      { new: true, runValidators: true }
    );

    if (!contrato) {
      throw new NotFoundException('Contrato no encontrado');
    }

    return contrato;
  }

  /**
   * Renovar un contrato
   */
  async renovarContrato(
    contratoId: Types.ObjectId,
    renovarContratoDto: RenovarContratoDto,
    usuarioId: Types.ObjectId
  ): Promise<ContratoEntity> {
    const contratoOriginal = await this.contratoModel.findById(contratoId);
    if (!contratoOriginal) {
      throw new NotFoundException('Contrato original no encontrado');
    }

    // Verificar que la plantilla existe
    const plantilla = await this.plantillaModel.findById(renovarContratoDto.plantillaId);
    if (!plantilla) {
      throw new NotFoundException('Plantilla de contrato no encontrada');
    }

    // Generar nuevo número de contrato
    const nuevoNumeroContrato = await this.generarNumeroContrato();

    // Crear el nuevo contrato
    const nuevoContrato = new this.contratoModel({
      empleadoId: contratoOriginal.empleadoId,
      numeroContrato: nuevoNumeroContrato,
      tipoContrato: contratoOriginal.tipoContrato,
      fechaInicio: new Date(renovarContratoDto.fechaInicio),
      fechaFin: renovarContratoDto.fechaFin ? new Date(renovarContratoDto.fechaFin) : null,
      estado: 'EN_REVISION',
      contenidoContrato: renovarContratoDto.contenidoContrato,
      plantillaId: renovarContratoDto.plantillaId,
      'aprobacion.comentarios': renovarContratoDto.comentarios,
    });

    const contratoRenovado = await nuevoContrato.save();

    // Actualizar el contrato original como terminado
    await this.contratoModel.findByIdAndUpdate(contratoId, {
      $set: { estado: 'TERMINADO' }
    });

    return contratoRenovado;
  }

  /**
   * Eliminar un contrato
   */
  async eliminarContrato(contratoId: Types.ObjectId): Promise<void> {
    const contrato = await this.contratoModel.findById(contratoId);
    if (!contrato) {
      throw new NotFoundException('Contrato no encontrado');
    }

    // Solo permitir eliminar contratos en revisión o rechazados
    if (!['EN_REVISION', 'RECHAZADO'].includes(contrato.estado)) {
      throw new BadRequestException('No se puede eliminar un contrato aprobado o terminado');
    }

    await this.contratoModel.findByIdAndDelete(contratoId);
  }

  /**
   * Obtener contratos próximos a vencer
   */
  async obtenerContratosProximosAVencer(dias: number = 30): Promise<ContratoEntity[]> {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + dias);

    return await this.contratoModel
      .find({
        fechaFin: { $lte: fechaLimite, $gte: new Date() },
        estado: 'APROBADO'
      })
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('plantillaId', 'nombre')
      .sort({ fechaFin: 1 });
  }

  /**
   * Obtener contratos vencidos
   */
  async obtenerContratosVencidos(): Promise<ContratoEntity[]> {
    return await this.contratoModel
      .find({
        fechaFin: { $lt: new Date() },
        estado: 'APROBADO'
      })
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('plantillaId', 'nombre')
      .sort({ fechaFin: 1 });
  }

  /**
   * Marcar contratos vencidos automáticamente
   */
  async marcarContratosVencidos(): Promise<number> {
    const resultado = await this.contratoModel.updateMany(
      {
        fechaFin: { $lt: new Date() },
        estado: 'APROBADO'
      },
      {
        $set: { estado: 'TERMINADO' }
      }
    );

    return resultado.modifiedCount;
  }

  /**
   * Obtener estadísticas de contratos
   */
  async obtenerEstadisticasContratos(): Promise<{
    total: number;
    porEstado: Record<string, number>;
    porTipo: Record<string, number>;
    proximosAVencer: number;
    vencidos: number;
  }> {
    const contratos = await this.contratoModel.find({});

    const estadisticas = {
      total: contratos.length,
      porEstado: {} as Record<string, number>,
      porTipo: {} as Record<string, number>,
      proximosAVencer: 0,
      vencidos: 0
    };

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 30);

    contratos.forEach(contrato => {
      // Contar por estado
      estadisticas.porEstado[contrato.estado] = (estadisticas.porEstado[contrato.estado] || 0) + 1;

      // Contar por tipo
      estadisticas.porTipo[contrato.tipoContrato] = (estadisticas.porTipo[contrato.tipoContrato] || 0) + 1;

      // Contar próximos a vencer
      if (contrato.fechaFin && contrato.fechaFin <= fechaLimite && contrato.fechaFin > new Date()) {
        estadisticas.proximosAVencer++;
      }

      // Contar vencidos
      if (contrato.fechaFin && contrato.fechaFin < new Date()) {
        estadisticas.vencidos++;
      }
    });

    return estadisticas;
  }

  /**
   * Generar número de contrato único
   */
  private async generarNumeroContrato(): Promise<string> {
    const año = new Date().getFullYear();
    const prefijo = `CON-${año}-`;
    
    // Buscar el último contrato del año
    const ultimoContrato = await this.contratoModel
      .findOne({ numeroContrato: { $regex: `^${prefijo}` } })
      .sort({ numeroContrato: -1 });

    let numero = 1;
    if (ultimoContrato) {
      const ultimoNumero = parseInt(ultimoContrato.numeroContrato.split('-')[2]);
      numero = ultimoNumero + 1;
    }

    return `${prefijo}${numero.toString().padStart(4, '0')}`;
  }

  /**
   * Buscar contratos por criterios
   */
  async buscarContratos(criterios: {
    empleadoId?: Types.ObjectId;
    estado?: string;
    tipoContrato?: string;
    fechaInicio?: Date;
    fechaFin?: Date;
    numeroContrato?: string;
  }): Promise<ContratoEntity[]> {
    const query: any = {};

    if (criterios.empleadoId) {
      query.empleadoId = criterios.empleadoId;
    }

    if (criterios.estado) {
      query.estado = criterios.estado;
    }

    if (criterios.tipoContrato) {
      query.tipoContrato = criterios.tipoContrato;
    }

    if (criterios.fechaInicio || criterios.fechaFin) {
      query.fechaInicio = {};
      if (criterios.fechaInicio) {
        query.fechaInicio.$gte = criterios.fechaInicio;
      }
      if (criterios.fechaFin) {
        query.fechaInicio.$lte = criterios.fechaFin;
      }
    }

    if (criterios.numeroContrato) {
      query.numeroContrato = { $regex: criterios.numeroContrato, $options: 'i' };
    }

    return await this.contratoModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico cargoId areaId')
      .populate('plantillaId', 'nombre descripcion')
      .populate('aprobacion.aprobadoPor', 'nombre apellido')
      .sort({ createdAt: -1 });
  }
}
