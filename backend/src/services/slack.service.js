"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSlackNotification = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../db/prisma");
const sendSlackNotification = async (userId, message) => {
    try {
        const connection = await prisma_1.prisma.slackConnection.findUnique({
            where: { userId }
        });
        if (!connection || !connection.active || !connection.accessToken) {
            console.log('Slack not connected for user', userId);
            return false; // Silently skip if not connected
        }
        const response = await axios_1.default.post('https://slack.com/api/chat.postMessage', {
            channel: '#general', // Ideally, allow user to pick channel, or DM them.
            text: message
        }, {
            headers: {
                'Authorization': `Bearer ${connection.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.data.ok) {
            console.error('Failed to send Slack notification:', response.data.error);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Error sending Slack notification:', error);
        return false;
    }
};
exports.sendSlackNotification = sendSlackNotification;
//# sourceMappingURL=slack.service.js.map