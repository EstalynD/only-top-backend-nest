import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { UsersService } from './users.service.js';
import { IsEmail, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { RbacService } from '../rbac/rbac.service.js';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(300)
  avatarUrl?: string | null;
}

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
  ) {}

  @Get()
  async getProfile(@Req() req: any) {
    const userId = req.user.id as string;
    const dbUser = await this.usersService.getById(userId);
    const { passwordHash, ...safe } = dbUser as any;
    // Recalcular permisos efectivos a partir de roles y permisos directos del usuario en BD
    const roles = Array.isArray(safe.roles) ? safe.roles : [];
    const directPerms = Array.isArray(safe.permissions) ? safe.permissions : [];
    const permissions = await this.rbacService.computeEffectivePermissions(roles, directPerms);
    return { user: { ...safe, roles, permissions } };
  }

  @Put()
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const userId = req.user.id as string;
    const updated = await this.usersService.updateProfile(userId, dto);
    const { passwordHash, ...safe } = updated as any;
    return { user: safe };
  }
}
