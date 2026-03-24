import mongoose from 'mongoose';
import { Readable } from 'stream';

// Use mongoose's built-in GridFSBucket from its mongodb driver
let gfs: mongoose.mongo.GridFSBucket | null = null;

// Initialize GridFS
export const initGridFS = (): mongoose.mongo.GridFSBucket | null => {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const db = mongoose.connection.db;
      gfs = new mongoose.mongo.GridFSBucket(db, { bucketName: 'media' });
      console.log('✅ GridFS initialized successfully');
      return gfs;
    } else {
      console.warn('⚠️ MongoDB not connected yet, GridFS will be initialized on connection');
      return null;
    }
  } catch (error) {
    console.error('❌ Error initializing GridFS:', error);
    return null;
  }
};

// Get GridFS instance
export const getGridFS = (): mongoose.mongo.GridFSBucket => {
  if (!gfs) {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const initialized = initGridFS();
      if (!initialized) {
        throw new Error('Failed to initialize GridFS');
      }
      return initialized;
    } else {
      throw new Error('MongoDB not connected. Cannot access GridFS.');
    }
  }
  return gfs;
};

// Upload file to GridFS
export const uploadToGridFS = (file: Express.Multer.File, userId: string, metadata?: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    const gridfs = getGridFS();
    const filename = `${userId}-${Date.now()}-${file.originalname}`;
    
    const readableStream = Readable.from(file.buffer);
    const uploadStream = gridfs.openUploadStream(filename, {
      contentType: file.mimetype,
      metadata: {
        userId,
        originalName: file.originalname,
        ...metadata,
      },
    });

    readableStream.pipe(uploadStream);

    uploadStream.on('error', (error) => {
      reject(error);
    });

    uploadStream.on('finish', () => {
      // Return the file ID as URL (we'll create an endpoint to serve files)
      const fileId = uploadStream.id.toString();
      resolve(fileId);
    });
  });
};

// Get file URL (will be served via API endpoint)
export const getFileURL = (fileId: string, baseUrl: string): string => {
  return `${baseUrl}/api/media/file/${fileId}`;
};

// Rewrite stored URLs that reference old/suspended backend domains
const OLD_DOMAINS = [
  'https://sync-6m58.onrender.com',
  'http://sync-6m58.onrender.com',
];

export const fixStoredUrl = (url: string): string => {
  if (!url) return url;
  const currentHost = process.env.RENDER_EXTERNAL_URL || 'https://meherzankturel-github-io.onrender.com';
  for (const old of OLD_DOMAINS) {
    if (url.startsWith(old)) {
      return url.replace(old, currentHost);
    }
  }
  // Ensure https
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

