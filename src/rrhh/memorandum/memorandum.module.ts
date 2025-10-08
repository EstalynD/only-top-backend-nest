import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceEntity, AttendanceSchema } from '../attendance/attendance.schema.js';
import { MemorandumService } from './memorandum.service.js';
import { MemorandumController } from './memorandum.controller.js';
import { RrhhModule } from '../rrhh.module.js';
import { AuthModule } from '../../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceEntity.name, schema: AttendanceSchema }
    ]),
    RrhhModule,
    AuthModule
  ],
  providers: [MemorandumService],
  controllers: [MemorandumController],
  exports: [MemorandumService]
})
export class MemorandumModule {}
