import express, { Request, Response, NextFunction } from 'express';
import { upload } from '../utils/fileUpload';
import { uploadToGridFS, getFileURL } from '../utils/gridfs';
import Media from '../models/Media.model';
import multer from 'multer';

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
 *   - files: Image file(s)
 *   - userId: User ID
 *   - pairId: Couple/pair ID
 *   - momentDate: Date string (YYYY-MM-DD)
 *   - caption: Optional caption text
 */
router.post('/upload', upload.single('file'), handleMulterError, async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { userId, pairId, momentDate, caption } = req.body;

        if (!userId || !pairId || !momentDate) {
            return res.status(400).json({
                error: 'Missing required fields: userId, pairId, and momentDate are required'
            });
        }

        console.log(`📸 Uploading moment for user ${userId} on ${momentDate}`);

        const file = req.file as Express.Multer.File;
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // Determine file type
        const isImage = file.mimetype.startsWith('image/');
        const type = isImage ? 'image' : 'video';

        // Upload to GridFS
        const fileId = await uploadToGridFS(file, userId, {
            pairId,
            momentDate,
            type: 'moment', // Tag as moment for organization
        });

        // Generate URL
        const url = getFileURL(fileId, baseUrl);

        // Save metadata to MongoDB
        const mediaDoc = new Media({
            userId,
            pairId,
            momentDate,
            caption: caption || undefined,
            type,
            url,
            filename: file.originalname,
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
                caption,
                uploadedAt: mediaDoc.createdAt,
            },
        });
    } catch (error: any) {
        console.error('❌ Moment upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload moment' });
    }
});

/**
 * GET /api/moments/today/:userId/:partnerId
 * Get today's moments for a couple
 * Returns both user's and partner's moments for today
 */
router.get('/today/:userId/:partnerId', async (req: Request, res: Response) => {
    try {
        const { userId, partnerId } = req.params;

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
            type: 'image', // Moments are images only
        }).sort({ createdAt: -1 }); // Most recent first

        // Separate user's and partner's moments
        const userMoment = moments.find(m => m.userId === userId);
        const partnerMoment = moments.find(m => m.userId === partnerId);

        console.log(`✅ Found ${moments.length} moments (user: ${!!userMoment}, partner: ${!!partnerMoment})`);

        res.json({
            success: true,
            date: today,
            pairId,
            userMoment: userMoment ? {
                id: userMoment._id,
                userId: userMoment.userId,
                url: userMoment.url,
                caption: userMoment.caption,
                uploadedAt: userMoment.createdAt,
            } : null,
            partnerMoment: partnerMoment ? {
                id: partnerMoment._id,
                userId: partnerMoment.userId,
                url: partnerMoment.url,
                caption: partnerMoment.caption,
                uploadedAt: partnerMoment.createdAt,
            } : null,
        });
    } catch (error: any) {
        console.error('❌ Error fetching moments:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch moments' });
    }
});

/**
 * GET /api/moments/history/:pairId
 * Get moment history for a couple (last 30 days)
 */
router.get('/history/:pairId', async (req: Request, res: Response) => {
    try {
        const { pairId } = req.params;
        const limit = parseInt(req.query.limit as string) || 30;

        // Get date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - limit);
        const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

        const moments = await Media.find({
            pairId,
            momentDate: { $gte: dateFilter },
            type: 'image',
        }).sort({ momentDate: -1, createdAt: -1 });

        res.json({
            success: true,
            count: moments.length,
            moments: moments.map(m => ({
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
});

/**
 * PATCH /api/moments/:momentId/caption
 * Update the caption of a moment
 */
router.patch('/:momentId/caption', async (req: Request, res: Response) => {
    try {
        const { momentId } = req.params;
        const { caption, userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        console.log(`✏️ Updating caption for moment ${momentId}`);

        // Find and verify ownership
        const moment = await Media.findById(momentId);
        if (!moment) {
            return res.status(404).json({ error: 'Moment not found' });
        }

        if (moment.userId !== userId) {
            return res.status(403).json({ error: 'You can only edit your own moments' });
        }

        // Update caption
        moment.caption = caption || undefined;
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
});

export default router;
