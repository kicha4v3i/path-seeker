from app.core.auth import AuthUser
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


async def get_or_create_user(auth: AuthUser) -> User:
    user = await User.find_one(User.clerk_id == auth.clerk_id)
    if user:
        return user

    workspace = Workspace(name=f"{auth.name or auth.email}'s Workspace", owner_id=auth.clerk_id)
    await workspace.insert()

    user = User(
        clerk_id=auth.clerk_id,
        email=auth.email,
        name=auth.name,
        default_workspace_id=str(workspace.id),
    )
    await user.insert()

    await WorkspaceMember(
        workspace_id=str(workspace.id),
        user_id=auth.clerk_id,
        role="owner",
    ).insert()

    return user


async def get_user_workspace(user: User) -> Workspace:
    ws = await Workspace.get(user.default_workspace_id)
    if not ws:
        ws = Workspace(name="Default Workspace", owner_id=user.clerk_id)
        await ws.insert()
        user.default_workspace_id = str(ws.id)
        await user.save()
    return ws
