# Family Calendar

A shared family calendar with smart event and travel suggestions, powered by Google and Claude AI.

## Features

- Shared calendar synced bidirectionally with Google Calendar
- Any family member can add, edit, or delete events
- Push notification + email 30 minutes before each timed event
- Daily digest at 8pm with tomorrow's schedule
- Weekly digest every Sunday at 6pm
- AI agent discovers local events and travel deals that fit your free time
- Web app (Next.js) + mobile app (Expo / iOS & Android)

## Architecture

```
family-calendar/
├── backend/    Python + FastAPI  (REST API, schedulers, agents)
├── web/        Next.js           (web frontend)
└── mobile/     Expo              (iOS + Android)
```

**Accounts required**

| Account | Purpose | Cost |
|---|---|---|
| Google | Auth, Calendar, Firestore, Vertex AI (Claude), Places, Gmail | Free / pay-per-use |
| Twilio | — (dropped, using Gmail) | — |
| Ticketmaster | Local event discovery | Free |
| Amadeus | Flight deal search | Free |

---

## 1. Google Cloud Setup

Everything runs under a single Google account. You need to complete these steps once.

### 1.1 Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project** → name it `family-calendar` → Create
3. Note your **Project ID** (e.g. `family-calendar-12345`)

### 1.2 Enable APIs

In your project, go to **APIs & Services → Library** and enable:

- Google Calendar API
- Google Places API (New)
- Vertex AI API
- Gmail API *(optional — only needed if Gmail SMTP fails)*

### 1.3 Create OAuth 2.0 credentials

Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.

Create **two** client IDs:

**Web client** (for the Next.js app and backend token exchange):
- Application type: **Web application**
- Authorized JavaScript origins: `http://localhost:3000`
- Authorized redirect URIs: `http://localhost:3000`
- Copy the **Client ID** and **Client Secret**

**Android/iOS client** (for Expo):
- Application type: **Android** (or iOS)
- For development with Expo Go you can use the same Web client ID
- For production builds, create a platform-specific client

### 1.4 OAuth consent screen

Go to **APIs & Services → OAuth consent screen**:
- User type: **External**
- Add scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar`
- Add your Google account as a test user

### 1.5 Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → select your existing Google Cloud project
3. Go to **Firestore Database → Create database** → choose **Native mode**
4. Go to **Project Settings → Service accounts → Generate new private key**
5. Save the downloaded JSON as `backend/firebase-service-account.json`

> ⚠️ This file contains secrets. It is in `.gitignore` and must never be committed.

### 1.6 Enable Vertex AI for Claude

In your Google Cloud project:
1. Go to **Vertex AI → Enable API** (if not already done in step 1.2)
2. In **Model Garden**, find **Claude** (Anthropic) and click **Enable**
3. The service account in your Firebase JSON already has access if you granted it the **Vertex AI User** role

To grant the role:
```
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/aiplatform.user"
```

### 1.7 Gmail App Password (for email notifications)

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. You must have **2-Step Verification** enabled
3. Create a new app password (name it `family-calendar`)
4. Copy the 16-character password

---

## 2. Ticketmaster API Key

1. Sign up at [developer.ticketmaster.com](https://developer.ticketmaster.com) (free)
2. Go to **My Apps → Add a New App**
3. Copy your **Consumer Key** (this is your API key)

---

## 3. Amadeus API Credentials

1. Sign up at [developers.amadeus.com](https://developers.amadeus.com) (free)
2. Go to **My Apps → Create new app**
3. Copy your **API Key** (Client ID) and **API Secret** (Client Secret)

> The free sandbox environment is sufficient for testing. Switch to production when ready.

---

## 4. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_web_client_id
GOOGLE_CLIENT_SECRET=your_web_client_secret

# Firebase
FIREBASE_PROJECT_ID=family-calendar-12345
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json

# Google Cloud (Vertex AI)
GOOGLE_CLOUD_PROJECT=family-calendar-12345
VERTEX_AI_LOCATION=us-east5

# Points to the same service account JSON (for Vertex AI auth)
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json

# JWT
JWT_SECRET=replace-with-a-long-random-string

# Gmail
GMAIL_ADDRESS=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Ticketmaster
TICKETMASTER_API_KEY=your_ticketmaster_key

# Amadeus
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
```

Place your `firebase-service-account.json` in the `backend/` directory.

**Run the backend:**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

API docs available at [http://localhost:8000/docs](http://localhost:8000/docs)

**Firestore indexes required** (Firestore will prompt with a link on first query):
- Collection `events`: `family_id` ASC + `start_datetime` ASC

---

## 5. Web Setup

```bash
cd web
npm install

cp .env.local.example .env.local
```

Edit `web/.env.local`:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_web_client_id
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Run the web app:**

```bash
npm run dev
# Opens at http://localhost:3000
```

---

## 6. Mobile Setup

```bash
cd mobile
npm install

cp .env.example .env
```

Edit `mobile/.env`:

```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_web_client_id
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000   # your machine's local IP, not localhost
```

> Use your machine's local network IP (not `localhost`) so the physical device or emulator can reach the backend.

**Run the mobile app:**

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app (iOS App Store or Google Play) to run on your device.

For push notifications in development, you need to run on a **physical device** (not a simulator).

---

## 7. Running Everything Together

Open three terminals:

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2 — web
cd web && npm run dev

# Terminal 3 — mobile (optional)
cd mobile && npx expo start
```

---

## 8. First-Time Flow

1. Open the web app at [http://localhost:3000](http://localhost:3000)
2. Click **Sign in with Google** — grant Calendar access when prompted
3. Enter your family name, home city, and home airport (IATA code, e.g. `CPH`)
4. Your family calendar is created and a shared Google Calendar is set up automatically
5. Invite family members from **Settings → Family members → Invite**
6. Invited members sign in and join via the invitation

---

## 9. Google Calendar Sync Notes

- A shared Google Calendar named **"[Family Name] Family Calendar"** is created automatically
- All members are added as writers — they can view and edit it in Google Calendar directly
- The app syncs every 15 minutes and also listens for real-time webhook updates
- For real-time webhooks during local development, you need a public URL (e.g. using [ngrok](https://ngrok.com))

---

## 10. Deployment (Railway)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add the backend as a service, set all environment variables from `.env`
4. Update `web/.env.local` with the deployed backend URL
5. Deploy the web app to [Vercel](https://vercel.com) or Railway
6. Update your Google OAuth authorized origins/redirect URIs with the production URLs

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Web client secret |
| `FIREBASE_PROJECT_ID` | Firebase / Google Cloud project ID |
| `FIREBASE_CREDENTIALS_PATH` | Path to service account JSON file |
| `GOOGLE_CLOUD_PROJECT` | Same as `FIREBASE_PROJECT_ID` |
| `VERTEX_AI_LOCATION` | Vertex AI region (e.g. `us-east5`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON (for Vertex AI) |
| `JWT_SECRET` | Long random string for signing JWT tokens |
| `GMAIL_ADDRESS` | Gmail address for sending notifications |
| `GMAIL_APP_PASSWORD` | 16-character Gmail App Password |
| `TICKETMASTER_API_KEY` | Ticketmaster Discovery API key |
| `AMADEUS_CLIENT_ID` | Amadeus API client ID |
| `AMADEUS_CLIENT_SECRET` | Amadeus API client secret |

### Web (`web/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g. `http://localhost:8000`) |

### Mobile (`mobile/.env`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `EXPO_PUBLIC_API_URL` | Backend URL (use local IP, not `localhost`) |
