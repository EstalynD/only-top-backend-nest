import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module.js';
import { SistemaModule } from '../sistema/sistema.module.js';
import { ChatterSalesController } from './chatter-sales.controller.js';
import { ChatterSalesService } from './chatter-sales.service.js';
import { ChatterGoalsService } from './chatter-goals.service.js';
import { ChatterCommissionsService } from './chatter-commissions.service.js';
import { ChatterPdfService } from './chatter-pdf.service.js';
import { ChatterExcelService } from './chatter-excel.service.js';
import { ChatterSaleEntity, ChatterSaleSchema } from './chatter-sale.schema.js';
import { ChatterGoalEntity, ChatterGoalSchema } from './chatter-goal.schema.js';
import { ChatterCommissionEntity, ChatterCommissionSchema } from './chatter-commission.schema.js';
import { ModeloEntity, ModeloSchema } from '../rrhh/modelo.schema.js';
import { EmpleadoEntity, EmpleadoSchema } from '../rrhh/empleado.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatterSaleEntity.name, schema: ChatterSaleSchema },
      { name: ChatterGoalEntity.name, schema: ChatterGoalSchema },
      { name: ChatterCommissionEntity.name, schema: ChatterCommissionSchema },
      { name: ModeloEntity.name, schema: ModeloSchema },
      { name: EmpleadoEntity.name, schema: EmpleadoSchema },
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    SistemaModule,
  ],
  controllers: [ChatterSalesController],
  providers: [
    ChatterSalesService,
    ChatterGoalsService,
    ChatterCommissionsService,
    ChatterPdfService,
    ChatterExcelService,
  ],
  exports: [
    ChatterSalesService,
    ChatterGoalsService,
    ChatterCommissionsService,
    ChatterPdfService,
    ChatterExcelService,
  ],
})
export class ChatterModule {}

