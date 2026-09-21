import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { PreparedAccessibilityAnswer } from './accessibilityReport.types.js';
import type { AccessibilityReportListQuery } from './accessibilityReport.validation.js';

const reportSelect = {
  id: true,
  observedAt: true,
  createdAt: true,
  updatedAt: true,
  place: {
    select: {
      id: true,
      name: true,
    },
  },
  answers: {
    orderBy: [{ feature: { displayName: 'asc' } }, { featureId: 'asc' }],
    select: {
      valueType: true,
      booleanValue: true,
      numericValue: true,
      numericUnit: true,
      textValue: true,
      option: {
        select: {
          id: true,
          code: true,
          displayName: true,
        },
      },
      feature: {
        select: {
          id: true,
          code: true,
          displayName: true,
          description: true,
          valueType: true,
          unit: true,
        },
      },
    },
  },
} satisfies Prisma.PlaceAccessibilityReportSelect;

function submissionContextSelect(featureIds: string[]) {
  return {
    id: true,
    category: {
      select: {
        features: {
          where: {
            featureId: { in: featureIds },
            isActive: true,
            feature: { isActive: true },
          },
          select: {
            feature: {
              select: {
                id: true,
                valueType: true,
                unit: true,
                options: {
                  where: { isActive: true },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.PlaceSelect;
}

export type AccessibilityReportRecord = Prisma.PlaceAccessibilityReportGetPayload<{
  select: typeof reportSelect;
}>;
export type AccessibilitySubmissionContext = Prisma.PlaceGetPayload<{
  select: ReturnType<typeof submissionContextSelect>;
}>;

export interface AccessibilityReportListRecord {
  items: AccessibilityReportRecord[];
  total: number;
}

export interface AccessibilityReportRepository {
  findForVisiblePlace(
    placeId: string,
    query: AccessibilityReportListQuery,
  ): Promise<AccessibilityReportListRecord | null>;
  findPublicById(id: string): Promise<AccessibilityReportRecord | null>;
  findSubmissionContext(
    placeId: string,
    featureIds: string[],
  ): Promise<AccessibilitySubmissionContext | null>;
  create(
    placeId: string,
    userId: string,
    observedAt: Date | null,
    answers: PreparedAccessibilityAnswer[],
  ): Promise<AccessibilityReportRecord>;
}

export function accessibilityReportRepositoryFor(
  prisma: Prisma.TransactionClient,
): AccessibilityReportRepository {
  return {
    findForVisiblePlace: async (placeId, query) => {
      const place = await prisma.place.findFirst({
        where: { id: placeId, deletedAt: null, category: { isActive: true } },
        select: {
          reports: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            select: reportSelect,
          },
          _count: {
            select: { reports: { where: { deletedAt: null } } },
          },
        },
      });

      return place ? { items: place.reports, total: place._count.reports } : null;
    },
    findPublicById: (id) =>
      prisma.placeAccessibilityReport.findFirst({
        where: {
          id,
          deletedAt: null,
          place: { deletedAt: null, category: { isActive: true } },
        },
        select: reportSelect,
      }),
    findSubmissionContext: (placeId, featureIds) =>
      prisma.place.findFirst({
        where: { id: placeId, deletedAt: null, category: { isActive: true } },
        select: submissionContextSelect(featureIds),
      }),
    create: (placeId, userId, observedAt, answers) =>
      prisma.placeAccessibilityReport.create({
        data: {
          placeId,
          userId,
          observedAt,
          answers: { create: answers },
        },
        select: reportSelect,
      }),
  };
}
export const accessibilityReportRepository = accessibilityReportRepositoryFor(prisma);
