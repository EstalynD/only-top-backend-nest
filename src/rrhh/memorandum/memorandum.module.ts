import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AttendanceEntity, AttendanceSchema } from '../attendance/attendance.schema.js';
import { MemorandumEntity, MemorandumSchema } from './memorandum.schema.js';
import { MemorandumService } from './memorandum.service.js';
import { MemorandumController } from './memorandum.controller.js';
import { MemorandumSchedulerService } from './memorandum-scheduler.service.js';
import { RrhhModule } from '../rrhh.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { AttendanceModule } from '../attendance/attendance.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceEntity.name, schema: AttendanceSchema },
      { name: MemorandumEntity.name, schema: MemorandumSchema },
    ]),
    ScheduleModule.forRoot(),
    RrhhModule,
    AuthModule,
    forwardRef(() => AttendanceModule)
  ],
  providers: [MemorandumService, MemorandumSchedulerService],
  controllers: [MemorandumController],
  exports: [MemorandumService]
})
export class MemorandumModule {}
