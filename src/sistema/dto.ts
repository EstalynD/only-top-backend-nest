import { IsDateString, IsNotEmpty, IsNumber, IsObject, IsOptional, Min, IsBoolean } from 'class-validator';

export class CreateTrmDto {
  // Fecha/hora ISO de vigencia. Se recomienda normalizar a 00:00:00Z del día de vigencia
  @IsDateString()
  effectiveAt!: string;

  // COP por 1 USD
  @IsNumber()
  @Min(0)
  copPerUsd!: number;

  // Datos opcionales de auditoría
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class ListTrmQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

export type CurrencyCode = 'USD' | 'COP';
export type DisplayFormat = 'CODE_SYMBOL' | 'SYMBOL_ONLY';

export class UpdateCurrencyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumFractionDigits?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumFractionDigits?: number;

  @IsOptional()
  displayFormat?: DisplayFormat;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTimezoneDto {
  @IsNotEmpty()
  timezone!: 'Colombia' | 'Peru';
}

export class EmailConfigDto {
  @IsOptional()
  provider?: string;

  @IsOptional()
  host?: string;

  @IsOptional()
  @IsNumber()
  port?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  authUser?: string;

  @IsOptional()
  authPass?: string;

  @IsOptional()
  from?: string;

  @IsOptional()
  fromName?: string;

  @IsOptional()
  replyTo?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class TestEmailDto {
  @IsNotEmpty()
  to!: string;
}

export type CurrencyFormatSpec = {
  code: CurrencyCode;
  symbol: string;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
  displayFormat: DisplayFormat;
  isActive: boolean;
  sample: string;
};


