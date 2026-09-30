"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const env_1 = require("./config/env");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const email_routes_1 = __importDefault(require("./routes/email.routes"));
const slack_routes_1 = __importDefault(require("./routes/slack.routes"));
const queue_routes_1 = __importDefault(require("./routes/queue.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, express_session_1.default)({
    secret: env_1.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: env_1.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/emails', email_routes_1.default);
app.use('/api/slack', slack_routes_1.default);
app.use('/admin/queues', queue_routes_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: 'ok', // TODO: actual health checks
        redis: 'ok',
        elasticsearch: 'ok'
    });
});
// Error handling
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map