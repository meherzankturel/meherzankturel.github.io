import express, { Request, Response } from 'express';
import axios from 'axios';
import { getFirestore } from 'firebase-admin/firestore';
import { UserProfile } from '../models/UserProfile.model';

const router = express.Router();
const db = getFirestore();

/**
 * POST /api/snapkit/callback
 * Exchange Snap Kit auth code for access token and fetch Bitmoji data
 */
router.post('/callback', async (req: Request, res: Response) => {
    try {
        const { code, uid } = req.body;

        if (!code || !uid) {
            return res.status(400).json({ error: 'Missing code or uid' });
        }

        // Step 1: Exchange auth code for access token
        const tokenResponse = await axios.post(
            'https://accounts.snapchat.com/login/oauth2/access_token',
            new URLSearchParams({
                code,
                client_id: process.env.SNAP_CLIENT_ID!,
                client_secret: process.env.SNAP_CLIENT_SECRET!,
                grant_type: 'authorization_code',
                redirect_uri: process.env.SNAP_REDIRECT_URI!,
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        if (!access_token) {
            throw new Error('Failed to obtain access token from Snap');
        }

        // Step 2: Fetch Bitmoji Avatar Info
        const bitmojiResponse = await axios.get(
            'https://kit.snapchat.com/v1/bitmoji/avatar',
            {
                headers: { Authorization: `Bearer ${access_token}` },
            }
        );

        const bitmojiId = bitmojiResponse.data?.data?.id;
        const bitmojiTemplateId = bitmojiResponse.data?.data?.avatar_id;

        if (!bitmojiId) {
            throw new Error('No Bitmoji associated with this Snap account');
        }

        // Step 3: Generate mood-based pose URLs (cached)
        const cachedPoseUrls = await generateMoodPoseUrls(bitmojiTemplateId);

        // Step 4: Save to MongoDB user_profile using Mongoose
        await UserProfile.findOneAndUpdate(
            { uid },
            {
                $set: {
                    snap_id: bitmojiId,
                    bitmojiTemplateId,
                    cachedPoseUrls,
                    snapAccessToken: access_token,
                    snapRefreshToken: refresh_token,
                    snapTokenExpiresAt: new Date(Date.now() + expires_in * 1000),
                }
            },
            { upsert: true, new: true }
        );

        // Step 5: Update Firestore active_users (minimal live data)
        const defaultPoseUrl = cachedPoseUrls['neutral'] || cachedPoseUrls['happy'];

        await db.collection('active_users').doc(uid).set(
            {
                avatarType: 'bitmoji',
                bitmojiTemplateId,
                bitmojiPoseUrl: defaultPoseUrl,
                lastUpdated: new Date(),
            },
            { merge: true }
        );

        console.log(`✅ Bitmoji linked for user ${uid}`);

        res.json({
            success: true,
            bitmojiId,
            defaultPoseUrl,
        });
    } catch (error: any) {
        console.error('❌ Snap Kit callback error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to link Bitmoji',
            details: error.message
        });
    }
});

/**
 * POST /api/bitmoji/pose
 * Get Bitmoji pose URL for a specific mood
 */
router.post('/pose', async (req: Request, res: Response) => {
    try {
        const { uid, mood } = req.body;

        if (!uid || !mood) {
            return res.status(400).json({ error: 'Missing uid or mood' });
        }

        // Fetch from MongoDB cache
        const userProfile = await UserProfile.findOne({ uid });

        if (!userProfile || !userProfile.cachedPoseUrls) {
            return res.status(404).json({ error: 'No Bitmoji linked for this user' });
        }

        // Access the Map (Mongoose Map type)
        const cachedPoses = userProfile.cachedPoseUrls as any;
        // Handle if it's a Map or object
        const poseUrl = (cachedPoses.get ? cachedPoses.get(mood.toLowerCase()) : cachedPoses[mood.toLowerCase()]) ||
            (cachedPoses.get ? cachedPoses.get('neutral') : cachedPoses['neutral']);

        // Update Firestore active_users
        await db.collection('active_users').doc(uid).update({
            bitmojiPoseUrl: poseUrl,
            mood: mood.toLowerCase(),
            lastUpdated: new Date(),
        });

        res.json({ poseUrl });
    } catch (error: any) {
        console.error('❌ Pose fetching error:', error);
        res.status(500).json({ error: 'Failed to fetch pose' });
    }
});

/**
 * Helper: Generate Bitmoji pose URLs for different moods
 */
async function generateMoodPoseUrls(templateId: string): Promise<Record<string, string>> {
    const moodToPoseMap = {
        excited: '10220132', // Jumping/celebration
        happy: '10220783',   // Smiling/waving
        neutral: '10220784', // Standing neutral
        anxious: '10221298', // Nervous/thinking
        sad: '10221520',     // Sitting/pensive
        loved: '10221897',   // Heart eyes
        grateful: '10220443',// Hands together
        tired: '10221633',   // Sleepy
        angry: '10221156',   // Angry face
        stressed: '10221299',// Stressed
    };

    const cachedUrls: Record<string, string> = {};

    for (const [mood, comicId] of Object.entries(moodToPoseMap)) {
        // Snap Bitmoji Comic URL format
        cachedUrls[mood] = `https://sdk.bitmoji.com/render/panel/${comicId}-${templateId}-v1.png?transparent=1&palette=1`;
    }

    return cachedUrls;
}

export default router;
