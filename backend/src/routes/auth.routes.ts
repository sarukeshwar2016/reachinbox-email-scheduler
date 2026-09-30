import { Router } from 'express';
import passport from 'passport';
import '../auth/google'; // Ensure strategy is loaded

const router = Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect home/dashboard.
    // Ensure we are redirecting to the frontend port (e.g., 5173).
    // In production, backend and frontend might be on the same domain or behind a proxy.
    const frontendUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173';
    res.redirect(frontendUrl);
  }
);

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ success: true, data: req.user });
  } else {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
  }
});

export default router;
