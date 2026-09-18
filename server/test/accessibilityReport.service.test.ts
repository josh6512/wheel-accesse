import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import type {
  AccessibilityReportRecord,
  AccessibilityReportRepository,
  AccessibilitySubmissionContext,
} from '../src/modules/accessibilityReports/accessibilityReport.repository.js';
import {
  getAccessibilityReport,
  listPlaceAccessibilityReports,
  submitAccessibilityReport,
} from '../src/modules/accessibilityReports/accessibilityReport.service.js';
import type { PreparedAccessibilityAnswer } from '../src/modules/accessibilityReports/accessibilityReport.types.js';
import {
  submitAccessibilityReportBodySchema,
  type SubmitAccessibilityReportInput,
} from '../src/modules/accessibilityReports/accessibilityReport.validation.js';
import { ApiError } from '../src/utils/ApiError.js';

const placeId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const booleanFeatureId = '33333333-3333-4333-8333-333333333333';
const numericFeatureId = '44444444-4444-4444-8444-444444444444';
const textFeatureId = '55555555-5555-4555-8555-555555555555';
const selectFeatureId = '66666666-6666-4666-8666-666666666666';
const optionId = '77777777-7777-4777-8777-777777777777';
const reportId = '88888888-8888-4888-8888-888888888888';
const now = new Date('2026-01-01T00:00:00.000Z');

function storedAnswer(
  feature: {
    id: string;
    code: string;
    displayName: string;
    valueType: string;
    unit?: string | null;
  },
  values: Partial<AccessibilityReportRecord['answers'][number]>,
): AccessibilityReportRecord['answers'][number] {
  return {
    valueType: feature.valueType,
    booleanValue: null,
    numericValue: null,
    numericUnit: null,
    textValue: null,
    option: null,
    feature: {
      description: null,
      unit: feature.unit ?? null,
      ...feature,
    },
    ...values,
  };
}

const report: AccessibilityReportRecord = {
  id: reportId,
  observedAt: now,
  createdAt: now,
  updatedAt: now,
  place: { id: placeId, name: 'Temporary place' },
  user: { id: userId, displayName: 'Test author', deletedAt: null },
  answers: [
    storedAnswer(
      {
        id: booleanFeatureId,
        code: 'boolean-feature',
        displayName: 'Boolean feature',
        valueType: 'boolean',
      },
      { booleanValue: false },
    ),
    storedAnswer(
      {
        id: numericFeatureId,
        code: 'numeric-feature',
        displayName: 'Numeric feature',
        valueType: 'numeric',
        unit: 'cm',
      },
      { numericValue: new Prisma.Decimal('84.5000'), numericUnit: 'cm' },
    ),
    storedAnswer(
      {
        id: textFeatureId,
        code: 'text-feature',
        displayName: 'Text feature',
        valueType: 'text',
      },
      { textValue: 'Plain observation' },
    ),
    storedAnswer(
      {
        id: selectFeatureId,
        code: 'select-feature',
        displayName: 'Select feature',
        valueType: 'select',
      },
      { option: { id: optionId, code: 'selected', displayName: 'Selected' } },
    ),
  ],
};

const submissionContext: AccessibilitySubmissionContext = {
  id: placeId,
  category: {
    features: [
      { feature: { id: booleanFeatureId, valueType: 'boolean', unit: null, options: [] } },
      { feature: { id: numericFeatureId, valueType: 'numeric', unit: 'cm', options: [] } },
      { feature: { id: textFeatureId, valueType: 'text', unit: null, options: [] } },
      {
        feature: {
          id: selectFeatureId,
          valueType: 'select',
          unit: null,
          options: [{ id: optionId }],
        },
      },
    ],
  },
};

function repository(
  overrides: Partial<AccessibilityReportRepository> = {},
): AccessibilityReportRepository {
  return {
    findForVisiblePlace: async () => ({ items: [report], total: 1 }),
    findPublicById: async () => report,
    findSubmissionContext: async () => submissionContext,
    create: async () => report,
    ...overrides,
  };
}

