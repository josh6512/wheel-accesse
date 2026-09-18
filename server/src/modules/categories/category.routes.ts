import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { getCategoryHandler, listCategoryHandler } from './category.controller.js';
import { categoryIdParamsSchema } from './category.validation.js';

export const categoryRouter = Router();

categoryRouter.get('/', listCategoryHandler);
categoryRouter.get('/:id', validateRequest({ params: categoryIdParamsSchema }), getCategoryHandler);
