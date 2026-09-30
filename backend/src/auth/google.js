"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const env_1 = require("../config/env");
const prisma_1 = require("../db/prisma");
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { id } });
        done(null, user);
    }
    catch (error) {
        done(error, null);
    }
});
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: env_1.env.GOOGLE_CLIENT_ID,
    clientSecret: env_1.env.GOOGLE_CLIENT_SECRET,
    callbackURL: env_1.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails?.[0].value;
        if (!email) {
            return done(new Error('No email found from Google profile'), false);
        }
        let user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma_1.prisma.user.create({
                data: {
                    email,
                    googleId: profile.id,
                    name: profile.displayName,
                    avatarUrl: profile.photos?.[0].value,
                }
            });
        }
        else if (!user.googleId) {
            // Update existing user with googleId if they didn't have one
            user = await prisma_1.prisma.user.update({
                where: { email },
                data: { googleId: profile.id, avatarUrl: profile.photos?.[0].value }
            });
        }
        done(null, user);
    }
    catch (error) {
        done(error, false);
    }
}));
//# sourceMappingURL=google.js.map