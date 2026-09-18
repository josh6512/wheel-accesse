import type { RequestHandler } from 'express';
import { getCategory, listCategories } from './category.service.js';
import type { CategoryIdParams } from './category.validation.js';

export const listCategoryHandler: RequestHandler = async (_request, response, next) => {
  try {
    response.json({ data: await listCategories() });
  } catch (error) {
    next(error);
  }
};

export const getCategoryHandler: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validated?.params as CategoryIdParams;
    response.json({ data: await getCategory(id) });
  } catch (error) {
    next(error);
  }
};
