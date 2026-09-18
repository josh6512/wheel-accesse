import type { RequestHandler } from 'express';
import { searchPlaces } from './search.service.js';
import type { SearchPlacesQuery } from './search.validation.js';

export const searchPlaceHandler: RequestHandler = async (request, response, next) => {
  try {
    const query = request.validated?.query as SearchPlacesQuery;
    response.json(await searchPlaces(query));
  } catch (error) {
    next(error);
  }
};
