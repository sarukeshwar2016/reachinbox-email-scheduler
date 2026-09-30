import { Router } from 'express';
import { prisma } from '../db/prisma';
import { emailQueue } from '../queues/email.queue';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Middleware to check authentication
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
};

router.use(isAuthenticated);

const scheduleEmailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  startTime: z.string().datetime(),
  delayMs: z.number().min(0),
  hourlyLimit: z.number().min(1),
  senderId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1),
});

router.post('/schedule', async (req, res, next) => {
  try {
    const data = scheduleEmailSchema.parse(req.body);
    const userId = (req.user as any).id;

    // Verify sender belongs to user
    const sender = await prisma.sender.findFirst({
      where: { id: data.senderId, userId }
    });

    if (!sender) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid sender ID' } });
    }

    // Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        senderId: data.senderId,
        subject: data.subject,
        body: data.body,
        startTime: new Date(data.startTime),
        delayMs: data.delayMs,
        hourlyLimit: data.hourlyLimit,
        totalRecipients: data.recipients.length,
      }
    });

    const startTimeMs = new Date(data.startTime).getTime();
    
    // Create Emails and add to BullMQ
    const emailPromises = data.recipients.map(async (recipient, index) => {
      const scheduledTime = new Date(startTimeMs + (index * data.delayMs));
      const idempotencyKey = uuidv4(); // Deterministic key if we had unique data, but uuid is fine for creation

      const email = await prisma.email.create({
        data: {
          userId,
          senderId: data.senderId,
          campaignId: campaign.id,
          recipient,
          subject: data.subject,
          body: data.body,
          scheduledAt: scheduledTime,
          status: 'scheduled',
          idempotencyKey,
        }
      });

      // Calculate initial delay for BullMQ (when it should first execute)
      const delay = Math.max(0, scheduledTime.getTime() - Date.now());

      const job = await emailQueue.add(
        'send-email', 
        { 
          emailId: email.id,
          campaignId: campaign.id,
          senderId: data.senderId,
          userId,
          idempotencyKey,
          hourlyLimit: data.hourlyLimit
        }, 
        { 
          delay,
          jobId: idempotencyKey // BullMQ uses this for deduplication!
        }
      );

      // Update email with bull job id
      await prisma.email.update({
        where: { id: email.id },
        data: { bullJobId: job.id }
      });

      return email;
    });

    await Promise.all(emailPromises);

    res.json({
      success: true,
      data: {
        campaignId: campaign.id,
        message: `Scheduled ${data.recipients.length} emails.`
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/scheduled', async (req, res, next) => {
  try {
    const userId = (req.user as any).id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const emails = await prisma.email.findMany({
      where: { userId, status: 'scheduled' },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { scheduledAt: 'asc' },
      include: { sender: true }
    });
    
    const total = await prisma.email.count({ where: { userId, status: 'scheduled' } });

    res.json({ success: true, data: { emails, total, page, limit } });
  } catch (err) { next(err); }
});

router.get('/sent', async (req, res, next) => {
  try {
    const userId = (req.user as any).id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const emails = await prisma.email.findMany({
      where: { userId, status: { in: ['sent', 'failed'] } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: { sender: true }
    });
    
    const total = await prisma.email.count({ where: { userId, status: { in: ['sent', 'failed'] } } });

    res.json({ success: true, data: { emails, total, page, limit } });
  } catch (err) { next(err); }
});

// Create Sender Endpoint
router.post('/senders', async (req, res, next) => {
  try {
    const userId = (req.user as any).id;
    const { email, name } = req.body;
    
    const sender = await prisma.sender.create({
      data: { userId, email, name }
    });
    res.json({ success: true, data: sender });
  } catch (err) { next(err); }
});

router.get('/senders', async (req, res, next) => {
  try {
    const userId = (req.user as any).id;
    const senders = await prisma.sender.findMany({ where: { userId } });
    res.json({ success: true, data: senders });
  } catch (err) { next(err); }
});

export default router;
