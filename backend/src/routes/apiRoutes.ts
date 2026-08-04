import { Router } from 'express';
import { ApiControllers } from '../controllers/apiControllers';
import { requestDurationHistogram } from '../services/observability';
import { rateLimiter, strictRateLimiter } from '../services/rateLimiterService';

const router = Router();

router.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    requestDurationHistogram.observe(
      {
        method: req.method,
        route: req.originalUrl,
        status: String(res.statusCode),
      },
      durationMs / 1000
    );
    (req as any).log.info({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    }, 'API request completed');
  });
  next();
});

// ---------- Rate Limiting ----------

// Global baseline: 100 requests per minute per IP
const globalLimiter = rateLimiter({
  windowSec: 60,
  maxRequests: 100,
  prefix: 'global',
  message: 'Too many requests from this IP. Please try again later.',
});
router.use(globalLimiter);

// Strict limiter for search/availability (expensive DB + Redis queries)
const searchLimiter = strictRateLimiter({
  windowSec: 60,
  maxRequests: 10,
  prefix: 'search',
  message: 'Too many search requests. Please wait before searching again.',
});

// Strict limiter for booking operations
const bookingLimiter = strictRateLimiter({
  windowSec: 60,
  maxRequests: 5,
  prefix: 'booking',
  message: 'Too many booking attempts. Please slow down.',
});

// Daily strict limiter to prevent scalping
const dailyBookingLimiter = strictRateLimiter({
  windowSec: 86400, // 24 hours
  maxRequests: 5,
  prefix: 'daily_booking',
  message: 'Daily booking limit reached. You can only create up to 5 bookings per day from this IP.',
});

// Strict limiter for login attempts
const loginLimiter = strictRateLimiter({
  windowSec: 300,
  maxRequests: 5,
  prefix: 'login',
  message: 'Too many login attempts. Please try again in 5 minutes.',
});

import bcrypt from 'bcryptjs';
import { prisma } from '../services/db';

// ---------- Admin Auth ----------

const requireAdminAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [username, password] = credentials.split(':');

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Attach user to req if needed
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

// ---------- Routes ----------

router.post('/admin/login', loginLimiter, async (req: any, res: any) => {
  const { username, password } = req.body || {};

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (user && user.role === 'ADMIN') {
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) {
        const token = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
        return res.json({ success: true, data: { token } });
      }
    }
    return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Infrastructure & Master Data
router.get('/stations', ApiControllers.getStations);
router.get('/coaches', ApiControllers.getCoaches);

// Seat Availability & Mixed Ticket Gap Finder (rate limited)
router.get('/seats/availability', searchLimiter, ApiControllers.getSeatsAvailability);
router.get('/seats/mixed-tickets', searchLimiter, ApiControllers.getMixedTickets);

// Booking Transactions & Holds (rate limited)
router.post('/bookings/hold', bookingLimiter, dailyBookingLimiter, ApiControllers.createHoldBooking);
router.post('/bookings/hold-multi', bookingLimiter, dailyBookingLimiter, ApiControllers.createHoldMultiBooking);
router.post('/bookings/confirm', bookingLimiter, ApiControllers.confirmBooking);
router.post('/bookings/confirm-multi', bookingLimiter, ApiControllers.confirmMultiBooking);
router.get('/bookings/lookup/:pnr', ApiControllers.lookupPNR);

// Waitlist
router.post('/waitlist', bookingLimiter, ApiControllers.addToWaitlist);

// Department Admin Portal
router.get('/admin/analytics', requireAdminAuth, ApiControllers.getAdminAnalytics);
router.get('/admin/settings', ApiControllers.getSettings); // Public read for frontend
router.put('/admin/settings', requireAdminAuth, ApiControllers.updateSettings); // Admin only update
router.post('/admin/coaches', requireAdminAuth, ApiControllers.createCoach);
router.put('/admin/coaches/:id/pricing', requireAdminAuth, ApiControllers.updateCoachPricing);
router.delete('/admin/coaches/:id', requireAdminAuth, ApiControllers.deleteCoach);
router.get('/admin/users', requireAdminAuth, ApiControllers.getUsers);
router.post('/admin/users', requireAdminAuth, ApiControllers.createUser);
router.put('/admin/users/:id', requireAdminAuth, ApiControllers.updateUser);
router.delete('/admin/users/:id', requireAdminAuth, ApiControllers.deleteUser);

// Ticket Checker Portal
router.post('/checker/login', loginLimiter, ApiControllers.checkerLogin);
router.get('/checker/scan/:pnr', ApiControllers.validateTicket);

export default router;

