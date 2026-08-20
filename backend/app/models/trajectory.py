from datetime import datetime

from beanie import Document
from pydantic import BaseModel, Field


class SurveyStation(BaseModel):
    md: float
    inc: float
    azi: float
    tvd: float
    ns: float
    ew: float
    dls: float = 0
    vs: float = 0


class TrajectoryParams(BaseModel):
    kop: float | None = None
    build_rate: float | None = None
    turn_rate: float | None = None
    max_dls: float | None = None
    target_id: str | None = None
    sections: list[dict] = Field(default_factory=list)


class Trajectory(Document):
    well_id: str
    mode: str = "manual"
    survey_method: str = "minimum_curvature"
    params: TrajectoryParams = Field(default_factory=TrajectoryParams)
    survey_stations: list[SurveyStation] = Field(default_factory=list)
    source_prompt: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "trajectories"
