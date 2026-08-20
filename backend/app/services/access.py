from fastapi import HTTPException, status

from app.models.project import Project, ProjectMember
from app.models.well import Well
from app.models.workspace import Workspace


async def check_project_access(project_id: str, user_id: str, min_role: str = "viewer") -> Project:
    project = await Project.get(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    member = await ProjectMember.find_one(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    )

    # Workspace owner always has owner-level access
    workspace = await Workspace.get(project.workspace_id)
    is_workspace_owner = bool(workspace and workspace.owner_id == user_id)

    if not member and not is_workspace_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to project")

    role = member.role if member else "owner"
    if is_workspace_owner:
        role = "owner"

    role_rank = {"viewer": 0, "editor": 1, "owner": 2}
    if role_rank.get(role, 0) < role_rank.get(min_role, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return project


async def check_well_access(well_id: str, user_id: str, min_role: str = "viewer") -> Well:
    well = await Well.get(well_id)
    if not well:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Well not found")
    await check_project_access(well.project_id, user_id, min_role)
    return well
