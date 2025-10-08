import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { PlataformaCampana, EstadoCampana } from '../traffic-campaign.schema.js';

export class FilterCampaignsDto {
  @IsOptional()
  @IsString()
  modeloId?: string;

  @IsOptional()
  @IsString()
  traffickerId?: string;

  @IsOptional()
  @IsEnum(PlataformaCampana)
  plataforma?: PlataformaCampana;

  @IsOptional()
  @IsEnum(EstadoCampana)
  estado?: EstadoCampana;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  pais?: string;
}
