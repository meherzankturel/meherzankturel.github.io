import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

// Extend Express Request type to include user info
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
      userId?: string;
    }
  }
}

// Initialize Firebase Admin SDK (if not already initialized)
const initializeFirebaseAdmin = () => {
  if (admin.apps.length === 0) {
    // In production, use service account credentials from environment
    // In development, can use Application Default Credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase Admin initialized with service account');
      } catch (error) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
        // Fallback to application default credentials
        admin.initializeApp();
        console.log('✅ Firebase Admin initialized with default credentials');
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with application default credentials');
    } else {
      // For local development without credentials, initialize with project ID only
      // This will work for ID token verification if the project is set up correctly
      const projectId = process.env.FIREBASE_PROJECT_ID || 'boundless-d2a20';
      admin.initializeApp({
        projectId,
      });
      console.log(`✅ Firebase Admin initialized with project ID: ${projectId}`);
    }
  }
  return admin;
};

// Initialize on module load
initializeFirebaseAdmin();

/**
 * Authentication middleware that verifies Firebase ID tokens
 * Required for all protected routes
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
      });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!idToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
      return;
    }

    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Attach user info to request
    req.user = decodedToken;
    req.userId = decodedToken.uid;

    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error.code, error.message);

    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please sign in again.',
      });
      return;
    }

    if (error.code === 'auth/id-token-revoked') {
      res.status(401).json({
        error: 'Token revoked',
        message: 'Your session has been revoked. Please sign in again.',
      });
      return;
    }

    if (error.code === 'auth/argument-error') {
      res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid.',
      });
      return;
    }

    res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to verify your identity. Please sign in again.',
    });
  }
};

/**
 * Optional authentication middleware
 * Allows both authenticated and unauthenticated requests
 * If a token is provided, it will be verified and user info attached
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth provided, continue without user context
      next();
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!idToken) {
      next();
      return;
    }

    // Try to verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    req.userId = decodedToken.uid;
  } catch (error) {
    // Token verification failed, but since this is optional, continue
    console.warn('Optional auth token verification failed:', error);
  }

  next();
};

/**
 * Middleware to verify user ownership of a resource
 * Use after authMiddleware to ensure req.userId is available
 */
export const ownershipMiddleware = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];

    if (!req.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (resourceUserId && resourceUserId !== req.userId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      });
      return;
    }

    next();
  };
};

export default authMiddleware;
