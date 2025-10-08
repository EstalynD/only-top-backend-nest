import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  IsUrl,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { 
  PlataformaCampana, 
  EstadoCampana, 
  AcortadorURL 
} from '../traffic-campaign.schema.js';

// DTO para segmentación de campaña
export class CampaignSegmentationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paises?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regiones?: string[];

  @IsOptional()
  @IsString()
  edadMin?: string;

  @IsOptional()
  @IsString()
  edadMax?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intereses?: string[];
}

export class CreateCampaignDto {
  @IsString()
  modeloId!: string;

  @IsOptional()
  @IsString()
  traffickerId?: string; // ID del trafficker responsable (opcional, se usa el del usuario si no se proporciona)

  @IsEnum(PlataformaCampana)
  plataforma!: PlataformaCampana;

  @IsOptional()
  @IsString()
  descripcionSegmentacion?: string;

  @ValidateNested()
  @Type(() => CampaignSegmentationDto)
  segmentaciones!: CampaignSegmentationDto;

  @IsDateString()
  fechaActivacion!: string;

  @IsDateString()
  fechaPublicacion!: string;

  @IsOptional()
  @IsDateString()
  fechaFinalizacion?: string;

  @IsNumber()
  @Min(0)
  presupuestoAsignado!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  presupuestoGastado?: number;

  @IsOptional()
  @IsString()
  moneda?: string; // Moneda del presupuesto (debe existir en sistema)

  @IsEnum(EstadoCampana)
  @IsOptional()
  estado?: EstadoCampana;

  @IsString()
  copyUtilizado!: string;

  @IsOptional()
  @IsUrl()
  linkPauta?: string;

  @IsUrl()
  trackLinkOF!: string;

  @IsEnum(AcortadorURL)
  acortadorUtilizado!: AcortadorURL;

  @IsOptional()
  @IsString()
  rendimiento?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
