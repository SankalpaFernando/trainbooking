import { describe, expect, it } from 'vitest';
import { ValidationService } from '../src/services/validationService';

describe('ValidationService', () => {
  describe('isValidSriLankanNic', () => {
    it('returns true for valid old NIC format', () => {
      expect(ValidationService.isValidSriLankanNic('123456789V')).toBe(true);
      expect(ValidationService.isValidSriLankanNic('123456789v')).toBe(true);
    });

    it('returns true for valid new NIC format', () => {
      expect(ValidationService.isValidSriLankanNic('199012345678')).toBe(true);
    });

    it('returns true for passport-like IDs', () => {
      expect(ValidationService.isValidSriLankanNic('A1234567')).toBe(true);
      expect(ValidationService.isValidSriLankanNic('ZXCVBN12')).toBe(true);
    });

    it('returns false for invalid NIC formats', () => {
      expect(ValidationService.isValidSriLankanNic('1234')).toBe(false);
      expect(ValidationService.isValidSriLankanNic('abcdefghij')).toBe(false);
      expect(ValidationService.isValidSriLankanNic('1234567890')).toBe(false);
    });

    it('returns false for empty or missing values', () => {
      expect(ValidationService.isValidSriLankanNic('')).toBe(false);
      expect(ValidationService.isValidSriLankanNic('   ')).toBe(false);
    });
  });

  describe('isValidSriLankanPhone', () => {
    it('returns true for valid local mobile numbers', () => {
      expect(ValidationService.isValidSriLankanPhone('0712345678')).toBe(true);
      expect(ValidationService.isValidSriLankanPhone('0779876543')).toBe(true);
    });

    it('returns true for valid international mobile numbers', () => {
      expect(ValidationService.isValidSriLankanPhone('+94712345678')).toBe(true);
    });

    it('returns false for invalid formats', () => {
      expect(ValidationService.isValidSriLankanPhone('12345678')).toBe(false);
      expect(ValidationService.isValidSriLankanPhone('+9412345678')).toBe(false);
      expect(ValidationService.isValidSriLankanPhone('071234567')).toBe(false);
    });

    it('returns false for empty values', () => {
      expect(ValidationService.isValidSriLankanPhone('')).toBe(false);
      expect(ValidationService.isValidSriLankanPhone('   ')).toBe(false);
    });
  });
});
