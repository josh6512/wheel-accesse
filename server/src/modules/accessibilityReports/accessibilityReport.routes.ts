import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  getAccessibilityReportHandler,
  listPlaceAccessibilityReportHandler,
} from './accessibilityReport.controller.js';
import {
  accessibilityReportIdParamsSchema,
  accessibilityReportListQuerySchema,
  placeAccessibilityReportParamsSchema,
} from './accessibilityReport.validation.js';

export const placeAccessibilityReportRouter = Router();
export const accessibilityReportRouter = Router();

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
