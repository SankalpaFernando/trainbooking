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

      const isUp = reqStart < reqEnd;
      const normReqStart = Math.min(reqStart, reqEnd);
      const normReqEnd = Math.max(reqStart, reqEnd);

      // Remove the global direct seat check so that multi-hop can be generated
      // even if direct seats exist (e.g. in other classes). 
      // To force the algorithm to generate true multi-leg routes (and efficiently pack the train),
      // we exclude any seat that can cover the entire journey by itself.
      const candidateSeats = seatSummaries.filter((s) =>
        !s.availableGaps.some((gap) => gap.startSeq <= normReqStart && gap.endSeq >= normReqEnd)
      );

      const route: CandidateLeg[] = [];
      let currentSeq = normReqStart;

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
        availableGaps: [{ startSeq: normReqStart, endSeq: normReqEnd }],
      };

      while (currentSeq < normReqEnd) {
        let bestSeat: SeatGapSummary | null = null;
        let maxEnd = currentSeq;

        // Find the fragmented reserved seat that covers currentSeq and goes the furthest
        for (const seat of candidateSeats) {
          for (const gap of seat.availableGaps) {
            if (gap.startSeq <= currentSeq && gap.endSeq > currentSeq) {
              const reachableEnd = Math.min(gap.endSeq, normReqEnd);
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
          // No fragmented reserved seat available at currentSeq. 
          // Find the next station where ANY fragmented seat becomes available.
          let nextAvailableSeq = normReqEnd;
          for (const seat of candidateSeats) {
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
        // Just one dummy leg. (Real seats that span the whole route were filtered out).
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
          startStationSeq: isUp ? leg.startSeq : leg.endSeq,
          endStationSeq: isUp ? leg.endSeq : leg.startSeq,
          fare: legFares[index],
        })),
      };

      return [recommendation];
    } finally {
      activeSpan.end();
    }
  }
}
