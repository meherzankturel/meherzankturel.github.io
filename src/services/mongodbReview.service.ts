/**
 * MongoDB Review Service
 * Handles fetching reviews from MongoDB API with real-time capabilities
 */

import { API_ENDPOINTS, apiRequest, fixMediaUrl } from '../config/mongodb';

export interface MongoDBReview {
  _id: string;
  dateNightId: string;
  userId: string;
  userName?: string;
  rating: number;
  message: string;
  emoji?: string;
  images?: string[];
  videos?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch reviews for a date night
 */
export async function getReviewsForDateNight(dateNightId: string): Promise<MongoDBReview[]> {
  try {
    const reviews = await apiRequest<MongoDBReview[]>(
      API_ENDPOINTS.REVIEWS.GET_BY_DATE_NIGHT(dateNightId)
    );
    // Rewrite media URLs that reference old/suspended backend domains
    return reviews.map(r => ({
      ...r,
      images: r.images?.map(fixMediaUrl),
      videos: r.videos?.map(fixMediaUrl),
    }));
  } catch (error: any) {
    console.error('Error fetching reviews from MongoDB:', error);
    throw error;
  }
}

/**
 * Create a new review
 */
export async function createReview(reviewData: {
  dateNightId: string;
  userId: string;
  userName?: string;
  rating: number;
  message: string;
  emoji?: string;
  images?: string[];
  videos?: string[];
}): Promise<MongoDBReview> {
  try {
    const review = await apiRequest<MongoDBReview>(
      API_ENDPOINTS.REVIEWS.CREATE,
      {
        method: 'POST',
        body: JSON.stringify(reviewData),
      }
    );
    return review;
  } catch (error: any) {
    console.error('Error creating review in MongoDB:', error);
    throw error;
  }
}

/**
 * Set up polling for real-time updates
 * Returns a cleanup function
 */
export function startReviewPolling(
  dateNightId: string,
  onUpdate: (reviews: MongoDBReview[]) => void,
  intervalMs: number = 5000
): () => void {
  let isPolling = true;
  let pollInterval: ReturnType<typeof setTimeout> | null = null;

  const poll = async () => {
    if (!isPolling) return;

    try {
      const reviews = await getReviewsForDateNight(dateNightId);
      onUpdate(reviews);
    } catch (error) {
      console.error('Polling error:', error);
      // Continue polling even on error
    }
  };

  // Initial fetch
  poll();

  // Set up interval
  pollInterval = setInterval(poll, intervalMs);

  // Return cleanup function
  return () => {
    isPolling = false;
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  };
}
