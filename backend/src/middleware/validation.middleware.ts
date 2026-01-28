import { Request, Response, NextFunction } from 'express';

/**
 * Input validation utilities and middleware
 */

// ===== VALIDATION HELPERS =====

/**
 * Sanitize string input to prevent XSS
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Validate MongoDB ObjectId format
 */
export const isValidObjectId = (id: string): boolean => {
  return /^[a-fA-F0-9]{24}$/.test(id);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate date format (YYYY-MM-DD)
 */
export const isValidDateFormat = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
};

/**
 * Validate URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate rating (1-5)
 */
export const isValidRating = (rating: any): boolean => {
  const num = Number(rating);
  return Number.isInteger(num) && num >= 1 && num <= 5;
};

// ===== VALIDATION SCHEMAS =====

interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  sanitize?: boolean;
  errorMessage?: string;
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

/**
 * Validate request body against a schema
 */
export const validateBody = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const sanitizedBody: any = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      // Check required
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(rules.errorMessage || `${field} is required`);
        continue;
      }

      // Skip validation if not required and not provided
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push(rules.errorMessage || `${field} must be a ${rules.type}`);
          continue;
        }
      }

      // String validations
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(rules.errorMessage || `${field} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(rules.errorMessage || `${field} must be at most ${rules.maxLength} characters`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(rules.errorMessage || `${field} has invalid format`);
        }

        // Sanitize string if required
        sanitizedBody[field] = rules.sanitize !== false ? sanitizeString(value) : value;
      }

      // Number validations
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(rules.errorMessage || `${field} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(rules.errorMessage || `${field} must be at most ${rules.max}`);
        }
        sanitizedBody[field] = value;
      }

      // Custom validation
      if (rules.custom && !rules.custom(value)) {
        errors.push(rules.errorMessage || `${field} is invalid`);
      }

      // For types other than string/number, just copy
      if (typeof value !== 'string' && typeof value !== 'number') {
        sanitizedBody[field] = value;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Replace body with sanitized values
    req.body = { ...req.body, ...sanitizedBody };
    next();
  };
};

/**
 * Validate request params
 */
export const validateParams = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.params[field];

      if (rules.required && !value) {
        errors.push(rules.errorMessage || `${field} is required`);
        continue;
      }

      if (value && rules.pattern && !rules.pattern.test(value)) {
        errors.push(rules.errorMessage || `${field} has invalid format`);
      }

      if (value && rules.custom && !rules.custom(value)) {
        errors.push(rules.errorMessage || `${field} is invalid`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
};

// ===== COMMON VALIDATION SCHEMAS =====

export const reviewValidation = validateBody({
  dateNightId: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 100,
    sanitize: true,
  },
  userId: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 128,
    sanitize: true,
  },
  rating: {
    required: true,
    type: 'number',
    min: 1,
    max: 5,
    errorMessage: 'Rating must be between 1 and 5',
  },
  message: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 2000,
    sanitize: true,
  },
  userName: {
    type: 'string',
    maxLength: 100,
    sanitize: true,
  },
  emoji: {
    type: 'string',
    maxLength: 10,
  },
});

export const momentValidation = validateBody({
  userId: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 128,
  },
  pairId: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 200,
  },
  momentDate: {
    required: true,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    errorMessage: 'momentDate must be in YYYY-MM-DD format',
  },
  caption: {
    type: 'string',
    maxLength: 500,
    sanitize: true,
  },
});

export const captionValidation = validateBody({
  userId: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 128,
  },
  caption: {
    type: 'string',
    maxLength: 500,
    sanitize: true,
  },
});

export const objectIdValidation = validateParams({
  id: {
    required: true,
    custom: isValidObjectId,
    errorMessage: 'Invalid ID format',
  },
});

export const momentIdValidation = validateParams({
  momentId: {
    required: true,
    custom: isValidObjectId,
    errorMessage: 'Invalid moment ID format',
  },
});

export const pairIdValidation = validateParams({
  pairId: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 200,
  },
});
