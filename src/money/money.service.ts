import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import Big from 'big.js';
import { CurrencyConfigService } from './currency-config.service.js';

/**
 * MoneyService - Servicio profesional para manejo de monedas
 * 
 * Reglas fundamentales:
 * 1. Almacenamiento en MongoDB: enteros escalados a 5 decimales (multiply by 100000)
 * 2. Presentación al usuario: según configuración DINÁMICA de CurrencyEntity en BD
 * 3. Precisión interna: big.js para evitar errores de punto flotante
 * 4. Formato: consulta CurrencyConfigService para respetar config del cliente
 * 
 * Ejemplo:
 * Usuario ingresa: 3000000.25 COP
 * Escalado interno: 3000000.25 * 100000 = 300000025000 (NumberLong)
 * En MongoDB: { amount: 300000025000, currency: "COP" }
 * Al leer: 300000025000 / 100000 = 3000000.25
 * Al mostrar: Consulta BD → "$ 3.000.000 COP" (si minDecimals=0 en BD)
 */

@Injectable()
export class MoneyService {
  private readonly logger = new Logger(MoneyService.name);
  private readonly SCALE_FACTOR = 100000; // 5 decimales
  private readonly DEFAULT_DECIMALS = 2; // Fallback

  constructor(private readonly currencyConfig: CurrencyConfigService) {}

