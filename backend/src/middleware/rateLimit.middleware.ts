import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based rate limiting
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
}

// In-memory store for rate limiting
const stores: Map<string, RateLimitStore> = new Map();

// Cleanup expired entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  stores.forEach((store, name) => {
    Object.keys(store).forEach((key) => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  });
}, 60000); // Clean up every minute

// Prevent Node from keeping the process alive just for cleanup
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Create a rate limiter middleware
 */
export const createRateLimiter = (name: string, options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req: Request) => {
      // Use IP address as default key
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded
        ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
        : req.ip || req.socket.remoteAddress || 'unknown';
      return ip;
    },
    skip = () => false,
  } = options;

  // Initialize store for this limiter
  if (!stores.has(name)) {
    stores.set(name, {});
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if configured to skip
    if (skip(req)) {
      next();
      return;
    }

    const store = stores.get(name)!;
    const key = keyGenerator(req);
    const now = Date.now();

    // Initialize or reset if window expired
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    store[key].count++;

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - store[key].count);
    const resetTime = Math.ceil(store[key].resetTime / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    // Check if over limit
    if (store[key].count > maxRequests) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);

      res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter,
      });
      return;
    }

    next();
  };
};

// ===== PRE-CONFIGURED RATE LIMITERS =====

/**
 * General API rate limiter
 * 100 requests per minute
 */
export const generalRateLimiter = createRateLimiter('general', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests. Please wait a moment and try again.',
});

/**
 * Authentication rate limiter
 * Stricter limits to prevent brute force
 * 10 requests per minute
 */
export const authRateLimiter = createRateLimiter('auth', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many authentication attempts. Please wait before trying again.',
});

/**
 * File upload rate limiter
 * 20 uploads per minute
 */
export const uploadRateLimiter = createRateLimiter('upload', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  message: 'Upload limit reached. Please wait before uploading more files.',
});

/**
 * Heavy operation rate limiter
 * For expensive operations like search, report generation
 * 10 requests per minute
 */
export const heavyOperationRateLimiter = createRateLimiter('heavy', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Processing limit reached. Please wait before making another request.',
});

/**
 * User-specific rate limiter
 * Limits based on authenticated user ID instead of IP
 */
export const userRateLimiter = (maxRequests: number = 100, windowMs: number = 60000) => {
  return createRateLimiter('user', {
    windowMs,
    maxRequests,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return (req as any).userId || req.ip || 'unknown';
    },
  });
};

export default {
  createRateLimiter,
  generalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  heavyOperationRateLimiter,
  userRateLimiter,
};
