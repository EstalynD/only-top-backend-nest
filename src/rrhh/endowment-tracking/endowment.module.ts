import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EndowmentController } from './endowment.controller.js';
import { EndowmentService } from './endowment.service.js';
import { 
  EndowmentCategoryEntity, 
  EndowmentCategorySchema,
  EndowmentItemEntity,
  EndowmentItemSchema,
  EndowmentTrackingEntity,
  EndowmentTrackingSchema
} from './endowment.schema.js';
import { EmpleadoEntity, EmpleadoSchema } from '../empleado.schema.js';
import { UserEntity, UserSchema } from '../../users/user.schema.js';
import { AuthModule } from '../../auth/auth.module.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: EndowmentCategoryEntity.name, schema: EndowmentCategorySchema },
      { name: EndowmentItemEntity.name, schema: EndowmentItemSchema },
      { name: EndowmentTrackingEntity.name, schema: EndowmentTrackingSchema },
      { name: EmpleadoEntity.name, schema: EmpleadoSchema },
      { name: UserEntity.name, schema: UserSchema },
    ]),
  ],
  controllers: [EndowmentController],
  providers: [EndowmentService],
  exports: [EndowmentService],
})
export class EndowmentModule {}
