import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TokenStore } from './token.store.js';
import type { TokenRecord, AuthUser } from './auth.types.js';

@Injectable()
export class AuthService {
  constructor(private readonly tokenStore: TokenStore) {}

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
}
