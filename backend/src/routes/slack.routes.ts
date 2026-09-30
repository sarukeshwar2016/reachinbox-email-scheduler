import { Router } from 'express';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import axios from 'axios';

const router = Router();

// Middleware to check authentication
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
};

router.get('/connect', isAuthenticated, (req, res) => {
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=chat:write&redirect_uri=${env.SLACK_REDIRECT_URI}&state=${(req.user as any).id}`;
  res.redirect(slackAuthUrl);
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing code or state');

    const userId = state as string;

    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI
      }
    });

    if (!response.data.ok) {
      console.error('Slack OAuth Error:', response.data);
      return res.status(400).send('Slack OAuth failed');
    }

    const { access_token, team } = response.data;

    await prisma.slackConnection.upsert({
      where: { userId },
      update: { accessToken: access_token, teamId: team.id, active: true },
      create: { userId, accessToken: access_token, teamId: team.id }
    });

    // Ensure we are redirecting to the frontend port (e.g., 5173).
    const frontendUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173';
    res.redirect(frontendUrl);
  } catch (error) {
    console.error('Slack Callback Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/disconnect', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    await prisma.slackConnection.updateMany({
      where: { userId },
      data: { active: false }
    });
    res.json({ success: true, message: 'Slack disconnected' });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

router.get('/status', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const connection = await prisma.slackConnection.findUnique({ where: { userId } });
    res.json({ success: true, data: { connected: !!connection?.active } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
});

export default router;
