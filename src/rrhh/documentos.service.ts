import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentoEntity, DocumentoDocument } from './documento.schema.js';
import { EmpleadoEntity } from './empleado.schema.js';
import { ContratoEntity } from './contrato.schema.js';
import { CreateDocumentoDto, UpdateDocumentoDto, ValidarDocumentoDto, RenovarDocumentoDto } from './dto/create-documento.dto.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

@Injectable()
export class DocumentosService {
  constructor(
    @InjectModel(DocumentoEntity.name) private documentoModel: Model<DocumentoDocument>,
    @InjectModel(EmpleadoEntity.name) private empleadoModel: Model<EmpleadoEntity>,
    @InjectModel(ContratoEntity.name) private contratoModel: Model<ContratoEntity>,
    private cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crear un nuevo documento
   */
  async crearDocumento(createDocumentoDto: CreateDocumentoDto, usuarioId: Types.ObjectId): Promise<DocumentoEntity> {
    // Verificar que el empleado existe
    const empleado = await this.empleadoModel.findById(new Types.ObjectId(createDocumentoDto.empleadoId));
    if (!empleado) {
      throw new NotFoundException('Empleado no encontrado');
    }

    // Si se especifica un contrato, verificar que existe
    if (createDocumentoDto.contratoId) {
      const contrato = await this.contratoModel.findById(new Types.ObjectId(createDocumentoDto.contratoId));
      if (!contrato) {
        throw new NotFoundException('Contrato no encontrado');
      }
    }

    // Crear el documento
    const documento = new this.documentoModel({
      ...createDocumentoDto,
      empleadoId: new Types.ObjectId(createDocumentoDto.empleadoId),
      contratoId: createDocumentoDto.contratoId ? new Types.ObjectId(createDocumentoDto.contratoId) : null,
      fechaSubida: new Date(),
      'validacion.validadoPor': usuarioId,
    });

    return await documento.save();
  }

  /**
   * Obtener todos los documentos de un empleado
   */
  async obtenerDocumentosPorEmpleado(
    empleadoId: Types.ObjectId,
    filtros?: {
      tipoDocumento?: string;
      estado?: string;
      esConfidencial?: boolean;
    }
  ): Promise<DocumentoEntity[]> {
    const query: any = { empleadoId };

    if (filtros?.tipoDocumento) {
      query.tipoDocumento = filtros.tipoDocumento;
    }

    if (filtros?.estado) {
      query.estado = filtros.estado;
    }

    if (filtros?.esConfidencial !== undefined) {
      query.esConfidencial = filtros.esConfidencial;
    }

    return await this.documentoModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('contratoId', 'numeroContrato tipoContrato estado')
      .populate('validacion.validadoPor', 'nombre apellido')
      .sort({ createdAt: -1 });
  }

  /**
   * Obtener un documento por ID
   */
  async obtenerDocumentoPorId(documentoId: Types.ObjectId): Promise<DocumentoEntity> {
    const documento = await this.documentoModel
      .findById(documentoId)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('contratoId', 'numeroContrato tipoContrato estado')
      .populate('validacion.validadoPor', 'nombre apellido');

    if (!documento) {
      throw new NotFoundException('Documento no encontrado');
    }

    return documento;
  }

  /**
   * Actualizar un documento
   */
  async actualizarDocumento(
    documentoId: Types.ObjectId,
    updateDocumentoDto: UpdateDocumentoDto
  ): Promise<DocumentoEntity> {
    const documento = await this.documentoModel.findByIdAndUpdate(
      documentoId,
      { $set: updateDocumentoDto },
      { new: true, runValidators: true }
    );

    if (!documento) {
      throw new NotFoundException('Documento no encontrado');
    }

    return documento;
  }

  /**
   * Validar un documento (aprobar/rechazar)
   */
  async validarDocumento(
    documentoId: Types.ObjectId,
    validarDocumentoDto: ValidarDocumentoDto,
    usuarioId: Types.ObjectId
  ): Promise<DocumentoEntity> {
    const documento = await this.documentoModel.findByIdAndUpdate(
      documentoId,
      {
        $set: {
          estado: validarDocumentoDto.estado,
          'validacion.validadoPor': usuarioId,
          'validacion.fechaValidacion': new Date(),
          'validacion.observaciones': validarDocumentoDto.observaciones,
          'validacion.esValido': validarDocumentoDto.esValido ?? (validarDocumentoDto.estado === 'APROBADO'),
        }
      },
      { new: true, runValidators: true }
    );

    if (!documento) {
      throw new NotFoundException('Documento no encontrado');
    }

    return documento;
  }

  /**
   * Renovar un documento vencido
   */
  async renovarDocumento(
    documentoId: Types.ObjectId,
    renovarDocumentoDto: RenovarDocumentoDto,
    usuarioId: Types.ObjectId
  ): Promise<DocumentoEntity> {
    const documentoOriginal = await this.documentoModel.findById(documentoId);
    if (!documentoOriginal) {
      throw new NotFoundException('Documento original no encontrado');
    }

    // Crear el nuevo documento
    const nuevoDocumento = new this.documentoModel({
      empleadoId: documentoOriginal.empleadoId,
      contratoId: documentoOriginal.contratoId,
      nombre: renovarDocumentoDto.nombre,
      nombreOriginal: renovarDocumentoDto.nombreOriginal,
      tipoDocumento: documentoOriginal.tipoDocumento,
      descripcion: renovarDocumentoDto.descripcion,
      urlArchivo: renovarDocumentoDto.urlArchivo,
      publicId: renovarDocumentoDto.publicId,
      formato: renovarDocumentoDto.formato,
      tamañoBytes: renovarDocumentoDto.tamañoBytes,
      mimeType: renovarDocumentoDto.mimeType,
      fechaEmision: new Date(renovarDocumentoDto.fechaEmision),
      fechaVencimiento: renovarDocumentoDto.fechaVencimiento ? new Date(renovarDocumentoDto.fechaVencimiento) : null,
      fechaSubida: new Date(),
      estado: 'PENDIENTE',
      esConfidencial: documentoOriginal.esConfidencial,
      tags: documentoOriginal.tags,
      'renovacion.requiereRenovacion': documentoOriginal.renovacion?.requiereRenovacion ?? false,
      'renovacion.diasAntesVencimiento': documentoOriginal.renovacion?.diasAntesVencimiento ?? 30,
      'renovacion.documentoAnterior': documentoId,
      'validacion.validadoPor': usuarioId,
    });

    const documentoRenovado = await nuevoDocumento.save();

    // Actualizar el documento original como renovado
    await this.documentoModel.findByIdAndUpdate(documentoId, {
      $set: { estado: 'RENOVADO' }
    });

    return documentoRenovado;
  }

  /**
   * Eliminar un documento
   */
  async eliminarDocumento(documentoId: Types.ObjectId): Promise<void> {
    const documento = await this.documentoModel.findById(documentoId);
    if (!documento) {
      throw new NotFoundException('Documento no encontrado');
    }

    // Eliminar el archivo de Cloudinary
    try {
      await this.cloudinaryService.deleteImage(documento.publicId);
    } catch (error) {
      console.error('Error eliminando archivo de Cloudinary:', error);
    }

    // Eliminar el documento de la base de datos
    await this.documentoModel.findByIdAndDelete(documentoId);
  }

  /**
   * Obtener documentos próximos a vencer
   */
  async obtenerDocumentosProximosAVencer(dias: number = 30): Promise<DocumentoEntity[]> {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + dias);

    return await this.documentoModel
      .find({
        fechaVencimiento: { $lte: fechaLimite, $gte: new Date() },
        estado: { $in: ['APROBADO', 'PENDIENTE'] },
        'renovacion.requiereRenovacion': true
      })
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('contratoId', 'numeroContrato')
      .sort({ fechaVencimiento: 1 });
  }

