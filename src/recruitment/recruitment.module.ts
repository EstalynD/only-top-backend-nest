import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecruitmentActivityEntity, RecruitmentActivitySchema } from './recruitment-activity.schema.js';
import { RecruitmentGoalEntity, RecruitmentGoalSchema } from './recruitment-goal.schema.js';
import { ContratoModeloEntity, ContratoModeloSchema } from '../rrhh/contrato-modelo.schema.js';
import { RecruitmentService } from './recruitment.service.js';
import { RecruitmentGoalsService } from './recruitment-goals.service.js';
import { RecruitmentController } from './recruitment.controller.js';
import { RecruitmentGoalsController } from './recruitment-goals.controller.js';
import { RrhhModule } from '../rrhh/rrhh.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RecruitmentActivityEntity.name, schema: RecruitmentActivitySchema },
      { name: RecruitmentGoalEntity.name, schema: RecruitmentGoalSchema },
      { name: ContratoModeloEntity.name, schema: ContratoModeloSchema },
    ]),
    forwardRef(() => RrhhModule),
    AuthModule,
    EmailModule,
  ],
  controllers: [RecruitmentController, RecruitmentGoalsController],
  providers: [RecruitmentService, RecruitmentGoalsService],
  exports: [RecruitmentService, RecruitmentGoalsService],
})
export class RecruitmentModule {}

