import {
  Station,
  Coach,
  AvailabilityResponseData,
  MixedTicketRecommendation,
  Booking,
  DepartmentAnalytics,
} from '../types';

const API_BASE = '/api';

export class ApiService {
  public static async getStations(): Promise<Station[]> {
    const res = await fetch(`${API_BASE}/stations`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async getCoaches(): Promise<Coach[]> {
    const res = await fetch(`${API_BASE}/coaches`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async getSeatsAvailability(
    date: string,
    originId: number,
    destinationId: number,
    coachId?: number
  ): Promise<AvailabilityResponseData> {
    let url = `${API_BASE}/seats/availability?date=${date}&originId=${originId}&destinationId=${destinationId}`;
    if (coachId) url += `&coachId=${coachId}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async getMixedTickets(
    date: string,
    originId: number,
    destinationId: number
  ): Promise<MixedTicketRecommendation[]> {
    const url = `${API_BASE}/seats/mixed-tickets?date=${date}&originId=${originId}&destinationId=${destinationId}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async createHoldBooking(data: {
    seatId: number;
    date: string;
    startStationId: number;
    endStationId: number;
    guestName: string;
    guestNic: string;
    guestMobile: string;
  }): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async confirmBooking(pnr: string): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnr }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async lookupPNR(pnr: string): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/lookup/${pnr}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async addToWaitlist(data: {
    date: string;
    startStationId: number;
    endStationId: number;
    guestName: string;
    guestNic: string;
    guestMobile: string;
  }) {
    const res = await fetch(`${API_BASE}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async getAdminAnalytics(date: string): Promise<DepartmentAnalytics> {
    const res = await fetch(`${API_BASE}/admin/analytics?date=${date}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async createCoach(data: {
    name: string;
    type: 'RESERVED' | 'UNRESERVED';
    classType: 'FIRST_CLASS' | 'SECOND_CLASS' | 'THIRD_CLASS';
    totalSeats: number;
    prefix: string;
  }) {
    const res = await fetch(`${API_BASE}/admin/coaches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }
}
