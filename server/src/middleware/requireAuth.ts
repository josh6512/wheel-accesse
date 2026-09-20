import type { RequestHandler } from 'express';
import { authService } from '../modules/auth/auth.service.js';
import { unauthorized, verifyAccess } from '../modules/auth/tokens.js';

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ') || header.length > 2048) throw unauthorized();
    const identity = await verifyAccess(header.slice(7));
    await authService.me(identity.userId, identity.familyId);
    request.auth = identity;
    next();
  } catch (error) {
    next(error);
  }
};
