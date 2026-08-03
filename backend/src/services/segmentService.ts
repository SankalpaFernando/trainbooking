import { prisma, redis } from './db';
import { BookingStatus } from '@prisma/client';
import { cacheHitsCounter, cacheMissesCounter, occupancyRatioGauge } from './observability';

export interface Interval {
  startSeq: number;
  endSeq: number;
}

export interface SeatGapSummary {
  seatId: number;
  seatNumber: string;
  coachId: number;
  coachName: string;
  coachType: string;
  classType: string;
  occupiedIntervals: Interval[];
  availableGaps: Interval[];
  isFullyAvailableForRoute: boolean;
  isAvailableForRequestedLeg: boolean;
  isWindowSeat: boolean;
  baseFare: number;
  ratePerStation: number;
  windowSurcharge: number;
}

export class SegmentService {
  /**
   * Evaluates if two station sequence ranges overlap.
   * Note: Station ranges are semi-open [startSeq, endSeq).
   * E.g. [1, 8) and [8, 18) do NOT overlap.
   */
  public static isOverlapping(
    reqStart: number,
    reqEnd: number,
    existStart: number,
    existEnd: number
  ): boolean {
    return reqStart < existEnd && reqEnd > existStart;
  }

  /**
   * Calculates empty gaps for a seat given its active bookings across minSeq to maxSeq route.
   */
  public static calculateGaps(
    bookings: { startStationSeq: number; endStationSeq: number }[],
    minSeq: number = 1,
    maxSeq: number = 18
  ): { occupied: Interval[]; gaps: Interval[] } {
    // Sort bookings by startStationSeq ascending
    const sorted = [...bookings].sort((a, b) => a.startStationSeq - b.startStationSeq);

    const occupied: Interval[] = [];
    const gaps: Interval[] = [];

    let pointer = minSeq;

    for (const b of sorted) {
      if (b.startStationSeq > pointer) {
        gaps.push({ startSeq: pointer, endSeq: b.startStationSeq });
      }
      occupied.push({ startSeq: b.startStationSeq, endSeq: b.endStationSeq });
      pointer = Math.max(pointer, b.endStationSeq);
    }

    if (pointer < maxSeq) {
      gaps.push({ startSeq: pointer, endSeq: maxSeq });
    }

    return { occupied, gaps };
  }

  public static async getSeatsAvailability(
    date: string,
    reqStart: number,
    reqEnd: number,
    coachIdFilter?: number
  ): Promise<SeatGapSummary[]> {
    const cacheKey = `cache:seatGaps:${date}`;
    
    // Check Redis Hash Cache
    let cachedStrings: string[] = [];
    try {
      cachedStrings = await redis.hvals(cacheKey);
    } catch (e) {
      console.warn('Redis read failed, falling back to database query:', e);
    }

    let summaries: SeatGapSummary[] = [];

    if (cachedStrings.length > 0) {
      cacheHitsCounter.inc();
      const allSummaries: SeatGapSummary[] = cachedStrings.map(s => JSON.parse(s));
      summaries = allSummaries.map((s) => ({
        ...s,
        isAvailableForRequestedLeg: !s.occupiedIntervals.some((occ) =>
          this.isOverlapping(reqStart, reqEnd, occ.startSeq, occ.endSeq)
        ),
      }));
    } else {
      cacheMissesCounter.inc();
      summaries = await this.rebuildAndCacheSeatsAvailability(date, reqStart, reqEnd);
    }

    const totalSeats = summaries.length;
    if (totalSeats > 0) {
      const unavailableSeats = summaries.filter((s) => !s.isAvailableForRequestedLeg).length;
      occupancyRatioGauge.set({ start_station: String(reqStart), end_station: String(reqEnd) }, unavailableSeats / totalSeats);
    }

    if (coachIdFilter) {
      return summaries.filter((s) => s.coachId === coachIdFilter);
    }

    return summaries;
  }

