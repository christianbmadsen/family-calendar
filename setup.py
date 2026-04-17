#!/usr/bin/env python3
"""
Family Calendar — Interactive Setup Script

Run: python3 setup.py
"""

import getpass
import json
import os
import secrets
import string
import subprocess
import sys
import webbrowser
from pathlib import Path

# ── Colours ────────────────────────────────────────────────────────────────

BOLD  = '\033[1m'
GREEN = '\033[92m'
YELLOW= '\033[93m'
RED   = '\033[91m'
CYAN  = '\033[96m'
DIM   = '\033[2m'
RESET = '\033[0m'

def bold(t):   return f"{BOLD}{t}{RESET}"
def green(t):  return f"{GREEN}{t}{RESET}"
def yellow(t): return f"{YELLOW}{t}{RESET}"
def red(t):    return f"{RED}{t}{RESET}"
def cyan(t):   return f"{CYAN}{t}{RESET}"
def dim(t):    return f"{DIM}{t}{RESET}"

def header(text):
    width = 62
    print(f"\n{BOLD}{CYAN}{'─' * width}{RESET}")
    print(f"{BOLD}{CYAN}  {text}{RESET}")
    print(f"{BOLD}{CYAN}{'─' * width}{RESET}\n")

def step(n, total, text):
    print(f"\n{bold(f'[{n}/{total}]')} {text}")

def ok(text):    print(f"  {green('✓')} {text}")
def warn(text):  print(f"  {yellow('⚠')} {text}")
def info(text):  print(f"  {dim('·')} {text}")
def err(text):   print(f"  {red('✗')} {text}")
def blank():     print()

# ── Helpers ────────────────────────────────────────────────────────────────

ROOT    = Path(__file__).parent.resolve()
BACKEND = ROOT / 'backend'
WEB     = ROOT / 'web'
MOBILE  = ROOT / 'mobile'

TOTAL_STEPS = 10


def ask(question, default=None, secret=False, validate=None):
    suffix = f" [{dim(default)}]" if default else ""
    prompt = f"  {bold('→')} {question}{suffix}: "
    while True:
        try:
            val = (getpass.getpass(prompt) if secret else input(prompt)).strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\nSetup cancelled.")
            sys.exit(0)
        val = val or default or ""
        if validate:
            error = validate(val)
            if error:
                err(error)
                continue
        if val:
            return val
        err("This field is required.")


def ask_yes(question, default=True):
    suffix = "[Y/n]" if default else "[y/N]"
    prompt = f"  {bold('→')} {question} {dim(suffix)}: "
    try:
        val = input(prompt).strip().lower()
    except (KeyboardInterrupt, EOFError):
        print("\n\nSetup cancelled.")
        sys.exit(0)
    if not val:
        return default
    return val.startswith('y')


def pause(message="Press Enter to continue once done…"):
    try:
        input(f"\n  {yellow('→')} {message}")
    except (KeyboardInterrupt, EOFError):
        print("\n\nSetup cancelled.")
        sys.exit(0)


def open_url(url):
    info(f"Opening: {cyan(url)}")
    try:
        webbrowser.open(url)
    except Exception:
        pass


def run(cmd, cwd=None, check=True, capture=True):
    result = subprocess.run(
        cmd, shell=True, cwd=cwd,
        capture_output=capture, text=True
    )
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"Command failed: {cmd}")
    return result


def has_cmd(name):
    return subprocess.run(f"which {name}", shell=True, capture_output=True).returncode == 0


