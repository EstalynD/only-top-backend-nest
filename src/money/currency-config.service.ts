import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CurrencyEntity } from '../sistema/currency.schema.js';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  minimumFractionDigits: number;
  maximumFractionDigits: number;
  displayFormat: 'SYMBOL_ONLY' | 'CODE_SYMBOL' | 'CODE_ONLY';
  thousandsSeparator: ',' | '.';
  decimalSeparator: ',' | '.';
}

/**
 * CurrencyConfigService - Servicio de caché para configuraciones de moneda
 * 
 * Cachea las configuraciones de moneda de la BD para evitar consultas repetitivas.
 * Se actualiza automáticamente al iniciar el módulo y puede refrescarse manualmente.
 */
@Injectable()
export class CurrencyConfigService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyConfigService.name);
  private configCache: Map<string, CurrencyConfig> = new Map();
  private lastRefresh: Date | null = null;

  constructor(
    @InjectModel(CurrencyEntity.name) 
    private readonly currencyModel: Model<CurrencyEntity>,
  ) {}

  async onModuleInit() {
    await this.refreshCache();
    this.logger.log('✅ Currency config cache initialized');
  }

  /**
   * Refresca el caché de configuraciones desde la BD
   */
  async refreshCache(): Promise<void> {
    try {
      const currencies = await this.currencyModel.find({ isActive: true }).lean();
      
      this.configCache.clear();
      
      for (const currency of currencies) {
        const config: CurrencyConfig = {
          code: currency.code,
          symbol: currency.symbol,
          minimumFractionDigits: currency.minimumFractionDigits,
          maximumFractionDigits: currency.maximumFractionDigits,
          displayFormat: currency.displayFormat as any,
          // Configurar separadores según la moneda
          thousandsSeparator: currency.code === 'COP' ? '.' : ',',
          decimalSeparator: currency.code === 'COP' ? ',' : '.',
        };
        
        this.configCache.set(currency.code, config);
      }
      
      this.lastRefresh = new Date();
      this.logger.log(`💰 Cached ${this.configCache.size} currency configs from DB`);
    } catch (error) {
      this.logger.error('Error refreshing currency cache:', error);
      // Si falla, usar configuración por defecto
      this.loadDefaultConfigs();
    }
  }

  /**
   * Obtiene la configuración de una moneda (desde caché)
   */
  getConfig(currencyCode: string): CurrencyConfig | null {
    return this.configCache.get(currencyCode) || null;
  }

  /**
   * Obtiene todas las configuraciones cacheadas
   */
  getAllConfigs(): CurrencyConfig[] {
    return Array.from(this.configCache.values());
  }

  /**
   * Verifica si el caché necesita actualización (opcional: por tiempo)
   */
  needsRefresh(maxAgeMinutes: number = 60): boolean {
    if (!this.lastRefresh) return true;
    const now = new Date();
    const diffMinutes = (now.getTime() - this.lastRefresh.getTime()) / 60000;
    return diffMinutes > maxAgeMinutes;
  }

  /**
   * Carga configuraciones por defecto en caso de error
   */
  private loadDefaultConfigs(): void {
    const defaultConfigs: CurrencyConfig[] = [
      {
        code: 'USD',
        symbol: '$',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        displayFormat: 'CODE_SYMBOL',
        thousandsSeparator: ',',
        decimalSeparator: '.',
      },
      {
        code: 'COP',
        symbol: '$',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        displayFormat: 'CODE_SYMBOL',
        thousandsSeparator: '.',
        decimalSeparator: ',',
      },
    ];

    this.configCache.clear();
    for (const config of defaultConfigs) {
      this.configCache.set(config.code, config);
    }
    
    this.logger.warn('⚠️ Using default currency configs (DB query failed)');
  }
}
