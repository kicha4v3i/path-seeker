from datetime import datetime

from beanie import Document
from pydantic import Field


class Report(Document):
    well_id: str
    trajectory_id: str
    filename: str
    content_base64: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "reports"
