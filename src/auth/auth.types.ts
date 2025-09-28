export interface AuthUser {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface TokenRecord {
  token: string;
  user: AuthUser;
  issuedAt: number; // seconds
  expiresAt: number; // seconds
  revoked: boolean;
}
