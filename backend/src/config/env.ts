import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory (where we run npm scripts from)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  ELASTICSEARCH_URL: z.string(),
  WORKER_CONCURRENCY: z.string().default('3').transform(Number),
  MIN_EMAIL_DELAY_MS: z.string().default('2000').transform(Number),
  MAX_EMAILS_PER_HOUR: z.string().default('100').transform(Number),
  GOOGLE_CLIENT_ID: z.string().default('placeholder_google_client_id'),
  GOOGLE_CLIENT_SECRET: z.string().default('placeholder_google_client_secret'),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().optional(),
  SESSION_SECRET: z.string().default('super_secret_session_key_changeme'),
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.string().default('587').transform(Number),
  ETHEREAL_USER: z.string().default('placeholder_ethereal_user'),
  ETHEREAL_PASSWORD: z.string().default('placeholder_ethereal_password'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
