import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/ApiError.js';

interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    try {
      const validated: NonNullable<Request['validated']> = {};
      if (schemas.body) validated.body = schemas.body.parse(request.body);
      if (schemas.params) validated.params = schemas.params.parse(request.params);
      if (schemas.query) validated.query = schemas.query.parse(request.query);
      request.validated = validated;
      next();
    } catch (error) {
      next(new ApiError(400, 'VALIDATION_ERROR', 'The request contains invalid data.', error));
    }
  };
}
