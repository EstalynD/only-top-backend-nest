import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanzasController } from './finanzas.controller.js';
import { CostosFijosController } from './costos-fijos.controller.js';
import { TransaccionesController } from './transacciones.controller.js';
import { GastosFijosQuincenalesController } from './gastos-fijos-quincenales.controller.js';
import { FinanzasService } from './finanzas.service.js';
import { CostosFijosService } from './costos-fijos.service.js';
import { TransaccionesService } from './transacciones.service.js';
import { GastosFijosQuincenalesService } from './gastos-fijos-quincenales.service.js';
import { BankOnlyTopService } from './bank-onlytop.service.js';
import { FinanzasModeloEntity, FinanzasModeloSchema } from './finanzas-modelo.schema.js';
import { PeriodoConsolidadoEntity, PeriodoConsolidadoSchema } from './periodo-consolidado.schema.js';
import { BankOnlyTopEntity, BankOnlyTopSchema } from './bank-onlytop.schema.js';
import { CostosFijosMensualesEntity, CostosFijosMensualesSchema } from './costos-fijos-mensuales.schema.js';
import { CategoriaGastoEntity, CategoriaGastoSchema } from './categoria-gasto.schema.js';
import { TransaccionMovimientoEntity, TransaccionMovimientoSchema } from './transaccion-movimiento.schema.js';
import { GastoFijoQuincenalEntity, GastoFijoQuincenalSchema } from './gasto-fijo-quincenal.schema.js';
import { ResumenGastosMensualEntity, ResumenGastosMensualSchema } from './resumen-gastos-mensual.schema.js';
import { ChatterSaleEntity, ChatterSaleSchema } from '../chatter/chatter-sale.schema.js';
import { ModeloEntity, ModeloSchema } from '../rrhh/modelo.schema.js';
import { EmpleadoEntity, EmpleadoSchema } from '../rrhh/empleado.schema.js';
import { ContratoModeloEntity, ContratoModeloSchema } from '../rrhh/contrato-modelo.schema.js';
import { CommissionScaleEntity, CommissionScaleSchema } from '../sistema/commission-scale.schema.js';
import { MoneyModule } from '../money/money.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

/**
 * FinanzasModule - Módulo de gestión financiera
 * 
 * Integra:
 * - ChatterSales: Ventas registradas de modelos
 * - ContratoModelo: Porcentajes de comisión
 * - MoneyService: Cálculos precisos con BigInt
 * - EmpleadoEntity: Integración con RRHH para nómina
 * 
 * Funcionalidades:
 * - Cálculo automático de ganancias mensuales
 * - Reportes financieros por modelo
 * - Estadísticas generales de la agencia
 * - Gestión de comisiones y pagos
 * - Gastos fijos quincenales con utilidad neta y comparativas
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinanzasModeloEntity.name, schema: FinanzasModeloSchema },
      { name: PeriodoConsolidadoEntity.name, schema: PeriodoConsolidadoSchema },
      { name: BankOnlyTopEntity.name, schema: BankOnlyTopSchema },
      { name: CostosFijosMensualesEntity.name, schema: CostosFijosMensualesSchema },
      { name: CategoriaGastoEntity.name, schema: CategoriaGastoSchema },
      { name: TransaccionMovimientoEntity.name, schema: TransaccionMovimientoSchema },
      { name: GastoFijoQuincenalEntity.name, schema: GastoFijoQuincenalSchema },
      { name: ResumenGastosMensualEntity.name, schema: ResumenGastosMensualSchema },
      { name: ChatterSaleEntity.name, schema: ChatterSaleSchema },
      { name: ModeloEntity.name, schema: ModeloSchema },
      { name: EmpleadoEntity.name, schema: EmpleadoSchema },
      { name: ContratoModeloEntity.name, schema: ContratoModeloSchema },
      { name: CommissionScaleEntity.name, schema: CommissionScaleSchema },
    ]),
    MoneyModule, // Para MoneyService (ya es @Global())
    AuthModule, // Para AuthGuard en el controlador
    RbacModule, // Para RequirePermissions decorator
  ],
  controllers: [
    FinanzasController,
    CostosFijosController,
    TransaccionesController,
    GastosFijosQuincenalesController,
  ],
  providers: [
    FinanzasService,
    CostosFijosService,
    TransaccionesService,
    BankOnlyTopService,
    GastosFijosQuincenalesService,
  ],
  exports: [
    FinanzasService,
    CostosFijosService,
    TransaccionesService,
    BankOnlyTopService,
    GastosFijosQuincenalesService,
  ],
})
export class FinanzasModule {}
