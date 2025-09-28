import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionsGuard } from './rbac.permissions.guard.js';
import { RolesGuard } from './rbac.roles.guard.js';
import { RoleEntity, RoleSchema } from './role.schema.js';
import { UserEntity, UserSchema } from '../users/user.schema.js';
import { RbacService } from './rbac.service.js';
import { RbacAdminController } from './rbac.admin.controller.js';
import { UsersModule } from '../users/users.module.js';
import { AuthzGuard } from './authz.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoleEntity.name, schema: RoleSchema },
      { name: UserEntity.name, schema: UserSchema },
    ]),
    UsersModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [RbacAdminController],
  providers: [
    Reflector,
    RolesGuard,
    PermissionsGuard,
    AuthGuard,
    AuthzGuard,
    RbacService,
  ],
  exports: [Reflector, RbacService, MongooseModule],
})
export class RbacModule {}
