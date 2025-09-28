import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { META_ROLES } from './rbac.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(META_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest<any>();
    const user = req.user as { roles?: string[]; permissions?: string[] } | undefined;
    if (!user) throw new ForbiddenException('No user in request');
    const perms = new Set(user.permissions ?? []);
    if (perms.has('system.admin')) return true; // bypass admin global
    const roles = new Set(user.roles ?? []);
    const ok = required.every((r) => roles.has(r));
    if (!ok) throw new ForbiddenException('Missing roles');
    return true;
  }
}
