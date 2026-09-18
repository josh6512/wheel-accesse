import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import {
  getAccessibilityFeatureHandler,
  listAccessibilityFeatureHandler,
} from './accessibilityFeature.controller.js';
import { accessibilityFeatureIdParamsSchema } from './accessibilityFeature.validation.js';

export const accessibilityFeatureRouter = Router();

accessibilityFeatureRouter.get('/', listAccessibilityFeatureHandler);
accessibilityFeatureRouter.get(
  '/:id',
  validateRequest({ params: accessibilityFeatureIdParamsSchema }),
  getAccessibilityFeatureHandler,
);
