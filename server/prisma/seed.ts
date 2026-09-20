import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { accessibilityFeatures, categories, categoryFeatures, mobilityTypes } from './catalog.js';

interface ChangeCounts {
  created: number;
  updated: number;
  unchanged: number;
}

interface ApplicationCounts {
  users: number;
  userMobilityTypes: number;
  places: number;
  accessibilityReports: number;
  accessibilityAnswers: number;
  reviews: number;
  mediaAssets: number;
  placeMedia: number;
  reviewMedia: number;
}

const changes = {
  mobilityTypes: { created: 0, updated: 0, unchanged: 0 },
  categories: { created: 0, updated: 0, unchanged: 0 },
  accessibilityFeatures: { created: 0, updated: 0, unchanged: 0 },
  featureOptions: { created: 0, updated: 0, unchanged: 0 },
  categoryFeatureMappings: { created: 0, updated: 0, unchanged: 0 },
} satisfies Record<string, ChangeCounts>;

function recordChange(counts: ChangeCounts, state: keyof ChangeCounts): void {
  counts[state] += 1;
}

async function applicationCounts(tx: Prisma.TransactionClient): Promise<ApplicationCounts> {
  return {
    users: await tx.user.count(),
    userMobilityTypes: await tx.userMobilityType.count(),
    places: await tx.place.count(),
    accessibilityReports: await tx.placeAccessibilityReport.count(),
    accessibilityAnswers: await tx.placeAccessibilityAnswer.count(),
    reviews: await tx.review.count(),
    mediaAssets: await tx.mediaAsset.count(),
    placeMedia: await tx.placeMedia.count(),
    reviewMedia: await tx.reviewMedia.count(),
  };
}

