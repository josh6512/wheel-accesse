import type { RequestHandler } from 'express';
import {
  getAccessibilityFeature,
  listAccessibilityFeatures,
} from './accessibilityFeature.service.js';
import type { AccessibilityFeatureIdParams } from './accessibilityFeature.validation.js';

export const listAccessibilityFeatureHandler: RequestHandler = async (_request, response, next) => {
  try {
    response.json({ data: await listAccessibilityFeatures() });
  } catch (error) {
    next(error);
  }
};

export const getAccessibilityFeatureHandler: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validated?.params as AccessibilityFeatureIdParams;
    response.json({ data: await getAccessibilityFeature(id) });
  } catch (error) {
    next(error);
  }
};
