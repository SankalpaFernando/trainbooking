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

// Strict limiter for login attempts
const loginLimiter = strictRateLimiter({
  windowSec: 300,
  maxRequests: 5,
  prefix: 'login',
  message: 'Too many login attempts. Please try again in 5 minutes.',
});

// ---------- Admin Auth ----------

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const requireAdminAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization || '';
  const expected = 'Basic ' + Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');

  if (authHeader === expected) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).json({ success: false, error: 'Unauthorized' });
};

// ---------- Routes ----------

router.post('/admin/login', loginLimiter, (req: any, res: any) => {
  const { username, password } = req.body || {};

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = 'Basic ' + Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
    return res.json({ success: true, data: { token } });
  }

  return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
});

// Infrastructure & Master Data
router.get('/stations', ApiControllers.getStations);
router.get('/coaches', ApiControllers.getCoaches);

// Seat Availability & Mixed Ticket Gap Finder (rate limited)
router.get('/seats/availability', searchLimiter, ApiControllers.getSeatsAvailability);
router.get('/seats/mixed-tickets', searchLimiter, ApiControllers.getMixedTickets);

// Booking Transactions & Holds (rate limited)
router.post('/bookings/hold', bookingLimiter, ApiControllers.createHoldBooking);
router.post('/bookings/hold-multi', bookingLimiter, ApiControllers.createHoldMultiBooking);
router.post('/bookings/confirm', bookingLimiter, ApiControllers.confirmBooking);
router.post('/bookings/confirm-multi', bookingLimiter, ApiControllers.confirmMultiBooking);
router.get('/bookings/lookup/:pnr', ApiControllers.lookupPNR);

// Waitlist
router.post('/waitlist', bookingLimiter, ApiControllers.addToWaitlist);

// Department Admin Portal
router.get('/admin/analytics', requireAdminAuth, ApiControllers.getAdminAnalytics);
router.post('/admin/coaches', requireAdminAuth, ApiControllers.createCoach);
router.put('/admin/coaches/:id/pricing', requireAdminAuth, ApiControllers.updateCoachPricing);
router.delete('/admin/coaches/:id', requireAdminAuth, ApiControllers.deleteCoach);
router.get('/admin/checkers', requireAdminAuth, ApiControllers.getCheckers);
router.post('/admin/checkers', requireAdminAuth, ApiControllers.createChecker);
router.put('/admin/checkers/:id', requireAdminAuth, ApiControllers.updateChecker);
router.delete('/admin/checkers/:id', requireAdminAuth, ApiControllers.deleteChecker);

// Ticket Checker Portal
router.post('/checker/login', loginLimiter, ApiControllers.checkerLogin);
router.get('/checker/scan/:pnr', ApiControllers.validateTicket);

export default router;