  /**
   * Convierte un valor decimal a entero escalado para almacenar en BD
   * @param value Valor decimal (ej: 3000000.25)
   * @param currency Código de moneda (USD, COP)
   * @returns Entero escalado (ej: 300000025000)
   */
  toDatabase(value: number | string, currency: string): bigint {
    try {
      const bigValue = new Big(value);
      const scaled = bigValue.times(this.SCALE_FACTOR);
      
      // Validar que el resultado no tenga decimales después de escalar
      if (!scaled.eq(scaled.round(0))) {
        throw new BadRequestException(
          `El valor ${value} tiene más de 5 decimales. Máximo permitido: 5 decimales.`
        );
      }

      return BigInt(scaled.toFixed(0));
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Valor de moneda inválido: ${value}. Debe ser un número válido.`
      );
    }
  }

  /**
   * Convierte un entero escalado de BD a valor decimal
   * @param scaledValue Entero escalado (ej: 300000025000)
   * @returns Valor decimal (ej: 3000000.25)
   */
  fromDatabase(scaledValue: bigint | number | string): number {
    try {
      const bigValue = new Big(scaledValue.toString());
      const unscaled = bigValue.div(this.SCALE_FACTOR);
      return parseFloat(unscaled.toFixed(this.DEFAULT_DECIMALS));
    } catch (error) {
      throw new BadRequestException(
        `Error al desescalar valor: ${scaledValue}. Valor de BD inválido.`
      );
    }
  }

  /**
   * Formatea un valor para mostrar al usuario según la configuración DINÁMICA de BD
   * @param value Valor decimal
   * @param currency Código de moneda
   * @param config Configuración de formato (opcional, override manual)
   * @returns String formateado (ej: "USD $ 3,000,000.25")
   */
  formatForUser(
    value: number,
    currency: string,
    config?: {
      symbol?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
      displayFormat?: 'SYMBOL_ONLY' | 'CODE_SYMBOL' | 'CODE_ONLY';
    }
  ): string {
    // Obtener configuración de la BD (si existe)
    const dbConfig = this.currencyConfig.getConfig(currency);
    
    // Usar config manual si se provee, sino usar BD, sino defaults
    const symbol = config?.symbol || dbConfig?.symbol || '$';
    const minDecimals = config?.minimumFractionDigits ?? dbConfig?.minimumFractionDigits ?? this.DEFAULT_DECIMALS;
    const maxDecimals = config?.maximumFractionDigits ?? dbConfig?.maximumFractionDigits ?? this.DEFAULT_DECIMALS;
    const displayFormat = config?.displayFormat || dbConfig?.displayFormat || 'SYMBOL_ONLY';
    
    // Usar separadores de la configuración de BD
    const thousandsSeparator = dbConfig?.thousandsSeparator || (currency === 'COP' ? '.' : ',');
    const decimalSeparator = dbConfig?.decimalSeparator || (currency === 'COP' ? ',' : '.');

    // Formatear el número con los separadores correctos
    const formatted = this.formatNumber(
      value,
      minDecimals,
      maxDecimals,
      thousandsSeparator,
      decimalSeparator
    );

    // Aplicar formato de presentación
    switch (displayFormat) {
      case 'CODE_ONLY':
        return `${currency} ${formatted}`;
      case 'CODE_SYMBOL':
        return `${currency} ${symbol} ${formatted}`;
      case 'SYMBOL_ONLY':
      default:
        return `${symbol} ${formatted}`;
    }
  }

  /**
   * Suma dos valores monetarios (usando big.js para precisión)
   * @param value1 Primer valor
   * @param value2 Segundo valor
   * @returns Suma exacta
   */
  add(value1: number | string, value2: number | string): number {
    const big1 = new Big(value1);
    const big2 = new Big(value2);
    return parseFloat(big1.plus(big2).toFixed(this.DEFAULT_DECIMALS));
  }

  /**
   * Resta dos valores monetarios
   * @param value1 Primer valor (minuendo)
   * @param value2 Segundo valor (sustraendo)
   * @returns Diferencia exacta
   */
  subtract(value1: number | string, value2: number | string): number {
    const big1 = new Big(value1);
    const big2 = new Big(value2);
    return parseFloat(big1.minus(big2).toFixed(this.DEFAULT_DECIMALS));
  }

  /**
   * Multiplica un valor monetario por un factor
   * @param value Valor base
   * @param factor Factor de multiplicación
   * @returns Producto exacto
   */
  multiply(value: number | string, factor: number | string): number {
    const bigValue = new Big(value);
    const bigFactor = new Big(factor);
    return parseFloat(bigValue.times(bigFactor).toFixed(this.DEFAULT_DECIMALS));
  }

  /**
   * Divide un valor monetario por un divisor
   * @param value Valor base (dividendo)
   * @param divisor Divisor
   * @returns Cociente exacto
   */
  divide(value: number | string, divisor: number | string): number {
    const bigValue = new Big(value);
    const bigDivisor = new Big(divisor);
    
    if (bigDivisor.eq(0)) {
      throw new BadRequestException('No se puede dividir por cero');
    }
    
    return parseFloat(bigValue.div(bigDivisor).toFixed(this.DEFAULT_DECIMALS));
  }

  /**
   * Convierte entre monedas usando una tasa de cambio
   * @param value Valor en moneda origen
   * @param exchangeRate Tasa de cambio
   * @returns Valor convertido
   */
  convert(value: number | string, exchangeRate: number | string): number {
    return this.multiply(value, exchangeRate);
  }

  /**
   * Redondea un valor usando "banker's rounding" (half to even)
   * @param value Valor a redondear
   * @param decimals Decimales (default: 2)
   * @returns Valor redondeado
   */
  round(value: number | string, decimals: number = this.DEFAULT_DECIMALS): number {
    Big.RM = Big.roundHalfEven; // Banker's rounding
    const bigValue = new Big(value);
    return parseFloat(bigValue.toFixed(decimals));
  }

  /**
   * Redondea un valor según los decimales configurados para la moneda
   * Política centralizada de redondeo monetario para TODO el sistema
   * 
   * Ejemplos:
   * - USD: 1.36364 → 1.36 (2 decimales)
   * - COP: 1363.64 → 1364 (0 decimales)
   * 
   * @param value Valor a redondear
   * @param currency Código de moneda
   * @returns Valor redondeado según la configuración de la moneda
   */
  roundForCurrency(value: number | string, currency: string): number {
    const config = this.currencyConfig.getConfig(currency);
    const decimals = config?.maximumFractionDigits ?? this.DEFAULT_DECIMALS;
    
    Big.RM = Big.roundHalfEven; // Banker's rounding (IEEE 754)
    const bigValue = new Big(value);
    return parseFloat(bigValue.toFixed(decimals));
  }

  /**
   * Realiza una operación matemática con redondeo automático según la moneda
   * Útil para cálculos intermedios en lógica de negocio
   * 
   * @param operation Función que realiza el cálculo
   * @param currency Código de moneda para redondear el resultado
   * @returns Resultado redondeado según la moneda
   */
  calculateWithRounding(operation: () => number, currency: string): number {
    const result = operation();
    return this.roundForCurrency(result, currency);
  }

  /**
   * Valida que un valor sea positivo
   * @param value Valor a validar
   * @param fieldName Nombre del campo (para mensaje de error)
   */
  validatePositive(value: number, fieldName: string = 'Monto'): void {
    if (value < 0) {
      throw new BadRequestException(`${fieldName} debe ser un valor positivo`);
    }
  }

  /**
   * Valida que un valor esté dentro de un rango
   * @param value Valor a validar
   * @param min Mínimo
   * @param max Máximo
   * @param fieldName Nombre del campo
   */
  validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string = 'Monto'
  ): void {
    if (value < min || value > max) {
      throw new BadRequestException(
        `${fieldName} debe estar entre ${min} y ${max}`
      );
    }
  }

  // ========== MÉTODOS PRIVADOS DE FORMATEO ==========

  /**
   * Formatea un número con separadores personalizados
   */
  private formatNumber(
    value: number,
    minDecimals: number,
    maxDecimals: number,
    thousandsSeparator: string,
    decimalSeparator: string
  ): string {
    // Redondear al número de decimales máximo
    const parts = value.toFixed(maxDecimals).split('.');
    
    // Formatear parte entera con separadores de miles
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
    
    // Parte decimal
    const decimalPart = parts[1] || '0'.repeat(minDecimals);
    
    // Si minDecimals es 0 y no hay decimales significativos, no mostrar decimales
    if (minDecimals === 0 && parseFloat('0.' + decimalPart) === 0) {
      return integerPart;
    }
    
    // Truncar o rellenar decimales según configuración
    const finalDecimals = decimalPart.substring(0, maxDecimals).padEnd(minDecimals, '0');
    
    return `${integerPart}${decimalSeparator}${finalDecimals}`;
  }

  /** @deprecated Use formatNumber con configuración dinámica */
  private formatCOP(value: number, minDecimals: number, maxDecimals: number): string {
    return this.formatNumber(value, minDecimals, maxDecimals, '.', ',');
  }

  /** @deprecated Use formatNumber con configuración dinámica */
  private formatUSD(value: number, minDecimals: number, maxDecimals: number): string {
    return this.formatNumber(value, minDecimals, maxDecimals, ',', '.');
  }
}
