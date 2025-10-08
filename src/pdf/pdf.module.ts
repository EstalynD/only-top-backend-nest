import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContratoModeloEntity, ContratoModeloSchema } from '../rrhh/contrato-modelo.schema.js';
import { ModeloEntity, ModeloSchema } from '../rrhh/modelo.schema.js';
import { CommissionScaleEntity, CommissionScaleSchema } from '../sistema/commission-scale.schema.js';
import { PaymentProcessorEntity, PaymentProcessorSchema } from '../sistema/payment-processor.schema.js';
import { PdfGeneratorService } from './pdf-generator.service.js';
import { PdfService } from './pdf.service.js';
import { PdfController } from './pdf.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContratoModeloEntity.name, schema: ContratoModeloSchema },
      { name: ModeloEntity.name, schema: ModeloSchema },
      { name: CommissionScaleEntity.name, schema: CommissionScaleSchema },
      { name: PaymentProcessorEntity.name, schema: PaymentProcessorSchema },
    ]),
  ],
  controllers: [PdfController],
  providers: [PdfGeneratorService, PdfService],
  exports: [PdfService, PdfGeneratorService],
})
export class PdfModule {}

