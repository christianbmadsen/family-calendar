import anthropic
from config import settings

MODEL = "claude-opus-4-7"


def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)
