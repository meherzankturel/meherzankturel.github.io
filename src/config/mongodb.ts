/**
 * MONGODB ATLAS API CONFIGURATION
 * 
 * This file exports MongoDB Atlas API service configuration.
 * 
 * To configure:
 * 1. Get your MongoDB Atlas API endpoint from your backend
 * 2. Update the API_BASE_URL below
 * 3. Ensure your backend handles authentication and CORS
 */

/**
 * MongoDB Atlas API Configuration
 * 
 * Production: Set EXPO_PUBLIC_MONGODB_API_URL to your deployed backend URL
 * Development: Uses localhost (for simulator) or can be overridden
 */
const getApiUrl = (): string => {
  // Priority 1: Environment variable (for production)
  if (process.env.EXPO_PUBLIC_MONGODB_API_URL) {
    return process.env.EXPO_PUBLIC_MONGODB_API_URL;
  }

  // Priority 2: Production build detection
  if (process.env.NODE_ENV === 'production') {
    // Default production URL - update this with your deployed backend URL
    return 'https://your-backend.vercel.app/api';
  }

  // Priority 3: Development fallback
  // Use your computer's IP for physical device testing (phone must be on same Wi-Fi)
  return 'http://192.168.2.121:3000/api';
};

export const MONGODB_API_BASE_URL = getApiUrl();

// Log the API URL being used (helpful for debugging)
if (__DEV__) {
  console.log('📍 MongoDB API URL:', MONGODB_API_BASE_URL);
}

// API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    SIGNUP: '/auth/signup',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    RESET_PASSWORD: '/auth/reset-password',
  },

  // User endpoints
  USERS: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    GET_USER: (userId: string) => `/users/${userId}`,
  },

  // Pair endpoints
  PAIRS: {
    CREATE: '/pairs',
    GET: (pairId: string) => `/pairs/${pairId}`,
    JOIN: (pairId: string) => `/pairs/${pairId}/join`,
    INVITE: '/pairs/invite',
  },

  // Date Night endpoints
  DATE_NIGHTS: {
    CREATE: '/date-nights',
    GET_ALL: '/date-nights',
    GET: (id: string) => `/date-nights/${id}`,
    UPDATE: (id: string) => `/date-nights/${id}`,
    DELETE: (id: string) => `/date-nights/${id}`,
  },

  // Review endpoints
  REVIEWS: {
    CREATE: '/reviews',
    GET_BY_DATE_NIGHT: (dateNightId: string) => `/reviews/date-night/${dateNightId}`,
    GET: (id: string) => `/reviews/${id}`,
    UPDATE: (id: string) => `/reviews/${id}`,
    DELETE: (id: string) => `/reviews/${id}`,
  },

  // Media upload endpoints
  MEDIA: {
    UPLOAD: '/media/upload',
    UPLOAD_MULTIPLE: '/media/upload-multiple',
    GET: (id: string) => `/media/${id}`,
    DELETE: (id: string) => `/media/${id}`,
  },

  // Mood endpoints
  MOODS: {
    CREATE: '/moods',
    GET_TIMELINE: '/moods/timeline',
    GET_TODAY: '/moods/today',
  },

  // Game endpoints
  GAMES: {
    CREATE_SESSION: '/games/sessions',
    GET_SESSION: (id: string) => `/games/sessions/${id}`,
    SUBMIT_ANSWER: (sessionId: string) => `/games/sessions/${sessionId}/answers`,
  },

  // Manifestation endpoints
  MANIFESTATIONS: {
    CREATE: '/manifestations',
    GET_ALL: '/manifestations',
    UPDATE: (id: string) => `/manifestations/${id}`,
    DELETE: (id: string) => `/manifestations/${id}`,
  },

  // Moment endpoints
  MOMENTS: {
    UPLOAD: '/moments/upload',
    GET_TODAY: (userId: string, partnerId: string) => `/moments/today/${userId}/${partnerId}`,
    GET_HISTORY: (pairId: string) => `/moments/history/${pairId}`,
    UPDATE_CAPTION: (momentId: string) => `/moments/${momentId}/caption`,
  },
};

/**
 * Make API request to MongoDB Atlas backend
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!MONGODB_API_BASE_URL) {
    throw new Error('MongoDB API base URL is not configured. Please set EXPO_PUBLIC_MONGODB_API_URL or update src/config/mongodb.ts');
  }

  const url = `${MONGODB_API_BASE_URL}${endpoint}`;

  // Get auth token from storage if available
  // TODO: Implement token storage/retrieval
  const token = ''; // Get from AsyncStorage or auth context

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error: any) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Upload file(s) to MongoDB Atlas backend
 * For React Native, we need to send files using FormData
 */
