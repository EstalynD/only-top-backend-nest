import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { EmpleadoEntity, EmpleadoDocument } from './empleado.schema.js';
import { ContratoEntity, ContratoDocument } from './contrato.schema.js';
// import { PlantillaContratoEntity, PlantillaContratoDocument } from './plantilla-contrato.schema.js'; // No usamos plantillas
import { AreaEntity, AreaDocument } from './area.schema.js';
import { CargoEntity, CargoDocument } from './cargo.schema.js';
import { UserEntity } from '../users/user.schema.js';
import { CreateEmpleadoDto } from './dto/create-empleado.dto.js';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto.js';
import { CreateContratoDto, AprobarContratoDto } from './dto/create-contrato.dto.js';
import { ContractTemplatesService } from './contract-templates/contract-templates.service.js';
import { EndowmentService } from './endowment-tracking/endowment.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoDocument>,
    @InjectModel(ContratoEntity.name) private contratoModel: Model<ContratoDocument>,
    // @InjectModel(PlantillaContratoEntity.name) private plantillaModel: Model<PlantillaContratoDocument>, // No usamos plantillas
    @InjectModel(AreaEntity.name) private areaModel: Model<AreaDocument>,
    @InjectModel(CargoEntity.name) private cargoModel: Model<CargoDocument>,
    @InjectModel(UserEntity.name) private userModel: Model<any>,
    private readonly contractTemplatesService: ContractTemplatesService,
    private readonly endowmentService: EndowmentService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ========== UTILIDADES ==========

  /**
   * Normaliza las URLs de las imágenes en un empleado
   */
  private normalizeEmpleadoImageUrls(empleado: any): any {
    if (empleado.fotoPerfil) {
      empleado.fotoPerfil = this.cloudinaryService.normalizeImageUrl(empleado.fotoPerfil);
    }
    return empleado;
  }

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

    const empleados = await this.empleadoModel
      .find(filter)
      .populate('areaId', 'name code color')
      .populate('cargoId', 'name code hierarchyLevel')
      .populate('jefeInmediatoId', 'nombre apellido correoElectronico')
      .sort({ fechaInicio: -1, apellido: 1, nombre: 1 })
      .exec();

    // Normalizar URLs de imágenes
    return empleados.map(empleado => this.normalizeEmpleadoImageUrls(empleado.toObject()));
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
    const normalizedEmpleado = this.normalizeEmpleadoImageUrls(plain);
    return {
      ...normalizedEmpleado,
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

  /**
   * Busca un empleado por el ID de su cuenta de usuario
   */
  async findEmpleadoByUserId(userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Primero buscar la cuenta de usuario para obtener el empleadoId
    const cuenta = await this.userModel
      .findById(userId)
      .select('empleadoId username email')
      .exec();

    if (!cuenta || !cuenta.empleadoId) {
      throw new NotFoundException(`User with ID '${userId}' not found or has no associated employee`);
    }

    // Buscar el empleado con populate
    const empleado = await this.empleadoModel
      .findById(cuenta.empleadoId)
      .populate('areaId', 'name code color')
      .populate('cargoId', 'name code hierarchyLevel')
      .populate('jefeInmediatoId', 'nombre apellido correoElectronico')
      .exec();

    if (!empleado) {
      throw new NotFoundException(`Employee with ID '${cuenta.empleadoId}' not found`);
    }

    const plain = empleado.toObject();
    const normalizedEmpleado = this.normalizeEmpleadoImageUrls(plain);
    return {
      ...normalizedEmpleado,
      hasUserAccount: true,
      userAccount: {
        id: String(cuenta._id),
        username: cuenta.username,
        email: cuenta.email ?? null,
      },
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

    // Normalizar URLs de imágenes
    return this.normalizeEmpleadoImageUrls(empleado.toObject());
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
    try {
      // Recargar empleado con área y cargo para obtener los códigos
      const empleadoCompleto = await this.empleadoModel
        .findById(empleado._id)
        .populate('areaId')
        .populate('cargoId')
        .exec();

      if (!empleadoCompleto) return null;

      // Evitar duplicados: si ya hay un contrato en revisión o aprobado, no crear otro automáticamente
      const existente = await this.contratoModel
        .findOne({ empleadoId: empleadoCompleto._id, estado: { $in: ['EN_REVISION', 'APROBADO'] } })
        .sort({ createdAt: -1 })
        .exec();
      if (existente) return null;

      const areaCode = (empleadoCompleto.areaId as any)?.code;
      const cargoCode = (empleadoCompleto.cargoId as any)?.code;
      if (!areaCode || !cargoCode) return null;

      // Validar que exista plantilla para el área/cargo
      const tienePlantilla = await this.contractTemplatesService.validateTemplateExists(areaCode, cargoCode);
      if (!tienePlantilla) return null;

      // Obtener información de contrato desde la plantilla
      // Obtener información de contrato y template sugerido por el servicio
      const suggestedInfo = await this.contractTemplatesService.getContractInfoForEmployee(
        empleadoCompleto._id.toString()
      );
      const templateId = suggestedInfo?.templateId ?? null;
      const contractInfo = templateId
        ? await this.contractTemplatesService.getContractInfoForTemplate(
            empleadoCompleto._id.toString(),
            templateId
          )
        : suggestedInfo;

      // Generar número de contrato propio (persistente y único)
      const numeroContrato = await this.generarNumeroContrato();

      // Construir contenido textual del contrato (HTML o texto) a partir de la info
  const contenidoContrato = this.buildContractContentFromInfo(contractInfo, numeroContrato);

      const contrato = new this.contratoModel({
        empleadoId: empleadoCompleto._id,
        numeroContrato,
        tipoContrato: empleadoCompleto.tipoContrato,
        fechaInicio: empleadoCompleto.fechaInicio,
        fechaFin: null,
        estado: 'EN_REVISION',
        contenidoContrato,
        templateKey: templateId ?? null,
        meta: {
          templateId: templateId ?? contractInfo.templateId,
          templateName: contractInfo.templateName,
          areaCode,
          cargoCode,
          contractNumberFromTemplate: contractInfo.contractNumber,
          generatedAt: new Date(),
          source: 'auto-on-employee-create',
          snapshot: {
            empleado: {
              id: empleadoCompleto._id,
              nombre: empleadoCompleto.nombre,
              apellido: empleadoCompleto.apellido,
              numeroIdentificacion: empleadoCompleto.numeroIdentificacion,
              correoElectronico: empleadoCompleto.correoElectronico,
            },
            laboral: {
              area: {
                id: (empleadoCompleto.areaId as any)?._id,
                code: areaCode,
                name: (empleadoCompleto.areaId as any)?.name,
              },
              cargo: {
                id: (empleadoCompleto.cargoId as any)?._id,
                code: cargoCode,
                name: (empleadoCompleto.cargoId as any)?.name,
              },
              tipoContrato: empleadoCompleto.tipoContrato,
              salario: empleadoCompleto.salario,
              fechaInicio: empleadoCompleto.fechaInicio,
            },
            terminos: {
              workSchedule: contractInfo.workSchedule,
              responsibilities: contractInfo.responsibilities,
              benefits: contractInfo.benefits,
              obligations: contractInfo.obligations,
            },
          },
        },
      });

      return await contrato.save();
    } catch (err) {
      // No bloquear la creación del empleado por fallo al generar contrato
      return null;
    }
  }

  private async generarNumeroContrato(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.contratoModel.countDocuments({
      numeroContrato: { $regex: `^CT${year}` }
    }).exec();
    
    return `CT${year}${String(count + 1).padStart(4, '0')}`;
  }

  // Método removido: generarContenidoContrato - ya no usamos plantillas

  // Construye un contenido simple de contrato (texto/HTML) basado en la información de la plantilla
  private buildContractContentFromInfo(info: any, numeroContratoOverride?: string): string {
    try {
      const numeroParaMostrar = numeroContratoOverride || info.contractNumber;
      const encabezado = `Contrato: ${numeroParaMostrar} - Plantilla: ${info.templateName}`;
      const empleadoLinea = `Empleado: ${info.employeeName} (ID: ${info.employeeId})`;
      const puestoLinea = `Área: ${info.area} | Cargo: ${info.cargo}`;
      const horario = info.workSchedule?.type === 'ROTATING'
        ? 'Horario: Turnos rotativos'
        : 'Horario: Fijo';

      const responsabilidades = Array.isArray(info.responsibilities)
        ? info.responsibilities.map((r: string) => `- ${r}`).join('\n')
        : '';
      const beneficios = Array.isArray(info.benefits)
        ? info.benefits.map((b: string) => `- ${b}`).join('\n')
        : '';
      const obligaciones = Array.isArray(info.obligations)
        ? info.obligations.map((o: string) => `- ${o}`).join('\n')
        : '';

      return [
        encabezado,
        empleadoLinea,
        puestoLinea,
        horario,
        '',
        'Responsabilidades:',
        responsabilidades,
        '',
        'Beneficios:',
        beneficios,
        '',
        'Obligaciones:',
        obligaciones,
      ].join('\n');
    } catch {
      // Fallback a serialización JSON si algo falla
      return typeof info === 'string' ? info : JSON.stringify(info);
    }
  }

  async findContratosByEmpleado(empleadoId: string): Promise<ContratoDocument[]> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('Invalid employee ID format');
    }

    return await this.contratoModel
      .find({ empleadoId: new Types.ObjectId(empleadoId) })
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

  // ========== CONTRATOS LABORALES ==========

  /**
   * Genera un contrato laboral para un empleado específico
   */
  async generateLaborContract(empleadoId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    // Verificar que el empleado existe
    const empleado = await this.empleadoModel.findById(empleadoId).exec();
    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    return await this.contractTemplatesService.generateContractForEmployee(empleadoId);
  }

  /**
   * Obtiene información del contrato laboral sin generar el PDF
   */
  async getLaborContractInfo(empleadoId: string): Promise<any> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    // Verificar que el empleado existe
    const empleado = await this.empleadoModel.findById(empleadoId).exec();
    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    return await this.contractTemplatesService.getContractInfoForEmployee(empleadoId);
  }

  /**
   * Obtiene las plantillas de contratos disponibles
   */
  async getAvailableContractTemplates(): Promise<any[]> {
    const templates = this.contractTemplatesService.getAvailableTemplates();
    console.log('Service returning templates:', templates);
    return templates;
  }

  /**
   * Obtiene plantillas de contratos por área
   */
  async getContractTemplatesByArea(areaCode: string): Promise<any[]> {
    return this.contractTemplatesService.getTemplatesByArea(areaCode);
  }

  /**
   * Obtiene plantillas de contratos por cargo
   */
  async getContractTemplatesByCargo(cargoCode: string): Promise<any[]> {
    return this.contractTemplatesService.getTemplatesByCargo(cargoCode);
  }

  /**
   * Valida si existe una plantilla para un empleado específico
   */
  async validateContractTemplateExists(empleadoId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    const empleado = await this.empleadoModel
      .findById(empleadoId)
      .populate('areaId')
      .populate('cargoId')
      .exec();

    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const areaCode = (empleado.areaId as any)?.code;
    const cargoCode = (empleado.cargoId as any)?.code;

    if (!areaCode || !cargoCode) {
      return false;
    }

    return await this.contractTemplatesService.validateTemplateExists(areaCode, cargoCode);
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

  async resetPasswordEmpleado(empleadoId: string): Promise<{ username: string; password: string; email: string }> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    // Verificar que el empleado existe
    const empleado = await this.empleadoModel.findById(empleadoId).exec();
    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    // Verificar que el empleado tiene una cuenta vinculada
    const cuentaExistente = await this.userModel.findOne({ empleadoId }).exec();
    if (!cuentaExistente) {
      throw new BadRequestException('Este empleado no tiene una cuenta de usuario vinculada');
    }

    // Generar nueva contraseña
    const newPassword = this.generarPasswordSegura();
    const passwordHash = createHash('sha256').update(newPassword).digest('hex');

    // Actualizar la contraseña en la base de datos
    await this.userModel.findByIdAndUpdate(cuentaExistente._id, {
      passwordHash
    }).exec();

    return {
      username: cuentaExistente.username,
      password: newPassword, // Retornamos la contraseña en texto plano SOLO esta vez
      email: empleado.correoElectronico,
    };
  }

  async editarCuentaEmpleado(empleadoId: string, updateData: { username?: string; email?: string; displayName?: string }): Promise<{ username: string; email: string; displayName: string }> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    // Verificar que el empleado existe
    const empleado = await this.empleadoModel.findById(empleadoId).exec();
    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    // Verificar que el empleado tiene una cuenta vinculada
    const cuentaExistente = await this.userModel.findOne({ empleadoId }).exec();
    if (!cuentaExistente) {
      throw new BadRequestException('Este empleado no tiene una cuenta de usuario vinculada');
    }

    // Validar que el nuevo username no exista (si se está cambiando)
    if (updateData.username && updateData.username !== cuentaExistente.username) {
      const usernameExists = await this.userModel.findOne({ 
        username: updateData.username,
        _id: { $ne: cuentaExistente._id }
      }).exec();
      
      if (usernameExists) {
        throw new ConflictException('El nombre de usuario ya está en uso');
      }
    }

    // Validar que el nuevo email no exista (si se está cambiando)
    if (updateData.email && updateData.email !== cuentaExistente.email) {
      const emailExists = await this.userModel.findOne({ 
        email: updateData.email.toLowerCase(),
        _id: { $ne: cuentaExistente._id }
      }).exec();
      
      if (emailExists) {
        throw new ConflictException('El correo electrónico ya está en uso');
      }
    }

    // Actualizar la cuenta
    const updateFields: any = {};
    if (updateData.username) updateFields.username = updateData.username;
    if (updateData.email) updateFields.email = updateData.email.toLowerCase();
    if (updateData.displayName !== undefined) updateFields.displayName = updateData.displayName;

    const cuentaActualizada = await this.userModel.findByIdAndUpdate(
      cuentaExistente._id,
      updateFields,
      { new: true }
    ).exec();

    if (!cuentaActualizada) {
      throw new NotFoundException('No se pudo actualizar la cuenta');
    }

    return {
      username: cuentaActualizada.username,
      email: cuentaActualizada.email || empleado.correoElectronico,
      displayName: cuentaActualizada.displayName || `${empleado.nombre} ${empleado.apellido}`,
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

  // ========== DOTACIÓN ==========

  /**
   * Obtiene el historial completo de dotación de un empleado
   */
  async getEmpleadoDotacionHistorial(empleadoId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    return await this.endowmentService.findTrackingByEmpleado(empleadoId);
  }

  /**
   * Obtiene los elementos activos (entregados sin devolver) de un empleado
   */
  async getEmpleadoDotacionActiva(empleadoId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    const tracking = await this.endowmentService.findAllTracking({ empleadoId });
    
    // Filtrar solo entregas activas (sin devolución correspondiente)
    const entregasActivas = tracking.filter(t => {
      if (t.action !== 'ENTREGA') return false;
      
      // Buscar si hay una devolución posterior para este elemento
      const devolucion = tracking.find(d => 
        d.itemId._id === t.itemId._id && 
        d.action === 'DEVOLUCION' && 
        new Date(d.actionDate) > new Date(t.actionDate)
      );
      
      return !devolucion;
    });

    return entregasActivas;
  }

  /**
   * Obtiene un resumen de dotación de un empleado
   */
  async getEmpleadoDotacionResumen(empleadoId: string): Promise<any> {
    if (!Types.ObjectId.isValid(empleadoId)) {
      throw new BadRequestException('ID de empleado inválido');
    }

    const tracking = await this.endowmentService.findAllTracking({ empleadoId });
    
    const resumen = {
      totalEntregas: tracking.filter(t => t.action === 'ENTREGA').length,
      totalDevoluciones: tracking.filter(t => t.action === 'DEVOLUCION').length,
      totalMantenimientos: tracking.filter(t => t.action === 'MANTENIMIENTO').length,
      totalReparaciones: tracking.filter(t => t.action === 'REPARACION').length,
      totalReemplazos: tracking.filter(t => t.action === 'REEMPLAZO').length,
      itemsActivos: 0,
      categorias: [] as string[],
      valorTotalEstimado: 0
    };

    // Calcular items activos y categorías
    const entregasActivas = tracking.filter(t => {
      if (t.action !== 'ENTREGA') return false;
      
      const devolucion = tracking.find(d => 
        d.itemId._id === t.itemId._id && 
        d.action === 'DEVOLUCION' && 
        new Date(d.actionDate) > new Date(t.actionDate)
      );
      
      return !devolucion;
    });

    resumen.itemsActivos = entregasActivas.length;
    
    const categoriasSet = new Set<string>();
    entregasActivas.forEach(entrega => {
      categoriasSet.add(entrega.categoryId.name);
      if (entrega.itemId.estimatedValue) {
        resumen.valorTotalEstimado += entrega.itemId.estimatedValue.monto;
      }
    });

    resumen.categorias = Array.from(categoriasSet);

    return resumen;
  }

  /**
   * Obtiene estadísticas de dotación por área
   */
  async getAreaDotacionEstadisticas(areaId: string): Promise<any> {
    if (!Types.ObjectId.isValid(areaId)) {
      throw new BadRequestException('ID de área inválido');
    }

    return await this.endowmentService.getEndowmentStats({ areaId });
  }

  /**
   * Obtiene empleados con dotación activa en un área específica
   */
  async getAreaEmpleadosConDotacion(areaId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(areaId)) {
      throw new BadRequestException('ID de área inválido');
    }

    // Obtener todos los empleados del área
    const empleados = await this.empleadoModel
      .find({ areaId: new Types.ObjectId(areaId), estado: 'ACTIVO' })
      .populate('areaId', 'name code')
      .populate('cargoId', 'name code')
      .exec();

    // Para cada empleado, obtener su resumen de dotación
    const empleadosConDotacion = await Promise.all(
      empleados.map(async (empleado) => {
        const resumen = await this.getEmpleadoDotacionResumen(empleado._id.toString());
        return {
          empleado: {
            _id: empleado._id,
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            correoElectronico: empleado.correoElectronico,
            areaId: empleado.areaId,
            cargoId: empleado.cargoId
          },
          dotacion: resumen
        };
      })
    );

    // Filtrar solo empleados que tienen dotación activa
    return empleadosConDotacion.filter(e => e.dotacion.itemsActivos > 0);
  }
}
