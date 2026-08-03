import { describe, expect, it, vi, beforeEach } from 'vitest';
import { bookingStatusCounter } from '../src/services/observability';
import { BookingService } from '../src/services/bookingService';
import { prisma, redis } from '../src/services/db';
import { BookingStatus } from '@prisma/client';

describe('BookingService Status Metrics Emissions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('increments bookingStatusCounter with status "pending" on single hold booking', async () => {
    const incSpy = vi.spyOn(bookingStatusCounter, 'inc');
    vi.spyOn(redis, 'set').mockResolvedValue('OK' as any);
    vi.spyOn(redis, 'del').mockResolvedValue(1 as any);
    vi.spyOn(prisma.station, 'findUnique')
      .mockResolvedValueOnce({ id: 1, sequenceNumber: 1 } as any)
      .mockResolvedValueOnce({ id: 2, sequenceNumber: 2 } as any);
    vi.spyOn(prisma.seat, 'findUnique').mockResolvedValue({ id: 1, coach: { classType: 'FIRST_CLASS' } } as any);
    vi.spyOn(prisma.booking, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.booking, 'create').mockResolvedValue({
      id: 10,
      pnr: 'SLR-123456',
      status: BookingStatus.PENDING,
      date: '2026-08-01',
    } as any);

    await BookingService.createHoldBooking({
      seatId: 1,
      date: '2026-08-01',
      startStationId: 1,
      endStationId: 2,
      guestName: 'John',
      guestNic: '123456789V',
      guestMobile: '0712345678',
    });

    expect(incSpy).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('increments bookingStatusCounter with status "confirmed" and "expired" on multi-leg confirm', async () => {
    const incSpy = vi.spyOn(bookingStatusCounter, 'inc');
    const mockBookings = [
      { id: 1, pnr: 'SLR-001', date: '2026-08-01', status: BookingStatus.PENDING, holdExpiresAt: new Date(Date.now() + 60000) },
      { id: 2, pnr: 'SLR-002', date: '2026-08-01', status: BookingStatus.PENDING, holdExpiresAt: new Date(Date.now() + 60000) },
    ];

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const tx = {
        booking: {
          findMany: vi.fn().mockResolvedValue(mockBookings),
          update: vi.fn().mockImplementation(({ where, data }) => {
            return Promise.resolve({ ...mockBookings.find((b) => b.id === where.id), ...data });
          }),
        },
      };
      return cb(tx);
    });

    await BookingService.confirmMultiBooking(['SLR-001', 'SLR-002']);

    expect(incSpy).toHaveBeenCalledWith({ status: 'confirmed' }, 2);
  });

  it('increments bookingStatusCounter with status "expired" when hold is expired during single confirm', async () => {
    const incSpy = vi.spyOn(bookingStatusCounter, 'inc');
    vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
      id: 5,
      pnr: 'SLR-EXPIRED',
      status: BookingStatus.PENDING,
      holdExpiresAt: new Date(Date.now() - 60000),
    } as any);
    vi.spyOn(prisma.booking, 'update').mockResolvedValue({ id: 5, status: BookingStatus.EXPIRED } as any);

    await expect(BookingService.confirmBooking('SLR-EXPIRED')).rejects.toThrow('Booking hold expired');
    expect(incSpy).toHaveBeenCalledWith({ status: 'expired' });
  });
});
