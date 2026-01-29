import express, { Request, Response, NextFunction } from 'express';
import { upload } from '../utils/fileUpload';
import { uploadToGridFS, getFileURL } from '../utils/gridfs';
import Media from '../models/Media.model';
import multer from 'multer';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { uploadRateLimiter } from '../middleware/rateLimit.middleware';
import {
  momentValidation,
  captionValidation,
  momentIdValidation,
  pairIdValidation,
  validateParams,
  sanitizeString,
  isValidDateFormat,
  isValidObjectId,
} from '../middleware/validation.middleware';

const router = express.Router();

// Multer error handler middleware
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer error:', err.code, err.message);
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    console.error('❌ Upload error:', err.message);
    return res.status(400).json({ error: err.message });
  }
  next();
};

/**
 * POST /api/moments/upload
 * Upload a daily moment photo with caption
 * Body (form-data):
 *   - file: Image file
 *   - userId: User ID
 *   - pairId: Couple/pair ID
 *   - momentDate: Date string (YYYY-MM-DD)
 *   - caption: Optional caption text
 */
router.post(
  '/upload',
  optionalAuthMiddleware,  // TODO: Use authMiddleware in production
  uploadRateLimiter,
  upload.single('file'),
  handleMulterError,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const { userId, pairId, momentDate, caption } = req.body;

      // Validate required fields
      if (!userId || !pairId || !momentDate) {
        return res.status(400).json({
          error: 'Missing required fields: userId, pairId, and momentDate are required',
        });
      }

      // Verify user ownership (skip in development without auth)
      if (req.userId && userId !== req.userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only upload moments for yourself',
        });
      }

      // Validate date format
      if (!isValidDateFormat(momentDate)) {
        return res.status(400).json({
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
      }

      // Sanitize caption
      const sanitizedCaption = caption ? sanitizeString(caption).substring(0, 500) : undefined;

      console.log(`📸 Uploading moment for user ${userId} on ${momentDate}`);

      const file = req.file as Express.Multer.File;
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // Validate file type
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/');

      if (!isImage && !isVideo) {
        return res.status(400).json({
          error: 'Invalid file type. Only images and videos are allowed.',
        });
      }

      const type = isImage ? 'image' : 'video';

      // Upload to GridFS
      const fileId = await uploadToGridFS(file, userId, {
        pairId: sanitizeString(pairId),
        momentDate,
        type: 'moment',
      });

      // Generate URL
      const url = getFileURL(fileId, baseUrl);

      // Save metadata to MongoDB
      const mediaDoc = new Media({
        userId,
        pairId: sanitizeString(pairId),
        momentDate,
        caption: sanitizedCaption,
        type,
        url,
        filename: sanitizeString(file.originalname),
        size: file.size,
        contentType: file.mimetype,
      });
      await mediaDoc.save();

      console.log(`✅ Moment uploaded successfully: ${url}`);

      res.json({
        success: true,
        url,
        momentDate,
        data: {
          id: mediaDoc._id,
          url,
          caption: sanitizedCaption,
          uploadedAt: mediaDoc.createdAt,
        },
      });
    } catch (error: any) {
      console.error('❌ Moment upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to upload moment' });
    }
  }
);

/**
 * GET /api/moments/today/:userId/:partnerId
 * Get today's moments for a couple
 * Returns both user's and partner's moments for today
 * Note: Using optionalAuth for development - add authMiddleware for production
 */
