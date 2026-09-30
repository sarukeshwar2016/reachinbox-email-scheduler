"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const PLACEHOLDER_MARKERS = ['placeholder_', 'your_'];
const isPlaceholder = (value) => PLACEHOLDER_MARKERS.some((m) => value.startsWith(m));
// Lazily resolved transporter — auto-provisions an Ethereal account when
// the .env credentials are still placeholders.
let _transporterPromise = null;
const getTransporter = () => {
    if (_transporterPromise)
        return _transporterPromise;
    _transporterPromise = (async () => {
        if (isPlaceholder(env_1.env.ETHEREAL_USER) || isPlaceholder(env_1.env.ETHEREAL_PASSWORD)) {
            console.log('[email] Ethereal credentials not set — auto-creating a test account...');
            const testAccount = await nodemailer_1.default.createTestAccount();
            console.log(`[email] Ethereal test account ready: ${testAccount.user}`);
            console.log(`[email] View sent emails at: https://ethereal.email/messages`);
            return nodemailer_1.default.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        }
        return nodemailer_1.default.createTransport({
            host: env_1.env.ETHEREAL_HOST,
            port: env_1.env.ETHEREAL_PORT,
            secure: false,
            auth: {
                user: env_1.env.ETHEREAL_USER,
                pass: env_1.env.ETHEREAL_PASSWORD,
            },
        });
    })();
    return _transporterPromise;
};
const sendEmail = async (to, subject, body, senderEmail) => {
    try {
        const transporter = await getTransporter();
        const info = await transporter.sendMail({
            from: senderEmail,
            to,
            subject,
            text: body,
        });
        console.log(`Email sent to ${to}. Message ID: ${info.messageId}`);
        // Preview only available when sending through an Ethereal account
        const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`📧 Preview URL: ${previewUrl}`);
        }
        return {
            success: true,
            messageId: info.messageId,
            previewUrl,
        };
    }
    catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=email.service.js.map