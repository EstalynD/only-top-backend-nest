import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrmEntity, TrmSchema } from './trm.schema.js';
import { CurrencyEntity, CurrencySchema } from './currency.schema.js';
import { SystemConfigEntity, SystemConfigSchema } from './system-config.schema.js';
import { EmailConfigEntity, EmailConfigSchema } from './email-config.schema.js';
import { PaymentProcessorEntity, PaymentProcessorSchema } from './payment-processor.schema.js';
import { CommissionScaleEntity, CommissionScaleSchema } from './commission-scale.schema.js';
import { ChatterCommissionScaleEntity, ChatterCommissionScaleSchema } from './chatter-commission-scale.schema.js';
import { InternalCommissionEntity, InternalCommissionSchema } from './internal-commission.schema.js';
import { AttendanceConfigEntity, AttendanceConfigSchema } from './attendance-config.schema.js';
import { SistemaService } from './sistema.service.js';
import { EmailConfigService } from './email-config.service.js';
import { FinanceConfigService } from './finance-config.service.js';
import { InternalCommissionService } from './internal-commission.service.js';
import { AttendanceConfigService } from './attendance-config.service.js';
import { SistemaController } from './sistema.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrmEntity.name, schema: TrmSchema },
      { name: CurrencyEntity.name, schema: CurrencySchema },
      { name: SystemConfigEntity.name, schema: SystemConfigSchema },
      { name: EmailConfigEntity.name, schema: EmailConfigSchema },
      { name: PaymentProcessorEntity.name, schema: PaymentProcessorSchema },
      { name: CommissionScaleEntity.name, schema: CommissionScaleSchema },
      { name: ChatterCommissionScaleEntity.name, schema: ChatterCommissionScaleSchema },
      { name: InternalCommissionEntity.name, schema: InternalCommissionSchema },
      { name: AttendanceConfigEntity.name, schema: AttendanceConfigSchema },
    ]), 
    AuthModule,
    EmailModule
  ],
  providers: [SistemaService, EmailConfigService, FinanceConfigService, InternalCommissionService, AttendanceConfigService],
  controllers: [SistemaController],
  exports: [MongooseModule, SistemaService, EmailConfigService, FinanceConfigService, InternalCommissionService, AttendanceConfigService],
})
export class SistemaModule {}


