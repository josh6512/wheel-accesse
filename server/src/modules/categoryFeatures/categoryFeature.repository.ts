import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const categoryWithFeaturesSelect = {
  features: {
    where: {
      isActive: true,
      feature: { isActive: true },
    },
    orderBy: [{ displayOrder: 'asc' }, { feature: { displayName: 'asc' } }, { featureId: 'asc' }],
    select: {
      displayOrder: true,
      isPrimary: true,
      feature: {
        select: {
          id: true,
          code: true,
          displayName: true,
          description: true,
          valueType: true,
          unit: true,
          isActive: true,
          options: {
            where: { isActive: true },
            orderBy: [{ displayOrder: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              code: true,
              displayName: true,
              displayOrder: true,
              isActive: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CategorySelect;

export type ActiveCategoryWithFeatures = Prisma.CategoryGetPayload<{
  select: typeof categoryWithFeaturesSelect;
}>;

export interface CategoryFeatureRepository {
  findForActiveCategory(categoryId: string): Promise<ActiveCategoryWithFeatures | null>;
}

export const categoryFeatureRepository: CategoryFeatureRepository = {
  findForActiveCategory: (categoryId) =>
    prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: categoryWithFeaturesSelect,
    }),
};
