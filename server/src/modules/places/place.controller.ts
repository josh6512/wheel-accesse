import type { RequestHandler } from 'express';
import { createPlace, getPlace, listPlaces } from './place.service.js';
import type { CreatePlaceInput, ListPlaceQuery, PlaceIdParams } from './place.validation.js';

export const listPlaceHandler: RequestHandler = async (request, response, next) => {
  try {
    const query = request.validated?.query as ListPlaceQuery;
    response.json(await listPlaces(query));
  } catch (error) {
    next(error);
  }
};

export const getPlaceHandler: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validated?.params as PlaceIdParams;
    response.json({ data: await getPlace(id) });
  } catch (error) {
    next(error);
  }
};

export const createPlaceHandler: RequestHandler = async (request, response, next) => {
  try {
    const input = request.validated?.body as CreatePlaceInput;
    response.status(201).json({ data: await createPlace(input, request.auth!.userId) });
  } catch (error) {
    next(error);
  }
};
