import type { Request } from 'express';

export type AuthIdentity = {
  subject: string;
  email: string;
  expiresAt: number;
};

export type AuthenticatedRequest = Request & { auth?: AuthIdentity };
