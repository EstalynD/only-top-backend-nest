import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { PermissionsGuard } from '../rbac/rbac.permissions.guard.js';
import { SetMetadata } from '@nestjs/common';
import { UsersService } from './users.service.js';

@Controller('admin/users')
@UseGuards(AuthGuard, PermissionsGuard)
// Clave usada por PermissionsGuard para leer permisos requeridos
@SetMetadata('permissions', ['system.admin'])
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(
    @Query('q') q?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    return this.usersService.searchUsers({ q: q?.trim() || undefined, page: pageNum, limit: limitNum });
  }
}