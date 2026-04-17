from datetime import datetime, timezone
from typing import Optional
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from models.event import Event
from config import settings


def _build_service(refresh_token: str):
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    creds.refresh(Request())
    return build("calendar", "v3", credentials=creds)


def _event_to_body(event: Event) -> dict:
    body: dict = {
        "summary": event.title,
        "description": event.description or "",
    }
    if event.location:
        body["location"] = event.location

    if event.is_all_day and event.start_datetime:
        date_str = event.start_datetime.date().isoformat()
        body["start"] = {"date": date_str}
        body["end"] = {"date": date_str}
    elif event.start_datetime:
        body["start"] = {
            "dateTime": event.start_datetime.isoformat(),
            "timeZone": "UTC",
        }
        end = event.end_datetime or event.start_datetime
        body["end"] = {"dateTime": end.isoformat(), "timeZone": "UTC"}

    return body


def _google_to_event_patch(item: dict) -> dict:
    """Convert a Google Calendar event item to a partial Firestore event dict."""
    patch: dict = {
        "title": item.get("summary", ""),
        "description": item.get("description"),
        "location": item.get("location"),
        "updated_at": datetime.now(timezone.utc),
    }

    start = item.get("start", {})
    end = item.get("end", {})

    if "date" in start:
        patch["is_all_day"] = True
        patch["start_datetime"] = datetime.fromisoformat(start["date"])
        patch["end_datetime"] = None
    elif "dateTime" in start:
        patch["is_all_day"] = False
        patch["start_datetime"] = datetime.fromisoformat(start["dateTime"])
        patch["end_datetime"] = (
            datetime.fromisoformat(end["dateTime"]) if "dateTime" in end else None
        )

    return patch


class GoogleCalendarService:
    def __init__(self, refresh_token: str):
        self._svc = _build_service(refresh_token)

    def create_family_calendar(self, family_name: str) -> str:
        result = (
            self._svc.calendars()
            .insert(body={"summary": f"{family_name} Family Calendar"})
            .execute()
        )
        return result["id"]

    def share_calendar(self, calendar_id: str, email: str) -> None:
        rule = {"scope": {"type": "user", "value": email}, "role": "writer"}
        self._svc.acl().insert(calendarId=calendar_id, body=rule).execute()

    def remove_calendar_member(self, calendar_id: str, email: str) -> None:
        rule_id = f"user:{email}"
        try:
            self._svc.acl().delete(calendarId=calendar_id, ruleId=rule_id).execute()
        except HttpError as e:
            if e.resp.status != 404:
                raise

    def create_event(self, calendar_id: str, event: Event) -> str:
        result = (
            self._svc.events()
            .insert(calendarId=calendar_id, body=_event_to_body(event))
            .execute()
        )
        return result["id"]

    def update_event(self, calendar_id: str, google_event_id: str, event: Event) -> None:
        self._svc.events().update(
            calendarId=calendar_id,
            eventId=google_event_id,
            body=_event_to_body(event),
        ).execute()

    def delete_event(self, calendar_id: str, google_event_id: str) -> None:
        try:
            self._svc.events().delete(
                calendarId=calendar_id, eventId=google_event_id
            ).execute()
        except HttpError as e:
            if e.resp.status != 404:
                raise

    def sync(
        self, calendar_id: str, sync_token: Optional[str] = None
    ) -> tuple[list[dict], Optional[str]]:
        """
        Returns (changed_items, next_sync_token).
        On first call pass sync_token=None to get all future events.
        On subsequent calls pass the previous sync_token for incremental updates.
        """
        params: dict = {"calendarId": calendar_id, "singleEvents": True}

        if sync_token:
            params["syncToken"] = sync_token
        else:
            params["timeMin"] = datetime.now(timezone.utc).isoformat()
            params["orderBy"] = "startTime"

        items: list[dict] = []
        next_page_token = None

        while True:
            if next_page_token:
                params["pageToken"] = next_page_token

            try:
                result = self._svc.events().list(**params).execute()
            except HttpError as e:
                if e.resp.status == 410:
                    # Sync token expired — caller should re-sync from scratch
                    raise SyncTokenExpired()
                raise

            items.extend(result.get("items", []))
            next_page_token = result.get("nextPageToken")
            next_sync_token = result.get("nextSyncToken")

            if not next_page_token:
                return items, next_sync_token


class SyncTokenExpired(Exception):
    pass
