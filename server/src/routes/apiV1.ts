import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { accessibilityFeatureRouter } from '../modules/accessibilityFeatures/accessibilityFeature.routes.js';
import {
  accessibilityReportRouter,
  placeAccessibilityReportRouter,
} from '../modules/accessibilityReports/accessibilityReport.routes.js';
import { categoryRouter } from '../modules/categories/category.routes.js';
import { categoryFeatureRouter } from '../modules/categoryFeatures/categoryFeature.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { placeRouter } from '../modules/places/place.routes.js';
import { placeReviewRouter, reviewRouter } from '../modules/reviews/review.routes.js';
import { searchRouter } from '../modules/search/search.routes.js';

export const apiV1Router = Router();
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/health', healthRouter);
apiV1Router.use('/categories', categoryFeatureRouter);
apiV1Router.use('/categories', categoryRouter);
apiV1Router.use('/accessibility-features', accessibilityFeatureRouter);
apiV1Router.use('/places', placeAccessibilityReportRouter);
apiV1Router.use('/accessibility-reports', accessibilityReportRouter);
apiV1Router.use('/places', placeReviewRouter);
apiV1Router.use('/reviews', reviewRouter);
apiV1Router.use('/places', searchRouter);
apiV1Router.use('/places', placeRouter);
