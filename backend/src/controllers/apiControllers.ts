import { Request, Response } from 'express';
import { prisma } from '../services/db';
import { SegmentService } from '../services/segmentService';
import { GapFinderService } from '../services/gapFinderService';
import { BookingService } from '../services/bookingService';
import { FareService } from '../services/fareService';
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
      const { seatId, date, startStationId, endStationId, guestName, guestNic, guestMobile } = req.body;

      if (!seatId || !date || !startStationId || !endStationId || !guestName || !guestNic || !guestMobile) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

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
      const { name, type, classType, totalSeats, prefix } = req.body;
      const coach = await prisma.coach.create({
        data: {
          name,
          type: type as CoachType,
          classType: classType as ClassType,
          totalSeats: parseInt(totalSeats, 10),
        },
      });

      if (coach.type === CoachType.RESERVED) {
        for (let i = 1; i <= coach.totalSeats; i++) {
          const numStr = i < 10 ? `0${i}` : `${i}`;
          await prisma.seat.create({
            data: {
              seatNumber: `${prefix || 'X'}-${numStr}`,
              coachId: coach.id,
            },
          });
        }
      }

      return res.json({ success: true, data: coach });
    } catch (e: any) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }
}
