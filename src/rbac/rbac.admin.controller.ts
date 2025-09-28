import { Body, Controller, Delete, Get, Param, Patch, Post, SetMetadata, UseGuards } from '@nestjs/common';
import { META_PERMISSIONS } from './rbac.decorators.js';
import { RbacService } from './rbac.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { PermissionsGuard } from './rbac.permissions.guard.js';
// DTOs disponibles pero la validación estricta se delega al servicio para evitar falsos 400
// import { CreateRoleDto } from './dto/create-role.dto.js';
// import { UpdateRoleDto } from './dto/update-role.dto.js';

function normalizeBody(body: any) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body ?? {};
}

@Controller('admin/rbac')
@UseGuards(AuthGuard, PermissionsGuard)
@SetMetadata(META_PERMISSIONS, ['system.admin'])
export class RbacAdminController {
  constructor(private readonly rbac: RbacService) {}

  // Permisos disponibles (catálogo)
  @Get('permissions')
  getPermissions() {
    return this.rbac.getPermissionsCatalog();
  }

  // Roles (CRUD)
  @Get('roles')
  listRoles() {
    return this.rbac.listRoles();
  }

  @Post('roles')
  async createRole(@Body() body: any) {
    const payload = normalizeBody(body);
    return this.rbac.createRole(payload);
  }

  @Get('roles/:key')
  getRole(@Param('key') key: string) {
    return this.rbac.getRole(key);
  }

  @Patch('roles/:key')
  updateRole(@Param('key') key: string, @Body() body: any) {
    const payload = normalizeBody(body);
    return this.rbac.updateRole(key, payload);
  }
  @Delete('roles/:key')
  deleteRole(@Param('key') key: string) {
    return this.rbac.deleteRole(key);
  }

  // Asignaciones a usuarios
  @Post('users/:userId/assign-roles')
  assignRoles(@Param('userId') userId: string, @Body() body: { roles: string[] }) {
    return this.rbac.assignRolesToUser(userId, body.roles ?? []);
  }

  @Post('users/:userId/revoke-roles')
  revokeRoles(@Param('userId') userId: string, @Body() body: { roles: string[] }) {
    return this.rbac.revokeRolesFromUser(userId, body.roles ?? []);
  }

  @Post('users/:userId/grant-permissions')
  grantPerms(@Param('userId') userId: string, @Body() body: { permissions: string[] }) {
    return this.rbac.grantPermissionsToUser(userId, body.permissions ?? []);
  }

  @Post('users/:userId/revoke-permissions')
  revokePerms(@Param('userId') userId: string, @Body() body: { permissions: string[] }) {
    return this.rbac.revokePermissionsFromUser(userId, body.permissions ?? []);
  }
}