async function seedCatalog(tx: Prisma.TransactionClient) {
  const mobilityIds = new Map<string, string>();
  const categoryIds = new Map<string, string>();
  const featureIds = new Map<string, string>();

  for (const item of mobilityTypes) {
    const existing = await tx.mobilityType.findUnique({ where: { code: item.code } });
    if (!existing) {
      const created = await tx.mobilityType.create({ data: { ...item, isActive: true } });
      mobilityIds.set(item.code, created.id);
      recordChange(changes.mobilityTypes, 'created');
      continue;
    }

    mobilityIds.set(item.code, existing.id);
    const metadataChanged =
      existing.displayName !== item.displayName ||
      existing.description !== item.description ||
      existing.displayOrder !== item.displayOrder;
    if (metadataChanged) {
      await tx.mobilityType.update({
        where: { id: existing.id },
        data: {
          displayName: item.displayName,
          description: item.description,
          displayOrder: item.displayOrder,
        },
      });
      recordChange(changes.mobilityTypes, 'updated');
    } else {
      recordChange(changes.mobilityTypes, 'unchanged');
    }
  }

  for (const item of categories) {
    const existing = await tx.category.findUnique({ where: { code: item.code } });
    if (!existing) {
      const created = await tx.category.create({ data: { ...item, isActive: true } });
      categoryIds.set(item.code, created.id);
      recordChange(changes.categories, 'created');
      continue;
    }

    categoryIds.set(item.code, existing.id);
    const metadataChanged =
      existing.displayName !== item.displayName ||
      existing.description !== item.description ||
      existing.displayOrder !== item.displayOrder;
    if (metadataChanged) {
      await tx.category.update({
        where: { id: existing.id },
        data: {
          displayName: item.displayName,
          description: item.description,
          displayOrder: item.displayOrder,
        },
      });
      recordChange(changes.categories, 'updated');
    } else {
      recordChange(changes.categories, 'unchanged');
    }
  }

  for (const item of accessibilityFeatures) {
    const existing = await tx.accessibilityFeature.findUnique({ where: { code: item.code } });
    if (!existing) {
      const created = await tx.accessibilityFeature.create({
        data: {
          id: item.id,
          code: item.code,
          displayName: item.displayName,
          description: item.description,
          valueType: item.valueType,
          unit: item.unit,
          isActive: true,
        },
      });
      featureIds.set(item.code, created.id);
      recordChange(changes.accessibilityFeatures, 'created');
      continue;
    }

    if (existing.valueType !== item.valueType || existing.unit !== item.unit) {
      throw new Error(
        `Catalog feature ${item.code} already exists with a different value type or unit. ` +
          'Retire or reconcile that record explicitly; the seed will not rewrite value semantics.',
      );
    }

    featureIds.set(item.code, existing.id);
    const metadataChanged =
      existing.displayName !== item.displayName || existing.description !== item.description;
    if (metadataChanged) {
      await tx.accessibilityFeature.update({
        where: { id: existing.id },
        data: { displayName: item.displayName, description: item.description },
      });
      recordChange(changes.accessibilityFeatures, 'updated');
    } else {
      recordChange(changes.accessibilityFeatures, 'unchanged');
    }
  }

  for (const feature of accessibilityFeatures) {
    const featureId = featureIds.get(feature.code);
    if (!featureId) throw new Error(`Missing seeded feature ID for ${feature.code}.`);

    for (const option of 'options' in feature ? feature.options : []) {
      const existing = await tx.accessibilityFeatureOption.findUnique({
        where: { featureId_code: { featureId, code: option.code } },
      });
      if (!existing) {
        await tx.accessibilityFeatureOption.create({
          data: { ...option, featureId, isActive: true },
        });
        recordChange(changes.featureOptions, 'created');
        continue;
      }

      const metadataChanged =
        existing.displayName !== option.displayName ||
        existing.displayOrder !== option.displayOrder;
      if (metadataChanged) {
        await tx.accessibilityFeatureOption.update({
          where: { id: existing.id },
          data: { displayName: option.displayName, displayOrder: option.displayOrder },
        });
        recordChange(changes.featureOptions, 'updated');
      } else {
        recordChange(changes.featureOptions, 'unchanged');
      }
    }
  }

  for (const [categoryCode, mappings] of Object.entries(categoryFeatures)) {
    const categoryId = categoryIds.get(categoryCode);
    if (!categoryId) throw new Error(`Missing seeded category ID for ${categoryCode}.`);

    for (const mapping of mappings) {
      const featureId = featureIds.get(mapping.featureCode);
      if (!featureId) throw new Error(`Missing seeded feature ID for ${mapping.featureCode}.`);

      const existing = await tx.categoryFeature.findUnique({
        where: { categoryId_featureId: { categoryId, featureId } },
      });
      if (!existing) {
        await tx.categoryFeature.create({
          data: {
            categoryId,
            featureId,
            displayOrder: mapping.displayOrder,
            isPrimary: mapping.isPrimary,
            isActive: true,
          },
        });
        recordChange(changes.categoryFeatureMappings, 'created');
        continue;
      }

      const metadataChanged =
        existing.displayOrder !== mapping.displayOrder || existing.isPrimary !== mapping.isPrimary;
      if (metadataChanged) {
        await tx.categoryFeature.update({
          where: { categoryId_featureId: { categoryId, featureId } },
          data: { displayOrder: mapping.displayOrder, isPrimary: mapping.isPrimary },
        });
        recordChange(changes.categoryFeatureMappings, 'updated');
      } else {
        recordChange(changes.categoryFeatureMappings, 'unchanged');
      }
    }
  }

  const managedMobilityTypes = await tx.mobilityType.findMany({
    where: { code: { in: mobilityTypes.map(({ code }) => code) } },
    select: { id: true, code: true },
    orderBy: { code: 'asc' },
  });
  const managedCategories = await tx.category.findMany({
    where: { code: { in: categories.map(({ code }) => code) } },
    select: { id: true, code: true },
    orderBy: { code: 'asc' },
  });
  const managedFeatures = await tx.accessibilityFeature.findMany({
    where: { code: { in: accessibilityFeatures.map(({ code }) => code) } },
    select: { id: true, code: true },
    orderBy: { code: 'asc' },
  });
  const managedFeatureIds = managedFeatures.map(({ id }) => id);
  const expectedOptionPairs = new Set(
    accessibilityFeatures.flatMap((feature) => {
      const featureId = featureIds.get(feature.code);
      if (!featureId) throw new Error(`Missing seeded feature ID for ${feature.code}.`);
      return ('options' in feature ? feature.options : []).map(
        ({ code }) => `${featureId}:${code}`,
      );
    }),
  );
  const managedOptions = (
    await tx.accessibilityFeatureOption.findMany({
      where: { featureId: { in: managedFeatureIds } },
      select: { id: true, featureId: true, code: true },
      orderBy: [{ featureId: 'asc' }, { code: 'asc' }],
    })
  ).filter(({ featureId, code }) => expectedOptionPairs.has(`${featureId}:${code}`));
  const expectedMappingPairs = new Set(
    Object.entries(categoryFeatures).flatMap(([categoryCode, mappings]) => {
      const categoryId = categoryIds.get(categoryCode);
      if (!categoryId) throw new Error(`Missing seeded category ID for ${categoryCode}.`);
      return mappings.map((mapping) => {
        const featureId = featureIds.get(mapping.featureCode);
        if (!featureId) throw new Error(`Missing seeded feature ID for ${mapping.featureCode}.`);
        return `${categoryId}:${featureId}`;
      });
    }),
  );
  const managedMappings = (
    await tx.categoryFeature.findMany({
      where: {
        categoryId: { in: managedCategories.map(({ id }) => id) },
        featureId: { in: managedFeatureIds },
      },
      select: { categoryId: true, featureId: true },
      orderBy: [{ categoryId: 'asc' }, { featureId: 'asc' }],
    })
  ).filter(({ categoryId, featureId }) => expectedMappingPairs.has(`${categoryId}:${featureId}`));

  const expectedCounts = {
    mobilityTypes: mobilityTypes.length,
    categories: categories.length,
    accessibilityFeatures: accessibilityFeatures.length,
    featureOptions: expectedOptionPairs.size,
    categoryFeatureMappings: expectedMappingPairs.size,
  };
  const managedCounts = {
    mobilityTypes: managedMobilityTypes.length,
    categories: managedCategories.length,
    accessibilityFeatures: managedFeatures.length,
    featureOptions: managedOptions.length,
    categoryFeatureMappings: managedMappings.length,
  };
  if (JSON.stringify(managedCounts) !== JSON.stringify(expectedCounts)) {
    throw new Error('The database does not contain every managed catalog record after seeding.');
  }

  const identityFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        mobilityTypes: managedMobilityTypes,
        categories: managedCategories,
        features: managedFeatures,
        options: managedOptions,
        mappings: managedMappings,
      }),
    )
    .digest('hex');

  return {
    managedCounts,
    catalogTableCounts: {
      mobilityTypes: await tx.mobilityType.count(),
      categories: await tx.category.count(),
      accessibilityFeatures: await tx.accessibilityFeature.count(),
      featureOptions: await tx.accessibilityFeatureOption.count(),
      categoryFeatureMappings: await tx.categoryFeature.count(),
    },
    identityFingerprint,
  };
}

async function main(): Promise<void> {
  const result = await prisma.$transaction(
    async (tx) => {
      const protectedBefore = await applicationCounts(tx);
      const catalog = await seedCatalog(tx);
      const protectedAfter = await applicationCounts(tx);
      if (JSON.stringify(protectedBefore) !== JSON.stringify(protectedAfter)) {
        throw new Error('Protected application record counts changed while seeding the catalog.');
      }
      return { ...catalog, protectedApplicationCounts: protectedAfter };
    },
    { timeout: 60_000 },
  );

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        changes,
        ...result,
        protectedApplicationDataChanged: false,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
