import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis';

export const emailQueue = new Queue('emailQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true, // or keep some for Bull Board
    removeOnFail: false,
  },
});
