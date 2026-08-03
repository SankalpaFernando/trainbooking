import { prisma, redis } from './db';
import { SegmentService } from './segmentService';
import { FareService } from './fareService';
import { BookingStatus } from '@prisma/client';
import crypto from 'crypto';
import { trace } from '@opentelemetry/api';
import { logger, bookingStatusCounter, lockAcquisitionHistogram } from './observability';

export interface CreateBookingDTO {
  seatId: number;
  date: string;
  startStationId: number;
  endStationId: number;
  guestName: string;
  guestNic: string;
  guestMobile: string;
}

export interface CreateMultiBookingLegDTO {
  seatId: number;
  startStationId: number;
  endStationId: number;
}

export interface CreateMultiBookingDTO {
  date: string;
  legs: CreateMultiBookingLegDTO[];
  guestName: string;
  guestNic: string;
  guestMobile: string;
}

export class BookingService {
  private static HOLD_TTL_SECONDS = parseInt(process.env.HOLD_TTL_SECONDS || '300', 10);

  /**
   * Generates unique PNR code: SLR-XXXXXX
   */
  private static generatePNR(): string {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `SLR-${randomHex}`;
  }

  /**
   * Attempts to reserve seat hold for passenger with Redis Distributed Lock & GiST Constraint safety.
   */
  public static async createHoldBooking(dto: CreateBookingDTO) {
    const span = trace.getTracer('railway-booking').startSpan('seat.lock_acquisition');
    const lockKey = `lock:seat:${dto.seatId}:${dto.date}`;
    const start = process.hrtime();

    const acquired = await redis.set(lockKey, 'LOCKED', 'EX', 5, 'NX');

    const [seconds, nanoseconds] = process.hrtime(start);
    const durationSeconds = seconds + nanoseconds / 1e9;
    lockAcquisitionHistogram.observe(durationSeconds);
    span.end();

    if (!acquired) {
      bookingStatusCounter.inc({ status: 'conflict_rejected' });
      logger.warn({ seatId: dto.seatId, date: dto.date }, 'Failed to acquire seat lock');
      throw new Error('Seat lock conflict: another transaction is processing this seat. Please try again.');
    }

    try {
      // 1. Fetch stations & seat
      const startStation = await prisma.station.findUnique({ where: { id: dto.startStationId } });
      const endStation = await prisma.station.findUnique({ where: { id: dto.endStationId } });
      const seat = await prisma.seat.findUnique({ where: { id: dto.seatId }, include: { coach: true } });

      if (!startStation || !endStation || !seat) {
        throw new Error('Invalid station or seat ID');
      }

      if (startStation.sequenceNumber >= endStation.sequenceNumber) {
        throw new Error('Origin station must precede destination station in travel direction');
      }

      // 2. Overlap Check against active bookings
      const overlapSpan = trace.getTracer('railway-booking').startSpan('seat.gist_exclusion_check');
      const existingOverlaps = await prisma.booking.findMany({
        where: {
          seatId: dto.seatId,
          date: dto.date,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      });
      overlapSpan.end();

      const isOverlapping = existingOverlaps.some((b) =>
        SegmentService.isOverlapping(
          startStation.sequenceNumber,
          endStation.sequenceNumber,
          b.startStationSeq,
          b.endStationSeq
        )
      );

      if (isOverlapping) {
        throw new Error('Seat is no longer available for the requested station leg.');
      }

      // 3. Calculate Fare
      const numMatch = seat.seatNumber.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      const isWindowSeat = num > 0 && (num % 6 === 1 || num % 6 === 0);

      const coachData = seat.coach as any;

      const fareResult = FareService.calculateFare({
        startStationSeq: startStation.sequenceNumber,
        endStationSeq: endStation.sequenceNumber,
        classType: seat.coach.classType,
        isWindowSeat,
        pricing: {
          baseFare: coachData.baseFare ?? 100,
          ratePerStation: coachData.ratePerStation ?? 50,
          windowSurcharge: coachData.windowSurcharge ?? 100,
        },
      });

      // 4. Create Pending Booking with Hold Expiry
      const holdExpiresAt = new Date(Date.now() + this.HOLD_TTL_SECONDS * 1000);
      const pnr = this.generatePNR();

      const booking = await prisma.booking.create({
        data: {
          pnr,
          seatId: dto.seatId,
          date: dto.date,
          startStationSeq: startStation.sequenceNumber,
          endStationSeq: endStation.sequenceNumber,
          startStationId: startStation.id,
          endStationId: endStation.id,
          status: BookingStatus.PENDING,
          guestName: dto.guestName,
          guestNic: dto.guestNic,
          guestMobile: dto.guestMobile,
          totalFare: fareResult.totalFare,
          holdExpiresAt,
        },
        include: {
          seat: { include: { coach: true } },
          startStation: true,
          endStation: true,
        },
      });

      bookingStatusCounter.inc({ status: 'pending_hold' });
      logger.info({ pnr: booking.pnr, status: booking.status }, 'Created pending hold booking');

      // 5. Rebuild CQRS Cache for this specific seat in background
      SegmentService.updateSeatAvailabilityInCache(dto.date, dto.seatId).catch((err) => logger.warn({ err }, 'Failed to update granular CQRS cache'));

      return booking;
    } finally {
      await redis.del(lockKey);
    }
  }

  /**
   * Confirms payment for a pending hold booking.
   */
  public static async confirmBooking(pnr: string) {
    const booking = await prisma.booking.findUnique({ where: { pnr } });

    if (!booking) {
      throw new Error(`Booking PNR ${pnr} not found.`);
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      return booking;
    }

    if (booking.status === BookingStatus.EXPIRED || booking.status === BookingStatus.CANCELLED) {
      throw new Error(`Booking hold has ${booking.status.toLowerCase()}. Please initiate a new booking.`);
    }

    if (booking.holdExpiresAt && new Date() > booking.holdExpiresAt) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRED },
      });
      bookingStatusCounter.inc({ status: 'expired' });
      throw new Error('Booking hold expired. Seat released for other passengers.');
    }

    const confirmed = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CONFIRMED },
      include: {
        seat: { include: { coach: true } },
        startStation: true,
        endStation: true,
      },
    });

    bookingStatusCounter.inc({ status: 'confirmed' });
    logger.info({ pnr: confirmed.pnr, status: confirmed.status }, 'Booking confirmed');
    // Status change from PENDING to CONFIRMED doesn't change availability gaps, but we can update it just in case.
    SegmentService.updateSeatAvailabilityInCache(booking.date, booking.seatId).catch((err) => logger.warn({ err }, 'Failed to update granular CQRS cache'));

    return confirmed;
  }

  /**
   * Cleans up expired pending hold reservations.
   */
  public static async asyncAcquireSeatLocks(legs: CreateMultiBookingLegDTO[], date: string) {
    const acquiredKeys: string[] = [];

    try {
      for (const leg of legs) {
        const key = `lock:seat:${leg.seatId}:${date}`;
        const acquired = await redis.set(key, 'LOCKED', 'EX', 5, 'NX');
        if (!acquired) {
          throw new Error('Seat lock conflict: one of the requested seats is currently being processed. Please try again.');
        }
        acquiredKeys.push(key);
      }

      return acquiredKeys;
    } catch (err) {
      if (acquiredKeys.length > 0) {
        await Promise.all(acquiredKeys.map((key) => redis.del(key)));
      }
      throw err;
    }
  }

  public static async asyncReleaseSeatLocks(keys: string[]) {
    if (keys.length === 0) return;
    await Promise.all(keys.map((key) => redis.del(key)));
  }

  public static async createHoldMultiBooking(dto: CreateMultiBookingDTO) {
    if (!dto.legs || dto.legs.length === 0) {
      throw new Error('At least one leg is required for multi-leg booking.');
    }

    const acquiredLocks = await this.asyncAcquireSeatLocks(dto.legs, dto.date);

    try {
      const holdExpiresAt = new Date(Date.now() + this.HOLD_TTL_SECONDS * 1000);

      const bookings = await prisma.$transaction(async (tx) => {
        const created: any[] = [];

        for (const leg of dto.legs) {
          const startStation = await tx.station.findUnique({ where: { id: leg.startStationId } });
          const endStation = await tx.station.findUnique({ where: { id: leg.endStationId } });
          const seat = await tx.seat.findUnique({ where: { id: leg.seatId }, include: { coach: true } });

          if (!startStation || !endStation || !seat) {
            throw new Error('Invalid station or seat ID for one of the legs');
          }

          if (startStation.sequenceNumber >= endStation.sequenceNumber) {
            throw new Error('Origin station must precede destination station in travel direction for each leg');
          }

          const existingOverlaps = await tx.booking.findMany({
            where: {
              seatId: leg.seatId,
              date: dto.date,
              status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
            },
          });

          const isOverlapping = existingOverlaps.some((b) =>
            SegmentService.isOverlapping(
              startStation.sequenceNumber,
              endStation.sequenceNumber,
              b.startStationSeq,
              b.endStationSeq
            )
          );

          if (isOverlapping) {
            throw new Error(`Seat ${seat.seatNumber} is no longer available for one of the requested legs.`);
          }

          const numMatch = seat.seatNumber.match(/\d+/);
          const num = numMatch ? parseInt(numMatch[0]) : 0;
          const isWindowSeat = num > 0 && (num % 6 === 1 || num % 6 === 0);

          const coachData = seat.coach as any;

          const fareResult = FareService.calculateFare({
            startStationSeq: startStation.sequenceNumber,
            endStationSeq: endStation.sequenceNumber,
            classType: seat.coach.classType,
            isWindowSeat,
            pricing: {
              baseFare: coachData.baseFare ?? 100,
              ratePerStation: coachData.ratePerStation ?? 50,
              windowSurcharge: coachData.windowSurcharge ?? 100,
            },
          });

          const pnr = this.generatePNR();

          const booking = await tx.booking.create({
            data: {
              pnr,
              seatId: leg.seatId,
              date: dto.date,
              startStationSeq: startStation.sequenceNumber,
              endStationSeq: endStation.sequenceNumber,
              startStationId: startStation.id,
              endStationId: endStation.id,
              status: BookingStatus.PENDING,
              guestName: dto.guestName,
              guestNic: dto.guestNic,
              guestMobile: dto.guestMobile,
              totalFare: fareResult.totalFare,
              holdExpiresAt,
            },
            include: {
              seat: { include: { coach: true } },
              startStation: true,
              endStation: true,
            },
          });

          created.push(booking);
        }

        return created;
      });

      bookingStatusCounter.inc({ status: 'pending_hold' }, bookings.length);
      logger.info({ count: bookings.length, date: dto.date }, 'Created multi-leg pending hold booking');
      
      for (const leg of dto.legs) {
        SegmentService.updateSeatAvailabilityInCache(dto.date, leg.seatId).catch((err) => logger.warn({ err }, 'Failed to update granular CQRS cache'));
      }
      
      return bookings;
    } finally {
      await this.asyncReleaseSeatLocks(acquiredLocks);
    }
  }

  public static async confirmMultiBooking(pnrs: string[]) {
    if (!pnrs || pnrs.length === 0) {
      throw new Error('At least one PNR is required to confirm a multi-leg booking.');
    }

    const now = new Date();
    let newlyConfirmedCount = 0;
    const datesToRebuild = new Set<string>();

    const confirmedBookings = await prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({ where: { pnr: { in: pnrs } } });

      if (bookings.length !== pnrs.length) {
        throw new Error('One or more PNRs were not found.');
      }

      const confirmed: any[] = [];

      for (const booking of bookings) {
        datesToRebuild.add(booking.date);

        if (booking.status === BookingStatus.CONFIRMED) {
          confirmed.push(booking);
          continue;
        }

        if (booking.status === BookingStatus.EXPIRED || booking.status === BookingStatus.CANCELLED) {
          throw new Error(`Booking with PNR ${booking.pnr} has ${booking.status.toLowerCase()} and cannot be confirmed.`);
        }

        if (booking.holdExpiresAt && now > booking.holdExpiresAt) {
          await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.EXPIRED } });
          bookingStatusCounter.inc({ status: 'expired' });
          throw new Error(`Booking hold for PNR ${booking.pnr} has expired.`);
        }

        const updated = await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CONFIRMED },
          include: {
            seat: { include: { coach: true } },
            startStation: true,
            endStation: true,
          },
        });

        confirmed.push(updated);
        newlyConfirmedCount++;
      }

      return confirmed;
    });

    if (newlyConfirmedCount > 0) {
      bookingStatusCounter.inc({ status: 'confirmed' }, newlyConfirmedCount);
      logger.info({ count: newlyConfirmedCount }, 'Multi-leg bookings confirmed');
      for (const booking of confirmedBookings) {
        SegmentService.updateSeatAvailabilityInCache(booking.date, booking.seatId).catch((err) => logger.warn({ err }, 'Failed to update granular CQRS cache'));
      }
    }

    return confirmedBookings;
  }

  public static async expirePendingHolds() {
    const now = new Date();
    const expired = await prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING,
        holdExpiresAt: { lt: now },
      },
      data: { status: BookingStatus.EXPIRED },
    });

    if (expired.count > 0) {
      bookingStatusCounter.inc({ status: 'expired' }, expired.count);
      logger.info({ count: expired.count }, 'Auto-expired pending hold reservations');
    }
  }

  /**
   * Removes all bookings and waitlists for dates prior to today.
   */
  public static async deletePastBookings() {
    const today = new Date().toISOString().split('T')[0];
    
    const deletedBookings = await prisma.booking.deleteMany({
      where: { date: { lt: today } },
    });
    
    const deletedWaitlists = await prisma.waitlist.deleteMany({
      where: { date: { lt: today } },
    });
    
    if (deletedBookings.count > 0 || deletedWaitlists.count > 0) {
      logger.info(
        { bookings: deletedBookings.count, waitlists: deletedWaitlists.count },
        'Auto-deleted past bookings and waitlists'
      );
    }
  }
}
