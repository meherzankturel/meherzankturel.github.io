import {
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
} from 'firebase/auth';
import {
  doc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/**
 * Account Deletion Service
 *
 * Apple App Store requires apps to provide a way for users to request
 * account and data deletion. This service handles the complete deletion
 * of user data across all Firestore collections and Firebase Auth.
 */
export class AccountDeletionService {
  /**
   * Reauthenticate user before sensitive operations
   * Required by Firebase before account deletion
   */
  static async reauthenticate(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('No authenticated user found');
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  }

  /**
   * Delete all user data from Firestore
   */
  static async deleteUserData(userId: string, pairId?: string): Promise<void> {
    const batch = writeBatch(db);
    const collectionsToClean = [
      'moods',
      'moments',
      'dateNights',
      'manifestations',
      'games',
      'gentleDays',
      'sosEvents',
      'dailyEcho',
      'presence',
      'notifications',
      'pushTokens',
    ];

    // Delete documents where userId matches
    for (const collectionName of collectionsToClean) {
      try {
        const q = query(
          collection(db, collectionName),
          where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        console.log(`Marked ${snapshot.docs.length} docs for deletion from ${collectionName}`);
      } catch (error) {
        console.warn(`Error querying ${collectionName}:`, error);
      }
    }

    // Delete user profile
    try {
      const userRef = doc(db, 'users', userId);
      batch.delete(userRef);
      console.log('Marked user profile for deletion');
    } catch (error) {
      console.warn('Error deleting user profile:', error);
    }

    // Handle pair relationship
    if (pairId) {
      try {
        const pairRef = doc(db, 'pairs', pairId);
        // Mark pair as inactive rather than deleting to preserve partner's context
        batch.update(pairRef, {
          status: 'inactive',
          [`deletedUser_${userId}`]: true,
          updatedAt: serverTimestamp(),
        });
        console.log('Marked pair as inactive');
      } catch (error) {
        console.warn('Error updating pair:', error);
      }
    }

    // Commit all deletions
    await batch.commit();
    console.log('All user data deleted from Firestore');
  }

  /**
   * Delete user's invites
   */
  static async deleteUserInvites(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'invites'),
        where('creatorId', '==', userId)
      );
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      if (snapshot.docs.length > 0) {
        await batch.commit();
        console.log(`Deleted ${snapshot.docs.length} invites`);
      }
    } catch (error) {
      console.warn('Error deleting invites:', error);
    }
  }

  /**
   * Request account deletion
   * This creates a deletion request that can be processed by backend
   */
  static async requestAccountDeletion(userId: string, reason?: string): Promise<string> {
    const requestId = `deletion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create deletion request document
    await doc(db, 'deletionRequests', requestId);

    // Store the request
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'deletionRequests', requestId), {
      userId,
      reason,
      status: 'pending',
      requestedAt: serverTimestamp(),
    });

    return requestId;
  }

  /**
   * Complete account deletion
   * Deletes all user data and the Firebase Auth account
   *
   * @param password - User's password for reauthentication
   * @param pairId - Optional pair ID to handle relationship cleanup
   */
  static async deleteAccount(password: string, pairId?: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user found');
    }

    const userId = user.uid;

    try {
      // Step 1: Reauthenticate
      console.log('Step 1: Reauthenticating user...');
      await this.reauthenticate(password);

      // Step 2: Delete Firestore data
      console.log('Step 2: Deleting Firestore data...');
      await this.deleteUserData(userId, pairId);

      // Step 3: Delete invites
      console.log('Step 3: Deleting invites...');
      await this.deleteUserInvites(userId);

      // Step 4: Delete Firebase Auth account
      console.log('Step 4: Deleting Firebase Auth account...');
      await deleteUser(user);

      console.log('Account deletion completed successfully');
    } catch (error: any) {
      console.error('Account deletion failed:', error);

      if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      }
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please sign out and sign in again before deleting your account.');
      }

      throw new Error(error.message || 'Failed to delete account. Please try again.');
    }
  }

  /**
   * Get deletion request status
   */
  static async getDeletionRequestStatus(requestId: string): Promise<string | null> {
    try {
      const { getDoc } = await import('firebase/firestore');
      const requestDoc = await getDoc(doc(db, 'deletionRequests', requestId));

      if (requestDoc.exists()) {
        return requestDoc.data().status;
      }
      return null;
    } catch (error) {
      console.error('Error getting deletion request status:', error);
      return null;
    }
  }
}

export default AccountDeletionService;
