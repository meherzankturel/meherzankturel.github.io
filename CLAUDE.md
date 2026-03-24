# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SYNC is a React Native couples app (long-distance relationships) built with Expo 54, Firebase, and MongoDB. The actual project code lives in the `meherzankturel.github.io/` subdirectory.

**Important:** This repo is linked to the live production app. Do not push changes without explicit approval.

## Commands

### Frontend (Expo app)
```bash
npm start              # Start Expo dev server (clears cache)
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npm run web            # Run web version
npm run fix            # Auto-fix Expo dependency versions
npm run doctor         # Diagnose Expo issues
npm run reset          # Nuclear reset: rm node_modules + reinstall
```

### Backend (Express API)
```bash
cd backend
npm run dev            # Dev server with hot reload (ts-node-dev)
npm run build          # Compile TypeScript
npm start              # Run compiled JS
npm run lint           # ESLint on src/
```

### EAS Builds
```bash
eas build --platform ios --profile preview      # Internal iOS build
eas build --platform android --profile preview  # Internal Android APK
eas build --platform ios --profile production   # App Store build
eas build --platform android --profile production  # Play Store build
```

## Architecture

### Dual Backend
- **Firebase** (Firestore + Auth): Real-time user data, authentication, pair management, moods, dates, games, manifestations
- **MongoDB Atlas** (via Express backend on Render): Media file storage (GridFS), date reviews
- Production API: `https://sync-6m58.onrender.com/api`

### Frontend Structure (`app/` + `src/`)
- **Routing**: Expo Router (file-based). Auth screens in `app/(auth)/`, main app in `app/(tabs)/` with 6 tabs
- **State**: React Context (`AuthContext.tsx`) for auth. No external state library — local state + Firebase real-time listeners
- **Services** (`src/services/`): Business logic layer. Each feature has a dedicated service (auth, pair, mood, dateNight, game, moment, gentleDays, manifestation, sos, etc.). Services call Firebase or the MongoDB API
- **Config** (`src/config/`): `firebase.ts` (SDK init), `mongodb.ts` (API client with `apiRequest()` and `uploadMedia()`), `theme.ts` (design system)
- **Components** (`src/components/`): 40+ reusable components. Doodle-themed UI with hand-drawn borders and playful animations

### Backend Structure (`backend/src/`)
- Express server with routes (`media`, `auth`, `reviews`, `moments`), Mongoose models, GridFS for file storage
- Firebase Admin SDK for server-side auth verification
- Middleware: rate limiting, CORS, helmet

### Firebase Cloud Functions (`functions/src/`)
- Email invites and push notifications

### Key Data Flows
- **Auth**: Firebase Auth → `AuthContext` → route guard redirects unauthenticated users to `(auth)/login`
- **Pairing**: User creates pair → Firestore doc with invite token → Cloud Function sends email → partner joins via token
- **Media upload**: Image picker → `uploadMedia()` XHR to Express backend → GridFS storage → URL saved to Firestore
- **Real-time**: Firestore `onSnapshot` listeners for moods, dates, games. MongoDB reviews polled every 5 seconds

## Design System

Defined in `src/config/theme.ts`. Purple primary (`#7f13ec`), pink secondary (`#ff85a2`). Doodle aesthetic throughout. Responsive utilities in `src/utils/responsive.ts` with `scale()`, `verticalScale()`, `moderateScale()`.

## Environment

- `EXPO_PUBLIC_MONGODB_API_URL`: Backend API URL. Set per EAS build profile in `eas.json`. Dev defaults to local IP, preview/production use Render URL
- Backend env vars: `MONGODB_URI`, `FIREBASE_*` credentials (see `backend/.env`)
- iOS bundle ID / Android package: `com.sync.app`

## Codebase Quirks

- `metro.config.js` adds `.cjs` extension support and disables unstable package exports — required for Firebase SDK compatibility
- `babel.config.js` strips console logs in production via `transform-remove-console`
- Some tab screens are very large (date-nights.tsx ~115KB, index.tsx ~98KB) — these contain significant inline logic
- The `gentle-days` tab (period tracking) is a hidden tab not shown in the default tab bar
