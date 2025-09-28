import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { PermissionsGuard } from './rbac.permissions.guard.js';
import { RolesGuard } from './rbac.roles.guard.js';

@Module({
  providers: [
    Reflector,
    RolesGuard,
    PermissionsGuard,
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [Reflector],
})
export class RbacModule {}
