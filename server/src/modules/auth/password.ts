import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const options = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;
export const hashPassword = (password: string) => argon2.hash(password, options);
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(hash: string | undefined, password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(32).toString('base64url'));
  const valid = await argon2.verify(hash ?? (await dummyHash), password);
  return hash !== undefined && valid;
}
