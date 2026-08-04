import { Request, Response, NextFunction } from 'express';
import { redis } from './db';

interface RateLimitOptions {
  /** Time window in seconds */
  windowSec: number;
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Key prefix for Redis */
  prefix: string;
  /** Custom message when rate limited */
  message?: string;
}

/**
 * Redis-backed sliding window rate limiter middleware.
 * Uses a simple counter with TTL per IP address.
 */
export function rateLimiter(options: RateLimitOptions) {
  const {
    windowSec,
    maxRequests,
    prefix,
    message = 'Too many requests. Please try again later.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract client IP (supports proxies via X-Forwarded-For)
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    const key = `ratelimit:${prefix}:${clientIp}`;

    try {
      const current = await redis.incr(key);

      // Set TTL only on the first request in the window
      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      // Attach rate limit headers for transparency
      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ttl));

      if (current > maxRequests) {
        res.setHeader('Retry-After', String(ttl));
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: ttl,
        });
      }

      return next();
    } catch (err) {
      // If Redis is down, fail open (allow the request) rather than blocking everyone
      console.warn('Rate limiter Redis error, failing open:', err);
      return next();
    }
  };
}

/**
 * Stricter rate limiter for sensitive/expensive operations.
 * Tracks by IP + route path for fine-grained control.
 */
export function strictRateLimiter(options: RateLimitOptions) {
  const {
    windowSec,
    maxRequests,
    prefix,
    message = 'Rate limit exceeded. Please slow down.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    const routeKey = req.path.replace(/[^a-zA-Z0-9]/g, '_');
    const key = `ratelimit:${prefix}:${routeKey}:${clientIp}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ttl));

      if (current > maxRequests) {
        res.setHeader('Retry-After', String(ttl));
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: ttl,
        });
      }

      return next();
    } catch (err) {
      console.warn('Strict rate limiter Redis error, failing open:', err);
      return next();
    }
  };
}
