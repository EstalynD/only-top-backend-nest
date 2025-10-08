import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsDateString, 
  IsEnum, 
  IsMongoId, 
  IsNumber, 
  IsBoolean,
  IsArray,
  Min,
  Max
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDocumentoDto {
  @IsMongoId()
  empleadoId!: string;

  @IsOptional()
  @IsMongoId()
  contratoId?: string | null;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  nombreOriginal!: string;

  @IsEnum([
    'CEDULA_IDENTIDAD',
    'RUT',
    'DIPLOMA',
    'CERTIFICADO_ACADEMICO',
    'CERTIFICADO_LABORAL',
    'CERTIFICADO_MEDICO',
    'CERTIFICADO_PENALES',
    'CERTIFICADO_POLICIA',
    'CONTRATO_LABORAL',
    'HOJA_VIDA',
    'FOTO_PERFIL',
    'OTRO'
  ])
  tipoDocumento!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  descripcion!: string;

  @IsOptional()
  @IsString()
  urlArchivo?: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsString()
  formato?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value === undefined || value === null ? value : Number(value)))
  tamañoBytes?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsDateString()
  fechaEmision!: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string | null;

  @IsOptional()
  @IsEnum(['PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'RENOVADO'])
  estado?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  esConfidencial?: boolean;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []))
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  requiereRenovacion?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  @Transform(({ value }) => (value === undefined || value === null ? value : Number(value)))
  diasAntesVencimiento?: number;
}

export class UpdateDocumentoDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  nombre?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fechaEmision?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string | null;

  @IsOptional()
  @IsEnum(['PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'RENOVADO'])
  estado?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  esConfidencial?: boolean;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []))
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  requiereRenovacion?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  @Transform(({ value }) => (value === undefined || value === null ? value : Number(value)))
  diasAntesVencimiento?: number;
}

export class ValidarDocumentoDto {
  @IsEnum(['APROBADO', 'RECHAZADO'])
  estado!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  observaciones?: string | null;

  @IsOptional()
  @IsBoolean()
  esValido?: boolean;
}

export class RenovarDocumentoDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  nombreOriginal!: string;

  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  @IsOptional()
  @IsString()
  urlArchivo?: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsString()
  formato?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => (value === undefined || value === null ? value : Number(value)))
  tamañoBytes?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsDateString()
  fechaEmision!: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string | null;
}
