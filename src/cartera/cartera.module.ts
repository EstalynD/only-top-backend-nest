import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarteraService } from './cartera.service.js';
import { CarteraController } from './cartera.controller.js';
import { CarteraPdfController } from './cartera-pdf.controller.js';
import { CarteraEmailService } from './cartera-email.service.js';
import { CarteraScheduler } from './cartera.scheduler.js';
import { CarteraPdfService } from './cartera-pdf.service.js';
import { CarteraFacturaPdfService } from './cartera-factura-pdf.service.js';
import { CarteraPdfCoreService } from './cartera-pdf-core.service.js';
import { CarteraTokenService } from './cartera-token.service.js';

// Schemas de Cartera
import { FacturaEntity, FacturaSchema } from './factura.schema.js';
import { PagoEntity, PagoSchema } from './pago.schema.js';
import { RecordatorioEntity, RecordatorioSchema } from './recordatorio.schema.js';
import { ConfiguracionCarteraEntity, ConfiguracionCarteraSchema } from './configuracion-cartera.schema.js';

// Dependencias externas
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { MoneyModule } from '../money/money.module.js';
import { EmailModule } from '../email/email.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SistemaModule } from '../sistema/sistema.module.js';
// import { PdfModule } from '../pdf/pdf.module.js'; // Pendiente integración

// Dependencias de módulos relacionados
import { ModeloEntity, ModeloSchema } from '../rrhh/modelo.schema.js';
import { ContratoModeloEntity, ContratoModeloSchema } from '../rrhh/contrato-modelo.schema.js';
import { ChatterSaleEntity, ChatterSaleSchema } from '../chatter/chatter-sale.schema.js';
import { CommissionScaleEntity, CommissionScaleSchema } from '../sistema/commission-scale.schema.js';

/**
 * Módulo de Cartera
 * 
 * Funcionalidades:
 * - Generación automática de facturas por modelo según ventas
 * - Registro de pagos con comprobantes en Cloudinary
 * - Estado de cuenta por modelo
 * - Recordatorios y alertas de pago
 * - Configuración de fechas de corte y alertas
 * - Exportación de estado de cuenta en PDF
 * 
 * Integraciones:
 * - MoneyModule: Manejo de monedas y cálculos precisos
 * - CloudinaryModule: Almacenamiento de comprobantes de pago
 * - PDFModule: Generación de estado de cuenta (pendiente)
 * - EmailModule: Envío de recordatorios (pendiente)
 */
@Module({
  imports: [
    // Schemas propios del módulo
    MongooseModule.forFeature([
      { name: FacturaEntity.name, schema: FacturaSchema },
      { name: PagoEntity.name, schema: PagoSchema },
      { name: RecordatorioEntity.name, schema: RecordatorioSchema },
      { name: ConfiguracionCarteraEntity.name, schema: ConfiguracionCarteraSchema },
    ]),

    // Schemas de dependencias
    MongooseModule.forFeature([
      { name: ModeloEntity.name, schema: ModeloSchema },
      { name: ContratoModeloEntity.name, schema: ContratoModeloSchema },
      { name: ChatterSaleEntity.name, schema: ChatterSaleSchema },
      { name: CommissionScaleEntity.name, schema: CommissionScaleSchema },
    ]),

    // Módulos externos
    CloudinaryModule,
    MoneyModule,
    EmailModule,
    SistemaModule, // Proporciona EmailConfigService
    AuthModule, // Requerido para AuthGuard en el controller
    // PdfModule, // TODO: Importar cuando esté listo
  ],
  controllers: [
    CarteraController,
    CarteraPdfController, // Controlador público para PDFs (sin auth)
  ],
  providers: [
    CarteraService,
    CarteraEmailService,
    CarteraScheduler,
    CarteraPdfService,
    CarteraFacturaPdfService,
    CarteraPdfCoreService, // Servicio centralizado para PDFs
    CarteraTokenService,
  ],
  exports: [
    CarteraService,
    CarteraPdfService,
    CarteraFacturaPdfService,
    CarteraPdfCoreService, // Exportar para uso en otros módulos
  ],
})
export class CarteraModule {}
