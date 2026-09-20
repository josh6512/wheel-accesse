import { z } from 'zod';

// Deliberately ASCII for MVP; no provider-specific dot/plus stripping.
export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email()
  .regex(/^[\x21-\x7e]+$/)
  .transform((value) => value.toLowerCase());
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const registerSchema = z
  .object({
    email: emailSchema,
    displayName: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value)),
    password: z.string().min(15).max(128),
  })
  .strict();
export type Registration = z.infer<typeof registerSchema>;
