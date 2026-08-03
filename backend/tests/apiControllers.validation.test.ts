import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApiControllers } from '../src/controllers/apiControllers';
import { ValidationService } from '../src/services/validationService';
import { BookingService } from '../src/services/bookingService';
import { RecaptchaService } from '../src/services/recaptchaService';

const mockResponse = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockRequest = (body: any = {}, query: any = {}, params: any = {}, ip = '127.0.0.1') => ({
  body,
  query,
  params,
  ip,
});

describe('ApiControllers createHoldBooking validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.RECAPTCHA_SECRET_KEY = 'test_secret';
  });

  it('returns 400 when required fields are missing', async () => {
    const req = mockRequest({ seatId: '1', date: '2026-08-01' });
    const res = mockResponse();

    await ApiControllers.createHoldBooking(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: expect.any(String) }));
  });

  it('returns 400 for invalid NIC', async () => {
    const req = mockRequest({
      seatId: '1',
      date: '2026-08-01',
      startStationId: '1',
      endStationId: '2',
      guestName: 'Test User',
      guestNic: 'INVALIDNIC',
      guestMobile: '0712345678',
      captchaToken: 'token',
    });
    const res = mockResponse();

    await ApiControllers.createHoldBooking(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid NIC or passport format' });
  });

  it('returns 400 for invalid mobile number', async () => {
    const req = mockRequest({
      seatId: '1',
      date: '2026-08-01',
      startStationId: '1',
      endStationId: '2',
      guestName: 'Test User',
      guestNic: '123456789V',
      guestMobile: '12345',
      captchaToken: 'token',
    });
    const res = mockResponse();

    await ApiControllers.createHoldBooking(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid Sri Lankan mobile number' });
  });

  it('calls RecaptchaService and BookingService on valid data', async () => {
    const req = mockRequest({
      seatId: '1',
      date: '2026-08-01',
      startStationId: '1',
      endStationId: '2',
      guestName: 'Test User',
      guestNic: '123456789V',
      guestMobile: '0712345678',
      captchaToken: 'token',
    });
    const res = mockResponse();

    vi.spyOn(ValidationService, 'isValidSriLankanNic').mockReturnValue(true);
    vi.spyOn(ValidationService, 'isValidSriLankanPhone').mockReturnValue(true);
    vi.spyOn(RecaptchaService, 'verifyToken').mockResolvedValue(true);
    vi.spyOn(BookingService, 'createHoldBooking').mockResolvedValue({ pnr: 'SLR-ABC123' } as any);

    await ApiControllers.createHoldBooking(req as any, res);

    expect(RecaptchaService.verifyToken).toHaveBeenCalledWith('token', '127.0.0.1');
    expect(BookingService.createHoldBooking).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { pnr: 'SLR-ABC123' } });
  });
});