  /**
   * Rebuilds CQRS seat availability snapshot for a given date and saves to Redis.
   */
  public static async rebuildAndCacheSeatsAvailability(
    date: string,
    reqStart: number = 1,
    reqEnd: number = 18
  ): Promise<SeatGapSummary[]> {
    const minStation = await prisma.station.findFirst({ orderBy: { sequenceNumber: 'asc' } });
    const maxStation = await prisma.station.findFirst({ orderBy: { sequenceNumber: 'desc' } });

    const minSeq = minStation ? minStation.sequenceNumber : 1;
    const maxSeq = maxStation ? maxStation.sequenceNumber : 18;

    const seats = await prisma.seat.findMany({
      include: {
        coach: true,
        bookings: {
          where: {
            date,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
          },
          select: {
            startStationSeq: true,
            endStationSeq: true,
          },
        },
      },
      orderBy: [{ coachId: 'asc' }, { seatNumber: 'asc' }],
    });

    const summaries: SeatGapSummary[] = seats.map((seat) => {
      const { occupied, gaps } = this.calculateGaps(seat.bookings, minSeq, maxSeq);

      const isFullyAvailableForRoute = gaps.length === 1 && gaps[0].startSeq === minSeq && gaps[0].endSeq === maxSeq;
      const isAvailableForRequestedLeg = !occupied.some((occ) =>
        this.isOverlapping(reqStart, reqEnd, occ.startSeq, occ.endSeq)
      );

      const numMatch = seat.seatNumber.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      const isWindowSeat = num > 0 && (num % 6 === 1 || num % 6 === 0);
      const coachData = seat.coach as any;

      return {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        coachId: seat.coachId,
        coachName: seat.coach.name,
        coachType: seat.coach.type,
        classType: seat.coach.classType,
        occupiedIntervals: occupied,
        availableGaps: gaps,
        isFullyAvailableForRoute,
        isAvailableForRequestedLeg,
        isWindowSeat,
        baseFare: coachData.baseFare ?? 100,
        ratePerStation: coachData.ratePerStation ?? 50,
        windowSurcharge: coachData.windowSurcharge ?? 100,
      };
    });

    // Write to Redis Hash cache
    try {
      const cacheKey = `cache:seatGaps:${date}`;
      const pipeline = redis.pipeline();
      for (const summary of summaries) {
        pipeline.hset(cacheKey, String(summary.seatId), JSON.stringify(summary));
      }
      pipeline.expire(cacheKey, 3600); // 1 hour TTL for the hash
      await pipeline.exec();
    } catch (e) {
      console.warn('Failed to set Redis Hash cache:', e);
    }

    return summaries;
  }

  /**
   * Updates a single seat's availability in the granular Redis Hash cache.
   * Called by BookingService upon booking creation/confirmation/expiration.
   */
  public static async updateSeatAvailabilityInCache(date: string, seatId: number): Promise<void> {
    try {
      const cacheKey = `cache:seatGaps:${date}`;
      const exists = await redis.exists(cacheKey);
      if (!exists) {
        // Cache is empty, no need to update granularly, it will rebuild on next fetch
        return;
      }

      const minStation = await prisma.station.findFirst({ orderBy: { sequenceNumber: 'asc' } });
      const maxStation = await prisma.station.findFirst({ orderBy: { sequenceNumber: 'desc' } });
      const minSeq = minStation ? minStation.sequenceNumber : 1;
      const maxSeq = maxStation ? maxStation.sequenceNumber : 18;

      const seat = await prisma.seat.findUnique({
        where: { id: seatId },
        include: {
          coach: true,
          bookings: {
            where: {
              date,
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
            },
            select: {
              startStationSeq: true,
              endStationSeq: true,
            },
          },
        },
      });

      if (!seat) return;

      const { occupied, gaps } = this.calculateGaps(seat.bookings, minSeq, maxSeq);
      const isFullyAvailableForRoute = gaps.length === 1 && gaps[0].startSeq === minSeq && gaps[0].endSeq === maxSeq;
      const numMatch = seat.seatNumber.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      const isWindowSeat = num > 0 && (num % 6 === 1 || num % 6 === 0);
      const coachData = seat.coach as any;

      const summary: SeatGapSummary = {
        seatId: seat.id,
        seatNumber: seat.seatNumber,
        coachId: seat.coachId,
        coachName: seat.coach.name,
        coachType: seat.coach.type,
        classType: seat.coach.classType,
        occupiedIntervals: occupied,
        availableGaps: gaps,
        isFullyAvailableForRoute,
        isAvailableForRequestedLeg: true, // Will be dynamically computed on fetch
        isWindowSeat,
        baseFare: coachData.baseFare ?? 100,
        ratePerStation: coachData.ratePerStation ?? 50,
        windowSurcharge: coachData.windowSurcharge ?? 100,
      };

      await redis.hset(cacheKey, String(seatId), JSON.stringify(summary));
    } catch (e) {
      console.warn(`Failed to update granular Redis cache for seat ${seatId}:`, e);
    }
  }
}
