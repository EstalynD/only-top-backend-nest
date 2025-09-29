import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrmEntity } from './trm.schema.js';
import { CurrencyEntity } from './currency.schema.js';
import { SystemConfigEntity } from './system-config.schema.js';
import { CreateTrmDto, CurrencyCode, CurrencyFormatSpec, ListTrmQueryDto, UpdateCurrencyDto, UpdateTimezoneDto, DisplayFormat } from './dto.js';

const DEFAULT_CURRENCIES: Array<Omit<CurrencyFormatSpec, 'sample'> & { code: CurrencyCode }> = [
  { code: 'USD', symbol: '$', minimumFractionDigits: 2, maximumFractionDigits: 2, displayFormat: 'SYMBOL_ONLY', isActive: true },
  { code: 'COP', symbol: '$', minimumFractionDigits: 0, maximumFractionDigits: 0, displayFormat: 'CODE_SYMBOL', isActive: true },
];

const AVAILABLE_TIMEZONES = [
  { country: 'Colombia', code: 'COT', utcOffset: '-05:00', iana: 'America/Bogota' },
  { country: 'Peru', code: 'PET', utcOffset: '-05:00', iana: 'America/Lima' },
];

const SYSTEM_CONFIG_KEYS = {
  SELECTED_TIMEZONE: 'selected_timezone',
} as const;

@Injectable()
export class SistemaService {
  constructor(
    @InjectModel(TrmEntity.name) private readonly trmModel: Model<TrmEntity>,
    @InjectModel(CurrencyEntity.name) private readonly currencyModel: Model<CurrencyEntity>,
    @InjectModel(SystemConfigEntity.name) private readonly configModel: Model<SystemConfigEntity>,
  ) {}

  async getCurrencies(): Promise<CurrencyFormatSpec[]> {
    await this.ensureDefaultCurrencies();
    const currencies = await this.currencyModel.find({ isActive: true }).lean();
    return currencies.map(c => ({
      code: c.code as CurrencyCode,
      symbol: c.symbol,
      minimumFractionDigits: c.minimumFractionDigits,
      maximumFractionDigits: c.maximumFractionDigits,
      displayFormat: c.displayFormat as DisplayFormat,
      isActive: c.isActive,
      sample: this.generateCurrencySample(c.code as CurrencyCode, c.symbol, c.displayFormat as DisplayFormat, c.minimumFractionDigits),
    }));
  }

  async updateCurrency(code: CurrencyCode, dto: UpdateCurrencyDto) {
    const updated = await this.currencyModel.findOneAndUpdate(
      { code },
      { $set: dto },
      { new: true, upsert: false }
    );
    if (!updated) {
      throw new Error(`Currency ${code} not found`);
    }
    return updated;
  }

  getAvailableTimezones() {
    return AVAILABLE_TIMEZONES;
  }

  async getSelectedTimezone() {
    const config = await this.configModel.findOne({ key: SYSTEM_CONFIG_KEYS.SELECTED_TIMEZONE }).lean();
    const selectedCountry = config?.value || 'Colombia';
    return AVAILABLE_TIMEZONES.find(tz => tz.country === selectedCountry) || AVAILABLE_TIMEZONES[0];
  }

  async updateTimezone(dto: UpdateTimezoneDto) {
    const timezone = AVAILABLE_TIMEZONES.find(tz => tz.country === dto.timezone);
    if (!timezone) {
      throw new Error(`Invalid timezone: ${dto.timezone}`);
    }
    
    await this.configModel.findOneAndUpdate(
      { key: SYSTEM_CONFIG_KEYS.SELECTED_TIMEZONE },
      { 
        key: SYSTEM_CONFIG_KEYS.SELECTED_TIMEZONE,
        value: dto.timezone,
        description: `Selected system timezone: ${dto.timezone}`
      },
      { upsert: true }
    );
    
    return timezone;
  }

  async createTrm(dto: CreateTrmDto) {
    const effectiveAt = new Date(dto.effectiveAt);
    const doc = await this.trmModel.create({ effectiveAt, copPerUsd: dto.copPerUsd, meta: dto.meta ?? {} });
    return { id: (doc as any)._id?.toString?.() ?? null, effectiveAt: doc.effectiveAt, copPerUsd: doc.copPerUsd, createdAt: (doc as any).createdAt };
  }

  async getCurrentTrm(at?: Date) {
    const when = at ?? new Date();
    const doc = await this.trmModel
      .findOne({ effectiveAt: { $lte: when } })
      .sort({ effectiveAt: -1 })
      .lean();
    return doc ?? null;
  }

  async listTrm(query: ListTrmQueryDto) {
    const where: any = {};
    if (query.from || query.to) {
      where.effectiveAt = {};
      if (query.from) where.effectiveAt.$gte = new Date(query.from);
      if (query.to) where.effectiveAt.$lte = new Date(query.to);
    }
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
    const items = await this.trmModel.find(where).sort({ effectiveAt: -1 }).limit(limit).lean();
    return items;
  }

  async formatCurrency(amount: number, currency: CurrencyCode): Promise<string> {
    const currencies = await this.getCurrencies();
    const spec = currencies.find(c => c.code === currency);
    if (!spec) throw new Error(`Currency ${currency} not found`);
    
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: spec.minimumFractionDigits,
      maximumFractionDigits: spec.maximumFractionDigits,
    });
    
    return spec.displayFormat === 'CODE_SYMBOL' 
      ? `${spec.code} ${spec.symbol}${formatted}`
      : `${spec.symbol}${formatted}`;
  }

  private async ensureDefaultCurrencies() {
    const count = await this.currencyModel.countDocuments();
    if (count === 0) {
      await this.currencyModel.insertMany(DEFAULT_CURRENCIES);
    }
  }

  private generateCurrencySample(code: CurrencyCode, symbol: string, displayFormat: DisplayFormat, decimals: number): string {
    const amount = code === 'USD' ? 100 : 4100;
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    
    return displayFormat === 'CODE_SYMBOL' 
      ? `${code} ${symbol}${formatted}`
      : `${symbol}${formatted}`;
  }
}


