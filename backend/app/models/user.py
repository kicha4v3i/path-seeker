from datetime import datetime

from beanie import Document, Indexed
from pydantic import EmailStr, Field


class User(Document):
    clerk_id: Indexed(str, unique=True)
    email: EmailStr
    name: str = ""
    default_workspace_id: str | None = None
    default_unit_system: str = "API"
    display_unit_override: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
