import { Router } from 'express';
import { ApiControllers } from '../controllers/apiControllers';
import { requestDurationHistogram } from '../services/observability';

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

router.post('/admin/login', (req: any, res: any) => {
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

// Seat Availability & Mixed Ticket Gap Finder
router.get('/seats/availability', ApiControllers.getSeatsAvailability);
router.get('/seats/mixed-tickets', ApiControllers.getMixedTickets);

// Booking Transactions & Holds
router.post('/bookings/hold', ApiControllers.createHoldBooking);
router.post('/bookings/hold-multi', ApiControllers.createHoldMultiBooking);
router.post('/bookings/confirm', ApiControllers.confirmBooking);
router.post('/bookings/confirm-multi', ApiControllers.confirmMultiBooking);
router.get('/bookings/lookup/:pnr', ApiControllers.lookupPNR);

// Waitlist
router.post('/waitlist', ApiControllers.addToWaitlist);

// Department Admin Portal
router.get('/admin/analytics', requireAdminAuth, ApiControllers.getAdminAnalytics);
router.post('/admin/coaches', requireAdminAuth, ApiControllers.createCoach);
router.put('/admin/coaches/:id/pricing', requireAdminAuth, ApiControllers.updateCoachPricing);

export default router;
