import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CommissionStatus } from '../chatter-commission.schema.js';

export class GenerateCommissionsDto {
  @IsOptional()
  @IsString()
  modeloId?: string; // Si se proporciona, solo genera para ese grupo

  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;

  @IsOptional()
  @IsString()
  goalId?: string; // Meta asociada (opcional)
}

export class ApproveCommissionDto {
  @IsOptional()
  @IsString()
  notas?: string;
}

export class RejectCommissionDto {
  @IsNotEmpty()
  @IsString()
  observaciones!: string;
}

export class PayCommissionDto {
  @IsOptional()
  @IsString()
  referenciaPago?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class FilterCommissionsDto {
  @IsOptional()
  @IsString()
  chatterId?: string;

  @IsOptional()
  @IsString()
  modeloId?: string;

  @IsOptional()
  @IsString()
  goalId?: string;

  @IsOptional()
  @IsEnum(CommissionStatus)
  estado?: CommissionStatus;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}

export class BulkApproveCommissionsDto {
  @IsNotEmpty()
  @IsString({ each: true })
  commissionIds!: string[];

  @IsOptional()
  @IsString()
  notas?: string;
}

export class BulkPayCommissionsDto {
  @IsNotEmpty()
  @IsString({ each: true })
  commissionIds!: string[];

  @IsOptional()
  @IsString()
  referenciaPago?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

