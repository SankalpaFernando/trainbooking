import { ClassType } from '@prisma/client';

export interface PricingConfig {
  baseFare: number;
  ratePerStation: number;
  windowSurcharge: number;
}

export interface FareCalculationInput {
  startStationSeq: number;
  endStationSeq: number;
  classType?: ClassType;
  isWindowSeat?: boolean;
  pricing?: PricingConfig;
}

export interface FareResult {
  baseFare: number;
  stationsTraversed: number;
  ratePerStation: number;
  classMultiplier: number;
  windowSurcharge: number;
  totalFare: number;
}

export class FareService {
  private static getClassMultiplier(classType?: ClassType): number {
    switch (classType) {
      case ClassType.FIRST_CLASS:
        return 1.5;
      case ClassType.SECOND_CLASS:
        return 1.2;
      case ClassType.THIRD_CLASS:
        return 1.0;
      default:
        return 1.0;
    }
  }

  public static calculateFare(
    input: FareCalculationInput,
    options: { excludeBaseFare?: boolean } = { excludeBaseFare: false }
  ): FareResult {
    const baseFare = input.pricing?.baseFare ?? parseFloat(process.env.BASE_FARE || '100');
    const ratePerStation = input.pricing?.ratePerStation ?? parseFloat(process.env.PER_STATION_RATE || '50');
    const windowSurchargeRate = input.pricing?.windowSurcharge ?? parseFloat(process.env.WINDOW_SURCHARGE || '100');

    const stationsTraversed = Math.abs(input.endStationSeq - input.startStationSeq);
    const classMultiplier = this.getClassMultiplier(input.classType);
    const windowSurcharge = input.isWindowSeat ? windowSurchargeRate : 0;

    const subtotal = ((options.excludeBaseFare ? 0 : baseFare) + (stationsTraversed * ratePerStation)) * classMultiplier + windowSurcharge;
    const totalFare = Math.round(subtotal * 100) / 100;

    return {
      baseFare,
      stationsTraversed,
      ratePerStation,
      classMultiplier,
      windowSurcharge,
      totalFare,
    };
  }
}
