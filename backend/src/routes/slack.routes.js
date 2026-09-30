"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const env_1 = require("../config/env");
const prisma_1 = require("../db/prisma");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated())
        return next();
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
};
router.get('/connect', isAuthenticated, (req, res) => {
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${env_1.env.SLACK_CLIENT_ID}&scope=chat:write&redirect_uri=${env_1.env.SLACK_REDIRECT_URI}&state=${req.user.id}`;
    res.redirect(slackAuthUrl);
});
router.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state)
            return res.status(400).send('Missing code or state');
        const userId = state;
        const response = await axios_1.default.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                client_id: env_1.env.SLACK_CLIENT_ID,
                client_secret: env_1.env.SLACK_CLIENT_SECRET,
                code,
                redirect_uri: env_1.env.SLACK_REDIRECT_URI
            }
        });
        if (!response.data.ok) {
            console.error('Slack OAuth Error:', response.data);
            return res.status(400).send('Slack OAuth failed');
        }
        const { access_token, team } = response.data;
        await prisma_1.prisma.slackConnection.upsert({
            where: { userId },
            update: { accessToken: access_token, teamId: team.id, active: true },
            create: { userId, accessToken: access_token, teamId: team.id }
        });
        // Ensure we are redirecting to the frontend port (e.g., 5173).
        const frontendUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173';
        res.redirect(frontendUrl);
    }
    catch (error) {
        console.error('Slack Callback Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/disconnect', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        await prisma_1.prisma.slackConnection.updateMany({
            where: { userId },
            data: { active: false }
        });
        res.json({ success: true, message: 'Slack disconnected' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
    }
});
router.get('/status', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await prisma_1.prisma.slackConnection.findUnique({ where: { userId } });
        res.json({ success: true, data: { connected: !!connection?.active } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
    }
});
exports.default = router;
//# sourceMappingURL=slack.routes.js.map