import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import mediaRoutes from './routes/media.routes';
import authRoutes from './routes/auth.routes';
import reviewRoutes from './routes/review.routes';
import momentRoutes from './routes/moment.routes';
import { initGridFS } from './utils/gridfs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://meherzankturel_db_user:V5cY1Stzli6OWckX@cluster0.qz3hz44.mongodb.net/couples_app?retryWrites=true&w=majority';

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
    console.error('❌ MongoDB connection error:', error);
    console.error('Please check your MongoDB connection string and network access settings.');
    process.exit(1);
  });

// Routes
app.use('/api/media', mediaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/moments', momentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server for non-serverless environments (local development)
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
