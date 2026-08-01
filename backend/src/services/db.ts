import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 2000),
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});
