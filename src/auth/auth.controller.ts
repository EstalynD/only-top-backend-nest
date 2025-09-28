import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';

type LoginDto = { username: string; password: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    const { token, expiresAt, user } = await this.authService.loginWithPassword(body.username, body.password);
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
