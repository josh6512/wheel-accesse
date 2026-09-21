import { ApiError } from '../../utils/ApiError.js';
import {
  accessibilityReportRepository,
  type AccessibilityReportRecord,
  type AccessibilityReportRepository,
} from './accessibilityReport.repository.js';
import type {
  AccessibilityAnswerValue,
  PaginatedAccessibilityReports,
  PreparedAccessibilityAnswer,
  PublicAccessibilityAnswer,
  PublicAccessibilityReport,
} from './accessibilityReport.types.js';
import type {
  AccessibilityReportListQuery,
  ReportAnswerInput,
  SubmitAccessibilityReportInput,
} from './accessibilityReport.validation.js';

type StoredAnswer = AccessibilityReportRecord['answers'][number];

function storedAnswerValue(answer: StoredAnswer): AccessibilityAnswerValue {
  switch (answer.valueType) {
    case 'boolean':
      if (answer.booleanValue === null) break;
      return { type: 'boolean', value: answer.booleanValue };
    case 'numeric':
      if (answer.numericValue === null) break;
      return {
        type: 'numeric',
        value: answer.numericValue.toString(),
        unit: answer.numericUnit,
      };
    case 'text':
      if (answer.textValue === null) break;
      return { type: 'text', value: answer.textValue };
    case 'select':
      if (answer.option === null) break;
      return { type: 'select', option: answer.option };
  }
  throw new Error('Stored accessibility answer violates its typed-value invariant.');
}

function toPublicAnswer(answer: StoredAnswer): PublicAccessibilityAnswer {
  return {
    feature: answer.feature,
    value: storedAnswerValue(answer),
  };
}

function toPublicReport(report: AccessibilityReportRecord): PublicAccessibilityReport {
  return {
    id: report.id,
    observedAt: report.observedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    place: report.place,
    author: null,
    answers: report.answers.map(toPublicAnswer),
  };
}

export async function listPlaceAccessibilityReports(
  placeId: string,
  query: AccessibilityReportListQuery,
  repository: AccessibilityReportRepository = accessibilityReportRepository,
): Promise<PaginatedAccessibilityReports> {
  const result = await repository.findForVisiblePlace(placeId, query);
  if (!result) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', 'The requested place was not found.');
  }

  const totalPages = Math.ceil(result.total / query.pageSize);
  return {
    data: result.items.map(toPublicReport),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: result.total,
      totalPages,
      hasPreviousPage: query.page > 1 && totalPages > 0,
      hasNextPage: query.page < totalPages,
    },
  };
}

export async function getAccessibilityReport(
  id: string,
  repository: AccessibilityReportRepository = accessibilityReportRepository,
): Promise<PublicAccessibilityReport> {
  const report = await repository.findPublicById(id);
  if (!report) {
    throw new ApiError(
      404,
      'ACCESSIBILITY_REPORT_NOT_FOUND',
      'The requested accessibility report was not found.',
    );
  }
  return toPublicReport(report);
}

function prepareAnswer(
  answer: ReportAnswerInput,
  feature: {
    id: string;
    valueType: string;
    unit: string | null;
    options: Array<{ id: string }>;
  },
): PreparedAccessibilityAnswer {
  if (feature.valueType !== answer.type) {
    throw new ApiError(
      400,
      'INVALID_ANSWER_TYPE',
      'An answer does not match its accessibility feature value type.',
    );
  }

  const prepared: PreparedAccessibilityAnswer = {
    featureId: answer.featureId,
    valueType: answer.type,
    booleanValue: null,
    numericValue: null,
    numericUnit: null,
    textValue: null,
    optionId: null,
  };

  switch (answer.type) {
    case 'boolean':
      prepared.booleanValue = answer.value;
      break;
    case 'numeric':
      prepared.numericValue = answer.value;
      prepared.numericUnit = feature.unit;
      break;
    case 'text':
      prepared.textValue = answer.value;
      break;
    case 'select':
      if (!feature.options.some((option) => option.id === answer.optionId)) {
        throw new ApiError(
          400,
          'INVALID_FEATURE_OPTION',
          'A selected option does not belong to the referenced active feature.',
        );
      }
      prepared.optionId = answer.optionId;
      break;
  }

  return prepared;
}

// Caller supplies only the requireAuth identity, never an identity from the body.
export async function submitAccessibilityReport(
  placeId: string,
  input: SubmitAccessibilityReportInput,
  authenticatedUserId: string,
  repository: AccessibilityReportRepository = accessibilityReportRepository,
): Promise<PublicAccessibilityReport> {
  const context = await repository.findSubmissionContext(
    placeId,
    input.answers.map((answer) => answer.featureId),
  );
  if (!context) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', 'The requested place was not found.');
  }

  const applicableFeatures = new Map(
    context.category.features.map(({ feature }) => [feature.id, feature]),
  );
  const seenFeatureIds = new Set<string>();
  const preparedAnswers = input.answers.map((answer) => {
    if (seenFeatureIds.has(answer.featureId)) {
      throw new ApiError(
        400,
        'DUPLICATE_FEATURE_ANSWER',
        'Each feature may be answered only once per report.',
      );
    }
    seenFeatureIds.add(answer.featureId);

    const feature = applicableFeatures.get(answer.featureId);
    if (!feature) {
      throw new ApiError(
        400,
        'FEATURE_NOT_APPLICABLE',
        'An accessibility feature is inactive or not configured for this place category.',
      );
    }
    return prepareAnswer(answer, feature);
  });

  return toPublicReport(
    await repository.create(
      placeId,
      authenticatedUserId,
      input.observedAt ?? null,
      preparedAnswers,
    ),
  );
}
