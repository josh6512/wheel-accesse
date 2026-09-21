import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { writeLimits } from '../community/writeLimits.js';
import { createReport, deleteReport } from '../community/community.service.js';
import {
  getAccessibilityReportHandler,
  listPlaceAccessibilityReportHandler,
} from './accessibilityReport.controller.js';
import {
  accessibilityReportIdParamsSchema,
  accessibilityReportListQuerySchema,
  placeAccessibilityReportParamsSchema,
  submitAccessibilityReportBodySchema,
  type PlaceAccessibilityReportParams,
  type AccessibilityReportIdParams,
  type SubmitAccessibilityReportInput,
} from './accessibilityReport.validation.js';

export const placeAccessibilityReportRouter = Router();
export const accessibilityReportRouter = Router();
placeAccessibilityReportRouter.post(
  '/:placeId/accessibility-reports',
  requireAuth,
  ...writeLimits(20),
  validateRequest({
    params: placeAccessibilityReportParamsSchema,
    body: submitAccessibilityReportBodySchema,
  }),
  async (request, response) => {
    const { placeId } = request.validated!.params as PlaceAccessibilityReportParams;
    response.status(201).json({
      data: await createReport(
        placeId,
        request.validated!.body as SubmitAccessibilityReportInput,
        request.auth!.userId,
      ),
    });
  },
);
accessibilityReportRouter.delete(
  '/:id',
  requireAuth,
  ...writeLimits(30),
  validateRequest({ params: accessibilityReportIdParamsSchema }),
  async (request, response) => {
    const { id } = request.validated!.params as AccessibilityReportIdParams;
    await deleteReport(id, request.auth!.userId);
    response.status(204).end();
  },
);

placeAccessibilityReportRouter.get(
  '/:placeId/accessibility-reports',
  validateRequest({
    params: placeAccessibilityReportParamsSchema,
    query: accessibilityReportListQuerySchema,
  }),
  listPlaceAccessibilityReportHandler,
);

accessibilityReportRouter.get(
  '/:id',
  validateRequest({ params: accessibilityReportIdParamsSchema }),
  getAccessibilityReportHandler,
);
