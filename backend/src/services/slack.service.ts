import axios from 'axios';
import { prisma } from '../db/prisma';

export const sendSlackNotification = async (userId: string, message: string) => {
  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId }
    });

    if (!connection || !connection.active || !connection.accessToken) {
      console.log('Slack not connected for user', userId);
      return false; // Silently skip if not connected
    }

    const response = await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: '#general', // Ideally, allow user to pick channel, or DM them.
        text: message
      },
      {
        headers: {
          'Authorization': `Bearer ${connection.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.ok) {
      console.error('Failed to send Slack notification:', response.data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return false;
  }
};
