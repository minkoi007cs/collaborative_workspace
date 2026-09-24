import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { loadConfig } from '../config';
import type { AuthIdentity } from './auth.types';

const claimsSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.literal('authenticated'),
  exp: z.number().int().positive(),
  is_anonymous: z.literal(false).optional(),
});

@Injectable()
export class AuthService {
  private readonly issuer: string | undefined;
  private readonly keys: ReturnType<typeof createRemoteJWKSet> | undefined;

  constructor() {
    const projectUrl = loadConfig().SUPABASE_URL?.replace(/\/$/, '');
    if (projectUrl) {
      this.issuer = `${projectUrl}/auth/v1`;
      this.keys = createRemoteJWKSet(
        new URL(`${this.issuer}/.well-known/jwks.json`),
        { cacheMaxAge: 600_000, timeoutDuration: 5_000 },
      );
    }
  }

  async verifyAccessToken(token: string): Promise<AuthIdentity> {
    if (!this.issuer || !this.keys) {
      throw new ServiceUnavailableException('Authentication is not configured');
    }
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
      });
      const claims = claimsSchema.parse(payload);
      return {
        subject: claims.sub,
        email: claims.email,
        expiresAt: claims.exp,
      };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
