import { PrismaMssql } from '@prisma/adapter-mssql';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaMssql(env.DATABASE_URL, {
  onPoolError: () => undefined,
  onConnectionError: () => undefined,
});

export const prisma = new PrismaClient({ adapter, log: ['warn'] });
