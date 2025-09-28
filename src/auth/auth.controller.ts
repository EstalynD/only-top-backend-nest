import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { AuthGuard } from './auth.guard.js';

type LoginDto = { username: string; password: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Endpoint de ejemplo para emitir un token opaco (login simulado)
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    // Nota: aquí iría la validación real de credenciales. Por ahora, ejemplo minimal.
    const isAdmin = body.username === 'admin';
    const user: AuthUser = {
      id: isAdmin ? '1' : '2',
      username: body.username,
      roles: [isAdmin ? 'ADMIN_GLOBAL' : 'USUARIO_NORMAL'],
      permissions: isAdmin ? ['system.admin'] : ['dashboard.general.ver', 'sistema.perfil.ver'],
    };
    const { token, expiresAt } = await this.authService.issueToken(user);
    return { token, expiresAt, user };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async logout(@Req() req: any) {
    const token = req.token as string;
    await this.authService.revokeToken(token);
    return { ok: true };
  }
}
