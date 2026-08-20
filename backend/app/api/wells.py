from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.api.schemas import SubsurfaceUpdate, TrajectoryGenerateRequest, TrajectoryUpdate, WellCreate, WellUpdate
from app.core.auth import AuthUser, get_current_user
from app.core.serialize import serialize_doc, serialize_docs
from app.models.subsurface import Subsurface
from app.models.trajectory import Trajectory, TrajectoryParams, SurveyStation
from app.services.access import check_project_access, check_well_access
from app.services.trajectory.engine import (
    TrajectoryEngine,
    build_request_from_context,
    collapse_interpolated_stations,
    recompute_stations_after_kop_change,
)
from app.models.well import Well

router = APIRouter(tags=["wells"])


def _survey_stations_for_kop(well: Well, kop: float | None) -> list[SurveyStation]:
    return recompute_stations_after_kop_change(
        surface_northing=well.northing or 0.0,
        surface_easting=well.easting or 0.0,
        subsequent=[],
        old_kop=None,
        new_kop=kop,
    )


def _subsequent_after_kop(
    stations: list[SurveyStation],
    old_kop: float | None,
) -> list[SurveyStation]:
    """Stations that follow the KOP row — kept (and recomputed) when KOP changes."""
    if not stations:
        return []

    if old_kop is not None and old_kop > 0:
        return [s for s in stations if s.md > old_kop + 1e-9]

    # No prior KOP: drop surface; if the next row looks like a vertical KOP, drop it too.
    rest = list(stations[1:])
    if (
        rest
        and rest[0].inc == 0
        and rest[0].azi == 0
        and abs(rest[0].md - rest[0].tvd) < 1e-6
    ):
        return rest[1:]
    return rest


def _apply_kop_preserving_subsequent(
    well: Well,
    stations: list[SurveyStation],
    old_kop: float | None,
    new_kop: float | None,
) -> list[SurveyStation]:
    """Update KOP and recompute north/east/TVD for section endpoints below it."""
    section_stations = collapse_interpolated_stations(stations)
    subsequent = _subsequent_after_kop(section_stations, old_kop)
    return recompute_stations_after_kop_change(
        surface_northing=well.northing or 0.0,
        surface_easting=well.easting or 0.0,
        subsequent=subsequent,
        old_kop=old_kop,
        new_kop=new_kop,
    )


def _align_survey_stations_to_well_surface(
    northing: float,
    easting: float,
    stations: list[SurveyStation],
) -> list[SurveyStation]:
    """
    Move all survey N/E so the surface row matches the well surface location.

    Uses the current surface station as anchor so misaligned legacy data (e.g. 0,0
    surface with non-zero well coordinates) is corrected as well as normal moves.
    """
    if not stations:
        return stations

    anchor_ns = stations[0].ns
    anchor_ew = stations[0].ew
    dn = northing - anchor_ns
    de = easting - anchor_ew
    if abs(dn) < 1e-9 and abs(de) < 1e-9:
        return stations

    updated: list[SurveyStation] = []
    for station in stations:
        ew = station.ew + de
        updated.append(
            SurveyStation(
                md=station.md,
                inc=station.inc,
                azi=station.azi,
                tvd=station.tvd,
                ns=station.ns + dn,
                ew=ew,
                dls=station.dls,
                vs=ew,
            )
        )

    if updated[0].md == 0:
        updated[0] = SurveyStation(
            md=updated[0].md,
            inc=updated[0].inc,
            azi=updated[0].azi,
            tvd=updated[0].tvd,
            ns=northing,
            ew=easting,
            dls=updated[0].dls,
            vs=easting,
        )

    return updated


def _apply_surface_coordinate_change(
    new_northing: float,
    new_easting: float,
    old_northing: float,
    old_easting: float,
    stations: list[SurveyStation],
) -> list[SurveyStation]:
    """Re-anchor survey stations when well surface northing/easting changes."""
    _ = (old_northing, old_easting)
    return _align_survey_stations_to_well_surface(new_northing, new_easting, stations)


@router.get("/projects/{project_id}/wells")
async def list_wells(project_id: str, user: AuthUser = Depends(get_current_user)):
    await check_project_access(project_id, user.clerk_id)
    wells = await Well.find(Well.project_id == project_id).to_list()
    return serialize_docs(wells)


@router.post("/projects/{project_id}/wells")
async def create_well(
    project_id: str,
    body: WellCreate,
    user: AuthUser = Depends(get_current_user),
):
    project = await check_project_access(project_id, user.clerk_id, "editor")
    data = body.model_dump()
    # Always inherit unit system from the project
    data["unit_system"] = getattr(project, "unit_system", None) or data.get("unit_system") or "API"
    well = Well(project_id=project_id, **data)
    await well.insert()
    subsurface = Subsurface(well_id=str(well.id))
    await subsurface.insert()
    return serialize_doc(well)


@router.get("/wells/{well_id}")
async def get_well(well_id: str, user: AuthUser = Depends(get_current_user)):
    well = await check_well_access(well_id, user.clerk_id)
    return serialize_doc(well)


@router.put("/wells/{well_id}")
async def update_well(
    well_id: str,
    body: WellUpdate,
    user: AuthUser = Depends(get_current_user),
):
    well = await check_well_access(well_id, user.clerk_id, "editor")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(well, k, v)
    well.updated_at = datetime.utcnow()
    await well.save()

    new_northing = well.northing or 0.0
    new_easting = well.easting or 0.0
    surface_coords_updated = "northing" in data or "easting" in data
    if surface_coords_updated and well.northing is not None and well.easting is not None:
        traj = await Trajectory.find_one(Trajectory.well_id == well_id)
        if traj and traj.survey_stations:
            aligned = _align_survey_stations_to_well_surface(
                new_northing,
                new_easting,
                traj.survey_stations,
            )
            if aligned is not traj.survey_stations:
                traj.survey_stations = aligned
                traj.updated_at = datetime.utcnow()
                await traj.save()

    return serialize_doc(well)


