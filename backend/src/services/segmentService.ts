import { prisma, redis } from './db';
import { BookingStatus } from '@prisma/client';

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

  /**
   * Retrieves seat availability across all seats for a specific date and requested leg [reqStart, reqEnd].
   * Uses Redis CQRS cache if available, falling back to DB and populating Redis cache.
   */
  public static async getSeatsAvailability(
    date: string,
    reqStart: number,
    reqEnd: number,
    coachIdFilter?: number
  ): Promise<SeatGapSummary[]> {
    const cacheKey = `cache:seats:${date}`;
    
    // Check Redis CQRS Cache
    let cachedData: string | null = null;
    try {
      cachedData = await redis.get(cacheKey);
    } catch (e) {
      console.warn('Redis read failed, falling back to database query:', e);
    }

    let summaries: SeatGapSummary[];

    if (cachedData) {
      const allSummaries: SeatGapSummary[] = JSON.parse(cachedData);
      summaries = allSummaries.map((s) => ({
        ...s,
        isAvailableForRequestedLeg: !s.occupiedIntervals.some((occ) =>
          this.isOverlapping(reqStart, reqEnd, occ.startSeq, occ.endSeq)
        ),
      }));
    } else {
      // Fetch from Database
      summaries = await this.rebuildAndCacheSeatsAvailability(date, reqStart, reqEnd);
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
      };
    });

    // Write to Redis CQRS cache with 60-second TTL
    try {
      await redis.set(`cache:seats:${date}`, JSON.stringify(summaries), 'EX', 60);
    } catch (e) {
      console.warn('Failed to set Redis CQRS cache:', e);
    }

    return summaries;
  }
}
