import { 
  IsString, 
  IsNotEmpty, 
  IsEnum, 
  IsNumber, 
  IsDate, 
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  Max,
  MinLength,
  IsMongoId,
  ValidateIf,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GoalType, GoalPeriod, GoalStatus } from '../recruitment-goal.schema.js';

export class CreateRecruitmentGoalDto {
  @IsMongoId()
  @IsNotEmpty()
  salesCloserId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  titulo!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsEnum(GoalType)
  @IsNotEmpty()
  tipo!: GoalType;

  @IsNumber()
  @Min(1)
  valorObjetivo!: number;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.tipo === GoalType.FACTURACION)
  moneda?: string;

  @IsEnum(GoalPeriod)
  @IsNotEmpty()
  periodo!: GoalPeriod;

  @IsISO8601()
  @IsNotEmpty()
  fechaInicio!: string;

  @IsISO8601()
  @IsNotEmpty()
  fechaFin!: string;

  @IsBoolean()
  @IsOptional()
  notificacionesActivas?: boolean;

  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  @IsOptional()
  umbralNotificaciones?: number[];
}

export class UpdateRecruitmentGoalDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  titulo?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  valorObjetivo?: number;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsISO8601()
  @IsOptional()
  fechaInicio?: string;

  @IsISO8601()
  @IsOptional()
  fechaFin?: string;

  @IsEnum(GoalStatus)
  @IsOptional()
  estado?: GoalStatus;

  @IsBoolean()
  @IsOptional()
  notificacionesActivas?: boolean;

  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  @IsOptional()
  umbralNotificaciones?: number[];
}

export class UpdateGoalProgressDto {
  @IsNumber()
  @Min(0)
  valorActual!: number;
}

