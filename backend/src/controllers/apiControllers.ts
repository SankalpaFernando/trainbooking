import { Request, Response } from 'express';
import { prisma } from '../services/db';
import { SegmentService } from '../services/segmentService';
import { GapFinderService } from '../services/gapFinderService';
import { BookingService } from '../services/bookingService';
import { FareService } from '../services/fareService';
import { RecaptchaService } from '../services/recaptchaService';
import { ValidationService } from '../services/validationService';
import { AnalyticsService } from '../services/analyticsService';
import { BookingStatus, CoachType, ClassType } from '@prisma/client';

export class ApiControllers {
  /**
   * GET /api/stations
   */
  public static async getStations(req: Request, res: Response) {
    try {
      const stations = await prisma.station.findMany({ orderBy: { sequenceNumber: 'asc' } });
      return res.json({ success: true, data: stations });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * GET /api/coaches
   */
  public static async getCoaches(req: Request, res: Response) {
    try {
      const coaches = await prisma.coach.findMany({
        include: { seats: { orderBy: { seatNumber: 'asc' } } },
        orderBy: { id: 'asc' },
      });
      return res.json({ success: true, data: coaches });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * PUT /api/admin/coaches/:id/pricing
   */
  public static async updateCoachPricing(req: Request, res: Response) {
    try {
      const coachId = parseInt(req.params.id, 10);
      const { baseFare, ratePerStation, windowSurcharge } = req.body;

      if (isNaN(coachId)) {
        return res.status(400).json({ success: false, error: 'Invalid coach ID' });
      }

      if (baseFare === undefined || ratePerStation === undefined || windowSurcharge === undefined) {
        return res.status(400).json({ success: false, error: 'Missing pricing parameters' });
      }

      const updatedCoach = await prisma.coach.update({
        where: { id: coachId },
        data: {
          baseFare: parseFloat(baseFare),
          ratePerStation: parseFloat(ratePerStation),
          windowSurcharge: parseFloat(windowSurcharge),
        },
      });

      // We should ideally invalidate the segment availability cache here as fares might be cached,
      // but fares are mostly calculated on the fly or embedded. We can clear today's cache if needed.
      // SegmentService.rebuildAndCacheSeatsAvailability(new Date().toISOString().split('T')[0]);

      return res.json({ success: true, data: updatedCoach });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * GET /api/seats/availability?date=2026-08-01&originId=1&destinationId=8&coachId=1
   */
  public static async getSeatsAvailability(req: Request, res: Response) {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const originId = parseInt(req.query.originId as string, 10);
      const destinationId = parseInt(req.query.destinationId as string, 10);
      const coachIdFilter = req.query.coachId ? parseInt(req.query.coachId as string, 10) : undefined;

      if (isNaN(originId) || isNaN(destinationId)) {
        return res.status(400).json({ success: false, error: 'originId and destinationId query parameters are required' });
      }

      const startStation = await prisma.station.findUnique({ where: { id: originId } });
      const endStation = await prisma.station.findUnique({ where: { id: destinationId } });

      if (!startStation || !endStation) {
        return res.status(404).json({ success: false, error: 'Origin or Destination station not found' });
      }

      const fareEstimate = FareService.calculateFare({
        startStationSeq: startStation.sequenceNumber,
        endStationSeq: endStation.sequenceNumber,
      });

      const seatSummaries = await SegmentService.getSeatsAvailability(
        date,
        startStation.sequenceNumber,
        endStation.sequenceNumber,
        coachIdFilter
      );

      return res.json({
        success: true,
        data: {
          date,
          origin: startStation,
          destination: endStation,
          fareEstimate,
          seats: seatSummaries,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * GET /api/seats/mixed-tickets?date=2026-08-01&originId=1&destinationId=18
   */
  public static async getMixedTickets(req: Request, res: Response) {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const originId = parseInt(req.query.originId as string, 10);
      const destinationId = parseInt(req.query.destinationId as string, 10);

      const startStation = await prisma.station.findUnique({ where: { id: originId } });
      const endStation = await prisma.station.findUnique({ where: { id: destinationId } });

      if (!startStation || !endStation) {
        return res.status(404).json({ success: false, error: 'Origin or Destination station not found' });
      }

      const recommendations = await GapFinderService.findMixedTickets(
        date,
        startStation.sequenceNumber,
        endStation.sequenceNumber
      );

      return res.json({ success: true, data: recommendations });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * POST /api/bookings/hold
   */
  public static async createHoldBooking(req: Request, res: Response) {
    try {
      const { seatId, date, startStationId, endStationId, guestName, guestNic, guestMobile, captchaToken } = req.body;

      if (!seatId || !date || !startStationId || !endStationId || !guestName || !guestNic || !guestMobile || !captchaToken) {
        return res.status(400).json({ success: false, error: 'All fields including captchaToken are required' });
      }

      if (!ValidationService.isValidSriLankanNic(guestNic)) {
        return res.status(400).json({ success: false, error: 'Invalid NIC or passport format' });
      }

      if (!ValidationService.isValidSriLankanPhone(guestMobile)) {
        return res.status(400).json({ success: false, error: 'Invalid Sri Lankan mobile number' });
      }

      await RecaptchaService.verifyToken(captchaToken, req.ip);

      const booking = await BookingService.createHoldBooking({
        seatId: parseInt(seatId, 10),
        date,
        startStationId: parseInt(startStationId, 10),
        endStationId: parseInt(endStationId, 10),
        guestName,
        guestNic,
        guestMobile,
      });

      return res.json({ success: true, data: booking });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  /**
   * POST /api/bookings/hold-multi
   */
  public static async createHoldMultiBooking(req: Request, res: Response) {
    try {
      const { date, legs, guestName, guestNic, guestMobile, captchaToken } = req.body;

      if (!date || !legs || !Array.isArray(legs) || legs.length === 0 || !guestName || !guestNic || !guestMobile || !captchaToken) {
        return res.status(400).json({ success: false, error: 'All multi-leg booking fields including captchaToken are required' });
      }

      if (!ValidationService.isValidSriLankanNic(guestNic)) {
        return res.status(400).json({ success: false, error: 'Invalid NIC or passport format' });
      }

      if (!ValidationService.isValidSriLankanPhone(guestMobile)) {
        return res.status(400).json({ success: false, error: 'Invalid Sri Lankan mobile number' });
      }

      await RecaptchaService.verifyToken(captchaToken, req.ip);

      const booking = await BookingService.createHoldMultiBooking({
        date,
        legs: legs.map((leg: any) => ({
          seatId: parseInt(leg.seatId, 10),
          startStationId: parseInt(leg.startStationId, 10),
          endStationId: parseInt(leg.endStationId, 10),
        })),
        guestName,
        guestNic,
        guestMobile,
      });

      return res.json({ success: true, data: booking });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  /**
   * POST /api/bookings/confirm
   */
  public static async confirmBooking(req: Request, res: Response) {
    try {
      const { pnr } = req.body;
      if (!pnr) {
        return res.status(400).json({ success: false, error: 'PNR is required' });
      }

      const confirmed = await BookingService.confirmBooking(pnr);
      return res.json({ success: true, data: confirmed });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  /**
   * POST /api/bookings/confirm-multi
   */
  public static async confirmMultiBooking(req: Request, res: Response) {
    try {
      const { pnrs } = req.body;
      if (!Array.isArray(pnrs) || pnrs.length === 0) {
        return res.status(400).json({ success: false, error: 'PNRs are required to confirm a multi-leg booking' });
      }

      const confirmed = await BookingService.confirmMultiBooking(pnrs);
      return res.json({ success: true, data: confirmed });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  /**
   * GET /api/bookings/lookup/:pnr
   */
  public static async lookupPNR(req: Request, res: Response) {
    try {
      const pnr = req.params.pnr;
      const booking = await prisma.booking.findUnique({
        where: { pnr },
        include: {
          seat: { include: { coach: true } },
          startStation: true,
          endStation: true,
        },
      });

      if (!booking) {
        return res.status(404).json({ success: false, error: 'PNR not found' });
      }

      return res.json({ success: true, data: booking });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * POST /api/waitlist
   */
  public static async addToWaitlist(req: Request, res: Response) {
    try {
      const { date, startStationId, endStationId, guestName, guestNic, guestMobile } = req.body;

      const startStation = await prisma.station.findUnique({ where: { id: parseInt(startStationId, 10) } });
      const endStation = await prisma.station.findUnique({ where: { id: parseInt(endStationId, 10) } });

      if (!startStation || !endStation) {
        return res.status(404).json({ success: false, error: 'Station not found' });
      }

      if (!guestName || !guestNic || !guestMobile) {
        return res.status(400).json({ success: false, error: 'Name, NIC, and mobile are all required' });
      }

      if (!ValidationService.isValidSriLankanNic(guestNic)) {
        return res.status(400).json({ success: false, error: 'Invalid NIC or passport format' });
      }

      if (!ValidationService.isValidSriLankanPhone(guestMobile)) {
        return res.status(400).json({ success: false, error: 'Invalid Sri Lankan mobile number' });
      }

      const waitlist = await prisma.waitlist.create({
        data: {
          date,
          startStationSeq: startStation.sequenceNumber,
          endStationSeq: endStation.sequenceNumber,
          startStationId: startStation.id,
          endStationId: endStation.id,
          guestName,
          guestNic,
          guestMobile,
        },
        include: { startStation: true, endStation: true },
      });

      return res.json({ success: true, data: waitlist });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * GET /api/admin/analytics?date=2026-08-01
   */
  public static async getAdminAnalytics(req: Request, res: Response) {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const analytics = await AnalyticsService.getDepartmentAnalytics(date);
      return res.json({ success: true, data: analytics });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * POST /api/admin/coaches
   */
  public static async createCoach(req: Request, res: Response) {
    try {
      const { name, type, classType, rows, seatsPerRow, prefix } = req.body;
      const parsedRows = parseInt(rows, 10);
      const parsedSeatsPerRow = parseInt(seatsPerRow, 10);
      const totalSeats = parsedRows * parsedSeatsPerRow;

      const coach = await prisma.coach.create({
        data: {
          name,
          type: type as CoachType,
          classType: classType as ClassType,
          totalSeats: totalSeats,
          rows: parsedRows,
          seatsPerRow: parsedSeatsPerRow,
        },
      });

      if (coach.type === CoachType.RESERVED) {
        const seats = [];
        for (let i = 1; i <= coach.totalSeats; i++) {
          const numStr = i < 10 ? `0${i}` : `${i}`;
          seats.push({
            seatNumber: `${prefix || 'X'}-${numStr}`,
            coachId: coach.id,
          });
        }
        await prisma.seat.createMany({ data: seats });
      }

      return res.json({ success: true, data: coach });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  /**
   * DELETE /api/admin/coaches/:id
   */
  public static async deleteCoach(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid coach ID' });
      }

      // Check if any bookings exist for seats in this coach
      const existingBooking = await prisma.booking.findFirst({
        where: { seat: { coachId: id } },
      });

      if (existingBooking) {
        return res.status(400).json({ success: false, error: 'Cannot delete coach with existing bookings' });
      }

      await prisma.coach.delete({ where: { id } });
      return res.json({ success: true, data: { deleted: true } });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // --- TICKET CHECKER & ADMIN ENDPOINTS ---

  /**
   * POST /api/checker/login
   */
  public static async checkerLogin(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const checker = await prisma.ticketChecker.findUnique({ where: { username } });
      
      if (!checker || checker.password !== password) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      // Simple token for demonstration (in production, use JWT)
      const token = 'Checker ' + Buffer.from(`${username}:${password}`).toString('base64');
      return res.json({ success: true, data: { token, username } });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * GET /api/checker/scan/:pnr
   */
  public static async validateTicket(req: Request, res: Response) {
    try {
      const { pnr } = req.params;
      const booking = await prisma.booking.findUnique({
        where: { pnr },
        include: {
          seat: { include: { coach: true } },
          startStation: true,
          endStation: true,
        },
      });

      if (!booking) {
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      return res.json({ success: true, data: booking });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * POST /api/admin/checkers
   */
  public static async createChecker(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required' });
      }

      const existing = await prisma.ticketChecker.findUnique({ where: { username } });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Username already exists' });
      }

      const checker = await prisma.ticketChecker.create({
        data: { username, password },
      });
      return res.json({ success: true, data: checker });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * GET /api/admin/checkers
   */
  public static async getCheckers(req: Request, res: Response) {
    try {
      const checkers = await prisma.ticketChecker.findMany({
        select: { id: true, username: true, createdAt: true },
        orderBy: { id: 'asc' },
      });
      return res.json({ success: true, data: checkers });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * PUT /api/admin/checkers/:id
   */
  public static async updateChecker(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, error: 'Password required' });
      }

      const checker = await prisma.ticketChecker.update({
        where: { id },
        data: { password },
      });
      return res.json({ success: true, data: checker });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * DELETE /api/admin/checkers/:id
   */
  public static async deleteChecker(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      await prisma.ticketChecker.delete({
        where: { id },
      });
      return res.json({ success: true, data: { deleted: true } });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}
