import { Worker } from 'bullmq';
export declare const startWorker: () => Worker<any, {
    skipped: boolean;
    reason: string;
    success?: never;
    messageId?: never;
} | {
    success: boolean;
    messageId: any;
    skipped?: never;
    reason?: never;
}, string, import("bullmq").RedisQueueBackend, import("bullmq").JobProgress, import("bullmq").ConnectionOptions>;
//# sourceMappingURL=index.d.ts.map