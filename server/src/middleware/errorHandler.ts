import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const isKnownError = error instanceof ApiError;
  const statusCode = isKnownError ? error.statusCode : 500;

  const requestContext = {
    requestId: request.id,
    method: request.method,
    path: request.path,
    statusCode,
  };

  if (isKnownError) {
    logger.warn({ ...requestContext, code: error.code }, 'Request rejected');
  } else {
    // Database/library errors can contain query arguments or credential input.
    logger.error(requestContext, 'Request failed');
  }

  response.status(statusCode).json({
    error: {
      code: isKnownError ? error.code : 'INTERNAL_SERVER_ERROR',
      message: isKnownError ? error.message : 'An unexpected error occurred.',
      requestId: request.id,
      ...(env.NODE_ENV !== 'production' && isKnownError && error.details
        ? { details: error.details }
        : {}),
    },
  });
};
