import { Router } from 'express';
import { accessibilityFeatureRouter } from '../modules/accessibilityFeatures/accessibilityFeature.routes.js';
import { categoryRouter } from '../modules/categories/category.routes.js';
import { categoryFeatureRouter } from '../modules/categoryFeatures/categoryFeature.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { placeRouter } from '../modules/places/place.routes.js';

export const apiV1Router = Router();
apiV1Router.use('/health', healthRouter);
apiV1Router.use('/categories', categoryFeatureRouter);
apiV1Router.use('/categories', categoryRouter);
apiV1Router.use('/accessibility-features', accessibilityFeatureRouter);
apiV1Router.use('/places', placeRouter);
