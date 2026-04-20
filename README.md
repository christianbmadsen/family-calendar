# Family Calendar

A shared family calendar with email notifications and optional AI activity suggestions.

## Features

- Shared calendar — any family member can add, edit, or delete events
- Times displayed in your local timezone
- Email notifications 30 minutes before each timed event
- Daily digest at 8 pm with tomorrow's schedule
- Weekly digest every Sunday at 6 pm
- AI activity suggestions powered by Claude (optional — requires Anthropic API key)
- iCal subscription feed — subscribe in Apple Calendar, Google Calendar, or any iCal-compatible app
- Web app (Next.js)

## Architecture

```
family-calendar/
├── backend/    Python + FastAPI  (REST API, scheduler, SQLite)
└── web/        Next.js           (web frontend)
```

**What you need to get started**

| Requirement | Purpose | Notes |
|---|---|---|
| Python 3.9+ | Run the backend | Required |
| Node.js + npm | Run the web frontend | Required |
| Gmail account | Email notifications | Requires an App Password (not your regular password) |
| Anthropic API key | AI activity suggestions | Optional — [console.anthropic.com](https://console.anthropic.com) |

No cloud accounts, Firebase, or Google Cloud setup required.

---

## Quick Start

Run the interactive setup script from the repo root:

```bash
python3 setup.py
```

The script will:
1. Check that Python and Node are installed
2. Ask for your Gmail address and App Password
3. Write `.env` files for the backend and web app (with a generated JWT secret)
4. Install Python and Node dependencies automatically

Then start the app with two terminals:

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2 — web
cd web && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register an account.

---

## Manual Setup

If you prefer to configure things by hand:

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

```env
JWT_SECRET=replace-with-a-long-random-string

GMAIL_ADDRESS=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Optional
# ANTHROPIC_API_KEY=sk-ant-...
```

```bash
uvicorn main:app --reload --port 8000
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Web

```bash
cd web
npm install
```

Create `web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
# Opens at http://localhost:3000
```

---

## Gmail App Password

Standard Gmail passwords don't work with SMTP. You need an App Password:

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. You must have **2-Step Verification** enabled on your Google account
3. Create a new app password (name it anything, e.g. `family-calendar`)
4. Copy the 16-character password into `GMAIL_APP_PASSWORD`

---

## AI Activity Suggestions (optional)

Add your Anthropic API key to `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Then restart the backend. The **Suggestions** page in the web app will let you generate 5 AI-powered activity ideas for the next 30 days, avoiding conflicts with your existing schedule. You can add them directly to your calendar or dismiss them.

Get an API key at [console.anthropic.com](https://console.anthropic.com).

---

## iCal Subscription

Share your family calendar with any calendar app that supports iCal subscriptions (Apple Calendar, Google Calendar, Outlook, etc.):

1. Go to **Settings** in the web app
2. Under **Subscribe to calendar**, click **Get subscription URL**
3. Copy the URL and paste it into your calendar app as a new subscription

The URL is private — keep it to yourself. If it gets shared accidentally, use **Regenerate URL** in Settings to invalidate it and get a new one.

---

## First-Time Flow

1. Open [http://localhost:3000](http://localhost:3000)
2. Register with your email and a password
3. Enter your family name
4. Invite family members from **Settings → Family members → Invite**
5. Invited members register and join via the invitation link

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Long random string for signing auth tokens |
| `GMAIL_ADDRESS` | Yes | Gmail address for sending notifications |
| `GMAIL_APP_PASSWORD` | Yes | 16-character Gmail App Password |
| `DB_PATH` | No | SQLite file path (default: `./family_calendar.db`) |
| `ANTHROPIC_API_KEY` | No | Enables AI activity suggestions |
| `GOOGLE_CLIENT_ID` | No | Enables Google Sign-In (future use) |
| `GOOGLE_CLIENT_SECRET` | No | Enables Google Sign-In (future use) |

### Web (`web/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | Backend URL (default: `http://localhost:8000`) |

---

## Deployment

1. Push this repo to GitHub
2. Deploy the backend to [Railway](https://railway.app) or any server that runs Python — set all env vars from `backend/.env`
3. Deploy the web app to [Vercel](https://vercel.com) or Railway — set `NEXT_PUBLIC_API_URL` to your deployed backend URL
