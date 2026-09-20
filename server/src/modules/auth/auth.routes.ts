import { Router, type CookieOptions, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { ApiError } from '../../utils/ApiError.js';
import { authService } from './auth.service.js';
import { loginSchema, registerSchema, type Registration } from './auth.validation.js';

export const cookieName = env.NODE_ENV === 'production' ? '__Secure-wa_refresh' : 'wa_refresh';
export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
};
export function readRefresh(cookie: string | undefined): string | undefined {
  const matches = (cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${cookieName}=`));
  return matches.length === 1 ? matches[0]!.slice(cookieName.length + 1) : undefined;
}
export const requireAuthOrigin: RequestHandler = (request, _response, next) => {
  if (
    request.headers.origin !== env.CLIENT_ORIGIN ||
    request.headers['sec-fetch-site'] === 'cross-site'
  ) {
    next(new ApiError(403, 'ORIGIN_REJECTED', 'This request origin is not allowed.'));
    return;
  }
  next();
};
export function authLimiter(limit: number, windowMs = 900000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many attempts. Please try again later.',
        },
      });
    },
  });
}
export const authRouter = Router();
authRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  next();
});
// All cookie-changing actions require a configured browser origin. A future native
// transport must be separate rather than bypassing this web CSRF boundary.
authRouter.post(
  '/register',
  requireAuthOrigin,
  authLimiter(10),
  validateRequest({ body: registerSchema }),
  async (request, response) => {
    const result = await authService.register(request.validated!.body as Registration);
    response.cookie(cookieName, result.refreshToken, {
      ...cookieOptions,
      expires: result.expiresAt,
    });
    request.log.info(
      { event: 'auth.register', userId: result.body.user.id },
      'Authentication succeeded',
    );
    response.status(201).json(result.body);
  },
);
authRouter.post(
  '/login',
  requireAuthOrigin,
  authLimiter(20),
  validateRequest({ body: loginSchema }),
  async (request, response) => {
    const { email, password } = request.validated!.body as { email: string; password: string };
    const result = await authService.login(email, password);
    response.cookie(cookieName, result.refreshToken, {
      ...cookieOptions,
      expires: result.expiresAt,
    });
    request.log.info(
      { event: 'auth.login', userId: result.body.user.id },
      'Authentication succeeded',
    );
    response.json(result.body);
  },
);
authRouter.post('/refresh', requireAuthOrigin, authLimiter(60), async (request, response, next) => {
  try {
    const result = await authService.refresh(readRefresh(request.headers.cookie));
    response.cookie(cookieName, result.refreshToken, {
      ...cookieOptions,
      expires: result.expiresAt,
    });
    response.json(result.body);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401)
      response.clearCookie(cookieName, cookieOptions);
    next(error);
  }
});
authRouter.post('/logout', requireAuthOrigin, authLimiter(60), async (request, response) => {
  await authService.logout(readRefresh(request.headers.cookie));
  response.clearCookie(cookieName, cookieOptions);
  response.status(204).end();
});
authRouter.get('/me', requireAuth, async (request, response) => {
  response.json(await authService.me(request.auth!.userId, request.auth!.familyId));
});