  /**
   * Obtener documentos vencidos
   */
  async obtenerDocumentosVencidos(): Promise<DocumentoEntity[]> {
    return await this.documentoModel
      .find({
        fechaVencimiento: { $lt: new Date() },
        estado: { $in: ['APROBADO', 'PENDIENTE'] }
      })
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('contratoId', 'numeroContrato')
      .sort({ fechaVencimiento: 1 });
  }

  /**
   * Marcar documentos vencidos automáticamente
   */
  async marcarDocumentosVencidos(): Promise<number> {
    const resultado = await this.documentoModel.updateMany(
      {
        fechaVencimiento: { $lt: new Date() },
        estado: { $in: ['APROBADO', 'PENDIENTE'] }
      },
      {
        $set: { estado: 'VENCIDO' }
      }
    );

    return resultado.modifiedCount;
  }

  /**
   * Obtener estadísticas de documentos por empleado
   */
  async obtenerEstadisticasDocumentos(empleadoId: Types.ObjectId): Promise<{
    total: number;
    porEstado: Record<string, number>;
    porTipo: Record<string, number>;
    proximosAVencer: number;
    vencidos: number;
  }> {
    const documentos = await this.documentoModel.find({ empleadoId });

    const estadisticas = {
      total: documentos.length,
      porEstado: {} as Record<string, number>,
      porTipo: {} as Record<string, number>,
      proximosAVencer: 0,
      vencidos: 0
    };

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 30);

