import type { RequestHandler } from 'express';
import {
  getAccessibilityReport,
  listPlaceAccessibilityReports,
} from './accessibilityReport.service.js';
import type {
  AccessibilityReportIdParams,
  AccessibilityReportListQuery,
  PlaceAccessibilityReportParams,
} from './accessibilityReport.validation.js';

export const listPlaceAccessibilityReportHandler: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const { placeId } = request.validated?.params as PlaceAccessibilityReportParams;
    const query = request.validated?.query as AccessibilityReportListQuery;
    response.json(await listPlaceAccessibilityReports(placeId, query));
  } catch (error) {
    next(error);
  }
};

export const getAccessibilityReportHandler: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validated?.params as AccessibilityReportIdParams;
    response.json({ data: await getAccessibilityReport(id) });
  } catch (error) {
    next(error);
  }
};
