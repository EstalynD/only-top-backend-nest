import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrafficCampaignEntity, TrafficCampaignSchema } from './traffic-campaign.schema.js';
import { ModeloEntity, ModeloSchema } from '../rrhh/modelo.schema.js';
import { EmpleadoEntity, EmpleadoSchema } from '../rrhh/empleado.schema.js';
import { CargoEntity, CargoSchema } from '../rrhh/cargo.schema.js';
import { TrafficCampaignsService } from './traffic-campaigns.service.js';
import { TrafficCampaignsController } from './traffic-campaigns.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrafficCampaignEntity.name, schema: TrafficCampaignSchema },
      { name: ModeloEntity.name, schema: ModeloSchema },
      { name: EmpleadoEntity.name, schema: EmpleadoSchema },
      { name: CargoEntity.name, schema: CargoSchema },
    ]),
    AuthModule,
  ],
  controllers: [TrafficCampaignsController],
  providers: [TrafficCampaignsService],
  exports: [TrafficCampaignsService],
})
export class TrafficModule {}
