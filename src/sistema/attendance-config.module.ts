import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceConfigService } from './attendance-config.service.js';
import { AttendanceConfigEntity, AttendanceConfigSchema } from './attendance-config.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceConfigEntity.name, schema: AttendanceConfigSchema },
    ]),
  ],
  providers: [AttendanceConfigService],
  exports: [AttendanceConfigService],
})
export class AttendanceConfigModule {}
