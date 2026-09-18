import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const featureSelect = {
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
} satisfies Prisma.AccessibilityFeatureSelect;

export type AccessibilityFeatureRecord = Prisma.AccessibilityFeatureGetPayload<{
  select: typeof featureSelect;
}>;

export interface AccessibilityFeatureRepository {
  findActive(): Promise<AccessibilityFeatureRecord[]>;
  findActiveById(id: string): Promise<AccessibilityFeatureRecord | null>;
}

export const accessibilityFeatureRepository: AccessibilityFeatureRepository = {
  findActive: () =>
    prisma.accessibilityFeature.findMany({
      where: { isActive: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      select: featureSelect,
    }),
  findActiveById: (id) =>
    prisma.accessibilityFeature.findFirst({
      where: { id, isActive: true },
      select: featureSelect,
    }),
};
