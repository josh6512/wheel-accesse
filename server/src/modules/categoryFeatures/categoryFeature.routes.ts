import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { listCategoryFeatureHandler } from './categoryFeature.controller.js';
import { categoryFeatureParamsSchema } from './categoryFeature.validation.js';

export const categoryFeatureRouter = Router();

categoryFeatureRouter.get(
  '/:categoryId/features',
  validateRequest({ params: categoryFeatureParamsSchema }),
  listCategoryFeatureHandler,
);
