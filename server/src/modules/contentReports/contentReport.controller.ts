import type { RequestHandler } from 'express';
import { createContentReport } from './contentReport.service.js';
import type { CreateContentReportInput } from './contentReport.validation.js';

export const createContentReportHandler: RequestHandler = async (request, response) => {
  response.status(201).json({
    data: await createContentReport(
      request.validated!.body as CreateContentReportInput,
      request.auth!.userId,
    ),
  });
};
