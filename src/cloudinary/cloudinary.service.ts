import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, ConfigOptions } from 'cloudinary';

type UploadResult = {
  success: boolean;
  data?: {
    publicId: string;
    url: string;
    downloadUrl?: string;
    urlHttp?: string;
    width?: number;
    height?: number;
    format?: string;
    resourceType?: string;
    size?: number;
    assetId?: string;
    version?: number;
  };
  message?: string;
};

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly signingEnabled: boolean;
  public readonly folder: string;
  public readonly allowedFormats: string[];
  public readonly maxFileSize: number; // bytes

  constructor() {
    const cfg: ConfigOptions = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    };
    cloudinary.config(cfg);

    this.signingEnabled = Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    );

    this.folder = 'only-top/employee-documents';
    this.allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
  }

  // Subir imagen o PDF (buffer o URL)
  async uploadImage(
    file: Buffer | string,
    options: {
      publicId?: string | null;
      folder?: string;
      transformation?: any[];
      tags?: string[];
      overwrite?: boolean;
      [k: string]: any;
    } = {},
  ): Promise<UploadResult> {
    try {
      const {
        publicId = null,
        folder = this.folder,
        transformation = [],
        tags = [],
        overwrite = false,
        ...rest
      } = options;

      const uploadOptions: Record<string, any> = {
        folder,
        resource_type: 'auto',
        overwrite,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }, ...transformation],
        tags: ['only-top', ...tags],
        ...rest,
      };

      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      if (Buffer.isBuffer(file)) {
        return await this.uploadBuffer(file, uploadOptions);
      }

      const result = await cloudinary.uploader.upload(file as string, uploadOptions);
      this.logger.log(`Imagen subida a Cloudinary publicId=${result.public_id} size=${result.bytes}`);
      return {
        success: true,
        data: {
          publicId: result.public_id,
          url: result.secure_url,
          downloadUrl: result.secure_url?.replace('/upload/', '/upload/fl_attachment/'),
          urlHttp: result.url,
          width: result.width,
          height: result.height,
          format: result.format,
          resourceType: result.resource_type,
          size: result.bytes,
          assetId: result.asset_id,
          version: result.version,
        },
      };
    } catch (error: any) {
      this.logger.error('Error subiendo imagen a Cloudinary', error?.stack || error);
      throw new Error(`Error al subir imagen: ${error?.message || 'desconocido'}`);
    }
  }

  // URL firmada para ver (image/raw)
  getSignedViewUrl(
    publicId: string,
    opts: { resourceType?: 'image' | 'raw' | 'auto'; format?: string; version?: number } = {},
  ): string {
    if (!publicId) throw new Error('publicId requerido');
    const resourceType = opts.resourceType || 'image';
    const baseOpts: Record<string, any> = {
      resource_type: resourceType,
      secure: true,
      version: opts.version,
      // Forzar extensión si se proporciona (para raw: asegura Content-Type adecuado)
      format: opts.format,
    };
    return cloudinary.url(publicId, this.signingEnabled ? { ...baseOpts, sign_url: true } : baseOpts);
  }

  // URL firmada para descargar (attachment)
  getSignedDownloadUrl(
    publicId: string,
    opts: { resourceType?: 'image' | 'raw' | 'auto'; format?: string; version?: number; filename?: string } = {},
  ): string {
    if (!publicId) throw new Error('publicId requerido');
    const resourceType = opts.resourceType || 'image';
    const isRaw = resourceType === 'raw';

    if (isRaw) {
      // Para archivos raw (PDF, DOC, etc.), usar URL directa sin firma
      // ya que las cuentas gratuitas tienen restricciones con private_download_url
      // Incluir formato para que el navegador lo trate como el tipo correcto (p.ej., pdf)
      // y sugerir nombre de archivo si se proporciona
      const flags = opts.filename ? `attachment:${opts.filename}` : 'attachment';
      return cloudinary.url(publicId, {
        resource_type: 'raw',
        secure: true,
        flags,
        version: opts.version,
        format: opts.format,
      });
    }

    const baseOpts = {
      resource_type: 'image',
      secure: true,
      flags: opts.filename ? `attachment:${opts.filename}` : 'attachment',
      version: opts.version,
      format: opts.format,
    } as const;
    return cloudinary.url(publicId, this.signingEnabled ? { ...baseOpts, sign_url: true } : baseOpts);
  }

  // Subir desde buffer
  async uploadBuffer(
    buffer: Buffer,
    options: Record<string, any> = {},
    mimeType: string = 'image/jpeg',
  ): Promise<UploadResult> {
    try {
      const base64String = buffer.toString('base64');
      const dataURI = `data:${mimeType};base64,${base64String}`;
      const uploadOpts = { resource_type: 'auto', ...options };
      const result = await cloudinary.uploader.upload(dataURI, uploadOpts);
      this.logger.log(`Buffer subido a Cloudinary publicId=${result.public_id} size=${result.bytes}`);
      return {
        success: true,
        data: {
          publicId: result.public_id,
          url: result.secure_url,
          downloadUrl: result.secure_url?.replace('/upload/', '/upload/fl_attachment/'),
          urlHttp: result.url,
          width: result.width,
          height: result.height,
          format: result.format,
          resourceType: result.resource_type,
          size: result.bytes,
          assetId: result.asset_id,
          version: result.version,
        },
      };
    } catch (error: any) {
      this.logger.error('Error subiendo buffer a Cloudinary', error?.stack || error);
      throw new Error(`Error al subir buffer: ${error?.message || 'desconocido'}`);
    }
  }

  // Subir desde buffer con validación de nombre/tamaño
  async uploadFromBuffer(
    buffer: Buffer,
    originalName: string,
    options: Record<string, any> = {},
  ): Promise<UploadResult> {
    try {
      const fileExtension = this.getFileExtension(originalName);
      if (!this.allowedFormats.includes(fileExtension.toLowerCase())) {
        throw new Error(
          `Formato de archivo no permitido. Formatos válidos: ${this.allowedFormats.join(', ')}`,
        );
      }
      if (buffer.length > this.maxFileSize) {
        throw new Error(
          `El archivo excede el tamaño máximo permitido (${this.maxFileSize / 1024 / 1024}MB)`,
        );
      }

      const timestamp = Date.now();
      const sanitizedName = this.sanitizeFileName(originalName);
      const baseWithoutExt = sanitizedName.replace(/\.[^.]+$/, '');
      const targetFolder = (options.folder && String(options.folder).replace(/^\/+|\/+|\.+/g, '')) || this.folder;
      const publicId = `${timestamp}_${baseWithoutExt}`;

      const mimeTypeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        pdf: 'application/pdf',
      };
      const mimeType = mimeTypeMap[fileExtension.toLowerCase()] || 'image/jpeg';

      const uploadRes = await this.uploadBuffer(
        buffer,
        {
          public_id: publicId,
          folder: targetFolder,
          resource_type: 'auto',
          ...options,
        },
        mimeType,
      );

      // Si la subida fue exitosa, calcular URLs de vista/descarga con formato y nombre adecuados
      if (uploadRes.success && uploadRes.data?.publicId) {
        const resourceType = (options.resource_type as 'image' | 'raw' | 'auto') || 'auto';
        const format = fileExtension.toLowerCase();
        const filenameWithExt = `${baseWithoutExt}.${format}`;

        // URL para ver (inline) con extensión forzada
        const viewUrl = this.getSignedViewUrl(uploadRes.data.publicId, {
          resourceType,
          format,
        });

        // URL para descargar con nombre sugerido y extensión
        const downloadUrl = this.getSignedDownloadUrl(uploadRes.data.publicId, {
          resourceType,
          format,
          filename: filenameWithExt,
        });

        uploadRes.data.url = viewUrl;
        uploadRes.data.downloadUrl = downloadUrl;
      }

      return uploadRes;
    } catch (error: any) {
      this.logger.error('Error subiendo imagen desde buffer', error?.stack || error);
      throw error;
    }
  }

  async uploadFromUrl(url: string, options: Record<string, any> = {}): Promise<UploadResult> {
    try {
      if (!this.isValidUrl(url)) {
        throw new Error('URL de imagen no válida');
      }
      const timestamp = Date.now();
      const publicId = `url_${timestamp}`; // la carpeta la controla 'folder'
      return await this.uploadImage(url, { publicId, ...options });
    } catch (error: any) {
      this.logger.error('Error subiendo imagen desde URL', error?.stack || error);
      throw error;
    }
  }

  async deleteImage(publicId: string): Promise<UploadResult> {
    if (!publicId) {
      return { success: false, message: 'Public ID es requerido para eliminar la imagen' };
    }
    const typesToTry: Array<'image' | 'raw' | 'video'> = ['image', 'raw', 'video'];
    for (const rt of typesToTry) {
      try {
        const result: any = await cloudinary.uploader.destroy(publicId, { resource_type: rt });
        if (result.result === 'ok') {
          this.logger.log(`Recurso eliminado de Cloudinary (${rt}) publicId=${publicId}`);
          return { success: true, message: `Eliminado (${rt})` };
        }
        if (result.result === 'not found') {
          this.logger.log(`Recurso no encontrado en Cloudinary (${rt}) publicId=${publicId}`);
          return { success: true, message: 'No encontrado (tratado como eliminado)' };
        }
      } catch (err: any) {
        this.logger.warn(
          `Fallo intentando eliminar en Cloudinary con resource_type=${rt} publicId=${publicId}: ${err?.message}`,
        );
      }
    }
    return { success: false, message: 'No se pudo eliminar el recurso en Cloudinary' };
  }

  getOptimizedUrl(publicId: string, transformation: Record<string, any> = {}): string {
    try {
      if (!publicId) throw new Error('Public ID es requerido para generar URL');
      const defaultTransformation = { quality: 'auto', fetch_format: 'auto', ...transformation };
      return cloudinary.url(publicId, { resource_type: 'image', ...defaultTransformation });
    } catch (error: any) {
      this.logger.error('Error generando URL optimizada', error?.stack || error);
      throw error;
    }
  }

  getTransformedUrl(
    publicId: string,
    options: { width?: number; height?: number; crop?: string; gravity?: string; quality?: string; format?: string } = {},
  ): string {
    try {
      const { width, height, crop = 'auto', gravity = 'auto', quality = 'auto', format = 'auto' } = options;
      const transformation: Record<string, any> = { crop, gravity, quality, fetch_format: format };
      if (width) transformation.width = width;
      if (height) transformation.height = height;
      return cloudinary.url(publicId, { resource_type: 'image', ...transformation });
    } catch (error: any) {
      this.logger.error('Error generando URL transformada', error?.stack || error);
      throw error;
    }
  }

  validateImageFile(file: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!file) {
      errors.push('No se proporcionó ningún archivo');
      return { isValid: false, errors };
    }
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`Tipo de archivo no permitido. Tipos válidos: ${allowedMimeTypes.join(', ')}`);
    }
    if (typeof file.size === 'number' && file.size > this.maxFileSize) {
      errors.push(`El archivo excede el tamaño máximo permitido (${this.maxFileSize / 1024 / 1024}MB)`);
    }
    if (!file.originalname || String(file.originalname).trim().length === 0) {
      errors.push('El nombre del archivo es requerido');
    }
    return { isValid: errors.length === 0, errors };
  }

  async deleteAllByPrefix(prefix: string): Promise<{ deleted: number }> {
    try {
      if (!prefix) return { deleted: 0 };
      let nextCursor: string | undefined = undefined;
      let total = 0;
      do {
        const res: any = await cloudinary.api.resources({
          type: 'upload',
          prefix,
          max_results: 100,
          next_cursor: nextCursor,
          resource_type: 'auto',
        });
        const ids = (res.resources || []).map((r: any) => r.public_id);
        if (ids.length) {
          const del: any = await cloudinary.api.delete_resources(ids, { resource_type: 'auto' });
          const count = Object.values(del.deleted || {}).filter((v) => v === 'deleted').length;
          total += count;
        }
        nextCursor = res.next_cursor;
      } while (nextCursor);
      return { deleted: total };
    } catch (err: any) {
      this.logger.error('Error eliminando recursos por prefijo', err?.stack || err);
      return { deleted: 0 };
    }
  }

  async deleteFolder(folder: string): Promise<void> {
    try {
      if (!folder) return;
      await cloudinary.api.delete_folder(folder);
    } catch (err: any) {
      this.logger.warn(
        `No se pudo eliminar carpeta (posible no vacía o inexistente): ${folder}. ${err?.message || ''}`,
      );
    }
  }

  getFileExtension(filename: string): string {
    return String(filename).split('.').pop()?.toLowerCase() || '';
  }

  sanitizeFileName(filename: string): string {
    if (!filename) return 'file';
    const parts = filename.split('.');
    if (parts.length === 1) {
      return filename.replace(/[^a-zA-Z0-9-_.]/g, '_').replace(/_{2,}/g, '_').toLowerCase();
    }
    const ext = parts.pop()!.toLowerCase();
    const base = parts
      .join('.')
      .replace(/[^a-zA-Z0-9-_.]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
    return `${base}.${ext}`;
  }

  isValidUrl(url: string): boolean {
    try {
      // eslint-disable-next-line no-new
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async getImageInfo(publicId: string): Promise<UploadResult> {
    try {
      const result: any = await cloudinary.api.resource(publicId, { resource_type: 'auto' });
      return {
        success: true,
        data: {
          publicId: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.bytes,
          version: result.version,
        },
      };
    } catch (error: any) {
      this.logger.error('Error obteniendo información de imagen', error?.stack || error);
      throw new Error(`Error al obtener información de imagen: ${error?.message || 'desconocido'}`);
    }
  }

  createSignedUploadParams(params: Record<string, any> = {}) {
    const timestamp = Math.round(new Date().getTime() / 1000);
    if (!this.signingEnabled) {
      throw new Error('Cloudinary API credentials not configured for signing');
    }
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: this.folder, ...params },
      process.env.CLOUDINARY_API_SECRET as string,
    );
    return {
      timestamp,
      signature,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder: this.folder,
      ...params,
    };
  }
}

export default CloudinaryService;
