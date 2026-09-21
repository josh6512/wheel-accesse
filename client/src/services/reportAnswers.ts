import type { CategoryFeature, ReportAnswer } from '../types/api';

export function reportAnswers(
  features: CategoryFeature[],
  values: Record<string, string>,
): ReportAnswer[] {
  return features.flatMap((feature): ReportAnswer[] => {
    const value = values[feature.id]?.trim();
    if (!value) return [];
    switch (feature.valueType) {
      case 'boolean':
        return [{ featureId: feature.id, type: 'boolean', value: value === 'true' }];
      case 'numeric':
        return [{ featureId: feature.id, type: 'numeric', value: Number(value) }];
      case 'select':
        return [{ featureId: feature.id, type: 'select', optionId: value }];
      case 'text':
        return [{ featureId: feature.id, type: 'text', value }];
      default:
        return [];
    }
  });
}
