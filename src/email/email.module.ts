import { Module } from '@nestjs/common';
import { BrevoSmtpProvider } from './brevo-smtp.provider.js';

@Module({
  providers: [BrevoSmtpProvider],
  exports: [BrevoSmtpProvider],
})
export class EmailModule {}
