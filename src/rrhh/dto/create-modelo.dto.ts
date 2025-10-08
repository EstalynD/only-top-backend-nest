import { 
  IsString, 
  IsNotEmpty, 
  IsEmail, 
  IsDateString, 
  IsArray, 
  IsOptional, 
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsMongoId,
  ValidateNested,
  IsBoolean,
  IsUrl
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoDocumento, PlataformaContenido, TipoTrafico } from '../modelo.schema.js';

// DTO para cuenta de plataforma
export class CuentaPlataformaDto {
  @IsEnum(PlataformaContenido)
  @IsNotEmpty()
  plataforma!: PlataformaContenido;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  links!: string[];

  @IsOptional()
  @IsString()
  notas?: string;
}

// DTO para red social
export class RedSocialDto {
  @IsString()
  @IsNotEmpty()
  plataforma!: string;

  @IsString()
  @IsNotEmpty()
  link!: string;

  @IsOptional()
  @IsString()
  username?: string;
}

// DTO para fuente de tráfico
export class FuenteTraficoDto {
  @IsEnum(TipoTrafico)
  @IsNotEmpty()
  tipo!: TipoTrafico;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inversionUSD?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje?: number;

  @IsOptional()
  @IsString()
  notas?: string;
}

// DTO para facturación mensual
export class FacturacionMensualDto {
  @IsNumber()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsNumber()
  @Min(2000)
  anio!: number;

  @IsNumber()
  @Min(0)
  monto!: number;

  @IsOptional()
  @IsString()
  moneda?: string;
}

// DTO para equipo de chatters
export class EquipoChattersDto {
  @IsMongoId()
  @IsNotEmpty()
  turnoAM!: string;

  @IsMongoId()
  @IsNotEmpty()
  turnoPM!: string;

  @IsMongoId()
  @IsNotEmpty()
  turnoMadrugada!: string;

  @IsMongoId()
  @IsNotEmpty()
  supernumerario!: string;
}

// DTO principal para crear modelo
export class CreateModeloDto {
  // Información básica
  @IsString()
  @IsNotEmpty()
  nombreCompleto!: string;

  @IsString()
  @IsNotEmpty()
  numeroIdentificacion!: string;

  @IsEnum(TipoDocumento)
  @IsNotEmpty()
  tipoDocumento!: TipoDocumento;

  @IsString()
  @IsNotEmpty()
  telefono!: string;

  @IsEmail()
  @IsNotEmpty()
  correoElectronico!: string;

  @IsDateString()
  @IsNotEmpty()
  fechaNacimiento!: string;

  @IsString()
  @IsNotEmpty()
  paisResidencia!: string;

  @IsString()
  @IsNotEmpty()
  ciudadResidencia!: string;

  // Plataformas de contenido
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CuentaPlataformaDto)
  @IsOptional()
  plataformas?: CuentaPlataformaDto[];

  // Redes sociales
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RedSocialDto)
  @IsOptional()
  redesSociales?: RedSocialDto[];

  // Facturación histórica (últimos 3 meses)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacturacionMensualDto)
  @IsOptional()
  facturacionHistorica?: FacturacionMensualDto[];

  // Fuentes de tráfico
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FuenteTraficoDto)
  @IsOptional()
  fuentesTrafico?: FuenteTraficoDto[];

  // Asignaciones de equipo (obligatorias)
  @IsMongoId()
  @IsNotEmpty()
  salesCloserAsignado!: string;

  @ValidateNested()
  @Type(() => EquipoChattersDto)
  @IsNotEmpty()
  equipoChatters!: EquipoChattersDto;

  @IsMongoId()
  @IsNotEmpty()
  traffickerAsignado!: string;

  // Información adicional
  @IsOptional()
  @IsUrl()
  linkFormularioRegistro?: string;

  @IsOptional()
  @IsUrl()
  fotoPerfil?: string;

  @IsOptional()
  @IsString()
  fotoPerfilPublicId?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsString()
  notasInternas?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['ACTIVA', 'INACTIVA', 'SUSPENDIDA', 'TERMINADA'])
  estado?: string;
}

