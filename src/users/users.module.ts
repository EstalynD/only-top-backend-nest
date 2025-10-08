import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserEntity, UserSchema } from './user.schema.js';
import { UsersService } from './users.service.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UserEntity.name, schema: UserSchema }]),
    forwardRef(() => RbacModule),
  ],
  providers: [UsersService],
  exports: [MongooseModule, UsersService],
})
export class UsersModule {}
