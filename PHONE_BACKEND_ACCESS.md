# Phone Can't Reach Backend (Use ngrok)

When **curl works on your Mac** but the **phone still can't reach** `http://192.168.2.131:3000`, the usual causes are:

- **Expo Go** – iOS may block plain HTTP from the app (our ATS setting only applies to custom builds).
- **macOS Firewall** – Blocking incoming connections from the phone.
- **Router** – Some Wi‑Fi networks block device-to-device traffic.

**Fix: expose your backend with ngrok (HTTPS).** The phone then talks to an `https://...ngrok.io` URL; ngrok forwards to your Mac. No firewall or same-network issues, and HTTPS is allowed by iOS.

---

## 1. Install ngrok

```bash
# macOS (Homebrew)
brew install ngrok

# Or download from https://ngrok.com/download
```

Sign up at [ngrok.com](https://ngrok.com) (free), then:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

---

## 2. Start backend and ngrok

**Terminal 1 – backend:**

```bash
cd backend && npm run dev
```

**Terminal 2 – ngrok:**

```bash
ngrok http 3000
```

You’ll see something like:

```
Forwarding   https://abc123def.ngrok-free.app -> http://localhost:3000
```

Copy the **HTTPS** URL (e.g. `https://abc123def.ngrok-free.app`).

---

## 3. Point the app at ngrok

**Option A – `.env` (recommended)**

In the **SYNC project root** (same folder as `package.json`), create or edit `.env`:

```env
EXPO_PUBLIC_MONGODB_API_URL=https://YOUR_NGROK_SUBDOMAIN.ngrok-free.app/api
```

Example:

```env
EXPO_PUBLIC_MONGODB_API_URL=https://abc123def.ngrok-free.app/api
```

No trailing slash. Restart Expo and reload the app (`r` in terminal or shake → Reload).

**Option B – one-off run**

```bash
EXPO_PUBLIC_MONGODB_API_URL=https://abc123def.ngrok-free.app/api npx expo start --tunnel
```

---

## 4. Try upload again

The app will use the ngrok URL. The health check and upload should work from the phone.

**Note:** With the free ngrok plan the URL changes each time you run `ngrok http 3000`. Update `.env` (or the command) whenever you restart ngrok. Paid/static domains keep the same URL.

---

## Quick checklist

| Step | Command / action |
|------|-------------------|
| 1 | `cd backend && npm run dev` |
| 2 | In another terminal: `ngrok http 3000` |
| 3 | Copy the `https://....ngrok-free.app` URL |
| 4 | In SYNC root: `.env` with `EXPO_PUBLIC_MONGODB_API_URL=https://....ngrok-free.app/api` |
| 5 | Restart Expo, reload app, try upload |
