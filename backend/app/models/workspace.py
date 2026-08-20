from datetime import datetime

from beanie import Document
from pydantic import Field


class Workspace(Document):
    name: str
    owner_id: str
    custom_lithologies: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "workspaces"


class WorkspaceMember(Document):
    workspace_id: str
    user_id: str
    role: str = "owner"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "workspace_members"
