# Pre-Release Distribution Guide

## 🎯 Goal
Give 2 people access to SYNC app before App Store approval.

---

## ✅ **RECOMMENDED: TestFlight (iOS) - Best Option**

### Why TestFlight?
- ✅ Official Apple solution (no hacks)
- ✅ Easy for testers (just install TestFlight app)
- ✅ Automatic updates
- ✅ No App Store approval needed
- ✅ Can add up to 10,000 testers
- ✅ Professional and trustworthy

### Prerequisites
1. **Apple Developer Account** ($99/year)
   - If you don't have one: https://developer.apple.com/programs/
2. **App Store Connect** access
   - Link your Apple ID to your developer account

### Steps

#### 1. Build the App
```bash
cd "/Users/harshiv/Documents/Meherzan Boundless/SYNC"
eas build --platform ios --profile preview
```

This will:
- Build your app in the cloud
- Create an IPA file
- Take ~15-20 minutes

#### 2. Submit to TestFlight
```bash
eas submit --platform ios --profile preview
```

This uploads to App Store Connect automatically.

#### 3. Add Testers in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Select your app → TestFlight tab
3. Add Internal Testers (up to 100):
   - Go to "Internal Testing"
   - Click "+" to add testers
   - Enter their Apple ID emails
4. Or External Testers (up to 10,000):
   - Go to "External Testing"
   - Add testers
   - Submit for Beta App Review (usually approved in 24-48 hours)

#### 4. Testers Install
1. Testers install **TestFlight** app from App Store
2. They receive email invitation
3. Open TestFlight → Accept invitation
4. Install SYNC app

---

## 🚀 **ALTERNATIVE: EAS Internal Distribution**

### Why This?
- ✅ Works for both iOS and Android
- ✅ No App Store Connect needed
- ✅ Direct download link
- ✅ Faster setup

### Steps

#### 1. Build for Internal Distribution
```bash
# iOS
eas build --platform ios --profile preview --distribution internal

# Android
eas build --platform android --profile preview --distribution internal
```

#### 2. Get Download Links
After build completes:
1. Go to https://expo.dev/accounts/meherzan/projects/sync-app/builds
2. Find your build
3. Copy the download link
4. Share with your 2 testers

#### 3. Testers Install

**iOS:**
- Open link on iPhone
- Tap "Install"
- Go to Settings → General → VPN & Device Management
- Trust your developer certificate
- Open app

**Android:**
- Open link on Android
- Download APK
- Enable "Install from Unknown Sources" if needed
- Install

---

## 📱 **QUICK: Direct APK (Android Only)**

If testers are on Android and you want the fastest option:

### Steps
```bash
eas build --platform android --profile preview --distribution internal
```

Then:
1. Download APK from EAS dashboard
2. Share APK file directly (email, Dropbox, etc.)
3. Testers install APK

---

## 🔧 **Setup Checklist**

Before building, make sure:

- [ ] **EAS CLI installed**: `npm install -g eas-cli`
- [ ] **Logged in**: `eas login`
- [ ] **Configured**: `eas build:configure` (if not done)
- [ ] **Apple Developer Account**: Active membership
- [ ] **App Store Connect**: App created
- [ ] **Bundle ID**: `com.sync.app` matches in App Store Connect

---

## 📋 **Comparison Table**

| Method | iOS | Android | Setup Time | Ease of Use | Updates |
|--------|-----|---------|------------|-------------|---------|
| **TestFlight** | ✅ | ❌ | 30 min | ⭐⭐⭐⭐⭐ | Auto |
| **EAS Internal** | ✅ | ✅ | 15 min | ⭐⭐⭐⭐ | Manual |
| **Direct APK** | ❌ | ✅ | 10 min | ⭐⭐⭐ | Manual |

---

## 🎯 **Recommended Approach for 2 Testers**

### If both have iPhones:
**→ Use TestFlight** (most professional, easiest for them)

### If mixed (iOS + Android):
**→ Use EAS Internal Distribution** (works for both)

### If both have Android:
**→ Direct APK** (fastest)

---

## 🚨 **Important Notes**

### For iOS:
- Testers need iOS 13.0 or later
- They need to install TestFlight app first (if using TestFlight)
- For internal distribution, they need to trust your developer certificate

### For Android:
- Testers need Android 5.0 or later
- They may need to enable "Install from Unknown Sources"
- APK file size might be large (share via cloud storage)

### Security:
- Internal builds expire after 90 days (TestFlight)
- You'll need to rebuild and redistribute periodically
- Consider setting up automatic builds

---

## 🔄 **Updating the App**

### TestFlight:
- Build new version: `eas build --platform ios --profile preview`
- Submit: `eas submit --platform ios --profile preview`
- Testers get automatic update notification

### EAS Internal:
- Build new version
- Share new download link
- Testers download and install (replaces old version)

---

## 💡 **Pro Tips**

1. **Version Numbers**: Update `app.json` version before each build
   ```json
   "version": "1.0.1"
   ```

2. **Build Profiles**: Your `eas.json` already has a "preview" profile configured - perfect for this!

3. **Environment Variables**: Make sure your backend URLs are correct in `eas.json`

4. **Notifications**: Testers should enable notifications for best experience

5. **Feedback**: Set up a way to collect feedback (email, Discord, etc.)

---

## 📞 **Quick Commands Reference**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure (first time)
eas build:configure

# Build iOS for TestFlight
eas build --platform ios --profile preview

# Build Android APK
eas build --platform android --profile preview

# Submit to TestFlight
eas submit --platform ios --profile preview

# Check build status
eas build:list
```

---

## 🆘 **Troubleshooting**

### "No Apple Developer Account"
- Sign up at https://developer.apple.com/programs/
- Takes 24-48 hours for approval

### "Build Failed"
- Check `eas.json` configuration
- Verify bundle ID matches App Store Connect
- Check EAS build logs

### "Testers can't install"
- iOS: Check if device UDID is registered (for ad-hoc)
- Android: Enable "Unknown Sources"
- Check if build is still valid (90-day expiration)

---

## ✅ **Next Steps**

1. **Choose your method** (TestFlight recommended)
2. **Run the build command**
3. **Add testers**
4. **Share instructions with testers**
5. **Collect feedback**
6. **Iterate and rebuild**

---

**Good luck! 🚀**
