from datetime import datetime

from beanie import Document
from pydantic import Field


class Well(Document):
    project_id: str
    name: str
    status: str = "draft"
    unit_system: str = "API"
    surface_coord_type: str = "ne"
    latitude: float | None = None
    longitude: float | None = None
    northing: float | None = None
    easting: float | None = None
    rkb_to_datum: float | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "wells"
