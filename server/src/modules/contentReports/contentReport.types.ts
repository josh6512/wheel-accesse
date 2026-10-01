import type { CreateContentReportInput } from './contentReport.validation.js';

export interface ReportTarget {
  ownerIds: (string | null)[];
}

export interface ContentReportRepository {
  findVisibleTarget(input: CreateContentReportInput): Promise<ReportTarget | null>;
  create(
    input: CreateContentReportInput,
    reporterUserId: string,
  ): Promise<{
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    status: string;
    createdAt: Date;
  }>;
}
