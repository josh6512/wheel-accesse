declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: { userId: string; familyId: string };
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}

export {};
