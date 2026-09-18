export const accessibilityStatuses = [
  'SUPPORTED',
  'NOT_SUPPORTED',
  'CONFLICTING',
  'UNKNOWN',
] as const;

export type AccessibilityStatus = (typeof accessibilityStatuses)[number];

export function deriveAccessibilityStatus(
  positiveReports: number,
  negativeReports: number,
): AccessibilityStatus {
  if (positiveReports === 0 && negativeReports === 0) return 'UNKNOWN';
  if (positiveReports > negativeReports) return 'SUPPORTED';
  if (negativeReports > positiveReports) return 'NOT_SUPPORTED';
  return 'CONFLICTING';
}
