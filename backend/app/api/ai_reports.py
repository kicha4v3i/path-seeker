import base64
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.schemas import AIChatRequest
from app.core.auth import AuthUser, get_current_user
from app.models.ai_session import AISession
from app.models.project import Project
from app.models.report import Report
from app.models.subsurface import Subsurface
from app.models.trajectory import Trajectory, TrajectoryParams
from app.services.access import check_well_access
from app.services.ai.agent import ai_chat_response
from app.services.reports.pdf import generate_pdf_report

router = APIRouter(tags=["ai-reports"])


@router.post("/wells/{well_id}/ai/chat")
async def ai_chat(
    well_id: str,
    body: AIChatRequest,
    user: AuthUser = Depends(get_current_user),
):
    well = await check_well_access(well_id, user.clerk_id, "editor")
    subsurface = await Subsurface.find_one(Subsurface.well_id == well_id)

    session = await AISession.find_one(AISession.well_id == well_id)
    if not session:
        session = AISession(well_id=well_id)
    history = session.messages[-10:]
    result = await ai_chat_response(body.message, well, subsurface, history)

    session.messages.append({"role": "user", "content": body.message})
    session.messages.append({"role": "assistant", "content": result["reply"]})
    session.last_proposed_params = result["params"]
    session.updated_at = datetime.utcnow()
    await session.save()

    return result


@router.post("/wells/{well_id}/ai/commit")
async def commit_ai_trajectory(
    well_id: str,
    user: AuthUser = Depends(get_current_user),
):
    await check_well_access(well_id, user.clerk_id, "editor")
    session = await AISession.find_one(AISession.well_id == well_id)
    if not session or not session.last_proposed_params:
        return {"error": "No proposed trajectory to commit"}

    traj = await Trajectory.find_one(Trajectory.well_id == well_id)
    is_new = traj is None
    if is_new:
        traj = Trajectory(well_id=well_id)

    well = await check_well_access(well_id, user.clerk_id, "editor")
    subsurface = await Subsurface.find_one(Subsurface.well_id == well_id)
    params = TrajectoryParams(**session.last_proposed_params)
    from app.services.trajectory.engine import TrajectoryEngine, build_request_from_context

    req = build_request_from_context(well, subsurface, params)
    result = TrajectoryEngine().generate(req)
    traj.mode = "ai"
    traj.params = params
    traj.survey_stations = result.stations
    traj.updated_at = datetime.utcnow()
    if is_new:
        await traj.insert()
    else:
        await traj.save()
    return traj.model_dump()


@router.get("/wells/{well_id}/ai/session")
async def get_ai_session(well_id: str, user: AuthUser = Depends(get_current_user)):
    await check_well_access(well_id, user.clerk_id)
    session = await AISession.find_one(AISession.well_id == well_id)
    return session.model_dump() if session else {"messages": []}


@router.post("/wells/{well_id}/reports")
async def create_report(well_id: str, user: AuthUser = Depends(get_current_user)):
    well = await check_well_access(well_id, user.clerk_id)
    traj = await Trajectory.find_one(Trajectory.well_id == well_id)
    if not traj or not traj.survey_stations:
        return {"error": "No trajectory to report"}

    project = await Project.get(well.project_id)
    filename, pdf_bytes = generate_pdf_report(project, well, traj)
    b64 = base64.b64encode(pdf_bytes).decode()

    report = Report(
        well_id=well_id,
        trajectory_id=str(traj.id),
        filename=filename,
        content_base64=b64,
    )
    await report.insert()
    return {"report_id": str(report.id), "filename": filename}


@router.get("/wells/{well_id}/reports/{report_id}/download")
async def download_report(
    well_id: str,
    report_id: str,
    user: AuthUser = Depends(get_current_user),
):
    await check_well_access(well_id, user.clerk_id)
    report = await Report.get(report_id)
    if not report:
        return {"error": "Report not found"}
    pdf_bytes = base64.b64decode(report.content_base64)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{report.filename}"'},
    )
