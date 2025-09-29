import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalCommissionEntity, type PerformanceScale } from './internal-commission.schema.js';
import { UpdateInternalCommissionsDto } from './dto.js';

const INTERNAL_COMMISSIONS_KEY = 'internal_commissions';

@Injectable()
export class InternalCommissionService {
  private readonly logger = new Logger(InternalCommissionService.name);

  constructor(
    @InjectModel(InternalCommissionEntity.name) private readonly internalCommissionModel: Model<InternalCommissionEntity>,
  ) {}

  async getInternalCommissions() {
    let config = await this.internalCommissionModel.findOne({ key: INTERNAL_COMMISSIONS_KEY }).lean();
    
    // Create default configuration if it doesn't exist
    if (!config) {
      config = await this.createDefaultConfiguration();
    }
    
    return config;
  }

  async updateInternalCommissions(dto: UpdateInternalCommissionsDto, updatedBy?: string) {
    // Validate chatters performance scale if provided
    if (dto.chattersPerformanceScale) {
      this.validatePerformanceScale(dto.chattersPerformanceScale);
    }

    // Validate chatters min/max relationship
    if (dto.chattersMinPercent !== undefined && dto.chattersMaxPercent !== undefined) {
      if (dto.chattersMinPercent > dto.chattersMaxPercent) {
        throw new Error('Chatters minimum percentage cannot be greater than maximum percentage');
      }
    }

    const updated = await this.internalCommissionModel.findOneAndUpdate(
      { key: INTERNAL_COMMISSIONS_KEY },
      { 
        ...dto,
        updatedBy,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    if (!updated) {
      throw new Error('Failed to update internal commissions configuration');
    }

    return updated.toObject();
  }

  // === CALCULATION METHODS ===

  async calculateSalesCloserCommission(subscriptionAmount: number, monthsActive: number) {
    const config = await this.getInternalCommissions();
    
    // Only apply commission for the configured months
    const applicableMonths = Math.min(monthsActive, config.salesCloserMonths);
    
    if (applicableMonths <= 0) {
      return {
        subscriptionAmount,
        applicableMonths: 0,
        commissionPercent: config.salesCloserPercent,
        commissionAmount: 0,
        totalMonthsConfigured: config.salesCloserMonths,
        note: 'No applicable months for commission'
      };
    }

    const monthlyAmount = subscriptionAmount / monthsActive;
    const applicableAmount = monthlyAmount * applicableMonths;
    const commissionAmount = (applicableAmount * config.salesCloserPercent) / 100;

    return {
      subscriptionAmount,
      monthlyAmount,
      applicableMonths,
      applicableAmount,
      commissionPercent: config.salesCloserPercent,
      commissionAmount,
      totalMonthsConfigured: config.salesCloserMonths,
      note: `Commission applied to first ${applicableMonths} months`
    };
  }

  async calculateTraffickerCommission(netSubscriptionAmount: number) {
    const config = await this.getInternalCommissions();
    
    const commissionAmount = (netSubscriptionAmount * config.traffickerPercent) / 100;

    return {
      netSubscriptionAmount,
      commissionPercent: config.traffickerPercent,
      commissionAmount,
      note: 'Commission on net subscriptions attributable to traffic'
    };
  }

  async calculateChattersCommission(goalCompletionPercent: number, baseAmount: number) {
    const config = await this.getInternalCommissions();
    
    // Find the applicable performance scale
    const scale = this.findApplicablePerformanceScale(goalCompletionPercent, config.chattersPerformanceScale);
    
    if (!scale) {
      return {
        baseAmount,
        goalCompletionPercent,
        commissionPercent: config.chattersMinPercent, // Fallback to minimum
        commissionAmount: (baseAmount * config.chattersMinPercent) / 100,
        scaleUsed: null,
        note: 'No applicable scale found, using minimum percentage'
      };
    }

    const commissionAmount = (baseAmount * scale.commissionPercent) / 100;

    return {
      baseAmount,
      goalCompletionPercent,
      commissionPercent: scale.commissionPercent,
      commissionAmount,
      scaleUsed: scale,
      note: `Applied scale: ${scale.fromPercent}%-${scale.toPercent || '∞'} = ${scale.commissionPercent}%`
    };
  }

  // === UTILITY METHODS ===

  private async createDefaultConfiguration(updatedBy?: string) {
    const defaultConfig: Omit<InternalCommissionEntity, '_id' | 'createdAt' | 'updatedAt'> = {
      key: INTERNAL_COMMISSIONS_KEY,
      salesCloserPercent: 2,
      salesCloserMonths: 2,
      traffickerPercent: 2,
      chattersMinPercent: 0.5,
      chattersMaxPercent: 2,
      chattersPerformanceScale: [
        { fromPercent: 0, toPercent: 79.99, commissionPercent: 0.5 },
        { fromPercent: 80, toPercent: 99.99, commissionPercent: 1 },
        { fromPercent: 100, commissionPercent: 2 }
      ],
      description: 'Default internal commissions configuration',
      updatedBy: updatedBy || 'system'
    };

    const created = await this.internalCommissionModel.create(defaultConfig);
    return created.toObject();
  }

  private findApplicablePerformanceScale(completionPercent: number, scales: PerformanceScale[]) {
    // Sort scales by fromPercent to ensure proper order
    const sortedScales = [...scales].sort((a, b) => a.fromPercent - b.fromPercent);
    
    return sortedScales.find(scale => {
      const fromOk = completionPercent >= scale.fromPercent;
      const toOk = scale.toPercent === undefined || scale.toPercent === null || completionPercent <= scale.toPercent;
      return fromOk && toOk;
    });
  }

  private validatePerformanceScale(scales: PerformanceScale[]) {
    if (!scales || scales.length === 0) {
      throw new Error('At least one performance scale is required');
    }

    // Sort scales by fromPercent to check for gaps/overlaps
    const sortedScales = [...scales].sort((a, b) => a.fromPercent - b.fromPercent);

    // Validate each scale
    for (let i = 0; i < sortedScales.length; i++) {
      const current = sortedScales[i];
      
      // Validate percentage ranges
      if (current.commissionPercent < 0 || current.commissionPercent > 100) {
        throw new Error(`Invalid commission percentage in scale ${i + 1}: ${current.commissionPercent}%. Must be between 0-100%`);
      }

      if (current.fromPercent < 0) {
        throw new Error(`Invalid fromPercent in scale ${i + 1}: ${current.fromPercent}%. Must be >= 0%`);
      }

      if (current.toPercent !== undefined && current.toPercent !== null) {
        if (current.toPercent < current.fromPercent) {
          throw new Error(`Invalid range in scale ${i + 1}: toPercent (${current.toPercent}%) must be >= fromPercent (${current.fromPercent}%)`);
        }
      }

      // Check for overlaps with next scale
      if (i < sortedScales.length - 1) {
        const next = sortedScales[i + 1];
        
        if (current.toPercent !== undefined && current.toPercent !== null) {
          // Check for overlap
          if (next.fromPercent <= current.toPercent) {
            throw new Error(`Performance scales overlap: Scale ${i + 1} (${current.fromPercent}-${current.toPercent}) overlaps with Scale ${i + 2} (${next.fromPercent}-${next.toPercent || '∞'})`);
          }

          // Check for gaps (warn but don't fail)
          if (next.fromPercent !== current.toPercent + 0.01) {
            this.logger.warn(`Gap detected between performance scales: ${current.toPercent + 0.01} to ${next.fromPercent - 0.01}`);
          }
        }
      }
    }

    // Ensure the first scale starts at 0
    if (sortedScales[0].fromPercent !== 0) {
      throw new Error('First performance scale must start at 0%');
    }
  }

  // === BULK CALCULATION METHODS ===

  async calculateAllCommissions(data: {
    subscriptionAmount: number;
    monthsActive: number;
    netSubscriptionAmount: number;
    goalCompletionPercent: number;
    baseAmountForChatters: number;
  }) {
    const [salesCloser, trafficker, chatters] = await Promise.all([
      this.calculateSalesCloserCommission(data.subscriptionAmount, data.monthsActive),
      this.calculateTraffickerCommission(data.netSubscriptionAmount),
      this.calculateChattersCommission(data.goalCompletionPercent, data.baseAmountForChatters)
    ]);

    const totalCommission = salesCloser.commissionAmount + trafficker.commissionAmount + chatters.commissionAmount;

    return {
      salesCloser,
      trafficker,
      chatters,
      summary: {
        totalCommission,
        breakdown: {
          salesCloser: salesCloser.commissionAmount,
          trafficker: trafficker.commissionAmount,
          chatters: chatters.commissionAmount
        }
      }
    };
  }
}
