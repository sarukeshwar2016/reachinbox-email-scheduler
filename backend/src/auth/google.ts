import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../config/env';
import { prisma } from '../db/prisma';

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(new GoogleStrategy({
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0].value;
      if (!email) {
        return done(new Error('No email found from Google profile'), false);
      }

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            googleId: profile.id,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0].value,
          }
        });
      } else if (!user.googleId) {
        // Update existing user with googleId if they didn't have one
        user = await prisma.user.update({
          where: { email },
          data: { googleId: profile.id, avatarUrl: profile.photos?.[0].value }
        });
      }

      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
));
