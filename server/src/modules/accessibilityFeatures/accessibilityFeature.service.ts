import { ApiError } from '../../utils/ApiError.js';
import {
  accessibilityFeatureRepository,
  type AccessibilityFeatureRecord,
  type AccessibilityFeatureRepository,
} from './accessibilityFeature.repository.js';

export function listAccessibilityFeatures(
  repository: AccessibilityFeatureRepository = accessibilityFeatureRepository,
): Promise<AccessibilityFeatureRecord[]> {
  return repository.findActive();
}

export async function getAccessibilityFeature(
  id: string,
  repository: AccessibilityFeatureRepository = accessibilityFeatureRepository,
): Promise<AccessibilityFeatureRecord> {
  const feature = await repository.findActiveById(id);
  if (!feature) {
    throw new ApiError(
      404,
      'ACCESSIBILITY_FEATURE_NOT_FOUND',
      'The requested accessibility feature was not found.',
    );
  }
  return feature;
}
