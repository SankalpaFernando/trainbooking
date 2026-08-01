import { SegmentService, SeatGapSummary } from './segmentService';
import { FareService } from './fareService';
import { ClassType } from '@prisma/client';

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

export class GapFinderService {
  /**
   * Generates mixed-ticket multi-leg itinerary recommendations for a requested route [reqStart, reqEnd].
   */
  public static async findMixedTickets(
    date: string,
    reqStart: number,
    reqEnd: number
  ): Promise<MixedTicketRecommendation[]> {
    const seatSummaries = await SegmentService.getSeatsAvailability(date, reqStart, reqEnd);

    // Filter only reserved seats
    const reservedSeats = seatSummaries.filter((s) => s.coachType === 'RESERVED');

    const recommendations: MixedTicketRecommendation[] = [];

    // Algorithm: Find 2-leg seat hop combinations that cover [reqStart, reqEnd]
    for (let intermediateSeq = reqStart + 1; intermediateSeq < reqEnd; intermediateSeq++) {
      // Find candidate seat for Leg 1: [reqStart, intermediateSeq]
      const leg1Candidates = reservedSeats.filter((s) =>
        s.availableGaps.some((gap) => gap.startSeq <= reqStart && gap.endSeq >= intermediateSeq)
      );

      // Find candidate seat for Leg 2: [intermediateSeq, reqEnd]
      const leg2Candidates = reservedSeats.filter((s) =>
        s.availableGaps.some((gap) => gap.startSeq <= intermediateSeq && gap.endSeq >= reqEnd)
      );

      if (leg1Candidates.length > 0 && leg2Candidates.length > 0) {
        // Pick top available candidate for leg 1 and leg 2 (prefer different seats to show hop)
        const seat1 = leg1Candidates[0];
        const seat2 = leg2Candidates.find((s) => s.seatId !== seat1.seatId) || leg2Candidates[0];

        const fare1 = FareService.calculateFare({
          startStationSeq: reqStart,
          endStationSeq: intermediateSeq,
          classType: seat1.classType as ClassType,
        }).totalFare;

        const fare2 = FareService.calculateFare({
          startStationSeq: intermediateSeq,
          endStationSeq: reqEnd,
          classType: seat2.classType as ClassType,
        }).totalFare;

        recommendations.push({
          totalLegs: 2,
          totalFare: Math.round((fare1 + fare2) * 100) / 100,
          legs: [
            {
              seatId: seat1.seatId,
              seatNumber: seat1.seatNumber,
              coachId: seat1.coachId,
              coachName: seat1.coachName,
              classType: seat1.classType as ClassType,
              startStationSeq: reqStart,
              endStationSeq: intermediateSeq,
              fare: fare1,
            },
            {
              seatId: seat2.seatId,
              seatNumber: seat2.seatNumber,
              coachId: seat2.coachId,
              coachName: seat2.coachName,
              classType: seat2.classType as ClassType,
              startStationSeq: intermediateSeq,
              endStationSeq: reqEnd,
              fare: fare2,
            },
          ],
        });

        // Limit to 3 distinct multi-leg recommendations
        if (recommendations.length >= 3) break;
      }
    }

    return recommendations;
  }
}
