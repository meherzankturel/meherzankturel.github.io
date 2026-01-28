# SYNC Codebase Overview

## 📱 Project Summary

**SYNC** is a React Native/Expo mobile application designed for couples in long-distance relationships. It provides features for emotional connection, shared experiences, and emergency communication.

**Tech Stack:**
- **Frontend**: React Native with Expo (~54.0.31)
- **Backend**: Firebase (Auth, Firestore, Functions, Storage) + Express.js API (MongoDB)
- **Navigation**: Expo Router (file-based routing)
- **Language**: TypeScript

---

## 🏗️ Architecture Overview

### Frontend Structure

```
SYNC/
├── app/                    # Expo Router screens (file-based routing)
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/            # Main app tabs
│   │   ├── index.tsx      # Home/Dashboard
│   │   ├── moods.tsx
│   │   ├── date-nights.tsx
│   │   ├── games.tsx
│   │   ├── gentle-days.tsx
│   │   └── manifestations.tsx
│   ├── settings/          # Settings screens
│   └── _layout.tsx        # Root layout with AuthProvider
│
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── MoodSelector.tsx
│   │   ├── DateCalendar.tsx
│   │   └── ... (30+ components)
│   │
│   ├── services/          # Business logic & API calls
│   │   ├── auth.service.ts
│   │   ├── pair.service.ts
│   │   ├── mood.service.ts
│   │   ├── dateNight.service.ts
│   │   ├── sos.service.ts
│   │   ├── game.service.ts
│   │   └── ... (15+ services)
│   │
│   ├── contexts/          # React Context providers
│   │   └── AuthContext.tsx
│   │
│   ├── config/           # Configuration files
│   │   ├── firebase.ts    # Firebase initialization
│   │   ├── mongodb.ts     # MongoDB config
│   │   └── theme.ts       # Design system
│   │
│   └── utils/            # Utility functions
│       ├── notifications.ts
│       └── pairIdDebug.ts
│
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── index.ts      # Express app setup
│   │   ├── routes/       # API routes
│   │   ├── models/       # MongoDB models
│   │   └── utils/        # File upload, GridFS
│   └── package.json
│
└── functions/            # Firebase Cloud Functions
    └── src/
        └── index.ts      # Cloud Functions (invites, notifications)
```

---

## 🔑 Key Features

### 1. **Authentication & Pairing**
- Email/password authentication via Firebase Auth
- Pair creation system: one user invites another via email
- Invite token system with expiration (7 days)
- Real-time pair status tracking

**Key Files:**
- `src/services/auth.service.ts` - Authentication logic
- `src/services/pair.service.ts` - Pair management
- `src/contexts/AuthContext.tsx` - Auth state management

### 2. **Mood Sharing**
- 8 mood types: happy, calm, neutral, sad, anxious, excited, grateful, loved
- Optional notes and causes (partner, work, health, etc.)
- Mood timeline and insights (last 7 days)
- Partner reactions to moods (hug, heart, support, etc.)

**Key Files:**
- `src/services/mood.service.ts` - Mood CRUD operations
- `app/(tabs)/moods.tsx` - Mood UI

### 3. **Date Nights**
- Create scheduled date nights with calendar integration
- Automatic calendar event creation (iOS Calendar)
- FaceTime deep links for virtual dates
- Reminders and notifications
- Completion tracking

**Key Files:**
- `src/services/dateNight.service.ts` - Date night management
- `app/(tabs)/date-nights.tsx` - Date night UI

### 4. **SOS Emergency Feature**
- One-tap emergency contact
- Smart connectivity detection (internet vs. cellular)
- FaceTime launch (if internet available)
- Fallback to regular phone call (works offline)
- Urgent push notifications to partner
- Firestore event logging

**Key Files:**
- `src/services/sos.service.ts` - SOS logic with connectivity checks
- `app/settings/sos.tsx` - SOS settings

### 5. **Games & Activities**
- Question games (AI-generated personalized questions)
- Would You Rather
- Trivia
- Tic-Tac-Toe
- Choice games

**Key Files:**
- `src/services/game.service.ts` - Game logic
- `app/(tabs)/games.tsx` - Game selection
- `functions/src/index.ts` - AI question generation

### 6. **Gentle Days**
- Feature for tracking special days together
- Partner coordination

**Key Files:**
- `src/services/gentleDays.service.ts`
- `app/(tabs)/gentle-days.tsx`

### 7. **Manifestations**
- Shared goals and dreams
- Progress tracking
- Milestone celebrations

**Key Files:**
- `src/services/manifestation.service.ts`
- `app/(tabs)/manifestations.tsx`

### 8. **Presence System**
- Real-time status when partner opens app
- "Thinking of you" notifications

**Key Files:**
- `src/services/presence.service.ts`

---

## 🔧 Backend Architecture

