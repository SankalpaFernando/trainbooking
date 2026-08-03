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
   * Generates a single optimal greedy multi-leg itinerary recommendation for a requested route.
   */
  public static async findMixedTickets(
    date: string,
    reqStart: number,
    reqEnd: number
  ): Promise<MixedTicketRecommendation[]> {
    const activeSpan = trace.getTracer('railway-booking').startSpan('gap_finder.calculate_greedy_hops');
    try {
      const seatSummaries = await SegmentService.getSeatsAvailability(date, reqStart, reqEnd);

      // Rule: If the passenger can go from start to end in a single seat, don't show multi-hop.
      const hasDirectSeat = seatSummaries.some((s) =>
        s.availableGaps.some((gap) => gap.startSeq <= reqStart && gap.endSeq >= reqEnd)
      );

      if (hasDirectSeat) {
        return []; // Suppress multi-leg since direct seat exists
      }

      const route: CandidateLeg[] = [];
      let currentSeq = reqStart;

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

      while (currentSeq < reqEnd) {
        let bestSeat: SeatGapSummary | null = null;
        let maxEnd = currentSeq;

        // Find the reserved seat that covers currentSeq and goes the furthest
        for (const seat of seatSummaries) {
          for (const gap of seat.availableGaps) {
            if (gap.startSeq <= currentSeq && gap.endSeq > currentSeq) {
              const reachableEnd = Math.min(gap.endSeq, reqEnd);
              if (reachableEnd > maxEnd) {
                maxEnd = reachableEnd;
                bestSeat = seat;
              }
            }
          }
        }

        if (bestSeat) {
          route.push({ seat: bestSeat, startSeq: currentSeq, endSeq: maxEnd });
          currentSeq = maxEnd;
        } else {
          // No reserved seat available at currentSeq. 
          // Find the next station where ANY seat becomes available.
          let nextAvailableSeq = reqEnd;
          for (const seat of seatSummaries) {
            for (const gap of seat.availableGaps) {
              if (gap.startSeq > currentSeq && gap.startSeq < nextAvailableSeq) {
                nextAvailableSeq = gap.startSeq;
              }
            }
          }
          
          route.push({ seat: dummySeat, startSeq: currentSeq, endSeq: nextAvailableSeq });
          currentSeq = nextAvailableSeq;
        }
      }

      if (route.length <= 1) {
        // Just one dummy leg, or one direct seat (which is handled earlier)
        return [];
      }

      // Calculate fares for the generated greedy route
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

      const recommendation: MixedTicketRecommendation = {
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
      };

      return [recommendation];
    } finally {
      activeSpan.end();
    }
  }
}
