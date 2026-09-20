import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const accountSelect = {
  id: true,
  displayName: true,
  credential: { select: { normalizedEmail: true } },
} satisfies Prisma.UserSelect;
export type Account = Prisma.UserGetPayload<{ select: typeof accountSelect }>;
export interface SessionInput {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}
async function sessionTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
}
export const authRepository = {
  async register(
    displayName: string,
    normalizedEmail: string,
    passwordHash: string,
    session: Omit<SessionInput, 'userId'>,
  ) {
    // Nested creation is one transaction; legacy contact email remains untouched.
    return prisma.user.create({
      data: {
        displayName,
        credential: { create: { normalizedEmail, passwordHash } },
        refreshSessions: { create: session },
      },
      select: accountSelect,
    });
  },
  credential(email: string) {
    return prisma.userCredential.findUnique({
      where: { normalizedEmail: email },
      select: { passwordHash: true, user: { select: { ...accountSelect, deletedAt: true } } },
    });
  },
  async createSession(session: SessionInput) {
    await prisma.refreshSession.create({ data: session });
  },
  async rotate(
    id: string,
    hash: string,
    next: { id: string; tokenHash: string },
    now: Date,
  ): Promise<{ account: Account; familyId: string; expiresAt: Date } | null> {
    return sessionTransaction(async (tx) => {
      const old = await tx.refreshSession.findFirst({
        where: { id, tokenHash: hash },
        include: { user: { select: { ...accountSelect, deletedAt: true } } },
      });
      if (!old) return null;
      if (old.revokedAt || old.expiresAt <= now || old.user.deletedAt) {
        await tx.refreshSession.updateMany({
          where: { familyId: old.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }
      const consumed = await tx.refreshSession.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: now, replacedById: next.id },
      });
      if (consumed.count !== 1) return null;
      await tx.refreshSession.create({
        data: { ...next, userId: old.userId, familyId: old.familyId, expiresAt: old.expiresAt },
      });
      return { account: old.user, familyId: old.familyId, expiresAt: old.expiresAt };
    });
  },
  async revokeToken(id: string, hash: string) {
    await sessionTransaction(async (tx) => {
      const session = await tx.refreshSession.findFirst({
        where: { id, tokenHash: hash },
        select: { familyId: true },
      });
      if (session)
        await tx.refreshSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
    });
  },
  async revokeFamily(familyId: string) {
    await sessionTransaction(async (tx) => {
      await tx.refreshSession.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  },
  async revokeAll(userId: string) {
    await sessionTransaction(async (tx) => {
      await tx.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  },
  async activeAccount(userId: string, familyId: string) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        credential: { isNot: null },
        refreshSessions: { some: { familyId, revokedAt: null, expiresAt: { gt: new Date() } } },
      },
      select: accountSelect,
    });
  },
};
export type AuthRepository = typeof authRepository;
