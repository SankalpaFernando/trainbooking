import { prisma } from './db';
import { BookingStatus, CoachType } from '@prisma/client';

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
  coachType: CoachType;
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

export class AnalyticsService {
  public static async getDepartmentAnalytics(date: string): Promise<DepartmentAnalytics> {
    const stations = await prisma.station.findMany({ orderBy: { sequenceNumber: 'asc' } });
    const reservedCoaches = await prisma.coach.findMany({
      where: { type: CoachType.RESERVED },
      include: { seats: true },
    });
    const totalReservedSeats = reservedCoaches.reduce((acc, c) => acc + c.seats.length, 0);

    const bookings = await prisma.booking.findMany({
      where: {
        date,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
      include: {
        seat: { include: { coach: true } },
      },
    });

    const confirmedBookings = bookings.filter((b) => b.status === BookingStatus.CONFIRMED);
    const pendingHoldBookings = bookings.filter((b) => b.status === BookingStatus.PENDING);

    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.totalFare, 0);

    // Segment occupancy calculation (between consecutive stations)
    const segmentMetrics: StationSegmentMetric[] = [];
    let totalSegmentOccupancySum = 0;

    for (let i = 0; i < stations.length - 1; i++) {
      const stStart = stations[i];
      const stEnd = stations[i + 1];

      // Count active bookings traversing this segment
      const bookedOnSegment = bookings.filter(
        (b) => b.startStationSeq <= stStart.sequenceNumber && b.endStationSeq >= stEnd.sequenceNumber
      ).length;

      const occupancyPercentage = totalReservedSeats > 0
        ? Math.round((bookedOnSegment / totalReservedSeats) * 100 * 10) / 10
        : 0;

      totalSegmentOccupancySum += occupancyPercentage;

      segmentMetrics.push({
        startStationName: stStart.name,
        endStationName: stEnd.name,
        startSeq: stStart.sequenceNumber,
        endSeq: stEnd.sequenceNumber,
        totalSeats: totalReservedSeats,
        bookedSeats: bookedOnSegment,
        occupancyPercentage,
      });
    }

    const averageOccupancyPercentage = segmentMetrics.length > 0
      ? Math.round((totalSegmentOccupancySum / segmentMetrics.length) * 10) / 10
      : 0;

    // Coach revenue breakdown
    const coachMetricsMap = new Map<number, CoachRevenueMetric>();

    for (const coach of reservedCoaches) {
      coachMetricsMap.set(coach.id, {
        coachId: coach.id,
        coachName: coach.name,
        coachType: coach.type,
        totalBookings: 0,
        totalRevenue: 0,
      });
    }

    for (const b of confirmedBookings) {
      const coachId = b.seat.coachId;
      if (coachMetricsMap.has(coachId)) {
        const metric = coachMetricsMap.get(coachId)!;
        metric.totalBookings += 1;
        metric.totalRevenue += b.totalFare;
      }
    }

    return {
      date,
      totalBookings: bookings.length,
      confirmedBookings: confirmedBookings.length,
      pendingHoldBookings: pendingHoldBookings.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageOccupancyPercentage,
      segmentMetrics,
      coachMetrics: Array.from(coachMetricsMap.values()),
    };
  }
}
