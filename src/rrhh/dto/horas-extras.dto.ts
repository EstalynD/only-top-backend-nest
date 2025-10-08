import { IsString, IsNotEmpty, IsNumber, Min, Max, IsEnum, IsArray, ValidateNested, IsOptional, IsDateString, IsMongoId, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoHoraExtra } from '../horas-extras.schema.js';

export class CreateDetalleHoraExtraDto {
  @IsEnum(TipoHoraExtra, { message: 'Tipo de hora extra inválido' })
  @IsNotEmpty()
  tipo!: TipoHoraExtra;

  @IsNumber({}, { message: 'La cantidad de horas debe ser un número' })
  @Min(0.01, { message: 'La cantidad de horas debe ser mayor a 0' })
  cantidadHoras!: number;

  @IsDateString({}, { message: 'Fecha de registro inválida' })
  @IsNotEmpty()
  fechaRegistro!: string; // ISO 8601 format

  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class CreateHorasExtrasDto {
  @IsMongoId({ message: 'ID de empleado inválido' })
  @IsNotEmpty()
  empleadoId!: string;

  @IsNumber({}, { message: 'El año debe ser un número' })
  @Min(2020, { message: 'Año mínimo: 2020' })
  @Max(2100, { message: 'Año máximo: 2100' })
  anio!: number;

  @IsNumber({}, { message: 'El mes debe ser un número' })
  @Min(1, { message: 'Mes mínimo: 1' })
  @Max(12, { message: 'Mes máximo: 12' })
  mes!: number;

  @IsNumber({}, { message: 'La quincena debe ser un número' })
  @IsEnum([1, 2], { message: 'Quincena debe ser 1 o 2' })
  quincena!: number;

  @IsArray({ message: 'Los detalles deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe registrar al menos una hora extra' })
  @ValidateNested({ each: true })
  @Type(() => CreateDetalleHoraExtraDto)
  detalles!: CreateDetalleHoraExtraDto[];

  @IsNumber({}, { message: 'Las horas laborales deben ser un número' })
  @IsOptional()
  @Min(1, { message: 'Horas laborales mínimo: 1' })
  horasLaboralesMes?: number; // Opcional, por defecto 220
}

export class UpdateHorasExtrasDto {
  @IsArray({ message: 'Los detalles deben ser un array' })
  @IsOptional()
  @ArrayMinSize(1, { message: 'Debe tener al menos una hora extra' })
  @ValidateNested({ each: true })
  @Type(() => CreateDetalleHoraExtraDto)
  detalles?: CreateDetalleHoraExtraDto[];

  @IsNumber({}, { message: 'Las horas laborales deben ser un número' })
  @IsOptional()
  @Min(1, { message: 'Horas laborales mínimo: 1' })
  horasLaboralesMes?: number;
}

export class AprobarHorasExtrasDto {
  @IsEnum(['APROBADO', 'RECHAZADO'], { message: 'Estado debe ser APROBADO o RECHAZADO' })
  @IsNotEmpty()
  estado!: 'APROBADO' | 'RECHAZADO';

  @IsString()
  @IsOptional()
  comentarios?: string;
}

// DTO para consultas y filtros
export class FiltrosHorasExtrasDto {
  @IsMongoId()
  @IsOptional()
  empleadoId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  anio?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  mes?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  quincena?: number;

  @IsString()
  @IsOptional()
  periodo?: string;

  @IsEnum(['PENDIENTE', 'APROBADO', 'RECHAZADO'])
  @IsOptional()
  estado?: string;
}

// DTO para aprobación en lote
export class AprobarHorasExtrasLoteDto {
  @IsArray({ message: 'Debe enviar una lista de IDs' })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un registro' })
  @IsMongoId({ each: true, message: 'ID inválido en la lista' })
  ids!: string[];

  @IsEnum(['APROBADO', 'RECHAZADO'], { message: 'Estado debe ser APROBADO o RECHAZADO' })
  estado!: 'APROBADO' | 'RECHAZADO';

  @IsString()
  @IsOptional()
  comentarios?: string;
}
