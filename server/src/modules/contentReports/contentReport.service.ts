import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError.js';
import { writeTransaction } from '../community/writeTransaction.js';
import { contentReportRepositoryFor } from './contentReport.repository.js';
import type { ContentReportRepository } from './contentReport.types.js';
import type { CreateContentReportInput } from './contentReport.validation.js';

export async function submitContentReport(
  input: CreateContentReportInput,
  reporterUserId: string,
  repository: ContentReportRepository,
) {
  const target = await repository.findVisibleTarget(input);
  if (!target)
    throw new ApiError(404, 'REPORT_TARGET_NOT_FOUND', 'The reported content was not found.');
  if (target.ownerIds.includes(reporterUserId))
    throw new ApiError(403, 'SELF_REPORT_FORBIDDEN', 'You cannot report your own content.');
  return repository.create(input, reporterUserId);
}

export async function createContentReport(input: CreateContentReportInput, reporterUserId: string) {
  try {
    return await writeTransaction((tx) =>
      submitContentReport(input, reporterUserId, contentReportRepositoryFor(tx)),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new ApiError(
        409,
        'REPORT_ALREADY_EXISTS',
        'You already reported this content for this reason.',
      );
    throw error;
  }
}
