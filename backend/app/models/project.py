from datetime import datetime

from beanie import Document
from pydantic import Field


class Project(Document):
    workspace_id: str
    name: str
    location_country: str = ""
    environment: str = "Onshore"
    ground_level_elevation: float | None = None
    water_depth: float | None = None
    block: str = ""
    field: str = ""
    coordinate_system: str = ""
    projection_system: str = ""
    datum: str = ""
    unit_system: str = "API"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "projects"


class ProjectMember(Document):
    project_id: str
    user_id: str
    email: str = ""
    role: str = "editor"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "project_members"
