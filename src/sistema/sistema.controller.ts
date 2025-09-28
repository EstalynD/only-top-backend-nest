import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, Roles } from '../rbac/rbac.decorators.js';

@Controller('sistema')
@UseGuards(AuthGuard)
export class SistemaController {
  @Get('admin-area')
  @Roles('ADMIN_GLOBAL')
  @Permissions('system.admin')
  adminArea(@Req() req: any) {
    return { ok: true, user: req.user, area: 'admin' };
  }

  @Get('perfil')
  @Permissions('sistema.perfil.ver')
  perfil(@Req() req: any) {
    return { ok: true, user: req.user, area: 'perfil' };
  }
}
