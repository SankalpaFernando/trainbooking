import { prisma, redis } from './db';
import { SegmentService } from './segmentService';
import { FareService } from './fareService';
import { BookingStatus } from '@prisma/client';
import crypto from 'crypto';

export interface CreateBookingDTO {
  seatId: number;
  date: string;
  startStationId: number;
  endStationId: number;
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
    const lockKey = `lock:seat:${dto.seatId}:${dto.date}`;
    
    const acquired = await redis.set(lockKey, 'LOCKED', 'EX', 5, 'NX');

    if (!acquired) {
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
      const existingOverlaps = await prisma.booking.findMany({
        where: {
          seatId: dto.seatId,
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
        throw new Error('Seat is no longer available for the requested station leg.');
      }

      // 3. Calculate Fare
      const fareResult = FareService.calculateFare({
        startStationSeq: startStation.sequenceNumber,
        endStationSeq: endStation.sequenceNumber,
        classType: seat.coach.classType,
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

      // 5. Rebuild CQRS Cache in background
      SegmentService.rebuildAndCacheSeatsAvailability(dto.date).catch(console.error);

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

    SegmentService.rebuildAndCacheSeatsAvailability(booking.date).catch(console.error);

    return confirmed;
  }

  /**
   * Cleans up expired pending hold reservations.
   */
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
      console.log(`Auto-expired ${expired.count} pending hold reservations.`);
    }
  }
}
