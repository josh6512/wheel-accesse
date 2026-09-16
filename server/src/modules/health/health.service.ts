import { prisma } from '../../db/prisma.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'connected' | 'unavailable';
  timestamp: string;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
  } catch {
    return { status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() };
  }
}