    documentos.forEach(doc => {
      // Contar por estado
      estadisticas.porEstado[doc.estado] = (estadisticas.porEstado[doc.estado] || 0) + 1;

      // Contar por tipo
      estadisticas.porTipo[doc.tipoDocumento] = (estadisticas.porTipo[doc.tipoDocumento] || 0) + 1;

      // Contar próximos a vencer
      if (doc.fechaVencimiento && doc.fechaVencimiento <= fechaLimite && doc.fechaVencimiento > new Date()) {
        estadisticas.proximosAVencer++;
      }

      // Contar vencidos
      if (doc.fechaVencimiento && doc.fechaVencimiento < new Date()) {
        estadisticas.vencidos++;
      }
    });

    return estadisticas;
  }

  /**
   * Buscar documentos por criterios
   */
  async buscarDocumentos(criterios: {
    empleadoId?: Types.ObjectId;
    tipoDocumento?: string;
    estado?: string;
    fechaInicio?: Date;
    fechaFin?: Date;
    esConfidencial?: boolean;
    tags?: string[];
  }): Promise<DocumentoEntity[]> {
    const query: any = {};

    if (criterios.empleadoId) {
      query.empleadoId = criterios.empleadoId;
    }

    if (criterios.tipoDocumento) {
      query.tipoDocumento = criterios.tipoDocumento;
    }

    if (criterios.estado) {
      query.estado = criterios.estado;
    }

    if (criterios.fechaInicio || criterios.fechaFin) {
      query.fechaEmision = {};
      if (criterios.fechaInicio) {
        query.fechaEmision.$gte = criterios.fechaInicio;
      }
      if (criterios.fechaFin) {
        query.fechaEmision.$lte = criterios.fechaFin;
      }
    }

    if (criterios.esConfidencial !== undefined) {
      query.esConfidencial = criterios.esConfidencial;
    }

    if (criterios.tags && criterios.tags.length > 0) {
      query.tags = { $in: criterios.tags };
    }

    return await this.documentoModel
      .find(query)
      .populate('empleadoId', 'nombre apellido correoElectronico')
      .populate('contratoId', 'numeroContrato tipoContrato')
      .populate('validacion.validadoPor', 'nombre apellido')
      .sort({ createdAt: -1 });
  }
}
