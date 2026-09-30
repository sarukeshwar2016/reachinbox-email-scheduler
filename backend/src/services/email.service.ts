import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

const PLACEHOLDER_MARKERS = ['placeholder_', 'your_'];

const isPlaceholder = (value: string) =>
  PLACEHOLDER_MARKERS.some((m) => value.startsWith(m));

// Lazily resolved transporter — auto-provisions an Ethereal account when
// the .env credentials are still placeholders.
let _transporterPromise: Promise<Transporter> | null = null;

const getTransporter = (): Promise<Transporter> => {
  if (_transporterPromise) return _transporterPromise;

  _transporterPromise = (async () => {
    if (isPlaceholder(env.ETHEREAL_USER) || isPlaceholder(env.ETHEREAL_PASSWORD)) {
      console.log('[email] Ethereal credentials not set — auto-creating a test account...');
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[email] Ethereal test account ready: ${testAccount.user}`);
      console.log(`[email] View sent emails at: https://ethereal.email/messages`);

      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    return nodemailer.createTransport({
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASSWORD,
      },
    });
  })();

  return _transporterPromise;
};

export const sendEmail = async (to: string, subject: string, body: string, senderEmail: string) => {
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
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 Preview URL: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};
