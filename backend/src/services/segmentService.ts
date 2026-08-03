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
    const isReqUp = reqStart < reqEnd;
    const isExistUp = existStart < existEnd;
    
    // Up and Down journeys do not overlap with each other
    if (isReqUp !== isExistUp) return false;

    const normReqStart = Math.min(reqStart, reqEnd);
    const normReqEnd = Math.max(reqStart, reqEnd);
    const normExistStart = Math.min(existStart, existEnd);
    const normExistEnd = Math.max(existStart, existEnd);

    return normReqStart < normExistEnd && normReqEnd > normExistStart;
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
    const isUp = reqStart < reqEnd;
    const cacheKey = `cache:seatGaps:${date}:${isUp ? 'UP' : 'DOWN'}`;
    
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
          this.isOverlapping(reqStart, reqEnd, occ.startSeq, occ.endSeq, true)
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

    const buildSummaries = (isUp: boolean) => seats.map((seat) => {
      let bookings = seat.bookings;
      if (isUp) {
        bookings = bookings.filter(b => b.startStationSeq < b.endStationSeq);
      } else {
        bookings = bookings.filter(b => b.startStationSeq > b.endStationSeq).map(b => ({
          startStationSeq: b.endStationSeq,
          endStationSeq: b.startStationSeq
        }));
      }

      const { occupied, gaps } = this.calculateGaps(bookings, minSeq, maxSeq);

      const isFullyAvailableForRoute = gaps.length === 1 && gaps[0].startSeq === minSeq && gaps[0].endSeq === maxSeq;
      const isAvailableForRequestedLeg = !occupied.some((occ) =>
        this.isOverlapping(reqStart, reqEnd, occ.startSeq, occ.endSeq, true)
      );

      const numMatch = seat.seatNumber.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      
      let seatsPerRow = 6;
      if (seat.coach.classType === 'FIRST_CLASS') seatsPerRow = 4;
      else if (seat.coach.classType === 'SECOND_CLASS') seatsPerRow = 5;
      
      const isWindowSeat = num > 0 && (num % seatsPerRow === 1 || num % seatsPerRow === 0);
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
      } as SeatGapSummary;
    });

    const upSummaries = buildSummaries(true);
    const downSummaries = buildSummaries(false);

    // Write to Redis Hash cache
    try {
      const upCacheKey = `cache:seatGaps:${date}:UP`;
      const downCacheKey = `cache:seatGaps:${date}:DOWN`;
      const pipeline = redis.pipeline();
      for (const summary of upSummaries) {
        pipeline.hset(upCacheKey, String(summary.seatId), JSON.stringify(summary));
      }
      for (const summary of downSummaries) {
        pipeline.hset(downCacheKey, String(summary.seatId), JSON.stringify(summary));
      }
      pipeline.expire(upCacheKey, 3600); // 1 hour TTL
      pipeline.expire(downCacheKey, 3600);
      await pipeline.exec();
    } catch (e) {
      console.warn('Failed to set Redis Hash cache:', e);
    }

    const isReqUp = reqStart < reqEnd;
    return isReqUp ? upSummaries : downSummaries;
  }

  /**
   * Updates a single seat's availability in the granular Redis Hash cache.
   * Called by BookingService upon booking creation/confirmation/expiration.
   */
  public static async updateSeatAvailabilityInCache(date: string, seatId: number): Promise<void> {
    try {
      const upCacheKey = `cache:seatGaps:${date}:UP`;
      const downCacheKey = `cache:seatGaps:${date}:DOWN`;
      const existsUp = await redis.exists(upCacheKey);
      const existsDown = await redis.exists(downCacheKey);
      
      if (!existsUp && !existsDown) {
        // Cache is empty, no need to update granularly
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

      const buildSummary = (isUp: boolean): SeatGapSummary => {
        let bookings = seat.bookings;
        if (isUp) {
          bookings = bookings.filter(b => b.startStationSeq < b.endStationSeq);
        } else {
          bookings = bookings.filter(b => b.startStationSeq > b.endStationSeq).map(b => ({
            startStationSeq: b.endStationSeq,
            endStationSeq: b.startStationSeq
          }));
        }

        const { occupied, gaps } = this.calculateGaps(bookings, minSeq, maxSeq);
        const isFullyAvailableForRoute = gaps.length === 1 && gaps[0].startSeq === minSeq && gaps[0].endSeq === maxSeq;
        const numMatch = seat.seatNumber.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0]) : 0;
        
        let seatsPerRow = 6;
        if (seat.coach.classType === 'FIRST_CLASS') seatsPerRow = 4;
        else if (seat.coach.classType === 'SECOND_CLASS') seatsPerRow = 5;
        
        const isWindowSeat = num > 0 && (num % seatsPerRow === 1 || num % seatsPerRow === 0);
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
          isAvailableForRequestedLeg: true, // Will be dynamically computed on fetch
          isWindowSeat,
          baseFare: coachData.baseFare ?? 100,
          ratePerStation: coachData.ratePerStation ?? 50,
          windowSurcharge: coachData.windowSurcharge ?? 100,
        };
      };

      if (existsUp) await redis.hset(upCacheKey, String(seatId), JSON.stringify(buildSummary(true)));
      if (existsDown) await redis.hset(downCacheKey, String(seatId), JSON.stringify(buildSummary(false)));
    } catch (e) {
      console.warn(`Failed to update granular Redis cache for seat ${seatId}:`, e);
    }
  }
}
