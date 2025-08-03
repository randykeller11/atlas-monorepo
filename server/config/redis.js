import Redis from 'ioredis';
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

let redis;

try {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required');
  }

  redis = new Redis(redisUrl, {
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  });

  redis.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  redis.on('error', (error) => {
    logger.error('Redis connection error', { error });
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });

  redis.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

} catch (error) {
  logger.error('Failed to initialize Redis client', { error });
  throw error;
}

export default redis;
