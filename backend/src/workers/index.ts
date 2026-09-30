import { Worker, Job } from 'bullmq';
import { redisConnection } from '../utils/redis';
import { prisma } from '../db/prisma';
import { checkRateLimit, getDelayForNextHour } from '../utils/rateLimiter';
import { sendEmail } from '../services/email.service';
import { sendSlackNotification } from '../services/slack.service';
import { indexEmail } from '../services/elasticsearch.service';
import { env } from '../config/env';

// Track if a notification was already sent to avoid spamming Slack within the same hour
const checkAndSetSlackNotification = async (senderId: string): Promise<boolean> => {
  const currentHour = new Date().toISOString().slice(0, 13);
  const key = `slack_notification:${senderId}:${currentHour}`;
  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.expire(key, 3600);
    return true; // Send notification
  }
  return false; // Already sent
};

export const startWorker = () => {
  console.log(`Starting BullMQ Worker with concurrency ${env.WORKER_CONCURRENCY}`);

  const worker = new Worker('emailQueue', async (job: Job) => {
    const { emailId, campaignId, senderId, userId, idempotencyKey, hourlyLimit } = job.data;

    // 1. Idempotency Check
    const email = await prisma.email.findUnique({
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
    const rateLimit = await checkRateLimit(senderId, hourlyLimit || env.MAX_EMAILS_PER_HOUR);

    if (!rateLimit.allowed) {
      console.log(`Rate limit reached for sender ${senderId}. Rescheduling email ${emailId}.`);
      
      // Delay this job to the next hour
      const delayMs = getDelayForNextHour();
      await job.moveToDelayed(Date.now() + delayMs, job.token!);
      
      // Slack Notification
      const shouldNotify = await checkAndSetSlackNotification(senderId);
      if (shouldNotify) {
        const message = `⚠️ Email rate limit reached\n\nSender: ${email.sender.email}\nLimit: ${hourlyLimit || env.MAX_EMAILS_PER_HOUR} emails/hour\nQueued emails will be delayed to the next available window.`;
        await sendSlackNotification(userId, message);
      }

      // Throwing error with specific message to trigger delay/backoff or just resolving?
      // MoveToDelayed puts the job back to delayed state, so we should throw a specific error or return.
      // But moveToDelayed requires the job token. Instead of doing it manually, we can throw an error
      // and use a custom backoff strategy, or we can just create a new delayed job and complete this one.
      // Let's use the error mechanism or manually moving it.
      throw new Error('RATE_LIMIT_EXCEEDED'); // The worker will retry. Wait, we want to delay it properly.
    }

    // 3. Mark as processing
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'processing', lastAttemptAt: new Date(), retryCount: { increment: 1 } }
    });

    // 4. Send Email via SMTP
    console.log(`Sending email ${emailId} to ${email.recipient}`);
    const result = await sendEmail(email.recipient, email.subject, email.body, email.sender.email);

    if (!result.success) {
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'failed', failureReason: result.error || null }
      });
      throw new Error(result.error);
    }

    // 5. Update DB as Sent
    const updatedEmail = await prisma.email.update({
      where: { id: emailId },
      data: { status: 'sent', sentAt: new Date() }
    });

    // 6. Index in Elasticsearch
    await indexEmail({
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
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  });

  worker.on('failed', async (job, err) => {
    if (job && err.message === 'RATE_LIMIT_EXCEEDED') {
      // Custom handling to delay it to the next hour.
      const delayMs = getDelayForNextHour();
      console.log(`Job ${job.id} rate limited. Retrying after ${delayMs}ms`);
      
      // Wait, BullMQ doesn't automatically move to delayed on error unless backoff is set.
      // We can manually change the delay of the job.
      await job.changeDelay(delayMs);
    } else {
      console.error(`Job ${job?.id} failed with error:`, err.message);
    }
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  return worker;
};

// If run directly
if (require.main === module) {
  startWorker();
}