describe('accessibility report reads', () => {
  it('retrieves a report with clear typed answers', async () => {
    const result = await getAccessibilityReport(reportId, repository());
    assert.deepEqual(
      result.answers.map((answer) => answer.value),
      [
        { type: 'boolean', value: false },
        { type: 'numeric', value: '84.5', unit: 'cm' },
        { type: 'text', value: 'Plain observation' },
        {
          type: 'select',
          option: { id: optionId, code: 'selected', displayName: 'Selected' },
        },
      ],
    );
  });

  it('keeps conflicting reports as independent records', async () => {
    const conflicting: AccessibilityReportRecord = {
      ...report,
      id: '99999999-9999-4999-8999-999999999999',
      answers: [{ ...report.answers[0]!, booleanValue: true }],
    };
    const result = await listPlaceAccessibilityReports(
      placeId,
      { page: 1, pageSize: 20 },
      repository({ findForVisiblePlace: async () => ({ items: [report, conflicting], total: 2 }) }),
    );
    assert.equal(result.data.length, 2);
    assert.deepEqual(
      result.data.map((item) => item.answers[0]?.value),
      [
        { type: 'boolean', value: false },
        { type: 'boolean', value: true },
      ],
    );
  });

  it('returns safe missing-place and missing-report errors', async () => {
    await assert.rejects(
      () =>
        listPlaceAccessibilityReports(
          placeId,
          { page: 1, pageSize: 20 },
          repository({ findForVisiblePlace: async () => null }),
        ),
      (error: unknown) =>
        error instanceof ApiError && error.statusCode === 404 && error.code === 'PLACE_NOT_FOUND',
    );
    await assert.rejects(
      () => getAccessibilityReport(reportId, repository({ findPublicById: async () => null })),
      (error: unknown) =>
        error instanceof ApiError &&
        error.statusCode === 404 &&
        error.code === 'ACCESSIBILITY_REPORT_NOT_FOUND',
    );
  });

  it('does not expose email or private mobility information', async () => {
    const result = await getAccessibilityReport(reportId, repository());
    assert.deepEqual(result.author, { id: userId, displayName: 'Test author' });
    assert.equal(result.author !== null && 'email' in result.author, false);
    assert.equal(result.author !== null && 'mobilityTypes' in result.author, false);
  });
});

describe('future authenticated report submission', () => {
  const validInput: SubmitAccessibilityReportInput = {
    answers: [
      { featureId: booleanFeatureId, type: 'boolean', value: false },
      { featureId: numericFeatureId, type: 'numeric', value: 84.5 },
      { featureId: selectFeatureId, type: 'select', optionId },
    ],
  };

  it('prepares typed values, snapshots numeric units, and uses the trusted user ID', async () => {
    let capturedUserId: string | undefined;
    let capturedAnswers: PreparedAccessibilityAnswer[] | undefined;
    await submitAccessibilityReport(
      placeId,
      validInput,
      userId,
      repository({
        create: async (_placeId, trustedUserId, _observedAt, answers) => {
          capturedUserId = trustedUserId;
          capturedAnswers = answers;
          return report;
        },
      }),
    );
    assert.equal(capturedUserId, userId);
    assert.equal(capturedAnswers?.[0]?.booleanValue, false);
    assert.equal(capturedAnswers?.[1]?.numericUnit, 'cm');
    assert.equal(capturedAnswers?.[2]?.optionId, optionId);
  });

  it('rejects a feature not configured for the place category', async () => {
    await assert.rejects(
      () =>
        submitAccessibilityReport(
          placeId,
          { answers: [{ featureId: randomUuid(), type: 'boolean', value: true }] },
          userId,
          repository(),
        ),
      hasApiCode('FEATURE_NOT_APPLICABLE'),
    );
  });

  it('rejects an answer whose type does not match the feature', async () => {
    await assert.rejects(
      () =>
        submitAccessibilityReport(
          placeId,
          { answers: [{ featureId: booleanFeatureId, type: 'text', value: 'wrong type' }] },
          userId,
          repository(),
        ),
      hasApiCode('INVALID_ANSWER_TYPE'),
    );
  });

  it('rejects a select option that does not belong to the feature', async () => {
    await assert.rejects(
      () =>
        submitAccessibilityReport(
          placeId,
          { answers: [{ featureId: selectFeatureId, type: 'select', optionId: randomUuid() }] },
          userId,
          repository(),
        ),
      hasApiCode('INVALID_FEATURE_OPTION'),
    );
  });

  it('rejects duplicate feature answers in validation and service defense-in-depth', async () => {
    const duplicate = {
      answers: [
        { featureId: booleanFeatureId, type: 'boolean' as const, value: true },
        { featureId: booleanFeatureId, type: 'boolean' as const, value: false },
      ],
    };
    assert.equal(submitAccessibilityReportBodySchema.safeParse(duplicate).success, false);
    await assert.rejects(
      () => submitAccessibilityReport(placeId, duplicate, userId, repository()),
      hasApiCode('DUPLICATE_FEATURE_ANSWER'),
    );
  });
});

function randomUuid(): string {
  return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
}

function hasApiCode(code: string) {
  return (error: unknown) =>
    error instanceof ApiError && error.statusCode === 400 && error.code === code;
}
