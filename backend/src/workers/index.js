"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../utils/redis");
const prisma_1 = require("../db/prisma");
const rateLimiter_1 = require("../utils/rateLimiter");
const email_service_1 = require("../services/email.service");
const slack_service_1 = require("../services/slack.service");
const elasticsearch_service_1 = require("../services/elasticsearch.service");
const env_1 = require("../config/env");
// Track if a notification was already sent to avoid spamming Slack within the same hour
const checkAndSetSlackNotification = async (senderId) => {
    const currentHour = new Date().toISOString().slice(0, 13);
    const key = `slack_notification:${senderId}:${currentHour}`;
    const count = await redis_1.redisConnection.incr(key);
    if (count === 1) {
        await redis_1.redisConnection.expire(key, 3600);
        return true; // Send notification
    }
    return false; // Already sent
};
const startWorker = () => {
    console.log(`Starting BullMQ Worker with concurrency ${env_1.env.WORKER_CONCURRENCY}`);
    const worker = new bullmq_1.Worker('emailQueue', async (job) => {
        const { emailId, campaignId, senderId, userId, idempotencyKey, hourlyLimit } = job.data;
        // 1. Idempotency Check
        const email = await prisma_1.prisma.email.findUnique({
            where: { id: emailId },
            include: { sender: true }
        });
        if (!email) {
            throw new Error(`Email ${emailId} not found`);
        }
        if (email.status === 'sent') {
            console.log(`Idempotency hit: Email ${emailId} already sent. Skipping.`);
            return { skipped: true, reason: 'Already sent' };
        }
        // 2. Rate Limiting Check
        const rateLimit = await (0, rateLimiter_1.checkRateLimit)(senderId, hourlyLimit || env_1.env.MAX_EMAILS_PER_HOUR);
        if (!rateLimit.allowed) {
            console.log(`Rate limit reached for sender ${senderId}. Rescheduling email ${emailId}.`);
            // Delay this job to the next hour
            const delayMs = (0, rateLimiter_1.getDelayForNextHour)();
            await job.moveToDelayed(Date.now() + delayMs, job.token);
            // Slack Notification
            const shouldNotify = await checkAndSetSlackNotification(senderId);
            if (shouldNotify) {
                const message = `⚠️ Email rate limit reached\n\nSender: ${email.sender.email}\nLimit: ${hourlyLimit || env_1.env.MAX_EMAILS_PER_HOUR} emails/hour\nQueued emails will be delayed to the next available window.`;
                await (0, slack_service_1.sendSlackNotification)(userId, message);
            }
            // Throwing error with specific message to trigger delay/backoff or just resolving?
            // MoveToDelayed puts the job back to delayed state, so we should throw a specific error or return.
            // But moveToDelayed requires the job token. Instead of doing it manually, we can throw an error
            // and use a custom backoff strategy, or we can just create a new delayed job and complete this one.
            // Let's use the error mechanism or manually moving it.
            throw new Error('RATE_LIMIT_EXCEEDED'); // The worker will retry. Wait, we want to delay it properly.
        }
        // 3. Mark as processing
        await prisma_1.prisma.email.update({
            where: { id: emailId },
            data: { status: 'processing', lastAttemptAt: new Date(), retryCount: { increment: 1 } }
        });
        // 4. Send Email via SMTP
        console.log(`Sending email ${emailId} to ${email.recipient}`);
        const result = await (0, email_service_1.sendEmail)(email.recipient, email.subject, email.body, email.sender.email);
        if (!result.success) {
            await prisma_1.prisma.email.update({
                where: { id: emailId },
                data: { status: 'failed', failureReason: result.error }
            });
            throw new Error(result.error);
        }
        // 5. Update DB as Sent
        const updatedEmail = await prisma_1.prisma.email.update({
            where: { id: emailId },
            data: { status: 'sent', sentAt: new Date() }
        });
        // 6. Index in Elasticsearch
        await (0, elasticsearch_service_1.indexEmail)({
            emailId: updatedEmail.id,
            userId: updatedEmail.userId,
            campaignId: updatedEmail.campaignId,
            sender: email.sender.email,
            recipient: updatedEmail.recipient,
            subject: updatedEmail.subject,
            body: updatedEmail.body,
            status: updatedEmail.status,
            scheduledAt: updatedEmail.scheduledAt,
            sentAt: updatedEmail.sentAt
        });
        return { success: true, messageId: result.messageId };
    }, {
        connection: redis_1.redisConnection,
        concurrency: env_1.env.WORKER_CONCURRENCY,
    });
    worker.on('failed', async (job, err) => {
        if (job && err.message === 'RATE_LIMIT_EXCEEDED') {
            // Custom handling to delay it to the next hour.
            const delayMs = (0, rateLimiter_1.getDelayForNextHour)();
            console.log(`Job ${job.id} rate limited. Retrying after ${delayMs}ms`);
            // Wait, BullMQ doesn't automatically move to delayed on error unless backoff is set.
            // We can manually change the delay of the job.
            await job.changeDelay(delayMs);
        }
        else {
            console.error(`Job ${job?.id} failed with error:`, err.message);
        }
    });
    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed successfully`);
    });
    return worker;
};
exports.startWorker = startWorker;
// If run directly
if (require.main === module) {
    (0, exports.startWorker)();
}
//# sourceMappingURL=index.js.map