import { SegmentService, SeatGapSummary } from './segmentService';
import { FareService } from './fareService';
import { ClassType } from '@prisma/client';
import { trace } from '@opentelemetry/api';

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
      const seatSummaries = await SegmentService.getSeatsAvailability(date, reqStart, reqEnd);

      // Use any seat with availability inside the requested route window so the recommendation
      // can mix classes (first, second, third) and fill the gaps between reqStart and reqEnd.
      const candidateSeats = seatSummaries.filter((s) =>
        s.availableGaps.some((gap) => gap.endSeq > reqStart && gap.startSeq < reqEnd)
      );

      const candidateRoutes = this.buildMultiLegRoutes(candidateSeats, reqStart, reqEnd, 5);
      if (candidateRoutes.length === 0) {
        return [];
      }

      const baseFare = FareService.calculateFare({ startStationSeq: reqStart, endStationSeq: reqEnd }).baseFare;

      const recommendations = candidateRoutes
        .map((route) => {
          const legFares = route.map((leg) =>
            FareService.calculateFare(
              {
                startStationSeq: leg.startSeq,
                endStationSeq: leg.endSeq,
                classType: leg.seat.classType as ClassType,
              },
              { excludeBaseFare: true }
            ).totalFare
          );

          const totalFare = Math.round((baseFare + legFares.reduce((sum, fare) => sum + fare, 0)) * 100) / 100;

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

      return recommendations;
    } finally {
      activeSpan.end();
    }
  }

  private static buildMultiLegRoutes(
    reservedSeats: SeatGapSummary[],
    reqStart: number,
    reqEnd: number,
    maxLegs: number
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
      if (route.length === 0) return;
      const key = route.map((leg) => `${leg.seat.seatId}:${leg.startSeq}-${leg.endSeq}`).join('|');
      if (!routeKeys.has(key)) {
        routeKeys.add(key);
        routes.push([...route]);
      }
    };

    const dfs = (currentSeq: number, route: CandidateLeg[]) => {
      if (route.length > maxLegs) {
        return;
      }

      if (route.length >= 1) {
        addRoute(route);
      }

      if (route.length === maxLegs) {
        return;
      }

      for (const seat of reservedSeats) {
        for (const gap of seat.availableGaps) {
          if (gap.startSeq <= currentSeq && gap.endSeq > currentSeq) {
            const maxEnd = Math.min(gap.endSeq, reqEnd);
            for (const nextPoint of sortedPoints) {
              if (nextPoint <= currentSeq || nextPoint > maxEnd) {
                continue;
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

    for (const startPoint of sortedPoints) {
      if (startPoint >= reqEnd) break;
      dfs(startPoint, []);
      if (routes.length >= maxRoutes) {
        break;
      }
    }

    return routes;
  }
}
