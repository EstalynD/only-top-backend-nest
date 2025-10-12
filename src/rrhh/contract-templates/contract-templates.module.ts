import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContractTemplatesService } from './contract-templates.service.js';
import { CommunityManagerContractTemplate } from './community-manager-contract.template.js';
import { TraffickerContractTemplate } from './trafficker-contract.template.js';
import { ChatterContractTemplate } from './chatter-contract.template.js';
import { ManagerContractTemplate } from './manager-contract.template.js';
import { AssignTemplatesMigration } from './assign-templates.migration.js';
import { EmpleadoEntity, EmpleadoSchema } from '../empleado.schema.js';
import { AreaEntity, AreaSchema } from '../area.schema.js';
import { CargoEntity, CargoSchema } from '../cargo.schema.js';
import { AttendanceConfigModule } from '../../sistema/attendance-config.module.js';
import { PdfModule } from '../../pdf/pdf.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmpleadoEntity.name, schema: EmpleadoSchema },
      { name: AreaEntity.name, schema: AreaSchema },
      { name: CargoEntity.name, schema: CargoSchema },
    ]),
    AttendanceConfigModule,
    PdfModule,
  ],
  providers: [
    ContractTemplatesService,
    CommunityManagerContractTemplate,
    TraffickerContractTemplate,
    ChatterContractTemplate,
    ManagerContractTemplate,
    AssignTemplatesMigration,
  ],
  exports: [
    ContractTemplatesService,
    CommunityManagerContractTemplate,
    TraffickerContractTemplate,
    ChatterContractTemplate,
    ManagerContractTemplate,
    AssignTemplatesMigration,
  ],
})
export class ContractTemplatesModule {}
