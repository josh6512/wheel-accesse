import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  CLIENT_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
  const invalidNames = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid server environment configuration: ${invalidNames}`);
}

export const env = result.data;
