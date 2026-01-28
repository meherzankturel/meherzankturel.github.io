import express, { Request, Response, NextFunction } from 'express';
import { upload } from '../utils/fileUpload';
import { uploadToGridFS, getFileURL, initGridFS } from '../utils/gridfs';
import Media from '../models/Media.model';
import multer from 'multer';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { uploadRateLimiter } from '../middleware/rateLimit.middleware';
import { sanitizeString, isValidObjectId } from '../middleware/validation.middleware';

const router = express.Router();

// Initialize GridFS
initGridFS();

// Multer error handler middleware
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.log('🔍 Multer middleware - checking for errors');
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer error:', err.code, err.message);
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    console.error('❌ Upload error:', err.message);
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Allowed MIME types for security
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
];

const isAllowedFileType = (mimetype: string): boolean => {
  return ALLOWED_IMAGE_TYPES.includes(mimetype) || ALLOWED_VIDEO_TYPES.includes(mimetype);
};

// ===== UPLOAD MULTIPLE FILES =====
// POST /api/media/upload-multiple
router.post(
  '/upload-multiple',
  authMiddleware,
  uploadRateLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    console.log('📤 Upload request received');
    console.log('📋 Content-Type:', req.headers['content-type']);
    console.log('📋 Content-Length:', req.headers['content-length']);
    next();
  },
  upload.array('files', 10),
  handleMulterError,
  async (req: Request, res: Response) => {
    console.log('📁 Files after multer:', req.files ? (req.files as any[]).length : 0);
    console.log('📋 Body keys:', Object.keys(req.body));

    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        console.error('❌ No files in request after multer processing');
        console.log('📋 Request body:', req.body);
        return res.status(400).json({
          error: 'No files provided. Make sure files are sent with field name "files".',
        });
      }

      // Validate file types
      for (const file of req.files as Express.Multer.File[]) {
        if (!isAllowedFileType(file.mimetype)) {
          return res.status(400).json({
            error: `Invalid file type: ${file.mimetype}. Only images and videos are allowed.`,
          });
        }
      }

      console.log('📁 Processing', req.files.length, 'files');
      for (const file of req.files as Express.Multer.File[]) {
        console.log(`  - ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
      }

      // Use authenticated userId, falling back to body for backward compatibility
      const userId = req.userId || req.body.userId || 'anonymous';
      const dateNightId = req.body.dateNightId ? sanitizeString(req.body.dateNightId) : undefined;
      const reviewId = req.body.reviewId ? sanitizeString(req.body.reviewId) : undefined;

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const uploadedURLs: string[] = [];
      const mediaRecords: any[] = [];

      // Upload each file
      for (const file of req.files as Express.Multer.File[]) {
        try {
          // Determine file type
          const isImage = file.mimetype.startsWith('image/');
          const type = isImage ? 'image' : 'video';

          // Upload to GridFS
          const fileId = await uploadToGridFS(file, userId, {
            dateNightId,
            reviewId,
            type,
          });

          // Generate URL
          const url = getFileURL(fileId, baseUrl);

          // Save metadata to MongoDB
          const mediaDoc = new Media({
            userId,
            dateNightId,
            reviewId,
            type,
            url,
            filename: sanitizeString(file.originalname),
            size: file.size,
            contentType: file.mimetype,
          });
          await mediaDoc.save();

          uploadedURLs.push(url);
          mediaRecords.push(mediaDoc);
        } catch (fileError: any) {
          console.error('❌ Error uploading file:', file.originalname, fileError.message);
          // Continue with other files
        }
      }

      console.log(`✅ Uploaded ${uploadedURLs.length}/${(req.files as any[]).length} files`);

      if (uploadedURLs.length === 0) {
        console.error('❌ All file uploads failed');
        return res.status(500).json({ error: 'Failed to upload any files' });
      }

      res.json({
        success: true,
        urls: uploadedURLs,
        count: uploadedURLs.length,
        data: {
          urls: uploadedURLs,
        },
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to upload files' });
    }
  }
);

// ===== SERVE FILES FROM GRIDFS =====
// GET /api/media/file/:fileId
// Note: File serving can be optionally authenticated for public media
router.get('/file/:fileId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    // Validate fileId format
    if (!isValidObjectId(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }

    const { getGridFS } = require('../utils/gridfs');
    const gridfs = getGridFS();
    const mongoose = require('mongoose');
    const ObjectId = mongoose.Types.ObjectId;

    // Check if file exists
    const files = await gridfs.find({ _id: new ObjectId(fileId) }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];
    const fileSize = file.length;
    const contentType = file.contentType || 'application/octet-stream';
    const isVideo = contentType.startsWith('video/');

    // Handle Range header for video streaming
    const range = req.headers.range;

    if (range && isVideo) {
      // Parse Range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range
      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;

      console.log(`🎬 Streaming video chunk: ${start}-${end}/${fileSize}`);

      // Set headers for partial content
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });

      // Stream the requested range
      const downloadStream = gridfs.openDownloadStream(new ObjectId(fileId), {
        start,
        end: end + 1,
      });

      downloadStream.pipe(res);

      downloadStream.on('error', (error: any) => {
        console.error('Error streaming video chunk:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });
    } else {
      // No range header or not a video - serve full file
      res.set('Content-Type', contentType);
      res.set('Content-Length', String(fileSize));
      res.set('Content-Disposition', `inline; filename="${file.filename}"`);
      res.set('Accept-Ranges', 'bytes');
      res.set('Cache-Control', 'public, max-age=31536000');

      // Stream full file
      const downloadStream = gridfs.openDownloadStream(new ObjectId(fileId));
      downloadStream.pipe(res);

      downloadStream.on('error', (error: any) => {
        console.error('Error streaming file:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });
    }
  } catch (error: any) {
    console.error('File serve error:', error);
    res.status(500).json({ error: error.message || 'Failed to serve file' });
  }
});

// ===== DELETE FILE =====
// DELETE /api/media/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }

    // Find the media record
    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify ownership
    if (media.userId !== req.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own files',
      });
    }

    // Delete from MongoDB
    await Media.findByIdAndDelete(id);

    // TODO: Also delete from GridFS using the URL's fileId

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

// ===== GET FILE METADATA =====
// GET /api/media/:id/metadata
router.get('/:id/metadata', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }

    const media = await Media.findById(id).lean();
    if (!media) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      success: true,
      data: {
        id: media._id,
        type: media.type,
        filename: media.filename,
        size: media.size,
        contentType: media.contentType,
        url: media.url,
        createdAt: media.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: error.message || 'Failed to get file metadata' });
  }
});

export default router;
