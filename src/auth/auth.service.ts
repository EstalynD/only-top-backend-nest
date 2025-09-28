import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { TokenStore } from './token.store.js';
import type { TokenRecord, AuthUser } from './auth.types.js';
import { UserEntity, type UserDocument } from '../users/user.schema.js';
import { RbacService } from '../rbac/rbac.service.js';
import { createHash } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenStore: TokenStore,
    @InjectModel(UserEntity.name) private readonly userModel: Model<UserDocument>,
    private readonly rbacService: RbacService,
  ) {}

  // Emite un token opaco y lo guarda con TTL
  async issueToken(user: AuthUser, ttlSeconds = 60 * 60 * 8): Promise<{ token: string; expiresAt: number }> {
    const token = randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    const record: TokenRecord = {
      token,
      user,
      issuedAt: now,
      expiresAt: now + ttlSeconds,
      revoked: false,
    };
    await this.tokenStore.save(record);
    return { token, expiresAt: record.expiresAt };
  }

  async validateToken(token: string): Promise<AuthUser> {
    const rec = await this.tokenStore.get(token);
    if (!rec || rec.revoked) throw new UnauthorizedException('Invalid token');
    const now = Math.floor(Date.now() / 1000);
    if (rec.expiresAt <= now) {
      await this.tokenStore.delete(token);
      throw new UnauthorizedException('Expired token');
    }
    return rec.user;
  }

  async revokeToken(token: string): Promise<void> {
    await this.tokenStore.revoke(token);
  }

  // Valida credenciales reales contra MongoDB y emite token
  async loginWithPassword(username: string, password: string): Promise<{ token: string; expiresAt: number; user: AuthUser }> {
    const userDoc = await this.userModel.findOne({ username }).lean().exec();
    if (!userDoc) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const hash = createHash('sha256').update(password).digest('hex');
    if (userDoc.passwordHash !== hash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const roles = userDoc.roles ?? [];
    const directPerms = userDoc.permissions ?? [];
    const effectivePerms = await this.rbacService.computeEffectivePermissions(roles, directPerms);
    const authUser: AuthUser = {
      id: (userDoc as any)._id.toString(),
      username: userDoc.username,
      roles,
      permissions: effectivePerms,
    };
    const { token, expiresAt } = await this.issueToken(authUser);
    return { token, expiresAt, user: authUser };
  }
}
