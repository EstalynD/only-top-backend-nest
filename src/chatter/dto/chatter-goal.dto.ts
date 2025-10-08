import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GoalStatus } from '../chatter-goal.schema.js';

export class CreateChatterGoalDto {
  @IsNotEmpty()
  @IsString()
  modeloId!: string;

  @IsNumber()
  @Min(0)
  montoObjetivo!: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  nivelesNotificacion?: number[];

  @IsOptional()
  @IsBoolean()
  notificacionesActivas?: boolean;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class UpdateChatterGoalDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoObjetivo?: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  estado?: GoalStatus;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  nivelesNotificacion?: number[];

  @IsOptional()
  @IsBoolean()
  notificacionesActivas?: boolean;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class CloseChatterGoalDto {
  @IsOptional()
  @IsString()
  notas?: string;
}

export class FilterChatterGoalsDto {
  @IsOptional()
  @IsString()
  modeloId?: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  estado?: GoalStatus;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}