export async function uploadMedia(
  files: Array<{ uri: string; type: 'image' | 'video'; name?: string }>,
  onProgress?: (progress: number) => void
): Promise<string[]> {
  if (!MONGODB_API_BASE_URL || MONGODB_API_BASE_URL === '') {
    throw new Error('MongoDB API base URL is not configured. Please start the backend server or set EXPO_PUBLIC_MONGODB_API_URL');
  }

  // For localhost in React Native, we need to use the actual IP address or ngrok
  // Check if it's localhost and provide helpful warning
  if (MONGODB_API_BASE_URL.includes('localhost') || MONGODB_API_BASE_URL.includes('127.0.0.1')) {
    console.warn('⚠️ Using localhost for API. If testing on a physical device, use your computer\'s IP address instead.');
  }

  const formData = new FormData();

  // Add all files to FormData with proper React Native format
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileExtension = file.uri.split('.').pop()?.toLowerCase() || (file.type === 'image' ? 'jpg' : 'mp4');
    const fileName = file.name || `file_${Date.now()}_${i}.${fileExtension}`;

    // Determine MIME type based on file extension and type
    let mimeType = 'application/octet-stream';
    if (file.type === 'image') {
      if (fileExtension === 'png') mimeType = 'image/png';
      else if (fileExtension === 'gif') mimeType = 'image/gif';
      else if (fileExtension === 'webp') mimeType = 'image/webp';
      else if (fileExtension === 'heic' || fileExtension === 'heif') mimeType = 'image/heic';
      else mimeType = 'image/jpeg';
    } else if (file.type === 'video') {
      if (fileExtension === 'mov') mimeType = 'video/quicktime';
      else mimeType = 'video/mp4';
    }

    console.log(`📁 Adding file ${i + 1}: ${fileName} (${mimeType})`);
    console.log(`   URI: ${file.uri.substring(0, 100)}...`);

    // In React Native, FormData accepts objects with uri, type, and name
    // The 'files' field name should match what the backend expects
    formData.append('files', {
      uri: file.uri,
      type: mimeType,
      name: fileName,
    } as any);
  }

  console.log(`📦 FormData prepared with ${files.length} file(s)`);

  // Get auth token from AsyncStorage if available
  // TODO: Implement proper token retrieval from AsyncStorage
  const token = ''; // Get from AsyncStorage or auth context

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${MONGODB_API_BASE_URL}${API_ENDPOINTS.MEDIA.UPLOAD_MULTIPLE}`;

    console.log(`📤 Uploading ${files.length} files to: ${url}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      console.log(`📥 Upload response: ${xhr.status} ${xhr.statusText}`);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          const urls = response.urls || response.data?.urls || [];
          if (urls.length === 0) {
            reject(new Error('Server returned no file URLs'));
            return;
          }
          console.log(`✅ Upload successful. Received ${urls.length} URLs`);
          resolve(urls);
        } catch (error) {
          console.error('❌ Failed to parse upload response:', xhr.responseText);
          reject(new Error('Failed to parse upload response. Server may be returning an error.'));
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          const errorMsg = errorResponse.error || `Upload failed: ${xhr.status} ${xhr.statusText}`;
          console.error(`❌ Upload failed: ${errorMsg}`);
          reject(new Error(errorMsg));
        } catch {
          const errorMsg = `Upload failed: ${xhr.status} ${xhr.statusText}. Make sure the backend server is running.`;
          console.error(`❌ ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      }
    };

    xhr.onerror = (event) => {
      console.error('❌ Upload network error:', event);
      let errorMsg = 'Cannot connect to backend server. ';

      // Check if using localhost
      if (MONGODB_API_BASE_URL.includes('localhost') || MONGODB_API_BASE_URL.includes('127.0.0.1')) {
        errorMsg += 'If testing on a physical device, update src/config/mongodb.ts to use your computer\'s IP address (e.g., http://192.168.1.100:3000/api). ';
      }

      errorMsg += 'Make sure: 1) Backend is running (run: cd backend && npm run dev), 2) Phone and computer are on the same Wi-Fi network.';

      reject(new Error(errorMsg));
    };

    xhr.ontimeout = () => {
      console.error('❌ Upload timeout');
      reject(new Error('Upload failed: Request timeout. The file may be too large or the server is slow.'));
    };

    xhr.open('POST', url);
    xhr.timeout = 300000; // 5 minutes timeout for large files

    // Don't set Content-Type header - let React Native set it with boundary automatically
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.send(formData as any);
  });
}