### Firebase Services
1. **Firestore Database**
   - Collections: `users`, `pairs`, `moods`, `dateNights`, `sosEvents`, `games`, etc.
   - Security rules: Currently open (expires Feb 2, 2026) - **needs proper rules**

2. **Firebase Auth**
   - Email/password authentication
   - User profile management

3. **Firebase Cloud Functions**
   - `createInvite` - Generate invite codes
   - `acceptInvite` - Link users in pairs
   - `generateGameQuestions` - AI-powered question generation
   - `onMoodCreated` - Trigger notifications

4. **Firebase Storage**
   - Media uploads (photos, videos)
   - Profile pictures

### Express.js API (MongoDB)
Located in `/backend`:
- **MongoDB Atlas** connection
- **GridFS** for large file storage
- Routes:
  - `/api/media` - Media upload/download
  - `/api/auth` - Auth endpoints
  - `/api/reviews` - Date reviews
  - `/api/moments` - Shared moments

**Note**: Backend can run locally or deploy to Vercel (serverless)

---

## 📦 Key Dependencies

### Core
- `expo` (~54.0.31)
- `react` (19.1.0)
- `react-native` (0.81.5)
- `expo-router` (~6.0.21) - File-based routing

### Firebase
- `firebase` (^10.14.1)

### Features
- `expo-calendar` (~15.0.8) - Calendar integration
- `expo-notifications` (~0.32.16) - Push notifications
- `expo-location` (~19.0.8) - Location services
- `expo-image-picker` (~17.0.10) - Photo selection
- `@react-native-community/netinfo` (11.4.1) - Network detection

### Backend
- `express` - API server
- `mongoose` - MongoDB ODM
- `cors` - CORS middleware

---

## 🔐 Security & Configuration

### Current Security Status
⚠️ **Firestore rules are currently open** (expires Feb 2, 2026)
- Need to implement proper pair-based access control
- Rules file: `firestore.rules`

### Firebase Configuration
- Config file: `src/config/firebase.ts`
- Project: `boundless-d2a20`
- Currently configured with production credentials

### MongoDB
- Connection string in `backend/src/index.ts`
- Uses MongoDB Atlas cluster

---

## 🚀 Running the Project

### Frontend (Expo)
```bash
npm install
npm start              # Start Expo dev server
npm run ios           # Run on iOS simulator
npm run android      # Run on Android emulator
```

### Backend (Express)
```bash
cd backend
npm install
npm start             # Runs on port 3000
```

### Firebase Functions
```bash
cd functions
npm install
firebase deploy --only functions
```

---

## 📝 Important Notes

1. **Firebase Setup Required**
   - Project is configured but may need your own Firebase project
   - See `START_HERE.md` for setup guide

2. **MongoDB Setup**
   - Backend requires MongoDB Atlas connection
   - Connection string in `backend/src/index.ts`

3. **Platform Support**
   - Primarily iOS-focused (FaceTime integration)
   - Android support exists but may have limitations

4. **Offline Support**
   - SOS feature works offline (phone calls)
   - Firestore offline persistence enabled
   - Network detection for smart connectivity

5. **Calendar Integration**
   - iOS Calendar integration via `expo-calendar`
   - Automatic event creation/deletion
   - Cross-device sync via Firestore

---

## 🎯 Development Status

### ✅ Completed
- Core services (auth, pairs, moods, dates, SOS, games)
- UI components library
- Firebase integration
- Backend API structure
- Calendar integration
- Push notifications

### 🚧 Needs Attention
- Firestore security rules (currently open)
- Production Firebase project setup
- Error handling improvements
- Testing coverage
- Documentation

---

## 📚 Documentation Files

The repository contains extensive documentation:
- `START_HERE.md` - Quick start guide
- `FIREBASE_SETUP_BOUNDLESS.md` - Firebase setup
- `IMPLEMENTATION_STATUS.md` - Feature status
- `HOW_TO_RUN.md` - Running instructions
- `PRODUCTION_READY_CHECKLIST.md` - Production checklist

---

## 🔍 Key Design Patterns

1. **Service Layer Pattern**
   - All business logic in `src/services/`
   - Services are static classes with static methods
   - Separation of concerns

2. **Context API**
   - `AuthContext` for global auth state
   - Protected route logic in `_layout.tsx`

3. **File-based Routing**
   - Expo Router handles navigation
   - `(auth)` and `(tabs)` are route groups

4. **TypeScript**
   - Full type safety
   - Interfaces for all data models

---

## 🐛 Known Issues / TODOs

1. Firestore security rules need implementation
2. Some error handling could be improved
3. Network detection in SOS could be more robust
4. Calendar event deletion fallback logic is complex
5. AI question generation is placeholder (needs OpenAI/Gemini integration)

---

## 📞 Support & Resources

- Firebase Console: https://console.firebase.google.com/
- Expo Docs: https://docs.expo.dev/
- React Native Docs: https://reactnative.dev/

---

**Last Updated**: January 27, 2026
**Repository**: https://github.com/meherzankturel/SYNC
