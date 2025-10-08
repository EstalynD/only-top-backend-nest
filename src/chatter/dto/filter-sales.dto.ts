import { IsOptional, IsMongoId, IsEnum, IsDateString, IsString } from 'class-validator';
import { TipoVenta, TurnoChatter } from '../chatter-sale.schema.js';

export class FilterSalesDto {
  @IsOptional()
  @IsMongoId()
  modeloId?: string;

  @IsOptional()
  @IsMongoId()
  chatterId?: string;

  @IsOptional()
  @IsEnum(TipoVenta)
  tipoVenta?: TipoVenta;

  @IsOptional()
  @IsEnum(TurnoChatter)
  turno?: TurnoChatter;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  plataforma?: string;
}

