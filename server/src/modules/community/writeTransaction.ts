import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

// Retry the entire transaction, never just the final write. SQL Server may
// choose a deadlock victim when concurrent serializable readers become writers.
export async function writeTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034')
        throw error;
      if (attempt >= 3)
        throw new ApiError(
          409,
          'WRITE_CONFLICT',
          'Another update is in progress. Please try again.',
        );
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}
