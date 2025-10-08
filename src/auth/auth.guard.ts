import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';

declare module 'http' {
  interface IncomingMessage {
    user?: AuthUser;
    token?: string;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Permitir acceso si la ruta está marcada como pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser; token?: string }>();
    const auth = (req.headers as any)['authorization'] as string | undefined;
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) throw new UnauthorizedException('Missing token');
    const token = auth.slice(7).trim();
    if (!token) throw new UnauthorizedException('Invalid token');
    const user = await this.authService.validateToken(token);
    (req as any).user = user;
    (req as any).token = token;
    return true;
  }
}
