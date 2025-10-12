import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceEntity, AttendanceSchema } from './attendance.schema.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceExportService } from './attendance-export.service.js';
import { AttendanceAutoCloseService } from './attendance-auto-close.service.js';
import { SistemaModule } from '../../sistema/sistema.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { RrhhModule } from '../rrhh.module.js';
import { MemorandumModule } from '../memorandum/memorandum.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceEntity.name, schema: AttendanceSchema }
    ]),
    SistemaModule,
    AuthModule,
    RrhhModule,
    forwardRef(() => MemorandumModule)
  ],
  providers: [AttendanceService, AttendanceExportService, AttendanceAutoCloseService],
  controllers: [AttendanceController],
  exports: [AttendanceService, AttendanceExportService, AttendanceAutoCloseService, MongooseModule]
})
export class AttendanceModule {}
