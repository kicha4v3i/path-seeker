from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.models.ai_session import AISession
from app.models.project import Project, ProjectMember
from app.models.report import Report
from app.models.subsurface import Subsurface
from app.models.trajectory import Trajectory
from app.models.user import User
from app.models.well import Well
from app.models.workspace import Workspace, WorkspaceMember

client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    global client
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(
        database=client[settings.mongodb_db],
        document_models=[
            User,
            Workspace,
            WorkspaceMember,
            Project,
            ProjectMember,
            Well,
            Subsurface,
            Trajectory,
            AISession,
            Report,
        ],
    )


async def close_db() -> None:
    global client
    if client:
        client.close()
        client = None
