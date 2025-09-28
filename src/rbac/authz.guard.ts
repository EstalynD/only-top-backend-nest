import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { PermissionsGuard } from './rbac.permissions.guard.js';

@Injectable()
export class AuthzGuard implements CanActivate {
  constructor(private readonly authGuard: AuthGuard, private readonly permsGuard: PermissionsGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = await this.authGuard.canActivate(context);
    if (!ok) return false;
    return this.permsGuard.canActivate(context);
  }
}
