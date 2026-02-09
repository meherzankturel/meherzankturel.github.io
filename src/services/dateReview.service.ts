import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface DateReview {
  id?: string;
  dateNightId: string;
  userId: string;
  userName?: string;
  rating: number; // 1-5 stars
  message: string;
  emoji?: string;
  images?: string[]; // URLs to uploaded images
  videos?: string[]; // URLs to uploaded videos
  createdAt: any;
  updatedAt: any;
}

export class DateReviewService {
  /**
   * Create a review for a date night
   */
  static async createReview(
    dateNightId: string,
    userId: string,
    review: Omit<DateReview, 'id' | 'dateNightId' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const reviewData: any = {
        dateNightId,
        userId,
        rating: review.rating,
        message: review.message,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Only include optional fields if they have values
      if (review.emoji && review.emoji.trim()) {
        reviewData.emoji = review.emoji.trim();
      }
      
      if (review.images && Array.isArray(review.images) && review.images.length > 0) {
        reviewData.images = review.images;
      }
      
      if (review.videos && Array.isArray(review.videos) && review.videos.length > 0) {
        reviewData.videos = review.videos;
      }
      
      if (review.userName && review.userName.trim()) {
        reviewData.userName = review.userName.trim();
      }
      
      const docRef = await addDoc(collection(db, 'dateReviews'), reviewData);
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create review');
    }
  }

  /**
   * Get reviews for a date night
   */
  static async getReviews(dateNightId: string): Promise<DateReview[]> {
    try {
      const q = query(
        collection(db, 'dateReviews'),
        where('dateNightId', '==', dateNightId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as DateReview[];
    } catch (error: any) {
      // Fallback: try without orderBy if index is missing
      try {
        const fallbackQ = query(
          collection(db, 'dateReviews'),
          where('dateNightId', '==', dateNightId)
        );
        const snapshot = await getDocs(fallbackQ);
        const reviews = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as DateReview[];
        
        // Sort manually by createdAt
        reviews.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return bTime - aTime; // Descending
        });
        
        return reviews;
      } catch (fallbackError: any) {
        throw new Error(error.message || 'Failed to get reviews');
      }
    }
  }

  /**
   * Update a review
   */
  static async updateReview(
    reviewId: string,
    updates: Partial<DateReview>
  ): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: serverTimestamp(),
      };
      
      // Only include fields that are actually provided and not undefined
      if (updates.rating !== undefined) {
        updateData.rating = updates.rating;
      }
      
      if (updates.message !== undefined && updates.message.trim()) {
        updateData.message = updates.message.trim();
      }
      
      if (updates.emoji !== undefined) {
        if (updates.emoji && updates.emoji.trim()) {
          updateData.emoji = updates.emoji.trim();
        } else {
          // If emoji is empty string, remove it
          updateData.emoji = null;
        }
      }
      
      if (updates.images !== undefined) {
        if (Array.isArray(updates.images) && updates.images.length > 0) {
          updateData.images = updates.images;
        } else {
          // If images array is empty, remove it
          updateData.images = null;
        }
      }
      
      if (updates.videos !== undefined) {
        if (Array.isArray(updates.videos) && updates.videos.length > 0) {
          updateData.videos = updates.videos;
        } else {
          // If videos array is empty, remove it
          updateData.videos = null;
        }
      }
      
      if (updates.userName !== undefined && updates.userName?.trim()) {
        updateData.userName = updates.userName.trim();
      }
      
      await updateDoc(doc(db, 'dateReviews', reviewId), updateData);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update review');
    }
  }

  /**
   * Check if user has already reviewed a date night
   */
  static async hasUserReviewed(dateNightId: string, userId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'dateReviews'),
        where('dateNightId', '==', dateNightId),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error: any) {
      console.error('Error checking review:', error);
      return false;
    }
  }

  /**
   * Get user's review for a date night
   */
  static async getUserReview(dateNightId: string, userId: string): Promise<DateReview | null> {
    try {
      const q = query(
        collection(db, 'dateReviews'),
        where('dateNightId', '==', dateNightId),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      } as DateReview;
    } catch (error: any) {
      console.error('Error getting user review:', error);
      return null;
    }
  }

  /**
   * Check if both partners have reviewed a date night
   */
  static async bothPartnersReviewed(
    dateNightId: string,
    userId1: string,
    userId2: string
  ): Promise<boolean> {
    try {
      const [user1Reviewed, user2Reviewed] = await Promise.all([
        this.hasUserReviewed(dateNightId, userId1),
        this.hasUserReviewed(dateNightId, userId2),
      ]);
      
      return user1Reviewed && user2Reviewed;
    } catch (error: any) {
      console.error('Error checking both partners reviewed:', error);
      return false;
    }
  }

  /**
   * Get missing reviews for a date night
   * Returns array of userIds who haven't reviewed yet
   */
  static async getMissingReviews(
    dateNightId: string,
    userId1: string,
    userId2: string
  ): Promise<string[]> {
    try {
      const [user1Reviewed, user2Reviewed] = await Promise.all([
        this.hasUserReviewed(dateNightId, userId1),
        this.hasUserReviewed(dateNightId, userId2),
      ]);
      
      const missing: string[] = [];
      if (!user1Reviewed) missing.push(userId1);
      if (!user2Reviewed) missing.push(userId2);
      
      return missing;
    } catch (error: any) {
      console.error('Error getting missing reviews:', error);
      return [];
    }
  }

  /**
   * Subscribe to reviews for a date night in real-time
   */
  static subscribeToReviews(
    dateNightId: string,
    callback: (reviews: DateReview[]) => void
  ): Unsubscribe {
    // Helper function to sort reviews
    const sortReviews = (reviews: DateReview[]): DateReview[] => {
      return [...reviews].sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime; // Descending (newest first)
      });
    };
    
    let unsubscribe: Unsubscribe | null = null;
    
    // Try with orderBy first
    const q = query(
      collection(db, 'dateReviews'),
      where('dateNightId', '==', dateNightId),
      orderBy('createdAt', 'desc')
    );
    
    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reviews = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as DateReview[];
        callback(reviews);
      },
      (error) => {
        console.warn('Review listener error (using fallback):', error);
        // Fallback: use query without orderBy and sort manually
        const fallbackQ = query(
          collection(db, 'dateReviews'),
          where('dateNightId', '==', dateNightId)
        );
        
        // Unsubscribe from the failed listener
        if (unsubscribe) {
          unsubscribe();
        }
        
        // Start fallback listener
        unsubscribe = onSnapshot(fallbackQ, (snapshot) => {
          const reviews = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as DateReview[];
          callback(sortReviews(reviews));
        }, (fallbackError) => {
          console.warn('Review fallback listener also failed:', fallbackError);
          callback([]);
        });
      }
    );
    
    // Return unsubscribe function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }
}

