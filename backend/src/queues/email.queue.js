"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../utils/redis");
exports.emailQueue = new bullmq_1.Queue('emailQueue', {
    connection: redis_1.redisConnection,
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
//# sourceMappingURL=email.queue.js.map