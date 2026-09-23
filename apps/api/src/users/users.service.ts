import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AuthIdentity } from '../auth/auth.types';

const publicProfile = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOrCreate(identity: AuthIdentity) {
    const displayName = identity.email.split('@')[0].slice(0, 80) || 'Member';
    return this.prisma.user.upsert({
      where: { authSubject: identity.subject },
      create: {
        authSubject: identity.subject,
        email: identity.email,
        displayName,
      },
      update: { email: identity.email },
      select: publicProfile,
    });
  }

  async updateProfile(identity: AuthIdentity, displayName: string) {
    const user = await this.getOrCreate(identity);
    return this.prisma.user.update({
      where: { id: user.id },
      data: { displayName },
      select: publicProfile,
    });
  }
}
