import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentProcessorEntity } from './payment-processor.schema.js';
import { CommissionScaleEntity, type CommissionRule } from './commission-scale.schema.js';
import { 
  CreatePaymentProcessorDto, 
  UpdatePaymentProcessorDto, 
  CreateCommissionScaleDto, 
  UpdateCommissionScaleDto,
  type CommissionType 
} from './dto.js';

@Injectable()
export class FinanceConfigService {
  private readonly logger = new Logger(FinanceConfigService.name);

  constructor(
    @InjectModel(PaymentProcessorEntity.name) private readonly paymentProcessorModel: Model<PaymentProcessorEntity>,
    @InjectModel(CommissionScaleEntity.name) private readonly commissionScaleModel: Model<CommissionScaleEntity>,
  ) {}

  // === PAYMENT PROCESSORS ===

  async createPaymentProcessor(dto: CreatePaymentProcessorDto, updatedBy?: string) {
    const processor = await this.paymentProcessorModel.create({
      ...dto,
      effectiveDate: new Date(dto.effectiveDate),
      isActive: dto.isActive ?? true,
      updatedBy,
    });
    
    return processor.toObject();
  }

  async updatePaymentProcessor(id: string, dto: UpdatePaymentProcessorDto, updatedBy?: string) {
    const updateData: any = { ...dto, updatedBy };
    
    if (dto.effectiveDate) {
      updateData.effectiveDate = new Date(dto.effectiveDate);
    }

    const updated = await this.paymentProcessorModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updated) {
      throw new Error('Payment processor not found');
    }

