import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { authRepository, type Account, type AuthRepository } from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { newRefresh, parseRefresh, signAccess, unauthorized } from './tokens.js';
import type { Registration } from './auth.validation.js';

export const publicAccount = (account: Account) => ({
  id: account.id,
  displayName: account.displayName,
  email: account.credential?.normalizedEmail ?? null,
});
export function createAuthService(repository: AuthRepository = authRepository) {
  async function result(account: Account, familyId: string, refreshToken: string, expiresAt: Date) {
    return {
      body: {
        user: publicAccount(account),
        accessToken: await signAccess(account.id, familyId),
        expiresIn: env.AUTH_ACCESS_SECONDS,
      },
      refreshToken,
      expiresAt,
    };
  }
  return {
    async register(input: Registration) {
      const refresh = newRefresh();
      const familyId = randomUUID();
      const expiresAt = new Date(Date.now() + env.AUTH_REFRESH_DAYS * 86400000);
      const hash = await hashPassword(input.password);
      try {
        const account = await repository.register(input.displayName, input.email, hash, {
          id: refresh.id,
          tokenHash: refresh.tokenHash,
          familyId,
          expiresAt,
        });
        return result(account, familyId, refresh.raw, expiresAt);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          throw new ApiError(
            409,
            'REGISTRATION_UNAVAILABLE',
            'An account cannot be created with those details. Try signing in.',
          );
        throw error;
      }
    },
    async login(email: string, password: string) {
      const credential = await repository.credential(email);
      const valid = await verifyPassword(credential?.passwordHash, password);
      if (!valid || !credential || credential.user.deletedAt)
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      const refresh = newRefresh();
      const familyId = randomUUID();
      const expiresAt = new Date(Date.now() + env.AUTH_REFRESH_DAYS * 86400000);
      await repository.createSession({
        id: refresh.id,
        tokenHash: refresh.tokenHash,
        familyId,
        userId: credential.user.id,
        expiresAt,
      });
      return result(credential.user, familyId, refresh.raw, expiresAt);
    },
    async refresh(raw: string | undefined) {
      const token = parseRefresh(raw);
      if (!token) throw unauthorized();
      const refresh = newRefresh();
      const rotated = await repository.rotate(
        token.id,
        token.tokenHash,
        { id: refresh.id, tokenHash: refresh.tokenHash },
        new Date(),
      );
      if (!rotated) throw unauthorized();
      return result(rotated.account, rotated.familyId, refresh.raw, rotated.expiresAt);
    },
    async logout(raw: string | undefined) {
      const token = parseRefresh(raw);
      if (token) await repository.revokeToken(token.id, token.tokenHash);
    },
    async me(userId: string, familyId: string) {
      const account = await repository.activeAccount(userId, familyId);
      if (!account) throw unauthorized();
      return publicAccount(account);
    },
    logoutAll: (userId: string) => repository.revokeAll(userId),
  };
}
export const authService = createAuthService();