router.get(
  '/today/:userId/:partnerId',
  optionalAuthMiddleware,
  validateParams({
    userId: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 128,
    },
    partnerId: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 128,
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { userId, partnerId } = req.params;

      // Verify the requester is one of the users (skip in development without auth)
      if (req.userId && req.userId !== userId && req.userId !== partnerId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only view moments for your own pair',
        });
      }

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Generate pairId (consistent ordering)
      const [id1, id2] = [userId, partnerId].sort();
      const pairId = `${id1}_${id2}`;

      console.log(`📅 Fetching moments for ${pairId} on ${today}`);

      // Find all moments for this couple on this date
      const moments = await Media.find({
        pairId,
        momentDate: today,
      }).sort({ createdAt: -1 }).lean();

      // Separate user's and partner's moments
      const userMoment = moments.find((m) => m.userId === userId);
      const partnerMoment = moments.find((m) => m.userId === partnerId);

      console.log(`✅ Found ${moments.length} moments (user: ${!!userMoment}, partner: ${!!partnerMoment})`);

      res.json({
        success: true,
        date: today,
        pairId,
        userMoment: userMoment
          ? {
              id: userMoment._id,
              userId: userMoment.userId,
              url: userMoment.url,
              caption: userMoment.caption,
              uploadedAt: userMoment.createdAt,
            }
          : null,
        partnerMoment: partnerMoment
          ? {
              id: partnerMoment._id,
              userId: partnerMoment.userId,
              url: partnerMoment.url,
              caption: partnerMoment.caption,
              uploadedAt: partnerMoment.createdAt,
            }
          : null,
      });
    } catch (error: any) {
      console.error('❌ Error fetching moments:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch moments' });
    }
  }
);

/**
 * GET /api/moments/history/:pairId
 * Get moment history for a couple (last 30 days)
 */
router.get(
  '/history/:pairId',
  optionalAuthMiddleware,
  pairIdValidation,
  async (req: Request, res: Response) => {
    try {
      const { pairId } = req.params;
      const limitParam = req.query.limit;

      // Validate and cap limit
      let limit = 30;
      if (limitParam) {
        const parsed = parseInt(limitParam as string, 10);
        if (!isNaN(parsed) && parsed > 0) {
          limit = Math.min(parsed, 90); // Cap at 90 days max
        }
      }

      // Get date N days ago
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - limit);
      const dateFilter = daysAgo.toISOString().split('T')[0];

      const moments = await Media.find({
        pairId: sanitizeString(pairId),
        momentDate: { $gte: dateFilter },
      })
        .sort({ momentDate: -1, createdAt: -1 })
        .limit(500) // Hard limit to prevent excessive data
        .lean();

      res.json({
        success: true,
        count: moments.length,
        moments: moments.map((m) => ({
          id: m._id,
          userId: m.userId,
          url: m.url,
          caption: m.caption,
          date: m.momentDate,
          uploadedAt: m.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('❌ Error fetching moment history:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch moment history' });
    }
  }
);

/**
 * PATCH /api/moments/:momentId/caption
 * Update the caption of a moment
 */
router.patch(
  '/:momentId/caption',
  authMiddleware,
  momentIdValidation,
  captionValidation,
  async (req: Request, res: Response) => {
    try {
      const { momentId } = req.params;
      const { caption, userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Verify user ownership
      if (userId !== req.userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own moments',
        });
      }

      console.log(`✏️ Updating caption for moment ${momentId}`);

      // Find and verify ownership
      const moment = await Media.findById(momentId);
      if (!moment) {
        return res.status(404).json({ error: 'Moment not found' });
      }

      if (moment.userId !== req.userId) {
        return res.status(403).json({ error: 'You can only edit your own moments' });
      }

      // Update caption (sanitized by middleware)
      moment.caption = caption ? sanitizeString(caption).substring(0, 500) : undefined;
      await moment.save();

      console.log(`✅ Caption updated for moment ${momentId}`);

      res.json({
        success: true,
        moment: {
          id: moment._id,
          caption: moment.caption,
          updatedAt: moment.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('❌ Error updating caption:', error);
      res.status(500).json({ error: error.message || 'Failed to update caption' });
    }
  }
);

/**
 * DELETE /api/moments/:momentId
 * Delete a moment
 */
router.delete(
  '/:momentId',
  authMiddleware,
  momentIdValidation,
  async (req: Request, res: Response) => {
    try {
      const { momentId } = req.params;

      // Find the moment
      const moment = await Media.findById(momentId);
      if (!moment) {
        return res.status(404).json({ error: 'Moment not found' });
      }

      // Verify ownership
      if (moment.userId !== req.userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only delete your own moments',
        });
      }

      await Media.findByIdAndDelete(momentId);

      // TODO: Also delete the file from GridFS

      console.log(`✅ Moment ${momentId} deleted`);

      res.json({
        success: true,
        message: 'Moment deleted successfully',
      });
    } catch (error: any) {
      console.error('❌ Error deleting moment:', error);
      res.status(500).json({ error: error.message || 'Failed to delete moment' });
    }
  }
);

export default router;