    return updated.toObject();
  }

  async deletePaymentProcessor(id: string) {
    const deleted = await this.paymentProcessorModel.findByIdAndDelete(id);
    
    if (!deleted) {
      throw new Error('Payment processor not found');
    }

    return { success: true, id };
  }

  async getPaymentProcessors(activeOnly = false) {
    const filter = activeOnly ? { isActive: true } : {};
    return this.paymentProcessorModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async getPaymentProcessor(id: string) {
    const processor = await this.paymentProcessorModel.findById(id).lean();
    
    if (!processor) {
      throw new Error('Payment processor not found');
    }

    return processor;
  }

  // === COMMISSION SCALES ===

  async createCommissionScale(dto: CreateCommissionScaleDto, updatedBy?: string) {
    // Validate rules don't overlap and are in ascending order
    this.validateCommissionRules(dto.rules);

    // If this is set as active, deactivate others
    if (dto.isActive) {
      await this.commissionScaleModel.updateMany({}, { isActive: false });
    }

    // If this is set as default, remove default from others
    if (dto.isDefault) {
      await this.commissionScaleModel.updateMany({}, { isDefault: false });
    }

    const scale = await this.commissionScaleModel.create({
      ...dto,
      isActive: dto.isActive ?? false,
      isDefault: dto.isDefault ?? false,
      updatedBy,
    });

    return scale.toObject();
  }

  async updateCommissionScale(id: string, dto: UpdateCommissionScaleDto, updatedBy?: string) {
    if (dto.rules) {
      this.validateCommissionRules(dto.rules);
    }

    // If this is set as active, deactivate others
    if (dto.isActive) {
      await this.commissionScaleModel.updateMany({ _id: { $ne: id } }, { isActive: false });
    }

    // If this is set as default, remove default from others
    if (dto.isDefault) {
      await this.commissionScaleModel.updateMany({ _id: { $ne: id } }, { isDefault: false });
    }

    const updated = await this.commissionScaleModel.findByIdAndUpdate(
      id,
      { ...dto, updatedBy },
      { new: true }
    );

    if (!updated) {
      throw new Error('Commission scale not found');
    }

    return updated.toObject();
  }

  async deleteCommissionScale(id: string) {
    const scale = await this.commissionScaleModel.findById(id);
    
    if (!scale) {
      throw new Error('Commission scale not found');
    }

    // Don't allow deletion of active scale
    if (scale.isActive) {
      throw new Error('Cannot delete active commission scale. Please activate another scale first.');
    }

    await this.commissionScaleModel.findByIdAndDelete(id);
    return { success: true, id };
  }

  async getCommissionScales() {
    return this.commissionScaleModel.find().sort({ isActive: -1, isDefault: -1, createdAt: -1 }).lean();
  }

  async getCommissionScale(id: string) {
    const scale = await this.commissionScaleModel.findById(id).lean();
    
    if (!scale) {
      throw new Error('Commission scale not found');
    }

    return scale;
  }

  async getActiveCommissionScale() {
    const active = await this.commissionScaleModel.findOne({ isActive: true }).lean();
    
    if (!active) {
      // Return default if no active scale
      return this.commissionScaleModel.findOne({ isDefault: true }).lean();
    }

    return active;
  }

  async setActiveCommissionScale(id: string, updatedBy?: string) {
    // Deactivate all scales
    await this.commissionScaleModel.updateMany({}, { isActive: false });
    
    // Activate the selected scale
    const updated = await this.commissionScaleModel.findByIdAndUpdate(
      id,
      { isActive: true, updatedBy },
      { new: true }
    );

    if (!updated) {
      throw new Error('Commission scale not found');
    }

    return updated.toObject();
  }

  // === UTILITY METHODS ===

  async calculateCommission(amountUsd: number) {
    const activeScale = await this.getActiveCommissionScale();
    
    if (!activeScale) {
      throw new Error('No active commission scale found');
    }

    // Find the applicable rule
    const rule = activeScale.rules.find(r => {
      const minOk = amountUsd >= r.minUsd;
      const maxOk = r.maxUsd === undefined || r.maxUsd === null || amountUsd <= r.maxUsd;
      return minOk && maxOk;
    });

    if (!rule) {
      throw new Error(`No commission rule found for amount: $${amountUsd}`);
    }

    const commissionAmount = (amountUsd * rule.percentage) / 100;
    
    return {
      amountUsd,
      rule: {
        minUsd: rule.minUsd,
        maxUsd: rule.maxUsd,
        percentage: rule.percentage,
      },
      commissionPercentage: rule.percentage,
      commissionAmount,
      netAmount: amountUsd - commissionAmount,
      scaleName: activeScale.name,
    };
  }

  async createDefaultCommissionScale(updatedBy?: string) {
    // Check if default already exists
    const existing = await this.commissionScaleModel.findOne({ isDefault: true });
    if (existing) {
      return existing.toObject();
    }

    const defaultRules: CommissionRule[] = [
      { minUsd: 0, maxUsd: 19999, percentage: 10 },
      { minUsd: 20000, maxUsd: 25999, percentage: 20 },
      { minUsd: 26000, percentage: 30 }, // 26000+ (no maxUsd)
    ];

    return this.createCommissionScale({
      name: 'Default',
      isDefault: true,
      isActive: true,
      rules: defaultRules,
      description: 'Default commission scale for new contracts',
    }, updatedBy);
  }

  private validateCommissionRules(rules: CommissionRule[]) {
    if (!rules || rules.length === 0) {
      throw new Error('At least one commission rule is required');
    }

    // Sort rules by minUsd to check for gaps/overlaps
    const sortedRules = [...rules].sort((a, b) => a.minUsd - b.minUsd);

    // Check for overlaps and gaps
    for (let i = 0; i < sortedRules.length - 1; i++) {
      const current = sortedRules[i];
      const next = sortedRules[i + 1];

      // Check if current rule has maxUsd
      if (current.maxUsd !== undefined && current.maxUsd !== null) {
        // Check for overlap
        if (next.minUsd <= current.maxUsd) {
          throw new Error(`Commission rules overlap: Rule ${i + 1} (${current.minUsd}-${current.maxUsd}) overlaps with Rule ${i + 2} (${next.minUsd}-${next.maxUsd || '∞'})`);
        }

        // Check for gaps (optional - you might want to allow gaps)
        if (next.minUsd !== current.maxUsd + 1) {
          this.logger.warn(`Gap detected between commission rules: ${current.maxUsd + 1} to ${next.minUsd - 1}`);
        }
      }

      // Validate percentage ranges
      if (current.percentage < 0 || current.percentage > 100) {
        throw new Error(`Invalid percentage in rule ${i + 1}: ${current.percentage}%. Must be between 0-100%`);
      }
    }

    // Validate last rule percentage
    const lastRule = sortedRules[sortedRules.length - 1];
    if (lastRule.percentage < 0 || lastRule.percentage > 100) {
      throw new Error(`Invalid percentage in last rule: ${lastRule.percentage}%. Must be between 0-100%`);
    }

    // Ensure the first rule starts at 0
    if (sortedRules[0].minUsd !== 0) {
      throw new Error('First commission rule must start at $0');
    }
  }
}
