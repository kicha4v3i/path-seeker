from datetime import datetime

from fastapi import APIRouter, Depends

from app.api.schemas import LithologyAdd, MemberInvite, ProjectCreate, ProjectUpdate, UserSettingsUpdate
from app.core.auth import AuthUser, get_current_user
from app.core.constants import (
    COORDINATE_SYSTEMS,
    COUNTRIES,
    DATUMS,
    DEFAULT_LITHOLOGIES,
    PROJECTION_SYSTEMS,
)
from app.core.serialize import serialize_doc, serialize_docs
from app.models.project import Project, ProjectMember
from app.services.access import check_project_access
from app.services.user_service import get_or_create_user, get_user_workspace

router = APIRouter(tags=["projects"])


@router.get("/reference")
async def get_reference_data(user: AuthUser = Depends(get_current_user)):
    db_user = await get_or_create_user(user)
    workspace = await get_user_workspace(db_user)
    return {
        "countries": COUNTRIES,
        "coordinate_systems": COORDINATE_SYSTEMS,
        "projection_systems": PROJECTION_SYSTEMS,
        "datums": DATUMS,
        "lithologies": DEFAULT_LITHOLOGIES + workspace.custom_lithologies,
        "default_lithologies": DEFAULT_LITHOLOGIES,
    }


@router.get("/me")
async def get_me(user: AuthUser = Depends(get_current_user)):
    db_user = await get_or_create_user(user)
    return serialize_doc(db_user)


@router.patch("/me/settings")
async def update_settings(
    body: UserSettingsUpdate,
    user: AuthUser = Depends(get_current_user),
):
    db_user = await get_or_create_user(user)
    if body.default_unit_system:
        db_user.default_unit_system = body.default_unit_system
    if body.display_unit_override is not None:
        db_user.display_unit_override = body.display_unit_override
    await db_user.save()
    return serialize_doc(db_user)


@router.get("/projects")
async def list_projects(user: AuthUser = Depends(get_current_user)):
    db_user = await get_or_create_user(user)
    memberships = await ProjectMember.find(ProjectMember.user_id == user.clerk_id).to_list()
    project_ids = {m.project_id for m in memberships}

    workspace = await get_user_workspace(db_user)
    workspace_projects = await Project.find(Project.workspace_id == str(workspace.id)).to_list()
    for p in workspace_projects:
        project_ids.add(str(p.id))

    projects = []
    for pid in project_ids:
        p = await Project.get(pid)
        if p:
            projects.append(p)
    return serialize_docs(projects)


@router.post("/projects")
async def create_project(body: ProjectCreate, user: AuthUser = Depends(get_current_user)):
    db_user = await get_or_create_user(user)
    workspace = await get_user_workspace(db_user)
    project = Project(workspace_id=str(workspace.id), **body.model_dump())
    await project.insert()
    await ProjectMember(
        project_id=str(project.id),
        user_id=user.clerk_id,
        email=user.email,
        role="owner",
    ).insert()
    return serialize_doc(project)


@router.get("/projects/{project_id}")
async def get_project(project_id: str, user: AuthUser = Depends(get_current_user)):
    project = await check_project_access(project_id, user.clerk_id)
    return serialize_doc(project)


@router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: AuthUser = Depends(get_current_user),
):
    project = await check_project_access(project_id, user.clerk_id, "editor")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(project, k, v)
    project.updated_at = datetime.utcnow()
    await project.save()
    return serialize_doc(project)


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: AuthUser = Depends(get_current_user)):
    project = await check_project_access(project_id, user.clerk_id, "owner")
    await project.delete()
    members = await ProjectMember.find(ProjectMember.project_id == project_id).to_list()
    for m in members:
        await m.delete()
    return {"ok": True}


@router.get("/projects/{project_id}/members")
async def list_members(project_id: str, user: AuthUser = Depends(get_current_user)):
    await check_project_access(project_id, user.clerk_id)
    members = await ProjectMember.find(ProjectMember.project_id == project_id).to_list()
    return serialize_docs(members)


@router.post("/projects/{project_id}/members")
async def invite_member(
    project_id: str,
    body: MemberInvite,
    user: AuthUser = Depends(get_current_user),
):
    await check_project_access(project_id, user.clerk_id, "owner")
    existing = await ProjectMember.find_one(
        ProjectMember.project_id == project_id,
        ProjectMember.email == body.email,
    )
    if existing:
        existing.role = body.role
        await existing.save()
        return serialize_doc(existing)
    member = ProjectMember(
        project_id=project_id,
        user_id=body.email,
        email=body.email,
        role=body.role,
    )
    await member.insert()
    return serialize_doc(member)


@router.post("/workspace/lithologies")
async def add_lithology(body: LithologyAdd, user: AuthUser = Depends(get_current_user)):
    db_user = await get_or_create_user(user)
    workspace = await get_user_workspace(db_user)
    name = body.name.strip()
    if name and name not in workspace.custom_lithologies and name not in DEFAULT_LITHOLOGIES:
        workspace.custom_lithologies.append(name)
        await workspace.save()
    return {"lithologies": DEFAULT_LITHOLOGIES + workspace.custom_lithologies}