@router.delete("/wells/{well_id}")
async def delete_well(well_id: str, user: AuthUser = Depends(get_current_user)):
    well = await check_well_access(well_id, user.clerk_id, "editor")
    await well.delete()
    subsurface = await Subsurface.find_one(Subsurface.well_id == well_id)
    if subsurface:
        await subsurface.delete()
    return {"ok": True}


@router.get("/wells/{well_id}/subsurface")
async def get_subsurface(well_id: str, user: AuthUser = Depends(get_current_user)):
    await check_well_access(well_id, user.clerk_id)
    subsurface = await Subsurface.find_one(Subsurface.well_id == well_id)
    if not subsurface:
        subsurface = Subsurface(well_id=well_id)
        await subsurface.insert()
    return serialize_doc(subsurface)


@router.put("/wells/{well_id}/subsurface")
async def update_subsurface(
    well_id: str,
    body: SubsurfaceUpdate,
    user: AuthUser = Depends(get_current_user),
):
    await check_well_access(well_id, user.clerk_id, "editor")
    subsurface = await Subsurface.find_one(Subsurface.well_id == well_id)
    is_new = subsurface is None
    if is_new:
        subsurface = Subsurface(well_id=well_id)
    subsurface.formations = body.formations
    subsurface.targets = body.targets
    subsurface.max_dls = body.max_dls
    subsurface.notes = body.notes
    subsurface.updated_at = datetime.utcnow()
    if is_new:
        await subsurface.insert()
    else:
        await subsurface.save()
    return serialize_doc(subsurface)


@router.get("/wells/{well_id}/trajectory")
async def get_trajectory(well_id: str, user: AuthUser = Depends(get_current_user)):
    well = await check_well_access(well_id, user.clerk_id)
    traj = await Trajectory.find_one(Trajectory.well_id == well_id)
    if not traj:
        return None

    changed = False
    if traj.survey_stations:
        collapsed = collapse_interpolated_stations(traj.survey_stations)
        if len(collapsed) < len(traj.survey_stations):
            traj.survey_stations = collapsed
            changed = True
        if well.northing is not None and well.easting is not None:
            aligned = _align_survey_stations_to_well_surface(
                well.northing,
                well.easting,
                traj.survey_stations,
            )
            if aligned is not traj.survey_stations:
                traj.survey_stations = aligned
                changed = True

    if changed:
        traj.updated_at = datetime.utcnow()
        await traj.save()

    return serialize_doc(traj)


@router.put("/wells/{well_id}/trajectory")
async def update_trajectory(
    well_id: str,
    body: TrajectoryUpdate,
    user: AuthUser = Depends(get_current_user),
):
    well = await check_well_access(well_id, user.clerk_id, "editor")
    traj = await Trajectory.find_one(Trajectory.well_id == well_id)
    is_new = traj is None
    if is_new:
        traj = Trajectory(well_id=well_id)

    updates = body.model_dump(exclude_unset=True)
    params = traj.params.model_dump()

    if "kop" in updates:
        kop = updates["kop"]
        if kop is not None and kop <= 0:
            raise HTTPException(status_code=400, detail="KOP must be greater than 0")
        old_kop = params.get("kop")
        params["kop"] = kop
        traj.params = TrajectoryParams(**params)
        if "survey_stations" not in updates:
            traj.survey_stations = _apply_kop_preserving_subsequent(
                well,
                traj.survey_stations or [],
                old_kop,
                kop,
            )

    if "survey_stations" in updates:
        traj.survey_stations = updates["survey_stations"]

    traj.updated_at = datetime.utcnow()

    if is_new:
        await traj.insert()
    else:
        await traj.save()
    return serialize_doc(traj)


@router.post("/wells/{well_id}/trajectories/generate")
async def generate_trajectory(
    well_id: str,
    body: TrajectoryGenerateRequest,
    user: AuthUser = Depends(get_current_user),
):
    well = await check_well_access(well_id, user.clerk_id, "editor")
    subsurface = await Subsurface.find_one(Subsurface.well_id == well_id)
    existing = await Trajectory.find_one(Trajectory.well_id == well_id)
    existing_params = existing.params if existing else TrajectoryParams()
    params = TrajectoryParams(
        kop=body.kop if body.kop is not None else existing_params.kop,
        build_rate=body.build_rate if body.build_rate is not None else existing_params.build_rate,
        turn_rate=body.turn_rate if body.turn_rate is not None else existing_params.turn_rate,
        max_dls=body.max_dls if body.max_dls is not None else existing_params.max_dls,
        sections=body.sections if body.sections is not None else existing_params.sections,
    )
    req = build_request_from_context(well, subsurface, params)
    if existing and existing.survey_stations:
        req.existing_stations = collapse_interpolated_stations(existing.survey_stations)
    engine = TrajectoryEngine()
    result = engine.generate(req)

    traj = existing
    is_new = traj is None
    if is_new:
        traj = Trajectory(well_id=well_id)
    traj.mode = body.mode
    traj.params = params
    traj.survey_stations = collapse_interpolated_stations(result.stations)
    traj.source_prompt = body.source_prompt
    traj.updated_at = datetime.utcnow()
    if is_new:
        await traj.insert()
    else:
        await traj.save()
    return {
        "trajectory": serialize_doc(traj),
        "summary": result.summary,
        "validation_errors": result.validation_errors,
        "info_messages": result.info_messages,
    }
