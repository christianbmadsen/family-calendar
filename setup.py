#!/usr/bin/env python3
"""
Family Calendar — Setup

Run: python3 setup.py
"""

import getpass
import os
import secrets
import string
import subprocess
import sys
import webbrowser
from pathlib import Path

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

def ok(text):   print(f"  {green('✓')} {text}")
def warn(text): print(f"  {yellow('⚠')} {text}")
def info(text): print(f"  {dim('·')} {text}")
def err(text):  print(f"  {red('✗')} {text}")
def blank():    print()

ROOT    = Path(__file__).parent.resolve()
BACKEND = ROOT / 'backend'
WEB     = ROOT / 'web'
MOBILE  = ROOT / 'mobile'

TOTAL_STEPS = 5


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
    return val.startswith('y') if val else default


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


def main():
    header("Family Calendar — Setup")
    print("  All you need is a Gmail account.")
    print(f"  {dim('Re-run at any time — steps already done are skipped.')}")

    be_env  = load_env(BACKEND / '.env')
    web_env = load_env(WEB / '.env.local')
    mob_env = load_env(MOBILE / '.env')

    # ── Step 1: Prerequisites ─────────────────────────────────────────────
    step(1, TOTAL_STEPS, "Checking prerequisites")

    missing = []
    for tool, hint in [
        ("python3", "https://python.org"),
        ("node",    "https://nodejs.org"),
        ("npm",     "https://nodejs.org"),
        ("git",     "https://git-scm.com"),
    ]:
        if has_cmd(tool):
            ok(tool)
        else:
            err(f"{tool} not found  →  {hint}")
            missing.append(tool)

    if missing:
        blank()
        err("Please install the missing tools above and re-run setup.")
        sys.exit(1)

    # ── Step 2: Gmail credentials ─────────────────────────────────────────
    step(2, TOTAL_STEPS, "Gmail — email notifications")

    gmail_address  = be_env.get("GMAIL_ADDRESS")
    gmail_password = be_env.get("GMAIL_APP_PASSWORD")

    if gmail_address and gmail_password and gmail_password != "your_16_char_app_password":
        ok(f"Gmail already configured: {cyan(gmail_address)}")
    else:
        info("Family Calendar sends email notifications via Gmail.")
        info("You need a 16-character App Password (not your regular password).")
        blank()
        info("Requires: 2-Step Verification on your Google account.")
        blank()
        open_url("https://myaccount.google.com/apppasswords")
        pause("Press Enter once you've created an App Password…")

        gmail_address  = ask("Your Gmail address")
        gmail_password = ask("App Password (16 characters, spaces ok)", secret=True)
        gmail_password = gmail_password.replace(" ", "")
        ok("Gmail credentials saved")

    be_env["GMAIL_ADDRESS"]      = gmail_address
    be_env["GMAIL_APP_PASSWORD"] = gmail_password

    # ── Step 3: Google OAuth credentials ─────────────────────────────────
    step(3, TOTAL_STEPS, "Google OAuth — Calendar + sign-in")

    client_id     = be_env.get("GOOGLE_CLIENT_ID")     or web_env.get("NEXT_PUBLIC_GOOGLE_CLIENT_ID")
    client_secret = be_env.get("GOOGLE_CLIENT_SECRET")

    if client_id and client_secret and client_id != "your_google_client_id":
        ok(f"OAuth credentials already set: {cyan(client_id[:30])}…")
    else:
        info("Family Calendar uses Google OAuth to sign in and sync your calendar.")
        info("You need a free Google Cloud project with the Calendar API enabled.")
        blank()
        info("Quick steps (takes ~5 minutes):")
        info("  1. Create a project at console.cloud.google.com")
        info("  2. Enable the Google Calendar API")
        info("  3. Configure OAuth consent screen (External, add yourself as test user)")
        info("     Scopes: openid, email, profile, calendar")
        info("  4. Create credentials → OAuth 2.0 Client ID → Web application")
        info("     Authorised JS origins:    http://localhost:3000")
        info("     Authorised redirect URIs: http://localhost:3000")
        blank()
        open_url("https://console.cloud.google.com/apis/credentials")
        pause("Press Enter once you've created the OAuth Client ID…")

        client_id     = ask("Paste your OAuth Client ID")
        client_secret = ask("Paste your OAuth Client Secret", secret=True)
        ok("OAuth credentials saved")

    be_env["GOOGLE_CLIENT_ID"]     = client_id
    be_env["GOOGLE_CLIENT_SECRET"] = client_secret
    be_env["GOOGLE_REDIRECT_URI"]  = be_env.get("GOOGLE_REDIRECT_URI", "postmessage")

    # ── Step 4: Write environment files ──────────────────────────────────
    step(4, TOTAL_STEPS, "Writing environment files")

    if not be_env.get("JWT_SECRET") or be_env.get("JWT_SECRET") == "change_this_to_a_long_random_string":
        be_env["JWT_SECRET"] = jwt_secret()
        ok("JWT secret generated")
    else:
        ok("JWT secret already set")

    be_env.setdefault("JWT_ALGORITHM",     "HS256")
    be_env.setdefault("JWT_EXPIRE_MINUTES", "10080")
    be_env.setdefault("DB_PATH",            "./family_calendar.db")

    write_env(BACKEND / '.env', be_env, example=BACKEND / '.env.example')
    ok(f"Written: {cyan('backend/.env')}")

    web_vals = {
        "NEXT_PUBLIC_GOOGLE_CLIENT_ID": client_id,
        "NEXT_PUBLIC_API_URL": web_env.get("NEXT_PUBLIC_API_URL", "http://localhost:8000"),
    }
    write_env(WEB / '.env.local', web_vals, example=WEB / '.env.local.example')
    ok(f"Written: {cyan('web/.env.local')}")

    mob_vals = {
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": client_id,
        "EXPO_PUBLIC_API_URL": mob_env.get("EXPO_PUBLIC_API_URL", "http://localhost:8000"),
    }
    write_env(MOBILE / '.env', mob_vals, example=MOBILE / '.env.example')
    ok(f"Written: {cyan('mobile/.env')}")

    warn("For mobile on a physical device, update EXPO_PUBLIC_API_URL in mobile/.env")
    info("  Use your machine's local IP (e.g. http://192.168.1.x:8000)")

    # ── Step 5: Install dependencies ──────────────────────────────────────
    step(5, TOTAL_STEPS, "Installing dependencies")

    info("Installing Python packages…")
    venv = BACKEND / '.venv'
    if not venv.exists():
        run(f"python3 -m venv {venv}")
    pip = venv / 'bin' / 'pip'
    run(f"{pip} install -q -r requirements.txt", cwd=BACKEND, capture=False)
    ok("Backend packages installed")

    if ask_yes("Install web dependencies? (npm install)", default=True):
        info("Installing web packages…")
        run("npm install --silent", cwd=WEB, capture=False)
        ok("Web packages installed")
    else:
        warn("Skipped  — run 'npm install' in web/ when ready")

    if ask_yes("Install mobile dependencies? (npm install)", default=True):
        info("Installing mobile packages…")
        run("npm install --silent", cwd=MOBILE, capture=False)
        ok("Mobile packages installed")
    else:
        warn("Skipped  — run 'npm install' in mobile/ when ready")

    # ── Done ──────────────────────────────────────────────────────────────
    header("Setup complete!")

    print(f"  {green('Everything is configured.')} To start the app, open two terminals:\n")

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
