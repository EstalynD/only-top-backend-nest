import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrmEntity, TrmSchema } from './trm.schema.js';
import { CurrencyEntity, CurrencySchema } from './currency.schema.js';
import { SystemConfigEntity, SystemConfigSchema } from './system-config.schema.js';
import { EmailConfigEntity, EmailConfigSchema } from './email-config.schema.js';
import { SistemaService } from './sistema.service.js';
import { EmailConfigService } from './email-config.service.js';
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
    ]), 
    AuthModule,
    EmailModule
  ],
  providers: [SistemaService, EmailConfigService],
  controllers: [SistemaController],
  exports: [MongooseModule, SistemaService, EmailConfigService],
})
export class SistemaModule {}


