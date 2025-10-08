import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';
import { Types } from 'mongoose';

export class CreateContratoDto {
  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  empleadoId!: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toUpperCase())
  numeroContrato!: string;

  @IsEnum(['PRESTACION_SERVICIOS', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR', 'APRENDIZAJE'])
  tipoContrato!: string;

  @IsDateString()
  fechaInicio!: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string | null;

  @IsOptional()
  @IsEnum(['EN_REVISION', 'APROBADO', 'RECHAZADO', 'TERMINADO'])
  estado?: string;

  @IsString()
  @IsNotEmpty()
  contenidoContrato!: string;

  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  plantillaId!: Types.ObjectId;
}

export class UpdateContratoDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim().toUpperCase())
  numeroContrato?: string;

  @IsOptional()
  @IsEnum(['PRESTACION_SERVICIOS', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR', 'APRENDIZAJE'])
  tipoContrato?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string | null;

  @IsOptional()
  @IsEnum(['EN_REVISION', 'APROBADO', 'RECHAZADO', 'TERMINADO'])
  estado?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  contenidoContrato?: string;

  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  plantillaId?: Types.ObjectId;
}

export class AprobarContratoDto {
  @IsEnum(['APROBADO', 'RECHAZADO'])
  estado!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  comentarios?: string | null;
}

export class RenovarContratoDto {
  @IsDateString()
  fechaInicio!: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string | null;

  @IsString()
  @Transform(({ value }) => value?.trim())
  contenidoContrato!: string;

  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  plantillaId!: Types.ObjectId;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim() || null)
  comentarios?: string | null;
}
