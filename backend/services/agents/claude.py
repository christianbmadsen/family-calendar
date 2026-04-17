import anthropic
from config import settings

# Authenticates via Google Application Default Credentials (ADC).
# Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.
def get_client() -> anthropic.AnthropicVertex:
    return anthropic.AnthropicVertex(
        region=settings.vertex_ai_location,
        project_id=settings.google_cloud_project,
    )


MODEL = "claude-opus-4-7"
