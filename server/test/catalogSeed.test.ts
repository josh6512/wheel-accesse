import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessibilityFeatures,
  categories,
  categoryFeatures,
  mobilityTypes,
} from '../prisma/catalog.js';

function assertUnique(values: readonly string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

test('catalog uses unique stable IDs and codes', () => {
  const options = accessibilityFeatures.flatMap((feature) =>
    'options' in feature ? feature.options : [],
  );

  assert.equal(mobilityTypes.length, 5);
  assert.equal(categories.length, 4);
  assert.equal(accessibilityFeatures.length, 19);
  assert.equal(options.length, 5);
  assert.equal(
    Object.values(categoryFeatures).reduce((total, mappings) => total + mappings.length, 0),
    36,
  );

  assertUnique(
    mobilityTypes.map(({ id }) => id),
    'mobility IDs',
  );
  assertUnique(
    mobilityTypes.map(({ code }) => code),
    'mobility codes',
  );
  assertUnique(
    categories.map(({ id }) => id),
    'category IDs',
  );
  assertUnique(
    categories.map(({ code }) => code),
    'category codes',
  );
  assertUnique(
    accessibilityFeatures.map(({ id }) => id),
    'feature IDs',
  );
  assertUnique(
    accessibilityFeatures.map(({ code }) => code),
    'feature codes',
  );
  assertUnique(
    options.map(({ id }) => id),
    'option IDs',
  );
});

test('catalog contains the intended typed values and path surface options', () => {
  const bedHeight = accessibilityFeatures.find(({ code }) => code === 'BED_HEIGHT');
  assert.deepEqual(bedHeight && { valueType: bedHeight.valueType, unit: bedHeight.unit }, {
    valueType: 'numeric',
    unit: 'cm',
  });

  const pathSurface = accessibilityFeatures.find(({ code }) => code === 'PATH_SURFACE');
  assert.equal(pathSurface?.valueType, 'select');
  assert.deepEqual(
    pathSurface && 'options' in pathSurface
      ? pathSurface.options.map(({ displayName }) => displayName)
      : [],
    ['Paved', 'Asphalt', 'Gravel', 'Grass', 'Dirt / Natural Surface'],
  );
});

test('every category mapping points to a feature once and has deterministic order', () => {
  const featureCodes = new Set(accessibilityFeatures.map(({ code }) => code));

  for (const category of categories) {
    const mappings = categoryFeatures[category.code];
    assert.ok(mappings.length > 0, `${category.code} must have features`);
    assertUnique(
      mappings.map(({ featureCode }) => featureCode),
      `${category.code} feature mappings`,
    );
    assert.deepEqual(
      mappings.map(({ displayOrder }) => displayOrder),
      [...mappings.map(({ displayOrder }) => displayOrder)].sort((left, right) => left - right),
    );
    for (const mapping of mappings) {
      assert.ok(featureCodes.has(mapping.featureCode), `${mapping.featureCode} must be defined`);
    }
  }
});
