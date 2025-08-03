import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

let prisma;

try {
  prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });

  // Log database queries in development
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      logger.debug('Database Query', {
        query: e.query,
        params: e.params,
        duration: e.duration
      });
    });
  }

  // Log database errors
  prisma.$on('error', (e) => {
    logger.error('Database Error', { error: e });
  });

} catch (error) {
  logger.error('Failed to initialize Prisma client', { error });
  throw error;
}

export default prisma;
