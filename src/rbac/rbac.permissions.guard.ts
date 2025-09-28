import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { META_PERMISSIONS } from './rbac.decorators.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(META_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<any>();
    const user = req.user as { permissions?: string[] } | undefined;
    if (!user) throw new ForbiddenException('No user in request');
    const perms = new Set(user.permissions ?? []);

    // Bypass global
    if (perms.has('system.admin')) return true;

    const ok = required.every((r) => perms.has(r));
    if (!ok) throw new ForbiddenException('Missing permissions');
    return true;
  }
}
