import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { EmpleadoEntity, EmpleadoDocument } from './empleado.schema.js';
import { ContratoEntity, ContratoDocument } from './contrato.schema.js';
import { PlantillaContratoEntity, PlantillaContratoDocument } from './plantilla-contrato.schema.js';
import { AreaEntity, AreaDocument } from './area.schema.js';
import { CargoEntity, CargoDocument } from './cargo.schema.js';
import { UserEntity } from '../users/user.schema.js';
import { CreateEmpleadoDto } from './dto/create-empleado.dto.js';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto.js';
import { CreateContratoDto, AprobarContratoDto } from './dto/create-contrato.dto.js';

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(ContratoEntity.name) private contratoModel: Model<ContratoDocument>,
    @InjectModel(PlantillaContratoEntity.name) private plantillaModel: Model<PlantillaContratoDocument>,
    @InjectModel(AreaEntity.name) private areaModel: Model<AreaDocument>,
    @InjectModel(CargoEntity.name) private cargoModel: Model<CargoDocument>,
    @InjectModel(UserEntity.name) private userModel: Model<any>,
  ) {}

  // ========== EMPLEADOS ==========

  async createEmpleado(createEmpleadoDto: CreateEmpleadoDto): Promise<EmpleadoDocument> {
    // Verificar que el correo no exista
    const existingEmail = await this.empleadoModel.findOne({ 
      correoElectronico: createEmpleadoDto.correoElectronico.toLowerCase() 
    }).exec();
    
    if (existingEmail) {
      throw new ConflictException(`Employee with email '${createEmpleadoDto.correoElectronico}' already exists`);
    }

    // Verificar que el número de identificación no exista
    const existingId = await this.empleadoModel.findOne({ 
      numeroIdentificacion: createEmpleadoDto.numeroIdentificacion 
    }).exec();
    
    if (existingId) {
      throw new ConflictException(`Employee with ID '${createEmpleadoDto.numeroIdentificacion}' already exists`);
    }

  // Verificar que el área existe y está activa
  const area = await this.areaModel.findById(new Types.ObjectId(createEmpleadoDto.areaId)).exec();
    if (!area || !area.isActive) {
      throw new BadRequestException('Invalid or inactive area');
    }

  // Verificar que el cargo existe y está activo
  const cargo = await this.cargoModel.findById(new Types.ObjectId(createEmpleadoDto.cargoId)).exec();
    if (!cargo || !cargo.isActive) {
      throw new BadRequestException('Invalid or inactive position');
    }

    // Verificar que el cargo pertenece al área
    if (cargo.areaId.toString() !== createEmpleadoDto.areaId.toString()) {
      throw new BadRequestException('Position does not belong to the specified area');
    }

    // Verificar jefe inmediato si se proporciona
    if (createEmpleadoDto.jefeInmediatoId) {
      const jefe = await this.empleadoModel.findById(new Types.ObjectId(createEmpleadoDto.jefeInmediatoId)).exec();
      if (!jefe || jefe.estado !== 'ACTIVO') {
        throw new BadRequestException('Invalid or inactive immediate supervisor');
      }
    }

    const empleado = new this.empleadoModel({
  ...createEmpleadoDto,
  areaId: new Types.ObjectId(createEmpleadoDto.areaId),
  cargoId: new Types.ObjectId(createEmpleadoDto.cargoId),
  jefeInmediatoId: createEmpleadoDto.jefeInmediatoId ? new Types.ObjectId(createEmpleadoDto.jefeInmediatoId) : null,
      fechaInicio: new Date(createEmpleadoDto.fechaInicio),
      fechaNacimiento: new Date(createEmpleadoDto.fechaNacimiento),
      estado: createEmpleadoDto.estado || 'ACTIVO',
      pais: createEmpleadoDto.pais || 'Colombia',
    });

    const savedEmpleado = await empleado.save();

    // Generar contrato automáticamente
    await this.generarContratoAutomatico(savedEmpleado);

    return savedEmpleado;
  }

  async findAllEmpleados(includeInactive = false, areaId?: string, cargoId?: string): Promise<EmpleadoDocument[]> {
    const filter: any = includeInactive ? {} : { estado: 'ACTIVO' };
    
    if (areaId) {
      if (!Types.ObjectId.isValid(areaId)) {
        throw new BadRequestException('Invalid area ID format');
      }
      filter.areaId = new Types.ObjectId(areaId);
    }

    if (cargoId) {
      if (!Types.ObjectId.isValid(cargoId)) {
        throw new BadRequestException('Invalid position ID format');
      }
      filter.cargoId = new Types.ObjectId(cargoId);
    }

    return await this.empleadoModel
      .find(filter)
      .populate('areaId', 'name code color')
      .populate('cargoId', 'name code hierarchyLevel')
      .populate('jefeInmediatoId', 'nombre apellido correoElectronico')
      .sort({ fechaInicio: -1, apellido: 1, nombre: 1 })
      .exec();
  }

  async findEmpleadoById(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    const empleado = await this.empleadoModel
      .findById(id)
      .populate('areaId', 'name code color')
      .populate('cargoId', 'name code hierarchyLevel')
      .populate('jefeInmediatoId', 'nombre apellido correoElectronico')
      .exec();
      
    if (!empleado) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

    // Adjuntar información de cuenta de usuario vinculada (si existe)
    const cuenta = await this.userModel
      .findOne({ empleadoId: empleado._id })
      .select('_id username email')
      .exec();

    const plain = empleado.toObject();
    return {
      ...plain,
      hasUserAccount: !!cuenta,
      userAccount: cuenta
        ? {
            id: String(cuenta._id),
            username: cuenta.username,
            email: cuenta.email ?? null,
          }
        : null,
    };
  }

  async updateEmpleado(id: string, updateEmpleadoDto: UpdateEmpleadoDto): Promise<EmpleadoDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    // Si se actualiza el correo, verificar que no exista
    if (updateEmpleadoDto.correoElectronico) {
      const existingEmail = await this.empleadoModel.findOne({
        correoElectronico: updateEmpleadoDto.correoElectronico.toLowerCase(),
        _id: { $ne: new Types.ObjectId(id) }
      }).exec();

      if (existingEmail) {
        throw new ConflictException(`Employee with email '${updateEmpleadoDto.correoElectronico}' already exists`);
      }
    }

    // Si se actualiza el número de identificación, verificar que no exista
    if (updateEmpleadoDto.numeroIdentificacion) {
      const existingId = await this.empleadoModel.findOne({
        numeroIdentificacion: updateEmpleadoDto.numeroIdentificacion,
        _id: { $ne: new Types.ObjectId(id) }
      }).exec();

      if (existingId) {
        throw new ConflictException(`Employee with ID '${updateEmpleadoDto.numeroIdentificacion}' already exists`);
      }
    }

    // Validaciones similares para área y cargo si se actualizan
    if (updateEmpleadoDto.areaId) {
      const area = await this.areaModel.findById(updateEmpleadoDto.areaId).exec();
      if (!area || !area.isActive) {
        throw new BadRequestException('Invalid or inactive area');
      }
    }

    if (updateEmpleadoDto.cargoId) {
      const cargo = await this.cargoModel.findById(updateEmpleadoDto.cargoId).exec();
      if (!cargo || !cargo.isActive) {
        throw new BadRequestException('Invalid or inactive position');
      }
    }

    const updatedData = {
      ...updateEmpleadoDto,
      ...(updateEmpleadoDto.fechaInicio && { fechaInicio: new Date(updateEmpleadoDto.fechaInicio) }),
      ...(updateEmpleadoDto.fechaNacimiento && { fechaNacimiento: new Date(updateEmpleadoDto.fechaNacimiento) }),
    };

    const empleado = await this.empleadoModel.findByIdAndUpdate(
      id,
      updatedData,
      { new: true, runValidators: true }
    )
    .populate('areaId', 'name code color')
    .populate('cargoId', 'name code hierarchyLevel')
    .populate('jefeInmediatoId', 'nombre apellido correoElectronico')
    .exec();

    if (!empleado) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

    return empleado;
  }

  async deleteEmpleado(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    // En lugar de eliminar, marcar como TERMINADO
    const result = await this.empleadoModel.findByIdAndUpdate(
      id,
      { estado: 'TERMINADO' },
      { new: true }
    ).exec();

    if (!result) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }
  }

  // ========== CONTRATOS ==========

  private async generarContratoAutomatico(empleado: EmpleadoDocument): Promise<ContratoDocument | null> {
    // Buscar plantilla de contrato para el área y cargo
    const plantilla = await this.plantillaModel.findOne({
      areaId: empleado.areaId,
      cargoId: empleado.cargoId,
      tipoContrato: empleado.tipoContrato,
      activa: true
    }).exec();

    if (!plantilla) {
      // No bloquear la creación del empleado si no hay plantilla disponible.
      // Se puede registrar un warning y continuar sin generar contrato.
      // Alternativa futura: generar un contrato genérico temporal.
      return null;
    }

    // Generar número de contrato único
    const numeroContrato = await this.generarNumeroContrato();

    // Generar contenido del contrato reemplazando variables
    const contenidoContrato = await this.generarContenidoContrato(plantilla, empleado);

    const contrato = new this.contratoModel({
      empleadoId: empleado._id,
      numeroContrato,
      tipoContrato: empleado.tipoContrato,
      fechaInicio: empleado.fechaInicio,
      estado: 'EN_REVISION',
      contenidoContrato,
      plantillaId: plantilla._id,
    });

    return await contrato.save();
  }

  private async generarNumeroContrato(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.contratoModel.countDocuments({
      numeroContrato: { $regex: `^CT${year}` }
    }).exec();
    
    return `CT${year}${String(count + 1).padStart(4, '0')}`;
  }

  private async generarContenidoContrato(plantilla: PlantillaContratoDocument, empleado: EmpleadoDocument): Promise<string> {
    // Poblar datos del empleado para reemplazo
    const empleadoPopulado = await this.empleadoModel
      .findById(empleado._id)
      .populate('areaId', 'name')
      .populate('cargoId', 'name')
      .exec();

    if (!empleadoPopulado) {
      throw new BadRequestException('Employee not found for contract generation');
    }

    let contenido = plantilla.contenidoPlantilla;

    // Reemplazar variables en el contenido
    const variables = {
      '{{nombre}}': empleadoPopulado.nombre,
      '{{apellido}}': empleadoPopulado.apellido,
      '{{nombreCompleto}}': `${empleadoPopulado.nombre} ${empleadoPopulado.apellido}`,
      '{{correoElectronico}}': empleadoPopulado.correoElectronico,
      '{{telefono}}': empleadoPopulado.telefono,
      '{{numeroIdentificacion}}': empleadoPopulado.numeroIdentificacion,
      '{{direccion}}': empleadoPopulado.direccion,
      '{{ciudad}}': empleadoPopulado.ciudad,
      '{{pais}}': empleadoPopulado.pais,
      '{{area}}': (empleadoPopulado.areaId as any).name,
      '{{cargo}}': (empleadoPopulado.cargoId as any).name,
      '{{salario}}': empleadoPopulado.salario.monto.toLocaleString('es-CO'),
      '{{moneda}}': empleadoPopulado.salario.moneda,
      '{{fechaInicio}}': empleadoPopulado.fechaInicio.toLocaleDateString('es-CO'),
      '{{tipoContrato}}': empleadoPopulado.tipoContrato.replace('_', ' '),
      '{{fechaActual}}': new Date().toLocaleDateString('es-CO'),
    };

    for (const [variable, valor] of Object.entries(variables)) {
      contenido = contenido.replace(new RegExp(variable, 'g'), valor);
    }

    return contenido;
  }

  async findContratosByEmpleado(empleadoId: string): Promise<ContratoDocument[]> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    return await this.contratoModel
      .find({ empleadoId: new Types.ObjectId(empleadoId) })
      .populate('plantillaId', 'nombre descripcion')
      .sort({ fechaInicio: -1 })
      .exec();
  }

  async aprobarContrato(contratoId: string, aprobarDto: AprobarContratoDto, userId: string): Promise<ContratoDocument> {
    if (!Types.ObjectId.isValid(contratoId)) {
      throw new BadRequestException('Invalid contract ID format');
    }

    const contrato = await this.contratoModel.findById(contratoId).exec();
    if (!contrato) {
      throw new NotFoundException(`Contract with ID '${contratoId}' not found`);
    }

    if (contrato.estado !== 'EN_REVISION') {
      throw new BadRequestException('Contract is not in review status');
    }

    const updatedContrato = await this.contratoModel.findByIdAndUpdate(
      contratoId,
      {
        estado: aprobarDto.estado,
        aprobacion: {
          aprobadoPor: new Types.ObjectId(userId),
          fechaAprobacion: new Date(),
          comentarios: aprobarDto.comentarios,
        },
      },
      { new: true, runValidators: true }
    )
    .populate('empleadoId', 'nombre apellido correoElectronico')
    .populate('plantillaId', 'nombre descripcion')
    .exec();

    return updatedContrato!;
  }

  // ========== UTILIDADES ==========

  async getEmpleadosStats(): Promise<any> {
    const totalEmpleados = await this.empleadoModel.countDocuments().exec();
    const empleadosActivos = await this.empleadoModel.countDocuments({ estado: 'ACTIVO' }).exec();
    const contratosEnRevision = await this.contratoModel.countDocuments({ estado: 'EN_REVISION' }).exec();
    
    const empleadosPorArea = await this.empleadoModel.aggregate([
      { $match: { estado: 'ACTIVO' } },
      { $group: { _id: '$areaId', count: { $sum: 1 } } },
      { $lookup: { from: 'rrhh_areas', localField: '_id', foreignField: '_id', as: 'area' } },
      { $unwind: '$area' },
      { $project: { _id: 0, area: '$area.name', count: 1 } }
    ]).exec();

    return {
      totalEmpleados,
      empleadosActivos,
      empleadosInactivos: totalEmpleados - empleadosActivos,
      contratosEnRevision,
      empleadosPorArea,
    };
  }

  // ========== CREAR CUENTA DE USUARIO ==========

  async crearCuentaParaEmpleado(empleadoId: string): Promise<{ username: string; password: string; email: string }> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    // Verificar que el empleado existe
    const empleado = await this.empleadoModel.findById(empleadoId).exec();
    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    // Verificar que el empleado no tenga ya una cuenta vinculada
    const cuentaExistente = await this.userModel.findOne({ empleadoId }).exec();
    if (cuentaExistente) {
      throw new ConflictException('Este empleado ya tiene una cuenta de usuario vinculada');
    }

    // Generar username basado en nombre y apellido
    const baseUsername = `${empleado.nombre.toLowerCase()}.${empleado.apellido.toLowerCase()}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');

    // Verificar que el username no exista, si existe agregar número
    let username = baseUsername;
    let counter = 1;
    while (await this.userModel.findOne({ username }).exec()) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Generar contraseña aleatoria segura
    const password = this.generarPasswordSegura();
    const passwordHash = createHash('sha256').update(password).digest('hex');

    // Crear usuario vinculado al empleado
    const nuevoUsuario = await this.userModel.create({
      username,
      passwordHash,
      empleadoId: empleado._id,
      displayName: `${empleado.nombre} ${empleado.apellido}`,
      email: empleado.correoElectronico,
      roles: [],
      permissions: [],
    });

    return {
      username,
      password, // Retornamos la contraseña en texto plano SOLO esta vez
      email: empleado.correoElectronico,
    };
  }

  private generarPasswordSegura(): string {
    // Genera una contraseña segura de 12 caracteres con mayúsculas, minúsculas, números y símbolos
    const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const minusculas = 'abcdefghijklmnopqrstuvwxyz';
    const numeros = '0123456789';
    const simbolos = '!@#$%&*';
    const todos = mayusculas + minusculas + numeros + simbolos;

    let password = '';
    // Asegurar al menos un carácter de cada tipo
    password += mayusculas[Math.floor(Math.random() * mayusculas.length)];
    password += minusculas[Math.floor(Math.random() * minusculas.length)];
    password += numeros[Math.floor(Math.random() * numeros.length)];
    password += simbolos[Math.floor(Math.random() * simbolos.length)];

    // Completar con caracteres aleatorios
    for (let i = password.length; i < 12; i++) {
      password += todos[Math.floor(Math.random() * todos.length)];
    }

    // Mezclar los caracteres
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
