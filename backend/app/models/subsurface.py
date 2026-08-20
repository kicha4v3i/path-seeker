from datetime import datetime

from beanie import Document
from pydantic import BaseModel, Field


class FormationRow(BaseModel):
    formation_name: str = ""
    lithology: str = ""
    tvd_top: float = 0
    tvd_bottom: float = 0


class TargetRow(BaseModel):
    name: str = "Target 1"
    northing: float = 0
    easting: float = 0
    tvdss: float = 0
    tolerance: str = "none"
    radius_of_tolerance: float | None = None
    major_radius: float | None = None
    minor_radius: float | None = None
    azimuth: float | None = None


class Subsurface(Document):
    well_id: str
    formations: list[FormationRow] = Field(default_factory=list)
    targets: list[TargetRow] = Field(default_factory=list)
    max_dls: float | None = None
    notes: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "subsurface"