def load_env(path: Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                env[k.strip()] = v.strip()
    return env


def write_env(path: Path, values: dict, example: Path = None):
    """Write .env, preserving comments from the example file."""
    if example and example.exists():
        lines = example.read_text().splitlines()
        out = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith('#') and '=' in stripped:
                key = stripped.split('=')[0].strip()
                out.append(f"{key}={values.get(key, stripped.split('=', 1)[1])}")
            else:
                out.append(line)
        path.write_text('\n'.join(out) + '\n')
    else:
        path.write_text('\n'.join(f"{k}={v}" for k, v in values.items()) + '\n')


def jwt_secret():
    alphabet = string.ascii_letters + string.digits + "-_"
    return ''.join(secrets.choice(alphabet) for _ in range(64))


def validate_iata(v):
    if len(v) != 3 or not v.isalpha():
        return "Must be a 3-letter IATA code (e.g. CPH, JFK, LHR)"


def validate_project_id(v):
    if not v or ' ' in v:
        return "Project ID cannot contain spaces"


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    header("Family Calendar — Setup")
    print("  This script will configure credentials, install dependencies,")
    print("  and get you ready to run the app.\n")
    print(f"  {dim('You can re-run this script at any time — it skips steps already done.')}")

    # Load any existing config so we don't re-ask
    be_env    = load_env(BACKEND / '.env')
    web_env   = load_env(WEB / '.env.local')
    mob_env   = load_env(MOBILE / '.env')

    # ── Step 1: Prerequisites ─────────────────────────────────────────────
    step(1, TOTAL_STEPS, "Checking prerequisites")

    missing = []
    for tool, install_hint in [
        ("python3", "https://python.org"),
        ("node",    "https://nodejs.org"),
        ("npm",     "https://nodejs.org"),
        ("git",     "https://git-scm.com"),
    ]:
        if has_cmd(tool):
            ok(tool)
        else:
            err(f"{tool} not found  →  {install_hint}")
            missing.append(tool)

    gcloud_available = has_cmd("gcloud")
    if gcloud_available:
        ok("gcloud CLI  (will use for Google Cloud setup)")
    else:
        warn("gcloud CLI not found  →  Google Cloud steps will be manual")
        info("Install from: https://cloud.google.com/sdk/docs/install")

    if missing:
        blank()
        err("Please install the missing tools above and re-run setup.")
        sys.exit(1)

    # ── Step 2: Google Cloud project ─────────────────────────────────────
    step(2, TOTAL_STEPS, "Google Cloud project")

    project_id = be_env.get("GOOGLE_CLOUD_PROJECT") or be_env.get("FIREBASE_PROJECT_ID")

    if project_id:
        ok(f"Project ID already set: {cyan(project_id)}")
    else:
        if gcloud_available:
            result = run("gcloud projects list --format='value(projectId)'", check=False)
            existing = [p.strip() for p in result.stdout.splitlines() if p.strip()]
            if existing:
                info("Existing Google Cloud projects:")
                for p in existing[:8]:
                    info(f"  {p}")
            blank()
            info("Enter an existing project ID, or a new one to create.")
            info("Project IDs are lowercase letters, digits, and hyphens.")
        else:
            info("Go to console.cloud.google.com → New Project.")
            open_url("https://console.cloud.google.com/projectcreate")
            pause()

        project_id = ask("Google Cloud Project ID", validate=validate_project_id)

        if gcloud_available:
            # Create if it doesn't exist
            check = run(f"gcloud projects describe {project_id}", check=False)
            if check.returncode != 0:
                info(f"Creating project {cyan(project_id)}…")
                run(f"gcloud projects create {project_id} --name='Family Calendar'")
                ok("Project created")
            run(f"gcloud config set project {project_id}", check=False)

    be_env["GOOGLE_CLOUD_PROJECT"] = project_id
    be_env["FIREBASE_PROJECT_ID"]  = project_id

    # ── Step 3: Enable Google APIs ────────────────────────────────────────
    step(3, TOTAL_STEPS, "Enabling Google Cloud APIs")

    apis = [
        ("calendar-json.googleapis.com",       "Google Calendar"),
        ("places-backend.googleapis.com",       "Google Places"),
        ("aiplatform.googleapis.com",           "Vertex AI"),
        ("firestore.googleapis.com",            "Firestore"),
        ("firebase.googleapis.com",             "Firebase"),
    ]

    if gcloud_available:
        api_str = " ".join(a for a, _ in apis)
        info("Enabling APIs (this may take a minute)…")
        try:
            run(f"gcloud services enable {api_str} --project={project_id}", capture=False)
            ok("All APIs enabled")
        except RuntimeError as e:
            warn(f"Some APIs may not have enabled: {e}")
    else:
        info("Enable these APIs in the Google Cloud console:")
        for api, name in apis:
            info(f"  · {name}  ({api})")
        open_url(f"https://console.cloud.google.com/apis/library?project={project_id}")
        pause("Press Enter once all APIs are enabled…")
        ok("APIs marked as enabled")

    # ── Step 4: Service account + Firebase credentials ────────────────────
    step(4, TOTAL_STEPS, "Service account & Firebase credentials")

    sa_json = BACKEND / 'firebase-service-account.json'

    if sa_json.exists():
        ok("firebase-service-account.json already exists — skipping")
        be_env["FIREBASE_CREDENTIALS_PATH"] = "./firebase-service-account.json"
        be_env["GOOGLE_APPLICATION_CREDENTIALS"] = "./firebase-service-account.json"
    elif gcloud_available:
        sa_name  = "family-calendar-sa"
        sa_email = f"{sa_name}@{project_id}.iam.gserviceaccount.com"

        info("Creating service account…")
        r = run(f"gcloud iam service-accounts describe {sa_email} --project={project_id}", check=False)
        if r.returncode != 0:
            run(f"gcloud iam service-accounts create {sa_name} "
                f"--display-name='Family Calendar' --project={project_id}")

        info("Granting IAM roles…")
        for role in ["roles/datastore.user", "roles/aiplatform.user", "roles/firebase.admin"]:
            run(f"gcloud projects add-iam-policy-binding {project_id} "
                f"--member='serviceAccount:{sa_email}' --role='{role}'",
                check=False)

        info("Downloading service account key…")
        run(f"gcloud iam service-accounts keys create {sa_json} "
            f"--iam-account={sa_email} --project={project_id}")
        ok(f"Saved to {cyan('backend/firebase-service-account.json')}")

        be_env["FIREBASE_CREDENTIALS_PATH"] = "./firebase-service-account.json"
        be_env["GOOGLE_APPLICATION_CREDENTIALS"] = "./firebase-service-account.json"
    else:
        info("You need to create a Firebase project and download the service account key.")
        blank()
        info("1. Go to Firebase console → Add project → select your Google Cloud project")
        open_url("https://console.firebase.google.com")
        pause("Press Enter once you've created the Firebase project…")
        blank()
        info("2. In Firebase: Project Settings → Service accounts → Generate new private key")
        info(f"3. Save the downloaded file as:  {cyan('backend/firebase-service-account.json')}")
        pause("Press Enter once the file is saved…")

        if not sa_json.exists():
            err("backend/firebase-service-account.json not found. Please try again.")
            sys.exit(1)

        ok("Service account file found")
        be_env["FIREBASE_CREDENTIALS_PATH"] = "./firebase-service-account.json"
        be_env["GOOGLE_APPLICATION_CREDENTIALS"] = "./firebase-service-account.json"

    # Read project ID from the JSON if we don't have it yet
    try:
        data = json.loads(sa_json.read_text())
        if not project_id:
            project_id = data.get("project_id", project_id)
            be_env["GOOGLE_CLOUD_PROJECT"] = project_id
            be_env["FIREBASE_PROJECT_ID"]  = project_id
    except Exception:
        pass

    # Firestore database
    info("Ensuring Firestore database exists…")
    if gcloud_available:
        r = run(f"gcloud firestore databases describe --project={project_id}", check=False)
        if r.returncode != 0:
            run(f"gcloud firestore databases create --location=eur3 --project={project_id}", check=False)
            ok("Firestore database created")
        else:
            ok("Firestore database already exists")
    else:
        info("In Firebase console: Firestore Database → Create database → Native mode")
        open_url(f"https://console.firebase.google.com/project/{project_id}/firestore")
        pause("Press Enter once Firestore is set up…")
        ok("Firestore setup confirmed")

    # ── Step 5: OAuth credentials ─────────────────────────────────────────
    step(5, TOTAL_STEPS, "Google OAuth credentials")

    client_id     = be_env.get("GOOGLE_CLIENT_ID")     or web_env.get("NEXT_PUBLIC_GOOGLE_CLIENT_ID")
    client_secret = be_env.get("GOOGLE_CLIENT_SECRET")

    if client_id and client_secret:
        ok(f"OAuth credentials already set: {cyan(client_id[:30])}…")
    else:
        info("Create an OAuth 2.0 Web Client ID in Google Cloud console.")
        info(f"Project: {cyan(project_id)}")
        blank()
        info("Settings:")
        info("  · Application type:          Web application")
        info("  · Authorised JS origins:     http://localhost:3000")
        info("  · Authorised redirect URIs:  http://localhost:3000")
        blank()
        info("Also configure the OAuth consent screen:")
        info("  · User type: External")
        info(f"  · Add scopes: openid, email, profile, calendar")
        info(f"  · Add your Google account as a test user")
        blank()
        open_url(
            f"https://console.cloud.google.com/apis/credentials/oauthclient?"
            f"project={project_id}"
        )
        pause("Press Enter once you've created the OAuth client ID…")

        client_id     = ask("Paste your OAuth Client ID")
        client_secret = ask("Paste your OAuth Client Secret", secret=True)
        ok("OAuth credentials saved")

    be_env["GOOGLE_CLIENT_ID"]     = client_id
    be_env["GOOGLE_CLIENT_SECRET"] = client_secret
    be_env["VERTEX_AI_LOCATION"]   = be_env.get("VERTEX_AI_LOCATION", "us-east5")

    # ── Step 6: Gmail App Password ────────────────────────────────────────
    step(6, TOTAL_STEPS, "Gmail notifications")

    gmail_address  = be_env.get("GMAIL_ADDRESS")
    gmail_password = be_env.get("GMAIL_APP_PASSWORD")

    if gmail_address and gmail_password and gmail_password != "xxxx-xxxx-xxxx-xxxx":
        ok(f"Gmail already configured: {cyan(gmail_address)}")
    else:
        info("Family Calendar sends email notifications via your Gmail.")
        info("You need a 16-character App Password (not your regular password).")
        blank()
        info("Requirements: 2-Step Verification must be enabled on your Google account.")
        blank()
        open_url("https://myaccount.google.com/apppasswords")
        pause("Press Enter once you've created an App Password…")

        gmail_address  = ask("Your Gmail address")
        gmail_password = ask("App Password (16 characters, spaces ok)", secret=True)
        gmail_password = gmail_password.replace(" ", "")
        ok("Gmail credentials saved")

    be_env["GMAIL_ADDRESS"]      = gmail_address
    be_env["GMAIL_APP_PASSWORD"] = gmail_password

    # ── Step 7: Third-party API keys ──────────────────────────────────────
    step(7, TOTAL_STEPS, "Ticketmaster & Amadeus API keys")

    # Ticketmaster
    tm_key = be_env.get("TICKETMASTER_API_KEY")
    if tm_key and tm_key != "your_ticketmaster_key":
        ok("Ticketmaster API key already set")
    else:
        info("Sign up for a free Ticketmaster developer account to discover local events.")
        open_url("https://developer.ticketmaster.com/products-and-docs/apis/getting-started/")
        pause("Press Enter once you have your Ticketmaster API key…")
        tm_key = ask("Ticketmaster API key")
        ok("Ticketmaster key saved")

    be_env["TICKETMASTER_API_KEY"] = tm_key

    # Amadeus
    am_id     = be_env.get("AMADEUS_CLIENT_ID")
    am_secret = be_env.get("AMADEUS_CLIENT_SECRET")
    if am_id and am_secret and am_id != "your_amadeus_client_id":
        ok("Amadeus credentials already set")
    else:
        info("Sign up for a free Amadeus developer account for flight deal search.")
        open_url("https://developers.amadeus.com/register")
        pause("Press Enter once you have your Amadeus API Key and Secret…")
        am_id     = ask("Amadeus Client ID (API Key)")
        am_secret = ask("Amadeus Client Secret", secret=True)
        ok("Amadeus credentials saved")

    be_env["AMADEUS_CLIENT_ID"]     = am_id
    be_env["AMADEUS_CLIENT_SECRET"] = am_secret

    # ── Step 8: Generate JWT secret + write all .env files ────────────────
    step(8, TOTAL_STEPS, "Writing environment files")

    # JWT
    if not be_env.get("JWT_SECRET") or be_env.get("JWT_SECRET") == "change_this_to_a_long_random_string":
        be_env["JWT_SECRET"] = jwt_secret()
        ok("JWT secret generated")
    else:
        ok("JWT secret already set")

    be_env.setdefault("JWT_ALGORITHM",    "HS256")
    be_env.setdefault("JWT_EXPIRE_MINUTES", "10080")

    # Write backend .env
    write_env(
        BACKEND / '.env',
        be_env,
        example=BACKEND / '.env.example'
    )
    ok(f"Written: {cyan('backend/.env')}")

    # Web .env.local
    web_vals = {
        "NEXT_PUBLIC_GOOGLE_CLIENT_ID": client_id,
        "NEXT_PUBLIC_API_URL":          web_env.get("NEXT_PUBLIC_API_URL", "http://localhost:8000"),
    }
    write_env(
        WEB / '.env.local',
        web_vals,
        example=WEB / '.env.local.example'
    )
    ok(f"Written: {cyan('web/.env.local')}")

    # Mobile .env
    mob_vals = {
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": client_id,
        "EXPO_PUBLIC_API_URL":          mob_env.get("EXPO_PUBLIC_API_URL", "http://localhost:8000"),
    }
    write_env(
        MOBILE / '.env',
        mob_vals,
        example=MOBILE / '.env.example'
    )
    ok(f"Written: {cyan('mobile/.env')}")

    warn("For mobile on a physical device, update EXPO_PUBLIC_API_URL in mobile/.env")
    info("  Use your machine's local IP (e.g. http://192.168.1.x:8000)")

    # ── Step 9: Install dependencies ──────────────────────────────────────
    step(9, TOTAL_STEPS, "Installing dependencies")

    # Backend
    info("Installing Python packages…")
    venv = BACKEND / '.venv'
    if not venv.exists():
        run(f"python3 -m venv {venv}")
    pip = venv / 'bin' / 'pip'
    run(f"{pip} install -q -r requirements.txt", cwd=BACKEND, capture=False)
    ok("Backend packages installed")

    # Web
    if ask_yes("Install web dependencies? (npm install)", default=True):
        info("Installing web packages…")
        run("npm install --silent", cwd=WEB, capture=False)
        ok("Web packages installed")
    else:
        warn("Skipped  — run 'npm install' in web/ when ready")

    # Mobile
    if ask_yes("Install mobile dependencies? (npm install)", default=True):
        info("Installing mobile packages…")
        run("npm install --silent", cwd=MOBILE, capture=False)
        ok("Mobile packages installed")
    else:
        warn("Skipped  — run 'npm install' in mobile/ when ready")

    # ── Step 10: Firestore indexes ────────────────────────────────────────
    step(10, TOTAL_STEPS, "Firestore composite index")

    info("The app needs one composite index in Firestore:")
    info("  Collection: events")
    info("  Fields:     family_id (Ascending) + start_datetime (Ascending)")
    blank()
    info("Firestore will prompt you with a direct link to create it")
    info("the first time you load the calendar. Alternatively create it now:")
    open_url(
        f"https://console.firebase.google.com/project/{project_id}/firestore/indexes"
    )
    ok("Noted — Firestore will prompt automatically on first use")

    # ── Done ──────────────────────────────────────────────────────────────
    header("Setup complete!")

    print(f"  {green('Everything is configured.')} To start the app, open three terminals:\n")

    print(f"  {bold('Terminal 1 — Backend')}")
    print(f"  {cyan('  cd backend')}")
    print(f"  {cyan('  source .venv/bin/activate')}")
    print(f"  {cyan('  uvicorn main:app --reload --port 8000')}\n")

    print(f"  {bold('Terminal 2 — Web')}")
    print(f"  {cyan('  cd web')}")
    print(f"  {cyan('  npm run dev')}")
    print(f"  {dim('  Opens at http://localhost:3000')}\n")

    print(f"  {bold('Terminal 3 — Mobile')} {dim('(optional)')}")
    print(f"  {cyan('  cd mobile')}")
    print(f"  {cyan('  npx expo start')}")
    print(f"  {dim('  Scan QR code with Expo Go app')}\n")

    print(f"  {dim('API docs: http://localhost:8000/docs')}\n")


if __name__ == '__main__':
    main()
