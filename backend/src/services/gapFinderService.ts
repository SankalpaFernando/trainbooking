import { SegmentService, SeatGapSummary } from './segmentService';
import { FareService } from './fareService';
import { ClassType } from '@prisma/client';
import { trace } from '@opentelemetry/api';
import { redis } from './db';

export interface LegOption {
  seatId: number;
  seatNumber: string;
  coachId: number;
  coachName: string;
  classType: ClassType;
  startStationSeq: number;
  endStationSeq: number;
  fare: number;
}

export interface MixedTicketRecommendation {
  totalLegs: number;
  totalFare: number;
  legs: LegOption[];
}

interface CandidateLeg {
  seat: SeatGapSummary;
  startSeq: number;
  endSeq: number;
}

export class GapFinderService {
  /**
   * Generates mixed-ticket multi-leg itinerary recommendations for a requested route [reqStart, reqEnd].
   */
  public static async findMixedTickets(
    date: string,
    reqStart: number,
    reqEnd: number
  ): Promise<MixedTicketRecommendation[]> {
    const activeSpan = trace.getTracer('railway-booking').startSpan('gap_finder.calculate_hops');
    try {
      const cacheKey = `cache:mixed:${date}:${reqStart}:${reqEnd}`;
      
      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      } catch (e) {
        console.warn('Redis read failed for mixed tickets, falling back to calculation:', e);
      }

      const seatSummaries = await SegmentService.getSeatsAvailability(date, reqStart, reqEnd);

      // Use any seat with availability inside the requested route window so the recommendation
      // can mix classes (first, second, third) and fill the gaps between reqStart and reqEnd.
      const candidateSeats = seatSummaries.filter((s) =>
        s.availableGaps.some((gap) => gap.endSeq > reqStart && gap.startSeq < reqEnd)
      );

      let candidateRoutes = this.buildMultiLegRoutes(candidateSeats, reqStart, reqEnd, 5, false);
      if (candidateRoutes.length === 0) {
        // Fallback to dummy unreserved seats to fill gaps
        candidateRoutes = this.buildMultiLegRoutes(candidateSeats, reqStart, reqEnd, 5, true);
      }

      if (candidateRoutes.length === 0) {
        return [];
      }

      const recommendations = candidateRoutes
        .map((route) => {
          let longestLegIndex = 0;
          let maxStations = 0;
          route.forEach((leg, index) => {
            const stations = leg.endSeq - leg.startSeq;
            if (stations > maxStations) {
              maxStations = stations;
              longestLegIndex = index;
            }
          });

          const legFares = route.map((leg, index) =>
            FareService.calculateFare(
              {
                startStationSeq: leg.startSeq,
                endStationSeq: leg.endSeq,
                classType: leg.seat.classType as ClassType,
                isWindowSeat: leg.seat.isWindowSeat,
                pricing: {
                  baseFare: leg.seat.baseFare,
                  ratePerStation: leg.seat.ratePerStation,
                  windowSurcharge: leg.seat.windowSurcharge,
                },
              },
              { excludeBaseFare: index !== longestLegIndex }
            ).totalFare
          );

          const totalFare = Math.round((legFares.reduce((sum, fare) => sum + fare, 0)) * 100) / 100;

          return {
            route,
            totalFare,
            legFares,
          };
        })
        .sort((a, b) => {
          if (a.totalFare !== b.totalFare) return a.totalFare - b.totalFare;
          return a.route.length - b.route.length;
        })
        .slice(0, 3)
        .map(({ route, totalFare, legFares }) => ({
          totalLegs: route.length,
          totalFare,
          legs: route.map((leg, index) => ({
            seatId: leg.seat.seatId,
            seatNumber: leg.seat.seatNumber,
            coachId: leg.seat.coachId,
            coachName: leg.seat.coachName,
            classType: leg.seat.classType as ClassType,
            startStationSeq: leg.startSeq,
            endStationSeq: leg.endSeq,
            fare: legFares[index],
          })),
        }));

      try {
        await redis.set(cacheKey, JSON.stringify(recommendations), 'EX', 60);
      } catch (e) {
        console.warn('Failed to set Redis CQRS cache for mixed tickets:', e);
      }

      return recommendations;
    } finally {
      activeSpan.end();
    }
  }

  private static buildMultiLegRoutes(
    reservedSeats: SeatGapSummary[],
    reqStart: number,
    reqEnd: number,
    maxLegs: number,
    allowDummy: boolean = false
  ): CandidateLeg[][] {
    const transferPoints = new Set<number>([reqStart, reqEnd]);

    for (const seat of reservedSeats) {
      for (const gap of seat.availableGaps) {
        if (gap.endSeq <= reqStart || gap.startSeq >= reqEnd) continue;
        transferPoints.add(Math.max(reqStart, gap.startSeq));
        transferPoints.add(Math.min(reqEnd, gap.endSeq));
      }
    }

    const sortedPoints = Array.from(transferPoints).sort((a, b) => a - b);
    const routes: CandidateLeg[][] = [];
    const routeKeys = new Set<string>();
    const maxRoutes = 30;

    const addRoute = (route: CandidateLeg[]) => {
      if (route.length <= 1) return;
      if (route[0].startSeq !== reqStart || route[route.length - 1].endSeq !== reqEnd) return;

      const key = route.map((leg) => `${leg.seat.seatId}:${leg.startSeq}-${leg.endSeq}`).join('|');
      if (!routeKeys.has(key)) {
        routeKeys.add(key);
        routes.push([...route]);
      }
    };

    const dummySeat: SeatGapSummary = {
      seatId: -1,
      seatNumber: 'None',
      coachId: -1,
      coachName: 'Unreserved',
      coachType: 'THIRD_CLASS' as any,
      classType: ClassType.THIRD_CLASS,
      isWindowSeat: false,
      baseFare: parseFloat(process.env.BASE_FARE || '100'),
      ratePerStation: parseFloat(process.env.PER_STATION_RATE || '50'),
      windowSurcharge: 0,
      occupiedIntervals: [],
      isFullyAvailableForRoute: true,
      isAvailableForRequestedLeg: true,
      availableGaps: [{ startSeq: reqStart, endSeq: reqEnd }],
    };

    const seatsToExplore = allowDummy ? [...reservedSeats, dummySeat] : reservedSeats;

    const dfs = (currentSeq: number, route: CandidateLeg[]) => {
      if (route.length > maxLegs) {
        return;
      }

      if (route.length > 1 && currentSeq === reqEnd) {
        addRoute(route);
      }

      if (route.length >= maxLegs || currentSeq === reqEnd) {
        return;
      }

      for (const seat of seatsToExplore) {
        const isDummy = seat.seatId === -1;
        for (const gap of seat.availableGaps) {
          if (gap.startSeq <= currentSeq && gap.endSeq > currentSeq) {
            const maxEnd = Math.min(gap.endSeq, reqEnd);
            for (const nextPoint of sortedPoints) {
              if (nextPoint <= currentSeq || nextPoint > maxEnd) {
                continue;
              }

              if (isDummy) {
                const isRealSeatStart = reservedSeats.some(s => 
                  s.availableGaps.some(g => g.startSeq === nextPoint)
                );
                if (nextPoint !== reqEnd && !isRealSeatStart) {
                  continue;
                }
              }

              route.push({ seat, startSeq: currentSeq, endSeq: nextPoint });
              dfs(nextPoint, route);
              route.pop();

              if (routes.length >= maxRoutes) {
                return;
              }
            }
          }

          if (routes.length >= maxRoutes) {
            return;
          }
        }

        if (routes.length >= maxRoutes) {
          return;
        }
      }
    };

    dfs(reqStart, []);

    return routes;
  }
}
