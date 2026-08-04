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
  windowSurcharge: number;
  totalFare: number;
}

export class FareService {

  public static calculateFare(
    input: FareCalculationInput,
    options: { excludeBaseFare?: boolean } = { excludeBaseFare: false }
  ): FareResult {
    const baseFare = input.pricing?.baseFare ?? parseFloat(process.env.BASE_FARE || '100');
    const ratePerStation = input.pricing?.ratePerStation ?? parseFloat(process.env.PER_STATION_RATE || '50');
    const windowSurchargeRate = input.pricing?.windowSurcharge ?? parseFloat(process.env.WINDOW_SURCHARGE || '100');

    const stationsTraversed = Math.abs(input.endStationSeq - input.startStationSeq);
    const windowSurcharge = input.isWindowSeat ? windowSurchargeRate : 0;

    const subtotal = ((options.excludeBaseFare ? 0 : baseFare) + (stationsTraversed * ratePerStation))  + windowSurcharge;
    const totalFare = Math.round(subtotal * 100) / 100;

    return {
      baseFare,
      stationsTraversed,
      ratePerStation,
      windowSurcharge,
      totalFare,
    };
  }
}
