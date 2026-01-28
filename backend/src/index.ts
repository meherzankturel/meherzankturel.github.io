import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import mediaRoutes from './routes/media.routes';
import authRoutes from './routes/auth.routes';
import reviewRoutes from './routes/review.routes';
import momentRoutes from './routes/moment.routes';
import snapkitRoutes from './routes/snapkit.routes';
import { initGridFS } from './utils/gridfs';
import { generalRateLimiter } from './middleware/rateLimit.middleware';

// Load environment variables first
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== SECURITY MIDDLEWARE =====

// Add security headers using helmet
// Note: You may need to install helmet: npm install helmet @types/helmet
try {
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for media files
    contentSecurityPolicy: false, // Disable CSP for API server
  }));
} catch (error) {
  console.warn('⚠️ Helmet not installed. Consider running: npm install helmet');
}

// ===== CORS CONFIGURATION =====
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ([
    process.env.FRONTEND_URL,
    /^exp:\/\/.*$/, // Expo development URLs
    /^https:\/\/.*\.vercel\.app$/, // Vercel deployments
  ].filter((origin): origin is string | RegExp => origin !== undefined))
  : '*'; // Allow all in development

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ===== REQUEST PARSING =====
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===== RATE LIMITING =====
// Apply general rate limiting to all routes
app.use(generalRateLimiter);

// ===== REQUEST LOGGING (Development) =====
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ===== DATABASE CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!');
  console.error('   Please create a .env file with your MongoDB connection string.');
  console.error('   See .env.example for reference.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    // Initialize GridFS after connection is ready
    if (mongoose.connection.readyState === 1) {
      const gridfs = initGridFS();
      if (gridfs) {
        console.log('✅ GridFS initialized for file storage');
      }
    }
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('   Please check your MongoDB connection string and network access settings.');
    process.exit(1);
  });

// Handle MongoDB connection events
mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// ===== ROUTES =====
app.use('/api/media', mediaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/moments', momentRoutes);
app.use('/api/snapkit', snapkitRoutes);
app.use('/api/bitmoji', snapkitRoutes); // Mount same router for bitmoji routes for now, or just use snapkit

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ===== ERROR HANDLING MIDDLEWARE =====
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
});

// ===== GRACEFUL SHUTDOWN =====
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ===== START SERVER =====
// Only start server if not in Vercel/serverless environment
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API Base URL: http://localhost:${PORT}/api`);
    console.log(`📤 Media upload: http://localhost:${PORT}/api/media/upload-multiple`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export for serverless environments (Vercel, AWS Lambda, etc.)
export default app;
