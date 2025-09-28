import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from './rbac.permissions.guard.js';
import { RolesGuard } from './rbac.roles.guard.js';

export const META_PERMISSIONS = 'rbac:permissions';
export const META_ROLES = 'rbac:roles';

export function Permissions(...perms: string[]) {
  return applyDecorators(SetMetadata(META_PERMISSIONS, perms), UseGuards(PermissionsGuard));
}

export function Roles(...roles: string[]) {
  return applyDecorators(SetMetadata(META_ROLES, roles), UseGuards(RolesGuard));
}
