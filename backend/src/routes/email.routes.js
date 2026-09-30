"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../db/prisma");
const email_queue_1 = require("../queues/email.queue");
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
};
router.use(isAuthenticated);
const scheduleEmailSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1),
    startTime: zod_1.z.string().datetime(),
    delayMs: zod_1.z.number().min(0),
    hourlyLimit: zod_1.z.number().min(1),
    senderId: zod_1.z.string().uuid(),
    recipients: zod_1.z.array(zod_1.z.string().email()).min(1),
});
router.post('/schedule', async (req, res, next) => {
    try {
        const data = scheduleEmailSchema.parse(req.body);
        const userId = req.user.id;
        // Verify sender belongs to user
        const sender = await prisma_1.prisma.sender.findFirst({
            where: { id: data.senderId, userId }
        });
        if (!sender) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid sender ID' } });
        }
        // Create Campaign
        const campaign = await prisma_1.prisma.campaign.create({
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
            const idempotencyKey = (0, uuid_1.v4)(); // Deterministic key if we had unique data, but uuid is fine for creation
            const email = await prisma_1.prisma.email.create({
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
            const job = await email_queue_1.emailQueue.add('send-email', {
                emailId: email.id,
                campaignId: campaign.id,
                senderId: data.senderId,
                userId,
                idempotencyKey,
                hourlyLimit: data.hourlyLimit
            }, {
                delay,
                jobId: idempotencyKey // BullMQ uses this for deduplication!
            });
            // Update email with bull job id
            await prisma_1.prisma.email.update({
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/scheduled', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const emails = await prisma_1.prisma.email.findMany({
            where: { userId, status: 'scheduled' },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { scheduledAt: 'asc' },
            include: { sender: true }
        });
        const total = await prisma_1.prisma.email.count({ where: { userId, status: 'scheduled' } });
        res.json({ success: true, data: { emails, total, page, limit } });
    }
    catch (err) {
        next(err);
    }
});
router.get('/sent', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const emails = await prisma_1.prisma.email.findMany({
            where: { userId, status: { in: ['sent', 'failed'] } },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { sentAt: 'desc' },
            include: { sender: true }
        });
        const total = await prisma_1.prisma.email.count({ where: { userId, status: { in: ['sent', 'failed'] } } });
        res.json({ success: true, data: { emails, total, page, limit } });
    }
    catch (err) {
        next(err);
    }
});
// Create Sender Endpoint
router.post('/senders', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { email, name } = req.body;
        const sender = await prisma_1.prisma.sender.create({
            data: { userId, email, name }
        });
        res.json({ success: true, data: sender });
    }
    catch (err) {
        next(err);
    }
});
router.get('/senders', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const senders = await prisma_1.prisma.sender.findMany({ where: { userId } });
        res.json({ success: true, data: senders });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=email.routes.js.map