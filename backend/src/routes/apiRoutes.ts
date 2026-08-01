import { Router } from 'express';
import { ApiControllers } from '../controllers/apiControllers';

const router = Router();

// Infrastructure & Master Data
router.get('/stations', ApiControllers.getStations);
router.get('/coaches', ApiControllers.getCoaches);

// Seat Availability & Mixed Ticket Gap Finder
router.get('/seats/availability', ApiControllers.getSeatsAvailability);
router.get('/seats/mixed-tickets', ApiControllers.getMixedTickets);

// Booking Transactions & Holds
router.post('/bookings/hold', ApiControllers.createHoldBooking);
router.post('/bookings/confirm', ApiControllers.confirmBooking);
router.get('/bookings/lookup/:pnr', ApiControllers.lookupPNR);

// Waitlist
router.post('/waitlist', ApiControllers.addToWaitlist);

// Department Admin Portal
router.get('/admin/analytics', ApiControllers.getAdminAnalytics);
router.post('/admin/coaches', ApiControllers.createCoach);

export default router;
