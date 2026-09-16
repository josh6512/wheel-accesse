import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';

export const notFound: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route ${request.method} ${request.path} was not found.`));
};
