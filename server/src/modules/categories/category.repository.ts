import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const categorySelect = {
  id: true,
  code: true,
  displayName: true,
  description: true,
  isActive: true,
  displayOrder: true,
} satisfies Prisma.CategorySelect;

export type CategoryRecord = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

export interface CategoryRepository {
  findActive(): Promise<CategoryRecord[]>;
  findActiveById(id: string): Promise<CategoryRecord | null>;
}

export const categoryRepository: CategoryRepository = {
  findActive: () =>
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
      select: categorySelect,
    }),
  findActiveById: (id) =>
    prisma.category.findFirst({
      where: { id, isActive: true },
      select: categorySelect,
    }),
};
