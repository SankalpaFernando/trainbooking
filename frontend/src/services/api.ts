import {
  Station,
  Coach,
  AvailabilityResponseData,
  MixedTicketRecommendation,
  Booking,
  DepartmentAnalytics,
} from '../types';

const API_BASE = '/api';

const getAuthHeaders = () => {
  const auth = localStorage.getItem('adminAuth');
  if (!auth) return {};
  return { Authorization: auth };
};

export class ApiService {
  public static async adminLogin(username: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Login failed');
    localStorage.setItem('adminAuth', json.data.token);
  }

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
    captchaToken: string;
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

  public static async createHoldMultiBooking(data: {
    date: string;
    legs: Array<{
      seatId: number;
      startStationId: number;
      endStationId: number;
    }>;
    guestName: string;
    guestNic: string;
    guestMobile: string;
    captchaToken: string;
  }): Promise<Booking[]> {
    const res = await fetch(`${API_BASE}/bookings/hold-multi`, {
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

  public static async confirmMultiBooking(pnrs: string[]): Promise<Booking[]> {
    const res = await fetch(`${API_BASE}/bookings/confirm-multi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnrs }),
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
    const res = await fetch(`${API_BASE}/admin/analytics?date=${date}`, {
      headers: getAuthHeaders(),
    });
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
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async updateCoachPricing(
    coachId: number,
    data: { baseFare: number; ratePerStation: number; windowSurcharge: number }
  ) {
    const res = await fetch(`${API_BASE}/admin/coaches/${coachId}/pricing`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async deleteCoach(id: number): Promise<void> {
    const auth = localStorage.getItem('adminAuth');
    if (!auth) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}/admin/coaches/${id}`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
  }

  // --- TICKET CHECKER & ADMIN API ---

  public static async checkerLogin(username: string, password: string):Promise<{token: string, username: string}> {
    const res = await fetch(`${API_BASE}/checker/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async validateTicket(pnr: string): Promise<Booking> {
    const res = await fetch(`${API_BASE}/checker/scan/${pnr}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async createChecker(username: string, password: string): Promise<void> {
    const auth = localStorage.getItem('adminAuth');
    if (!auth) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}/admin/checkers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
  }

  public static async getCheckers(): Promise<any[]> {
    const auth = localStorage.getItem('adminAuth');
    if (!auth) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}/admin/checkers`, {
      headers: { Authorization: auth },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }

  public static async updateChecker(id: number, password: string): Promise<void> {
    const auth = localStorage.getItem('adminAuth');
    if (!auth) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}/admin/checkers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
  }

  public static async deleteChecker(id: number): Promise<void> {
    const auth = localStorage.getItem('adminAuth');
    if (!auth) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}/admin/checkers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
  }
}
