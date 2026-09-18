import type { RequestHandler } from 'express';
import { listCategoryFeatures } from './categoryFeature.service.js';
import type { CategoryFeatureParams } from './categoryFeature.validation.js';

export const listCategoryFeatureHandler: RequestHandler = async (request, response, next) => {
  try {
    const { categoryId } = request.validated?.params as CategoryFeatureParams;
    response.json({ data: await listCategoryFeatures(categoryId) });
  } catch (error) {
    next(error);
  }
};
