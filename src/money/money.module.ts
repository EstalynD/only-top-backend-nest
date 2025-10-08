import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoneyService } from './money.service.js';
import { CurrencyConfigService } from './currency-config.service.js';
import { CurrencyEntity, CurrencySchema } from '../sistema/currency.schema.js';

/**
 * MoneyModule - Módulo global para manejo profesional de monedas
 * 
 * Características:
 * - Conversión precisa decimal ↔ entero escalado (5 decimales)
 * - Operaciones matemáticas sin errores de punto flotante (big.js)
 * - Formateo según configuración de moneda DINÁMICA desde BD
 * - Caché de configuraciones para performance
 * - Validaciones de negocio
 * - Exportable y reutilizable en cualquier módulo
 * 
 * Uso:
 * ```typescript
 * @Module({
 *   imports: [MoneyModule],
 *   // ...
 * })
 * export class MiModule {
 *   constructor(private moneyService: MoneyService) {}
 *   
 *   ejemplo() {
 *     // Guardar en BD
 *     const dbValue = this.moneyService.toDatabase(3000000.25, 'COP');
 *     // dbValue = 300000025000n (BigInt)
 *     
 *     // Leer de BD
 *     const userValue = this.moneyService.fromDatabase(300000025000n);
 *     // userValue = 3000000.25
 *     
 *     // Formatear (usa config de BD automáticamente)
 *     const formatted = await this.moneyService.formatForUser(3000000.25, 'USD');
 *     // formatted = "USD $ 3,000,000.25" (según config en BD)
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CurrencyEntity.name, schema: CurrencySchema },
    ]),
  ],
  providers: [MoneyService, CurrencyConfigService],
  exports: [MoneyService, CurrencyConfigService],
})
export class MoneyModule {}
