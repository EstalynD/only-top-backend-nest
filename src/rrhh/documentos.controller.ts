import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { DocumentosService } from './documentos.service.js';
import { CreateDocumentoDto, UpdateDocumentoDto, ValidarDocumentoDto, RenovarDocumentoDto } from './dto/create-documento.dto.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { User } from '../auth/user.decorator.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

@Controller(['api/rrhh/documentos', 'rrhh/documentos'])
@UseGuards(AuthGuard)
export class DocumentosController {
  constructor(
    private readonly documentosService: DocumentosService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crear un nuevo documento
   */
  @Post()
  @UseInterceptors(FileInterceptor('archivo'))
  async crearDocumento(
    @Body() createDocumentoDto: CreateDocumentoDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB (alineado con CloudinaryService)
          new FileTypeValidator({
            fileType: /^(application\/pdf|image\/(jpeg|jpg|png)|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/,
          }),
        ],
      }),
    )
    archivo: any,
    @User() usuario: any,
  ) {
    try {
      // Subir archivo a Cloudinary
      const resultado = await this.cloudinaryService.uploadBuffer(archivo.buffer, {
        folder: 'rrhh/documentos',
        resource_type: 'auto',
        public_id: `${Date.now()}_${archivo.originalname}`,
      }, archivo.mimetype);

      // Crear el documento con la información del archivo
      const documentoData = {
        ...createDocumentoDto,
        urlArchivo: resultado.data?.url || '',
        publicId: resultado.data?.publicId || '',
        // usar formato (extensión) que devuelve Cloudinary, no el mimetype
        formato: (resultado.data as any)?.format || (archivo.originalname.split('.').pop()?.toLowerCase() || ''),
        tamañoBytes: archivo.size,
        mimeType: archivo.mimetype,
      };

      const documento = await this.documentosService.crearDocumento(
        documentoData,
        new Types.ObjectId(usuario.id)
      );

      return {
        success: true,
        message: 'Documento creado exitosamente',
        data: documento,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtener todos los documentos de un empleado
   */
  @Get('empleado/:empleadoId')
  async obtenerDocumentosPorEmpleado(
    @Param('empleadoId') empleadoId: string,
    @Query('tipoDocumento') tipoDocumento?: string,
    @Query('estado') estado?: string,
    @Query('esConfidencial') esConfidencial?: string,
  ) {
    const filtros: any = {};
    
    if (tipoDocumento) filtros.tipoDocumento = tipoDocumento;
    if (estado) filtros.estado = estado;
    if (esConfidencial !== undefined) filtros.esConfidencial = esConfidencial === 'true';

    const documentos = await this.documentosService.obtenerDocumentosPorEmpleado(
      new Types.ObjectId(empleadoId),
      filtros
    );

    return {
      success: true,
      data: documentos,
    };
  }

  /**
   * Obtener un documento por ID
   */
  @Get(':id')
  async obtenerDocumentoPorId(@Param('id') id: string) {
    const documento = await this.documentosService.obtenerDocumentoPorId(new Types.ObjectId(id));

    return {
      success: true,
      data: documento,
    };
  }

  /**
   * Actualizar un documento
   */
  @Put(':id')
  async actualizarDocumento(
    @Param('id') id: string,
    @Body() updateDocumentoDto: UpdateDocumentoDto,
  ) {
    const documento = await this.documentosService.actualizarDocumento(
      new Types.ObjectId(id),
      updateDocumentoDto
    );

    return {
      success: true,
      message: 'Documento actualizado exitosamente',
      data: documento,
    };
  }

  /**
   * Validar un documento (aprobar/rechazar)
   */
  @Put(':id/validar')
  @HttpCode(HttpStatus.OK)
  async validarDocumento(
    @Param('id') id: string,
    @Body() validarDocumentoDto: ValidarDocumentoDto,
    @User() usuario: any,
  ) {
    const documento = await this.documentosService.validarDocumento(
      new Types.ObjectId(id),
      validarDocumentoDto,
      new Types.ObjectId(usuario.id)
    );

    return {
      success: true,
      message: `Documento ${validarDocumentoDto.estado.toLowerCase()} exitosamente`,
      data: documento,
    };
  }

  /**
   * Renovar un documento
   */
  @Post(':id/renovar')
  @UseInterceptors(FileInterceptor('archivo'))
  async renovarDocumento(
    @Param('id') id: string,
    @Body() renovarDocumentoDto: RenovarDocumentoDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: /^(application\/pdf|image\/(jpeg|jpg|png)|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/,
          }),
        ],
      }),
    )
    archivo: any,
    @User() usuario: any,
  ) {
    try {
      // Subir nuevo archivo a Cloudinary
      const resultado = await this.cloudinaryService.uploadBuffer(archivo.buffer, {
        folder: 'rrhh/documentos',
        resource_type: 'auto',
        public_id: `${Date.now()}_${archivo.originalname}`,
      }, archivo.mimetype);

      // Crear el documento renovado con la información del archivo
      const documentoRenovadoData = {
        ...renovarDocumentoDto,
        urlArchivo: resultado.data?.url || '',
        publicId: resultado.data?.publicId || '',
        // usar formato (extensión) que devuelve Cloudinary, no el mimetype
        formato: (resultado.data as any)?.format || (archivo.originalname.split('.').pop()?.toLowerCase() || ''),
        tamañoBytes: archivo.size,
        mimeType: archivo.mimetype,
      };

      const documento = await this.documentosService.renovarDocumento(
        new Types.ObjectId(id),
        documentoRenovadoData,
        new Types.ObjectId(usuario.id)
      );

      return {
        success: true,
        message: 'Documento renovado exitosamente',
        data: documento,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Eliminar un documento
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarDocumento(@Param('id') id: string) {
    await this.documentosService.eliminarDocumento(new Types.ObjectId(id));

    return {
      success: true,
      message: 'Documento eliminado exitosamente',
    };
  }

  /**
   * Obtener documentos próximos a vencer
   */
  @Get('alertas/proximos-vencer')
  async obtenerDocumentosProximosAVencer(@Query('dias') dias?: string) {
    const diasNum = dias ? parseInt(dias) : 30;
    const documentos = await this.documentosService.obtenerDocumentosProximosAVencer(diasNum);

    return {
      success: true,
      data: documentos,
    };
  }

  /**
   * Obtener documentos vencidos
   */
  @Get('alertas/vencidos')
  async obtenerDocumentosVencidos() {
    const documentos = await this.documentosService.obtenerDocumentosVencidos();

    return {
      success: true,
      data: documentos,
    };
  }

  /**
   * Marcar documentos vencidos automáticamente
   */
  @Post('alertas/marcar-vencidos')
  @HttpCode(HttpStatus.OK)
  async marcarDocumentosVencidos() {
    const cantidad = await this.documentosService.marcarDocumentosVencidos();

    return {
      success: true,
      message: `${cantidad} documentos marcados como vencidos`,
      data: { cantidadMarcados: cantidad },
    };
  }

  /**
   * Obtener estadísticas de documentos por empleado
   */
  @Get('estadisticas/empleado/:empleadoId')
  async obtenerEstadisticasDocumentos(@Param('empleadoId') empleadoId: string) {
    const estadisticas = await this.documentosService.obtenerEstadisticasDocumentos(
      new Types.ObjectId(empleadoId)
    );

    return {
      success: true,
      data: estadisticas,
    };
  }

  /**
   * Buscar documentos por criterios
   */
  @Get('buscar/criterios')
  async buscarDocumentos(
    @Query('empleadoId') empleadoId?: string,
    @Query('tipoDocumento') tipoDocumento?: string,
    @Query('estado') estado?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('esConfidencial') esConfidencial?: string,
    @Query('tags') tags?: string,
  ) {
    const criterios: any = {};

    if (empleadoId) criterios.empleadoId = new Types.ObjectId(empleadoId);
    if (tipoDocumento) criterios.tipoDocumento = tipoDocumento;
    if (estado) criterios.estado = estado;
    if (fechaInicio) criterios.fechaInicio = new Date(fechaInicio);
    if (fechaFin) criterios.fechaFin = new Date(fechaFin);
    if (esConfidencial !== undefined) criterios.esConfidencial = esConfidencial === 'true';
    if (tags) criterios.tags = tags.split(',');

    const documentos = await this.documentosService.buscarDocumentos(criterios);

    return {
      success: true,
      data: documentos,
    };
  }

  /**
   * Descargar un documento
   */
  @Get(':id/descargar')
  async descargarDocumento(@Param('id') id: string) {
    const documento = await this.documentosService.obtenerDocumentoPorId(new Types.ObjectId(id));
    
    // Si ya tenemos una URL de Cloudinary, usarla directamente
    if (documento.urlArchivo) {
      // Para archivos raw (PDF, DOC, etc.), modificar la URL para forzar descarga
      const isRaw = documento.mimeType?.startsWith('image/') === false;
      let downloadUrl = documento.urlArchivo;
      
      if (isRaw) {
        // Para archivos raw, agregar flag de attachment para forzar descarga
        downloadUrl = documento.urlArchivo.replace('/upload/', '/upload/fl_attachment/');
      }
      
      return {
        success: true,
        data: {
          url: downloadUrl,
          nombre: documento.nombreOriginal,
          formato: documento.formato,
          tamaño: documento.tamañoBytes,
        },
      };
    }
    
    // Fallback: generar URL usando el publicId
    const publicId = documento.publicId;
    
    if (!publicId) {
      throw new Error('No se encontró información de archivo para descargar');
    }
    
    // Determinar el tipo de recurso basado en el mimeType
    const resourceType = documento.mimeType?.startsWith('image/') ? 'image' : 'raw';
    
    // Para archivos raw (PDF, DOC, etc.), necesitamos especificar el formato
    let format: string | undefined;
    if (resourceType === 'raw') {
      // Usar el formato del documento o extraer de la extensión del nombre original
      format = documento.formato || documento.nombreOriginal.split('.').pop()?.toLowerCase() || 'pdf';
    }
    
    // Generar URL de descarga firmada
    const url = this.cloudinaryService.getSignedDownloadUrl(publicId, { 
      resourceType: resourceType as any, 
      format 
    });
    
    return {
      success: true,
      data: {
        url,
        nombre: documento.nombreOriginal,
        formato: documento.formato,
        tamaño: documento.tamañoBytes,
      },
    };
  }
}
