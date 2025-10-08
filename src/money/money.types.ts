/**
 * Tipos y DTOs para el módulo de Money
 * Manejo profesional de monedas con precisión decimal
 */

import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// ============= ENUMS =============

/**
 * Códigos de moneda ISO 4217 soportados
 */
export enum CurrencyCode {
  USD = 'USD',
  COP = 'COP',
}

/**
 * Formato de presentación de la moneda
 */
export enum DisplayFormat {
  SYMBOL_ONLY = 'SYMBOL_ONLY',     // $ 1,234.56
  CODE_SYMBOL = 'CODE_SYMBOL',     // $ 1,234.56 USD
  CODE_ONLY = 'CODE_ONLY',         // USD 1,234.56
}

// ============= TIPOS =============

/**
 * Estructura de almacenamiento en MongoDB
 * IMPORTANTE: amount DEBE ser NumberLong (entero escalado a 5 decimales)
 */
export type MoneyDB = {
  amount: bigint;  // Entero escalado (multiply by 100000)
  currency: CurrencyCode;
};

/**
 * Estructura de trabajo en lógica de negocio
 */
export type Money = {
  amount: number;  // Valor decimal (ej: 3000000.25)
  currency: CurrencyCode;
};

/**
 * Estructura formateada para frontend
 */
export type MoneyFormatted = {
  amount: number;
  currency: CurrencyCode;
  formatted: string;  // ej: "$ 3.000.000,25"
  symbol: string;     // ej: "$"
};

/**
 * Configuración de formato de moneda
 */
export type CurrencyFormatConfig = {
  code: CurrencyCode;
  symbol: string;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
  displayFormat: DisplayFormat;
  thousandsSeparator: ',' | '.';
  decimalSeparator: ',' | '.';
};

// ============= DTOs =============

/**
 * DTO para entrada de valores monetarios
 */
export class MoneyInputDto {
  @IsNumber()
  @Min(0, { message: 'El monto debe ser un valor positivo' })
  amount!: number;

  @IsEnum(CurrencyCode, { message: 'Código de moneda inválido. Use USD o COP.' })
  currency!: CurrencyCode;
}

/**
 * DTO para actualización de valores monetarios (opcional)
 */
export class MoneyUpdateDto {
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El monto debe ser un valor positivo' })
  amount?: number;

  @IsOptional()
  @IsEnum(CurrencyCode, { message: 'Código de moneda inválido. Use USD o COP.' })
  currency?: CurrencyCode;
}

/**
 * DTO para conversión de monedas
 */
export class MoneyConversionDto {
  @IsNumber()
  @Min(0, { message: 'El monto debe ser un valor positivo' })
  amount!: number;

  @IsEnum(CurrencyCode, { message: 'Código de moneda origen inválido' })
  fromCurrency!: CurrencyCode;

  @IsEnum(CurrencyCode, { message: 'Código de moneda destino inválido' })
  toCurrency!: CurrencyCode;

  @IsNumber()
  @Min(0.000001, { message: 'La tasa de cambio debe ser mayor a cero' })
  exchangeRate!: number;
}

/**
 * DTO para operaciones matemáticas con dinero
 */
export class MoneyOperationDto {
  @IsNumber()
  value1!: number;

  @IsNumber()
  value2!: number;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;
}

// ============= CONSTANTES =============

/**
 * Configuración de formato por moneda (según ISO 4217 y prácticas locales)
 */
export const CURRENCY_FORMAT_CONFIGS: Record<CurrencyCode, CurrencyFormatConfig> = {
  USD: {
    code: CurrencyCode.USD,
    symbol: '$',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    displayFormat: DisplayFormat.SYMBOL_ONLY,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  COP: {
    code: CurrencyCode.COP,
    symbol: '$',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    displayFormat: DisplayFormat.CODE_SYMBOL,
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
};

/**
 * Ejemplos de formato por moneda
 */
export const CURRENCY_FORMAT_EXAMPLES: Record<CurrencyCode, string> = {
  USD: '$1,234.56',
  COP: '$ 1.234,56 COP',
};

/**
 * Nombres de moneda en español
 */
export const CURRENCY_NAMES: Record<CurrencyCode, { singular: string; plural: string }> = {
  USD: { singular: 'Dólar estadounidense', plural: 'Dólares estadounidenses' },
  COP: { singular: 'Peso colombiano', plural: 'Pesos colombianos' },
};
