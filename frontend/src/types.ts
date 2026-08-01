export interface Station {
  id: number;
  name: string;
  code: string;
  sequenceNumber: number;
  distanceKm: number;
}

export interface Coach {
  id: number;
  name: string;
  type: 'RESERVED' | 'UNRESERVED';
  classType: 'FIRST_CLASS' | 'SECOND_CLASS' | 'THIRD_CLASS';
  totalSeats: number;
  seats?: Seat[];
}

export interface Seat {
  id: number;
  seatNumber: string;
  coachId: number;
}

export interface Interval {
  startSeq: number;
  endSeq: number;
}

export interface SeatGapSummary {
  seatId: number;
  seatNumber: string;
  coachId: number;
  coachName: string;
  coachType: 'RESERVED' | 'UNRESERVED';
  classType: 'FIRST_CLASS' | 'SECOND_CLASS' | 'THIRD_CLASS';
  occupiedIntervals: Interval[];
  availableGaps: Interval[];
  isFullyAvailableForRoute: boolean;
  isAvailableForRequestedLeg: boolean;
}

export interface FareEstimate {
  baseFare: number;
  stationsTraversed: number;
  ratePerStation: number;
  classMultiplier: number;
  totalFare: number;
}

export interface AvailabilityResponseData {
  date: string;
  origin: Station;
  destination: Station;
  fareEstimate: FareEstimate;
  seats: SeatGapSummary[];
}

export interface LegOption {
  seatId: number;
  seatNumber: string;
  coachId: number;
  coachName: string;
  classType: 'FIRST_CLASS' | 'SECOND_CLASS' | 'THIRD_CLASS';
  startStationSeq: number;
  endStationSeq: number;
  fare: number;
}

export interface MixedTicketRecommendation {
  totalLegs: number;
  totalFare: number;
  legs: LegOption[];
}

export interface Booking {
  id: number;
  pnr: string;
  seatId: number;
  seat: {
    id: number;
    seatNumber: string;
    coach: Coach;
  };
  date: string;
  startStationSeq: number;
  endStationSeq: number;
  startStation: Station;
  endStation: Station;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  guestName: string;
  guestNic: string;
  guestMobile: string;
  totalFare: number;
  holdExpiresAt?: string;
  createdAt: string;
}

export interface StationSegmentMetric {
  startStationName: string;
  endStationName: string;
  startSeq: number;
  endSeq: number;
  totalSeats: number;
  bookedSeats: number;
  occupancyPercentage: number;
}

export interface CoachRevenueMetric {
  coachId: number;
  coachName: string;
  coachType: 'RESERVED' | 'UNRESERVED';
  totalBookings: number;
  totalRevenue: number;
}

export interface DepartmentAnalytics {
  date: string;
  totalBookings: number;
  confirmedBookings: number;
  pendingHoldBookings: number;
  totalRevenue: number;
  averageOccupancyPercentage: number;
  segmentMetrics: StationSegmentMetric[];
  coachMetrics: CoachRevenueMetric[];
}
