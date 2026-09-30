"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env from backend directory (where we run npm scripts from)
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.string().default('development'),
    PORT: zod_1.z.string().default('5000'),
    DATABASE_URL: zod_1.z.string(),
    REDIS_URL: zod_1.z.string(),
    ELASTICSEARCH_URL: zod_1.z.string(),
    WORKER_CONCURRENCY: zod_1.z.string().transform(Number).default('3'),
    MIN_EMAIL_DELAY_MS: zod_1.z.string().transform(Number).default('2000'),
    MAX_EMAILS_PER_HOUR: zod_1.z.string().transform(Number).default('100'),
    GOOGLE_CLIENT_ID: zod_1.z.string().default('placeholder_google_client_id'),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().default('placeholder_google_client_secret'),
    GOOGLE_CALLBACK_URL: zod_1.z.string().default('http://localhost:5000/api/auth/google/callback'),
    SLACK_CLIENT_ID: zod_1.z.string().optional(),
    SLACK_CLIENT_SECRET: zod_1.z.string().optional(),
    SLACK_REDIRECT_URI: zod_1.z.string().optional(),
    SESSION_SECRET: zod_1.z.string().default('super_secret_session_key_changeme'),
    ETHEREAL_HOST: zod_1.z.string().default('smtp.ethereal.email'),
    ETHEREAL_PORT: zod_1.z.string().transform(Number).default('587'),
    ETHEREAL_USER: zod_1.z.string().default('placeholder_ethereal_user'),
    ETHEREAL_PASSWORD: zod_1.z.string().default('placeholder_ethereal_password'),
});
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
    console.error('Invalid environment variables:', _env.error.format());
    process.exit(1);
}
exports.env = _env.data;
//# sourceMappingURL=env.js.map