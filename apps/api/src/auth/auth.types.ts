import type { Request } from 'express';

export type AuthIdentity = {
  subject: string;
  email: string;
};

export type AuthenticatedRequest = Request & { auth?: AuthIdentity };
