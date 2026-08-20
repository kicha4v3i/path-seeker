from datetime import datetime

from beanie import Document
from pydantic import Field


class AISession(Document):
    well_id: str
    messages: list[dict] = Field(default_factory=list)
    last_proposed_params: dict | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "ai_sessions"
