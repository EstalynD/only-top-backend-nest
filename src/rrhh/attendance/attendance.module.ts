import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceEntity, AttendanceSchema } from './attendance.schema.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceController } from './attendance.controller.js';
import { SistemaModule } from '../../sistema/sistema.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { RrhhModule } from '../rrhh.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceEntity.name, schema: AttendanceSchema }
    ]),
  SistemaModule,
  AuthModule,
    RrhhModule
  ],
  providers: [AttendanceService],
  controllers: [AttendanceController],
  exports: [AttendanceService, MongooseModule]
})
export class AttendanceModule {}
