import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, Min, IsMongoId } from 'class-validator';
import { TipoVenta, TurnoChatter } from '../chatter-sale.schema.js';

export class CreateChatterSaleDto {
  @IsMongoId()
  modeloId!: string;

  @IsMongoId()
  chatterId!: string;

  @IsNumber()
  @Min(0)
  monto!: number;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsEnum(TipoVenta)
  tipoVenta!: TipoVenta;

  @IsEnum(TurnoChatter)
  turno!: TurnoChatter;

  @IsDateString()
  fechaVenta!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  notasInternas?: string;

  @IsString()
  @IsOptional()
  plataforma?: string;
}

