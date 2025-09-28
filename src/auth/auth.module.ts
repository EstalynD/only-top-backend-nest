import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { TokenStore } from './token.store.js';
import { AuthGuard } from './auth.guard.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { TokenEntity, TokenSchema } from './token.schema.js';
import { DatabaseModule } from '../database/database.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [DatabaseModule, UsersModule, RbacModule, MongooseModule.forFeature([{ name: TokenEntity.name, schema: TokenSchema }])],
  providers: [AuthService, TokenStore, AuthGuard],
  controllers: [AuthController],
  exports: [AuthService, TokenStore, AuthGuard],
})
export class AuthModule {}
