import { ClassType } from '@prisma/client';

export interface FareCalculationInput {
  startStationSeq: number;
  endStationSeq: number;
  classType?: ClassType;
}

export interface FareResult {
  baseFare: number;
  stationsTraversed: number;
  ratePerStation: number;
  classMultiplier: number;
  totalFare: number;
}

export class FareService {
  private static getBaseFare(): number {
    return parseFloat(process.env.BASE_FARE || '100');
  }

  private static getPerStationRate(): number {
    return parseFloat(process.env.PER_STATION_RATE || '50');
  }

  private static getClassMultiplier(classType?: ClassType): number {
    switch (classType) {
      case ClassType.FIRST_CLASS:
        return 1.5;
      case ClassType.SECOND_CLASS:
        return 1.2;
      case ClassType.THIRD_CLASS:
      default:
        return 1.0;
    }
  }

  public static calculateFare(input: FareCalculationInput): FareResult {
    const baseFare = this.getBaseFare();
    const ratePerStation = this.getPerStationRate();
    const stationsTraversed = Math.abs(input.endStationSeq - input.startStationSeq);
    const classMultiplier = this.getClassMultiplier(input.classType);

    const subtotal = baseFare + (stationsTraversed * ratePerStation);
    const totalFare = Math.round(subtotal * classMultiplier * 100) / 100;

    return {
      baseFare,
      stationsTraversed,
      ratePerStation,
      classMultiplier,
      totalFare,
    };
  }
}
