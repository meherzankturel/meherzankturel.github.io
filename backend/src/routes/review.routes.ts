import express, { Request, Response } from 'express';
import Review from '../models/Review.model';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  reviewValidation,
  objectIdValidation,
  validateParams,
  sanitizeString,
  isValidObjectId,
} from '../middleware/validation.middleware';

const router = express.Router();

// ===== CREATE REVIEW =====
// POST /api/reviews
router.post(
  '/',
  authMiddleware,
  reviewValidation,
  async (req: Request, res: Response) => {
    try {
      // Ensure userId matches authenticated user
      if (req.body.userId !== req.userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only create reviews for yourself',
        });
      }

      // Sanitize arrays if present
      const sanitizedImages = req.body.images?.map((url: string) => sanitizeString(url)) || [];
      const sanitizedVideos = req.body.videos?.map((url: string) => sanitizeString(url)) || [];

      const review = new Review({
        ...req.body,
        images: sanitizedImages,
        videos: sanitizedVideos,
      });

      await review.save();

      res.status(201).json({
        success: true,
        data: review,
      });
    } catch (error: any) {
      console.error('Create review error:', error);
      res.status(400).json({
        error: 'Failed to create review',
        message: error.message,
      });
    }
  }
);

// ===== GET REVIEWS BY DATE NIGHT =====
// GET /api/reviews/date-night/:dateNightId
router.get(
  '/date-night/:dateNightId',
  authMiddleware,
  validateParams({
    dateNightId: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 100,
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { dateNightId } = req.params;

      const reviews = await Review.find({ dateNightId })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        count: reviews.length,
        data: reviews,
      });
    } catch (error: any) {
      console.error('Get reviews error:', error);
      res.status(500).json({
        error: 'Failed to fetch reviews',
        message: error.message,
      });
    }
  }
);

// ===== GET SINGLE REVIEW =====
// GET /api/reviews/:id
router.get(
  '/:id',
  authMiddleware,
  objectIdValidation,
  async (req: Request, res: Response) => {
    try {
      const review = await Review.findById(req.params.id).lean();

      if (!review) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Review not found',
        });
      }

      res.json({
        success: true,
        data: review,
      });
    } catch (error: any) {
      console.error('Get review error:', error);
      res.status(500).json({
        error: 'Failed to fetch review',
        message: error.message,
      });
    }
  }
);

// ===== UPDATE REVIEW =====
// PUT /api/reviews/:id
router.put(
  '/:id',
  authMiddleware,
  objectIdValidation,
  async (req: Request, res: Response) => {
    try {
      // First, find the review to check ownership
      const existingReview = await Review.findById(req.params.id);

      if (!existingReview) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Review not found',
        });
      }

      // Verify ownership
      if (existingReview.userId !== req.userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own reviews',
        });
      }

      // Sanitize update data
      const updateData: any = {};

      if (req.body.rating !== undefined) {
        const rating = Number(req.body.rating);
        if (rating < 1 || rating > 5) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Rating must be between 1 and 5',
          });
        }
        updateData.rating = rating;
      }

      if (req.body.message !== undefined) {
        updateData.message = sanitizeString(req.body.message);
      }

      if (req.body.emoji !== undefined) {
        updateData.emoji = req.body.emoji.substring(0, 10);
      }

      if (req.body.userName !== undefined) {
        updateData.userName = sanitizeString(req.body.userName);
      }

      if (req.body.images !== undefined) {
        updateData.images = req.body.images.map((url: string) => sanitizeString(url));
      }

      if (req.body.videos !== undefined) {
        updateData.videos = req.body.videos.map((url: string) => sanitizeString(url));
      }

      const review = await Review.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        data: review,
      });
    } catch (error: any) {
      console.error('Update review error:', error);
      res.status(400).json({
        error: 'Failed to update review',
        message: error.message,
      });
    }
  }
);

// ===== DELETE REVIEW =====
// DELETE /api/reviews/:id
router.delete(
  '/:id',
  authMiddleware,
  objectIdValidation,
  async (req: Request, res: Response) => {
    try {
      // First, find the review to check ownership
      const existingReview = await Review.findById(req.params.id);

      if (!existingReview) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Review not found',
        });
      }

      // Verify ownership
      if (existingReview.userId !== req.userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only delete your own reviews',
        });
      }

      await Review.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Review deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete review error:', error);
      res.status(500).json({
        error: 'Failed to delete review',
        message: error.message,
      });
    }
  }
);

export default router;
