import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  CLIENT_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_ACCESS_SECRET: z
    .string()
    .min(43)
    .refine((value) => !value.startsWith('REPLACE_'))
    .optional(),
  AUTH_ISSUER: z.string().min(1).default('wheel-accesses'),
  AUTH_AUDIENCE: z.string().min(1).default('wheel-accesses-client'),
  AUTH_ACCESS_SECONDS: z.coerce.number().int().min(60).max(900).default(600),
  AUTH_REFRESH_DAYS: z.coerce.number().int().min(1).max(30).default(14),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const invalidNames = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid server environment configuration: ${invalidNames}`);
}

export const env = result.data;
