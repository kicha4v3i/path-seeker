import math
from dataclasses import dataclass, field

from app.models.trajectory import SurveyStation, TrajectoryParams

METERS_TO_FEET = 3.281


@dataclass
class TrajectoryRequest:
    unit_system: str = "API"
    kop: float = 500.0
    build_rate: float = 2.0
    turn_rate: float = 0.0
    max_dls: float = 3.0
    target_northing: float = 0.0
    target_easting: float = 1000.0
    target_tvdss: float = 8000.0
    surface_northing: float = 0.0
    surface_easting: float = 0.0
    sections: list[dict] = field(default_factory=list)
    existing_stations: list[SurveyStation] = field(default_factory=list)
    targets: list[dict] = field(default_factory=list)


@dataclass
class TrajectoryResult:
    stations: list[SurveyStation]
    summary: dict
    validation_errors: list[str] = field(default_factory=list)
    info_messages: list[str] = field(default_factory=list)


@dataclass
class Node:
    """Internal path node used by build/hold/drop geometry helpers."""

    md: float
    north: float
    east: float
    tvd: float
    inclination: float
    azimuth: float


def _deg2rad(d: float) -> float:
    return d * math.pi / 180.0


def _rad2deg(r: float) -> float:
    return r * 180.0 / math.pi


def _direction(inclination: float, azimuth: float) -> tuple[float, float, float]:
    """Unit direction vector from inclination and azimuth (degrees)."""
    inc = _deg2rad(inclination)
    azi = _deg2rad(azimuth)
    return (
        math.sin(inc) * math.cos(azi),
        math.sin(inc) * math.sin(azi),
        math.cos(inc),
    )


def _dogleg_angle(
    inclination1: float,
    azimuth1: float,
    inclination2: float,
    azimuth2: float,
) -> float:
    """Subtended dogleg angle (radians) between two attitude vectors."""
    t1 = _direction(inclination1, azimuth1)
    t2 = _direction(inclination2, azimuth2)
    cos_a = max(-1.0, min(1.0, t1[0] * t2[0] + t1[1] * t2[1] + t1[2] * t2[2]))
    return math.acos(cos_a)


def build_inc_azi(from_node: Node, inclination: float, azimuth: float, dls: float) -> Node:
    """
    Build section when end inclination and azimuth are provided.

    dls is dogleg severity in degrees per 100 length units (°/100ft or °/100m).
    Ported from the user-supplied geometry (numpy version → stdlib math).
    """
    if dls <= 0:
        raise ValueError("Build DLS must be greater than 0")

    t1 = _direction(from_node.inclination, from_node.azimuth)
    t2 = _direction(inclination, azimuth)
    alpha = _dogleg_angle(from_node.inclination, from_node.azimuth, inclination, azimuth)

    # Radius of curvature from DLS (°/100): R = 100 / radians(dls)
    radius = 100.0 / _deg2rad(dls)

    if alpha < 1e-12:
        # Same attitude — no curvature; zero-length step
        course_length = 0.0
        ratio = 1.0
    else:
        course_length = radius * alpha
        ratio = math.tan(alpha / 2.0) / (alpha / 2.0)

    north = from_node.north + course_length * ratio / 2.0 * (t1[0] + t2[0])
    east = from_node.east + course_length * ratio / 2.0 * (t1[1] + t2[1])
    tvd = from_node.tvd + course_length * ratio / 2.0 * (t1[2] + t2[2])

    return Node(
        md=from_node.md + course_length,
        north=north,
        east=east,
        tvd=tvd,
        inclination=inclination,
        azimuth=azimuth,
    )


def hold(from_node: Node, length: float) -> Node:
    """
    Hold section: constant inclination and azimuth for the given course length.

    Ported from the user-supplied geometry helper.
    """
    if length <= 0:
        raise ValueError("Hold length must be greater than 0")

    t1 = _direction(from_node.inclination, from_node.azimuth)
    p2_north = from_node.north + length * 0.5 * (t1[0] + t1[0])
    p2_east = from_node.east + length * 0.5 * (t1[1] + t1[1])
    p2_tvd = from_node.tvd + length * 0.5 * (t1[2] + t1[2])

    return Node(
        md=from_node.md + length,
        north=p2_north,
        east=p2_east,
        tvd=p2_tvd,
        inclination=from_node.inclination,
        azimuth=from_node.azimuth,
    )


def _vector_node(node: Node) -> tuple[float, float, float]:
    return node.north, node.east, node.tvd


def _v_add(
    a: tuple[float, float, float], b: tuple[float, float, float]
) -> tuple[float, float, float]:
    return a[0] + b[0], a[1] + b[1], a[2] + b[2]


def _v_sub(
    a: tuple[float, float, float], b: tuple[float, float, float]
) -> tuple[float, float, float]:
    return a[0] - b[0], a[1] - b[1], a[2] - b[2]


def _v_mul(a: tuple[float, float, float], s: float) -> tuple[float, float, float]:
    return a[0] * s, a[1] * s, a[2] * s


def _v_dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _v_norm(a: tuple[float, float, float]) -> float:
    return math.sqrt(_v_dot(a, a))


def build_hold(from_node: Node, to_node: Node, dls: float) -> tuple[Node, Node, float | None]:
    """
    Build-hold geometry: find the intermediate node between from_node and to_node.

    Returns the intermediate node, the updated to_node (MD and attitude set from the
    hold section), and when the else branch runs the effective DLS (°/100) required.
    """
    if dls <= 0:
        raise ValueError("Build & Hold DLS must be greater than 0")

    p1 = _vector_node(from_node)
    p3 = _vector_node(to_node)
    p3_p1 = (p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2])
    dist_sq = p3_p1[0] ** 2 + p3_p1[1] ** 2 + p3_p1[2] ** 2
    if dist_sq < 1e-18:
        raise ValueError("Build & Hold requires a non-zero displacement to the target node")

    t1 = _direction(from_node.inclination, from_node.azimuth)
    eta = p3_p1[0] * t1[0] + p3_p1[1] * t1[1] + p3_p1[2] * t1[2]
    epi_sq = dist_sq - eta**2
    if epi_sq < 0:
        raise ValueError("Build & Hold target is not reachable from the current attitude")
    epi = math.sqrt(epi_sq)

    R = 100.0 / _deg2rad(dls)
    adjusted_dls: float | None = None

    if R**2 < (dist_sq + eta**2):
        build_disc = dist_sq - 2 * R * epi
        if build_disc < 0:
            raise ValueError("Build & Hold geometry is not feasible for the given DLS")
        tangent_length = math.sqrt(build_disc)
        a = 2 * math.atan((eta - tangent_length) / (2 * R - epi))
        S12 = R * a
        rf_a = _rf(a)
        t2 = (
            (p3_p1[0] - S12 * rf_a / 2 * t1[0]) / (S12 * rf_a + tangent_length),
            (p3_p1[1] - S12 * rf_a / 2 * t1[1]) / (S12 * rf_a + tangent_length),
            (p3_p1[2] - S12 * rf_a / 2 * t1[2]) / (S12 * rf_a + tangent_length),
        )
        p2 = (
            p1[0] + S12 * rf_a / 2 * (t1[0] + t2[0]),
            p1[1] + S12 * rf_a / 2 * (t1[1] + t2[1]),
            p1[2] + S12 * rf_a / 2 * (t1[2] + t2[2]),
        )
    else:
        Rc = dist_sq / (2 * epi)
        adjusted_dls = _rad2deg(100.0 / Rc)
        if abs(eta) < 1e-12:
            raise ValueError("Build & Hold geometry is not feasible for the current configuration")
        ac = 2 * math.atan(epi / eta)
        hold_disc = dist_sq - 2 * Rc * epi
        if hold_disc < 0:
            raise ValueError("Build & Hold geometry is not feasible after adjusting DLS")
        tangent_length = math.sqrt(hold_disc)
        S12 = Rc * ac
        rf_ac = _rf(ac)
        t2 = (
            (p3_p1[0] - S12 * rf_ac / 2 * t1[0]) / (S12 * rf_ac + tangent_length),
            (p3_p1[1] - S12 * rf_ac / 2 * t1[1]) / (S12 * rf_ac + tangent_length),
            (p3_p1[2] - S12 * rf_ac / 2 * t1[2]) / (S12 * rf_ac + tangent_length),
        )
        p2 = (
            p1[0] + S12 * rf_ac / 2 * (t1[0] + t2[0]),
            p1[1] + S12 * rf_ac / 2 * (t1[1] + t2[1]),
            p1[2] + S12 * rf_ac / 2 * (t1[2] + t2[2]),
        )

    if abs(t2[2]) < 1e-12:
        raise ValueError("Build & Hold geometry produced an invalid hold direction")

    inclination = math.atan(math.hypot(t2[0], t2[1]) / t2[2])
    azimuth = math.atan2(t2[1], t2[0])
    inc_deg = _rad2deg(inclination)
    azi_deg = (_rad2deg(azimuth) - 360) % 360

    p2_node = Node(
        md=from_node.md + S12,
        north=p2[0],
        east=p2[1],
        tvd=p2[2],
        inclination=inc_deg,
        azimuth=azi_deg,
    )

    to_node_out = Node(
        md=p2_node.md + tangent_length,
        north=to_node.north,
        east=to_node.east,
        tvd=to_node.tvd,
        inclination=inc_deg,
        azimuth=azi_deg,
    )

    return p2_node, to_node_out, adjusted_dls


def curve_hold_curve(
    from_node: Node,
    to_node: Node,
    dls1: float,
    dls2: float,
    tol: float = 1e-6,
    max_iter: int = 200,
) -> tuple[Node, Node, Node]:
    """
    Curve-hold-curve (position_direction): two arcs joined by a tangent hold.

    Iterates forward from from_node (p1) and backward from to_node (p4) until the
    subtended angles converge. Returns p2, p3, and the to-node with MD set from
    the second curve. Survey legs are p1→p2 (curve), p2→p3 (hold), p3→p4 (curve).
    """
    if dls1 <= 0 or dls2 <= 0:
        raise ValueError("Curve-Hold-Curve DLS must be greater than 0")

    t1 = _direction(from_node.inclination, from_node.azimuth)
    t4 = _direction(to_node.inclination, to_node.azimuth)
    p1 = _vector_node(from_node)
    p4 = _vector_node(to_node)
    r1 = 100.0 / _deg2rad(dls1)
    r2 = 100.0 / _deg2rad(dls2)

    p1_new = p1
    p4_new = p4
    a1_prev = 0.0
    a4_prev = 0.0
    a1 = 0.0
    a4 = 0.0
    beta1 = 0.0
    beta2 = 0.0

    for _ in range(max_iter):
        delta = _v_sub(p4_new, p1)
        psi2 = _v_dot(delta, delta)
        eta = _v_dot(delta, t1)
        epi_sq = psi2 - eta * eta
        if epi_sq < -1e-12:
            raise ValueError(
                "Curve-Hold-Curve first curve is not reachable from the current attitude"
            )
        epi = math.sqrt(max(epi_sq, 0.0))
        build_disc = psi2 - 2.0 * r1 * epi
        if build_disc < -1e-12:
            raise ValueError("Curve-Hold-Curve first curve is not feasible for the given DLS")
        beta1 = math.sqrt(max(build_disc, 0.0))
        denom = 2.0 * r1 - epi
        if abs(denom) < 1e-18:
            raise ValueError("Curve-Hold-Curve first curve geometry is singular")
        a1 = 2.0 * math.atan((eta - beta1) / denom)
        p1_new = _v_add(p1, _v_mul(t1, r1 * math.tan(a1 / 2.0)))

        delta = _v_sub(p1_new, p4)
        psi2 = _v_dot(delta, delta)
        eta = _v_dot(delta, _v_mul(t4, -1.0))
        epi_sq = psi2 - eta * eta
        if epi_sq < -1e-12:
            raise ValueError(
                "Curve-Hold-Curve second curve is not reachable from the landing attitude"
            )
        epi = math.sqrt(max(epi_sq, 0.0))
        build_disc = psi2 - 2.0 * r2 * epi
        if build_disc < -1e-12:
            raise ValueError("Curve-Hold-Curve second curve is not feasible for the given DLS")
        beta2 = math.sqrt(max(build_disc, 0.0))
        denom = 2.0 * r2 - epi
        if abs(denom) < 1e-18:
            raise ValueError("Curve-Hold-Curve second curve geometry is singular")
        a4 = 2.0 * math.atan((eta - beta2) / denom)
        p4_new = _v_sub(p4, _v_mul(t4, r2 * math.tan(a4 / 2.0)))

        if math.hypot(a1 - a1_prev, a4 - a4_prev) < tol:
            break
        a1_prev = a1
        a4_prev = a4
    else:
        raise ValueError(
            "Curve-Hold-Curve did not converge for the given DLS and landing attitude"
        )

    half_s1 = r1 * a1 * _rf(a1) / 2.0
    half_s2 = r2 * a4 * _rf(a4) / 2.0
    denom_t2 = half_s1 + beta1
    denom_t3 = half_s2 + beta2
    if abs(denom_t2) < 1e-18 or abs(denom_t3) < 1e-18:
        raise ValueError("Curve-Hold-Curve produced an invalid hold direction")

    t2 = _v_mul(_v_sub(_v_sub(p4_new, p1), _v_mul(t1, half_s1)), 1.0 / denom_t2)
    t3 = _v_mul(_v_add(_v_sub(p1_new, p4), _v_mul(t4, half_s2)), -1.0 / denom_t3)
    p2 = _v_add(p1, _v_mul(_v_add(t1, t2), half_s1))
    p3 = _v_add(p4, _v_mul(_v_add(_v_mul(t4, -1.0), _v_mul(t3, -1.0)), half_s2))
    tangent_length = _v_norm(_v_sub(p3, p2))
    inc2, azi2 = _attitude_from_direction(t2[0], t2[1], t2[2])
    inc3, azi3 = _attitude_from_direction(t3[0], t3[1], t3[2])

    p2_node = Node(
        md=from_node.md + r1 * a1,
        north=p2[0],
        east=p2[1],
        tvd=p2[2],
        inclination=inc2,
        azimuth=azi2,
    )
    p3_node = Node(
        md=p2_node.md + tangent_length,
        north=p3[0],
        east=p3[1],
        tvd=p3[2],
        inclination=inc3,
        azimuth=azi3,
    )
    to_node_out = Node(
        md=p3_node.md + r2 * a4,
        north=to_node.north,
        east=to_node.east,
        tvd=to_node.tvd,
        inclination=to_node.inclination,
        azimuth=to_node.azimuth,
    )
    return p2_node, p3_node, to_node_out


def hold_upto_tvd(from_node: Node, tvd: float) -> Node:
    """
    Hold at constant attitude until the given TVD.

    Ported from the user-supplied hold_upto_tvd() helper (numpy → stdlib).
    """
    cos_inc = math.cos(_deg2rad(from_node.inclination))
    if abs(cos_inc) < 1e-12:
        raise ValueError("Cannot hold up to TVD at 90° inclination")

    tangent_length = (tvd - from_node.tvd) / cos_inc
    if tangent_length <= 0:
        raise ValueError("Hold-up-to TVD must be deeper than the current TVD")

    t1 = _direction(from_node.inclination, from_node.azimuth)
    return Node(
        md=from_node.md + tangent_length,
        north=from_node.north + tangent_length * t1[0],
        east=from_node.east + tangent_length * t1[1],
        tvd=from_node.tvd + tangent_length * t1[2],
        inclination=from_node.inclination,
        azimuth=from_node.azimuth,
    )


def _attitude_from_direction(tx: float, ty: float, tz: float) -> tuple[float, float]:
    """Inclination and azimuth (degrees) from a direction vector."""
    horizontal = math.hypot(tx, ty)
    inclination = _rad2deg(math.atan2(horizontal, tz))
    azimuth = _rad2deg(math.atan2(ty, tx)) % 360.0
    return inclination, azimuth


def _rf(angle: float) -> float:
    """Minimum-curvature ratio factor for dogleg angle (radians)."""
    if abs(angle) < 1e-12:
        return 1.0
    return math.tan(angle / 2.0) / (angle / 2.0)


def survey_data(from_node: Node, to_node: Node, step: int = 100) -> list[Node]:
    """
    Interpolate survey nodes between from_node and to_node at MD multiples of step.

    Ported from the user-supplied survey_data() helper (numpy → stdlib).
    Returns [from_node, ...intermediates..., to_node].
    """
    if step <= 0:
        raise ValueError("Interpolation step must be greater than 0")

    span = to_node.md - from_node.md
    if span <= 1e-9:
        return [from_node, to_node]

    t1 = _direction(from_node.inclination, from_node.azimuth)
    t2 = _direction(to_node.inclination, to_node.azimuth)
    alpha = _dogleg_angle(
        from_node.inclination,
        from_node.azimuth,
        to_node.inclination,
        to_node.azimuth,
    )

    # First MD on the step grid strictly after from_node.md
    md_start = from_node.md - (from_node.md % step) + step
    if md_start <= from_node.md + 1e-9:
        md_start += step

    nodes: list[Node] = [from_node]
    md = md_start
    while md < to_node.md - 1e-9:
        frac = (md - from_node.md) / span
        ai = frac * alpha

        if alpha < 1e-12:
            # Straight section — linear blend of attitudes and positions
            ti = (
                t1[0] + frac * (t2[0] - t1[0]),
                t1[1] + frac * (t2[1] - t1[1]),
                t1[2] + frac * (t2[2] - t1[2]),
            )
            course = md - from_node.md
            north = from_node.north + course * t1[0]
            east = from_node.east + course * t1[1]
            tvd = from_node.tvd + course * t1[2]
        else:
            sin_alpha = math.sin(alpha)
            ti = (
                math.sin(alpha - ai) / sin_alpha * t1[0] + math.sin(ai) / sin_alpha * t2[0],
                math.sin(alpha - ai) / sin_alpha * t1[1] + math.sin(ai) / sin_alpha * t2[1],
                math.sin(alpha - ai) / sin_alpha * t1[2] + math.sin(ai) / sin_alpha * t2[2],
            )
            course = md - from_node.md
            ratio = _rf(ai)
            north = from_node.north + course * ratio / 2.0 * (t1[0] + ti[0])
            east = from_node.east + course * ratio / 2.0 * (t1[1] + ti[1])
            tvd = from_node.tvd + course * ratio / 2.0 * (t1[2] + ti[2])

        inclination, azimuth = _attitude_from_direction(ti[0], ti[1], ti[2])
        nodes.append(
            Node(
                md=md,
                north=north,
                east=east,
                tvd=tvd,
                inclination=inclination,
                azimuth=azimuth,
            )
        )
        md += step

    nodes.append(to_node)
    return nodes


def _geo_horiz_to_local(
    northing: float,
    easting: float,
    surface_northing: float,
    surface_easting: float,
    unit_system: str,
) -> tuple[float, float]:
    """Geographic meters → local north/east (m for SI, ft for API)."""
    dn = northing - surface_northing
    de = easting - surface_easting
    if unit_system == "SI":
        return dn, de
    return dn * METERS_TO_FEET, de * METERS_TO_FEET


def _local_horiz_to_geo(
    local_north: float,
    local_east: float,
    surface_northing: float,
    surface_easting: float,
    unit_system: str,
) -> tuple[float, float]:
    """Local north/east → geographic meters for storage."""
    if unit_system == "SI":
        return surface_northing + local_north, surface_easting + local_east
    return (
        surface_northing + local_north / METERS_TO_FEET,
        surface_easting + local_east / METERS_TO_FEET,
    )


def _node_to_station(
    node: Node,
    surface_northing: float,
    surface_easting: float,
    unit_system: str,
    dls: float = 0.0,
) -> SurveyStation:
    ns, ew = _local_horiz_to_geo(
        node.north,
        node.east,
        surface_northing,
        surface_easting,
        unit_system,
    )
    return SurveyStation(
        md=node.md,
        inc=node.inclination,
        azi=node.azimuth,
        tvd=node.tvd,
        ns=ns,
        ew=ew,
        dls=dls,
        vs=ew,
    )


def _station_to_node(
    station: SurveyStation,
    surface_northing: float,
    surface_easting: float,
    unit_system: str,
) -> Node:
    north, east = _geo_horiz_to_local(
        station.ns,
        station.ew,
        surface_northing,
        surface_easting,
        unit_system,
    )
    return Node(
        md=station.md,
        north=north,
        east=east,
        tvd=station.tvd,
        inclination=station.inc,
        azimuth=station.azi,
    )


def recompute_stations_after_kop_change(
    surface_northing: float,
    surface_easting: float,
    subsequent: list[SurveyStation],
    old_kop: float | None,
    new_kop: float | None,
) -> list[SurveyStation]:
    """
    Rebuild survey stations after a KOP change.

    Keeps course lengths and attitudes of stations below the old KOP, shifts their
    MD with the KOP delta, and recomputes north/east/TVD (and DLS) from the new KOP.
    """
    stations: list[SurveyStation] = [
        SurveyStation(
            md=0.0,
            inc=0.0,
            azi=0.0,
            tvd=0.0,
            ns=surface_northing,
            ew=surface_easting,
            dls=0.0,
            vs=0.0,
        )
    ]

    if new_kop is not None and new_kop > 0:
        stations.append(
            SurveyStation(
                md=new_kop,
                inc=0.0,
                azi=0.0,
                tvd=new_kop,
                ns=surface_northing,
                ew=surface_easting,
                dls=0.0,
                vs=surface_easting,
            )
        )

    if not subsequent:
        return stations

    old_anchor = old_kop if old_kop is not None and old_kop > 0 else 0.0
    new_anchor = new_kop if new_kop is not None and new_kop > 0 else 0.0
    md_delta = new_anchor - old_anchor

    prev_md = stations[-1].md
    prev_inc = stations[-1].inc
    prev_azi = stations[-1].azi
    prev_ns = stations[-1].ns
    prev_ew = stations[-1].ew
    prev_tvd = stations[-1].tvd

    for station in subsequent:
        md2 = station.md + md_delta
        if md2 <= prev_md + 1e-9:
            # Degenerate after shift — keep a tiny forward step to avoid collapse.
            md2 = prev_md + max(station.md - old_anchor, 1.0)

        ns, ew, tvd, dls = _min_curvature_step(
            prev_md,
            prev_inc,
            prev_azi,
            prev_ns,
            prev_ew,
            prev_tvd,
            md2,
            station.inc,
            station.azi,
        )
        stations.append(
            SurveyStation(
                md=md2,
                inc=station.inc,
                azi=station.azi,
                tvd=tvd,
                ns=ns,
                ew=ew,
                dls=dls,
                vs=ew,
            )
        )
        prev_md, prev_inc, prev_azi = md2, station.inc, station.azi
        prev_ns, prev_ew, prev_tvd = ns, ew, tvd

    return stations


def _min_curvature_step(
    md1: float,
    inc1: float,
    azi1: float,
    ns1: float,
    ew1: float,
    tvd1: float,
    md2: float,
    inc2: float,
    azi2: float,
) -> tuple[float, float, float, float]:
    """Minimum curvature method between two survey stations (legacy helper)."""
    dmd = md2 - md1
    if dmd <= 0:
        return ns1, ew1, tvd1, 0.0

    dogleg = _dogleg_angle(inc1, azi1, inc2, azi2)
    dls = _rad2deg(dogleg) / dmd * 100.0

    if dogleg < 1e-8:
        rf = 1.0
    else:
        rf = 2.0 / dogleg * math.tan(dogleg / 2.0)

    inc1r, inc2r = _deg2rad(inc1), _deg2rad(inc2)
    azi1r, azi2r = _deg2rad(azi1), _deg2rad(azi2)

    dns = (dmd / 2.0) * (math.sin(inc1r) * math.cos(azi1r) + math.sin(inc2r) * math.cos(azi2r)) * rf
    dew = (dmd / 2.0) * (math.sin(inc1r) * math.sin(azi1r) + math.sin(inc2r) * math.sin(azi2r)) * rf
    dtvd = (dmd / 2.0) * (math.cos(inc1r) + math.cos(inc2r)) * rf

    return ns1 + dns, ew1 + dew, tvd1 + dtvd, dls


def _find_build_inc_azi_section(sections: list[dict]) -> dict | None:
    """Return the first build section defined by inclination + azimuth (no TVD)."""
    for section in sections:
        if str(section.get("type", "")).lower() != "build":
            continue
        inc = section.get("inc", section.get("inclination"))
        azi = section.get("azi", section.get("azimuth"))
        tvd = section.get("tvd")
        if inc is None or azi is None:
            continue
        if tvd is not None and tvd != "":
            continue
        return section
    return None


def _find_hold_section(sections: list[dict]) -> dict | None:
    """Return the first hold section with tangent length or hold-up-to TVD."""
    for section in sections:
        if str(section.get("type", "")).lower() != "hold":
            continue
        length = section.get(
            "tangent_length",
            section.get("tangentLength", section.get("length", section.get("md"))),
        )
        tvd = section.get("tvd")
        if length is not None and length != "":
            return section
        if tvd is not None and tvd != "":
            return section
    return None


def _distance_3d(
    a: tuple[float, float, float],
    b: tuple[float, float, float],
) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _next_target_by_tvd_sequence(
    from_node: Node,
    targets: list[dict],
    action: str = "Build & Hold",
) -> dict:
    """
    Pick the next target in ascending TVD order that has not been reached yet.

    A target is considered reached when the current station TVD is at or below
    the target TVD (drilling downward increases TVD).
    """
    if not targets:
        raise ValueError(f"{action} requires at least one target")

    sorted_targets = sorted(
        targets,
        key=lambda target: float(target.get("tvdss", target.get("tvd", 0))),
    )

    for target in sorted_targets:
        target_tvd = float(target.get("tvdss", target.get("tvd", 0)))
        if from_node.tvd < target_tvd - 1e-6:
            return target

    raise ValueError(
        f"{action} has no remaining targets: all targets have been reached at the current TVD"
    )


def _resolve_section_target(
    section: dict,
    targets: list[dict],
    action: str,
    from_node: Node,
) -> dict:
    """Use an explicitly selected target, otherwise the next unreached target by TVD."""
    raw_index = section.get("target_index", section.get("targetIndex"))
    if raw_index is not None and raw_index != "":
        index = int(raw_index)
        if index < 0 or index >= len(targets):
            raise ValueError(f"{action} target index {index} is out of range")
        return targets[index]

    name = section.get("target", section.get("target_name"))
    if name not in (None, ""):
        for target in targets:
            if target.get("name") == name:
                return target
        raise ValueError(f"{action} target '{name}' was not found")

    return _next_target_by_tvd_sequence(from_node, targets, action=action)


def _target_to_node(
    from_node: Node,
    target: dict,
    md: float,
    surface_northing: float,
    surface_easting: float,
    unit_system: str,
) -> Node:
    north, east = _geo_horiz_to_local(
        float(target["northing"]),
        float(target["easting"]),
        surface_northing,
        surface_easting,
        unit_system,
    )
    tvd = float(target.get("tvdss", target.get("tvd", 0)))
    dn = north - from_node.north
    de = east - from_node.east
    dt = tvd - from_node.tvd
    inclination, azimuth = _attitude_from_direction(dn, de, dt)
    return Node(
        md=md,
        north=north,
        east=east,
        tvd=tvd,
        inclination=inclination,
        azimuth=azimuth,
    )


def _find_build_hold_section(sections: list[dict]) -> dict | None:
    """Return the first build-hold section with DLS."""
    for section in sections:
        if str(section.get("type", "")).lower() not in ("build-hold", "build_hold"):
            continue
        dls = section.get("dls", section.get("build_rate"))
        if dls is None or dls == "":
            continue
        return section
    return None


def _find_curve_hold_curve_section(sections: list[dict]) -> dict | None:
    """Return the first curve-hold-curve section with DLS."""
    for section in sections:
        if _normalize_section_type(section) not in ("curve-hold-curve", "build-hold-build"):
            continue
        dls = section.get("dls1", section.get("dls", section.get("build_rate")))
        if dls is None or dls == "":
            continue
        return section
    return None


def _normalize_section_type(section: dict) -> str:
    return str(section.get("type", "")).lower().replace("_", "-")


def _apply_manual_sections_in_order(
    stations: list[SurveyStation],
    sections: list[dict],
    request: TrajectoryRequest,
    errors: list[str],
    info_messages: list[str],
) -> None:
    for section in sections:
        section_type = _normalize_section_type(section)
        if section_type == "build":
            try:
                _append_build_inc_azi(stations, section, request, errors)
            except ValueError as exc:
                errors.append(str(exc))
        elif section_type == "hold":
            _append_hold(stations, section, request, errors)
        elif section_type == "build-hold":
            try:
                _append_build_hold(stations, section, request, errors, info_messages)
            except ValueError as exc:
                errors.append(str(exc))
        elif section_type in ("curve-hold-curve", "build-hold-build"):
            try:
                _append_curve_hold_curve(stations, section, request, errors)
            except ValueError as exc:
                errors.append(str(exc))


def _summary_from_stations(stations: list[SurveyStation]) -> dict:
    last = stations[-1]
    return {
        "total_md": last.md,
        "total_tvd": last.tvd,
        "max_dls": max((s.dls for s in stations), default=0),
        "final_inc": last.inc,
        "final_azi": last.azi,
    }


def _surface_and_kop_stations(request: TrajectoryRequest) -> list[SurveyStation]:
    """Vertical path from surface through optional KOP."""
    stations: list[SurveyStation] = [
        SurveyStation(
            md=0.0,
            inc=0.0,
            azi=0.0,
            tvd=0.0,
            ns=request.surface_northing,
            ew=request.surface_easting,
            dls=0,
            vs=0,
        )
    ]
    if request.kop > 0:
        md = 0.0
        inc = 0.0
        azi = 0.0
        ns = request.surface_northing
        ew = request.surface_easting
        tvd = 0.0
        md2 = request.kop
        ns, ew, tvd, dls = _min_curvature_step(md, inc, azi, ns, ew, tvd, md2, inc, azi)
        stations.append(
            SurveyStation(md=md2, inc=inc, azi=azi, tvd=tvd, ns=ns, ew=ew, dls=dls, vs=ew)
        )
    return stations


def collapse_interpolated_stations(
    stations: list[SurveyStation],
    step: float = 100.0,
) -> list[SurveyStation]:
    """
    Keep only section endpoints from a densified survey_data() station list.

    Drops points that are strictly interior to a run of ~step MD spacing.
    Surface, KOP, and each section's final node are retained. Section boundaries
    are also detected when DLS changes (e.g. build → hold).
    """
    if len(stations) <= 2:
        return list(stations)

    def is_step_delta(a: float, b: float) -> bool:
        return abs((b - a) - step) <= 1.0

    kept: list[SurveyStation] = [stations[0]]
    for i in range(1, len(stations)):
        if i == len(stations) - 1:
            kept.append(stations[i])
            continue
        prev_step = is_step_delta(stations[i - 1].md, stations[i].md)
        next_step = is_step_delta(stations[i].md, stations[i + 1].md)
        dls_boundary = abs(stations[i].dls - stations[i + 1].dls) > 1e-6
        if prev_step and next_step and not dls_boundary:
            continue
        kept.append(stations[i])
    return kept


def _append_build_inc_azi(
    stations: list[SurveyStation],
    section: dict,
    request: TrajectoryRequest,
    errors: list[str],
) -> None:
    target_inc = float(section.get("inc", section.get("inclination")))
    target_azi = float(section.get("azi", section.get("azimuth")))
    dls = float(
        section.get("dls") or section.get("build_rate") or request.build_rate or 2.0
    )
    if dls > request.max_dls:
        errors.append(f"Build DLS {dls:.2f} exceeds max {request.max_dls}")

    from_node = _station_to_node(
        stations[-1],
        request.surface_northing,
        request.surface_easting,
        request.unit_system,
    )
    end_node = build_inc_azi(from_node, target_inc, target_azi, dls)
    # Summary table stores section endpoints only; chart densifies for display.
    stations.append(
        _node_to_station(
            end_node,
            request.surface_northing,
            request.surface_easting,
            request.unit_system,
            dls=dls,
        )
    )


def _append_build_hold(
    stations: list[SurveyStation],
    section: dict,
    request: TrajectoryRequest,
    errors: list[str],
    info_messages: list[str],
) -> None:
    dls = float(
        section.get("dls") or section.get("build_rate") or request.build_rate or 2.0
    )
    if dls > request.max_dls:
        errors.append(f"Build & Hold DLS {dls:.2f} exceeds max {request.max_dls}")

    from_node = _station_to_node(
        stations[-1],
        request.surface_northing,
        request.surface_easting,
        request.unit_system,
    )
    target = _next_target_by_tvd_sequence(from_node, request.targets)
    target_local_n, target_local_e = _geo_horiz_to_local(
        float(target["northing"]),
        float(target["easting"]),
        request.surface_northing,
        request.surface_easting,
        request.unit_system,
    )
    target_pos = (
        target_local_n,
        target_local_e,
        float(target.get("tvdss", target.get("tvd", 0))),
    )
    provisional_md = from_node.md + _distance_3d(
        (from_node.north, from_node.east, from_node.tvd),
        target_pos,
    )
    provisional_to = _target_to_node(
        from_node,
        target,
        provisional_md,
        request.surface_northing,
        request.surface_easting,
        request.unit_system,
    )
    intermediate, to_node, adjusted_dls = build_hold(from_node, provisional_to, dls)

    build_dls = adjusted_dls if adjusted_dls is not None else dls
    if adjusted_dls is not None:
        info_messages.append(f'The DLS was increased to "{adjusted_dls:.2f}"')

    stations.append(
        _node_to_station(
            intermediate,
            request.surface_northing,
            request.surface_easting,
            request.unit_system,
            dls=build_dls,
        )
    )
    stations.append(
        _node_to_station(
            to_node,
            request.surface_northing,
            request.surface_easting,
            request.unit_system,
            dls=0.0,
        )
    )


def _append_curve_hold_curve(
    stations: list[SurveyStation],
    section: dict,
    request: TrajectoryRequest,
    errors: list[str],
) -> None:
    dls1 = float(
        section.get("dls1")
        or section.get("dls")
        or section.get("build_rate")
        or request.build_rate
        or 2.0
    )
    dls2_raw = section.get("dls2")
    dls2 = float(dls2_raw) if dls2_raw not in (None, "") else dls1
    if dls1 > request.max_dls:
        errors.append(f"Curve-Hold-Curve DLS 1 {dls1:.2f} exceeds max {request.max_dls}")
    if dls2 > request.max_dls:
        errors.append(f"Curve-Hold-Curve DLS 2 {dls2:.2f} exceeds max {request.max_dls}")

    from_node = _station_to_node(
        stations[-1],
        request.surface_northing,
        request.surface_easting,
        request.unit_system,
    )
    target = _resolve_section_target(
        section, request.targets, "Curve-Hold-Curve", from_node
    )
    north, east = _geo_horiz_to_local(
        float(target["northing"]),
        float(target["easting"]),
        request.surface_northing,
        request.surface_easting,
        request.unit_system,
    )
    tvd = float(target.get("tvdss", target.get("tvd", 0)))
    inc = section.get("inc", section.get("inclination"))
    azi = section.get("azi", section.get("azimuth"))
    if inc in (None, "") or azi in (None, ""):
        provisional_md = from_node.md + _distance_3d(
            (from_node.north, from_node.east, from_node.tvd),
            (north, east, tvd),
        )
        landing = _target_to_node(
            from_node,
            target,
            provisional_md,
            request.surface_northing,
            request.surface_easting,
            request.unit_system,
        )
        inc = landing.inclination
        azi = landing.azimuth
    else:
        inc = float(inc)
        azi = float(azi)

    p4 = Node(
        md=from_node.md,
        north=north,
        east=east,
        tvd=tvd,
        inclination=inc,
        azimuth=azi,
    )
    p2, p3, p4_out = curve_hold_curve(from_node, p4, dls1, dls2)
    # Summary table stores section endpoints only; chart densifies p1→p2, p2→p3, p3→p4.
    stations.append(
        _node_to_station(
            p2,
            request.surface_northing,
            request.surface_easting,
            request.unit_system,
            dls=dls1,
        )
    )
    stations.append(
        _node_to_station(
            p3,
            request.surface_northing,
            request.surface_easting,
            request.unit_system,
            dls=0.0,
        )
    )
    stations.append(
        _node_to_station(
            p4_out,
            request.surface_northing,
            request.surface_easting,
            request.unit_system,
            dls=dls2,
        )
    )


def _append_hold(
    stations: list[SurveyStation],
    section: dict,
    request: TrajectoryRequest,
    errors: list[str],
) -> None:
    from_node = _station_to_node(
        stations[-1],
        request.surface_northing,
        request.surface_easting,
        request.unit_system,
    )
    tvd = section.get("tvd")
    length = section.get(
        "tangent_length",
        section.get("tangentLength", section.get("length", section.get("md"))),
    )
    try:
        if tvd is not None and tvd != "":
            end_node = hold_upto_tvd(from_node, float(tvd))
        else:
            end_node = hold(from_node, float(length))
        stations.append(
            _node_to_station(
                end_node,
                request.surface_northing,
                request.surface_easting,
                request.unit_system,
                dls=0.0,
            )
        )
    except ValueError as exc:
        errors.append(str(exc))


class TrajectoryEngine:
    """Trajectory generator. Build(inc, azi) and hold use the user-supplied geometry."""

    def generate(self, request: TrajectoryRequest) -> TrajectoryResult:
        errors: list[str] = []
        info_messages: list[str] = []

        hold_section = _find_hold_section(request.sections)
        build_hold_section = _find_build_hold_section(request.sections)
        curve_hold_curve_section = _find_curve_hold_curve_section(request.sections)

        if request.sections and len(request.sections) > 1:
            if request.existing_stations:
                stations = collapse_interpolated_stations(list(request.existing_stations))
            else:
                stations = _surface_and_kop_stations(request)
            _apply_manual_sections_in_order(
                stations,
                request.sections,
                request,
                errors,
                info_messages,
            )
            return TrajectoryResult(
                stations=stations,
                summary=_summary_from_stations(stations),
                validation_errors=errors,
                info_messages=info_messages,
            )

        if build_hold_section is not None:
            if request.existing_stations:
                stations = collapse_interpolated_stations(list(request.existing_stations))
            else:
                stations = _surface_and_kop_stations(request)
            try:
                _append_build_hold(stations, build_hold_section, request, errors, info_messages)
            except ValueError as exc:
                errors.append(str(exc))
            return TrajectoryResult(
                stations=stations,
                summary=_summary_from_stations(stations),
                validation_errors=errors,
                info_messages=info_messages,
            )

        if curve_hold_curve_section is not None:
            if request.existing_stations:
                stations = collapse_interpolated_stations(list(request.existing_stations))
            else:
                stations = _surface_and_kop_stations(request)
            try:
                _append_curve_hold_curve(stations, curve_hold_curve_section, request, errors)
            except ValueError as exc:
                errors.append(str(exc))
            return TrajectoryResult(
                stations=stations,
                summary=_summary_from_stations(stations),
                validation_errors=errors,
                info_messages=info_messages,
            )

        # Hold / build (change bearing) extend the current path when stations exist.
        if hold_section is not None and not _find_build_inc_azi_section(request.sections):
            if request.existing_stations:
                stations = collapse_interpolated_stations(list(request.existing_stations))
            else:
                stations = _surface_and_kop_stations(request)
            _append_hold(stations, hold_section, request, errors)
            return TrajectoryResult(
                stations=stations,
                summary=_summary_from_stations(stations),
                validation_errors=errors,
                info_messages=info_messages,
            )

        build_section = _find_build_inc_azi_section(request.sections)
        if build_section is not None:
            if request.existing_stations:
                stations = collapse_interpolated_stations(list(request.existing_stations))
            else:
                stations = _surface_and_kop_stations(request)

            try:
                _append_build_inc_azi(stations, build_section, request, errors)
            except ValueError as exc:
                errors.append(str(exc))

            # Optional hold after build in the same request.
            if hold_section is not None:
                _append_hold(stations, hold_section, request, errors)

            return TrajectoryResult(
                stations=stations,
                summary=_summary_from_stations(stations),
                validation_errors=errors,
                info_messages=info_messages,
            )

        stations = _surface_and_kop_stations(request)
        md = stations[-1].md
        inc = stations[-1].inc
        azi = stations[-1].azi
        local_n, local_e = _geo_horiz_to_local(
            stations[-1].ns,
            stations[-1].ew,
            request.surface_northing,
            request.surface_easting,
            request.unit_system,
        )
        tvd = stations[-1].tvd
        kop = request.kop
        surface_n = request.surface_northing
        surface_e = request.surface_easting
        unit_system = request.unit_system

        def append_local_station(
            md_val: float,
            inc_val: float,
            azi_val: float,
            local_north: float,
            local_east: float,
            tvd_val: float,
            dls_val: float,
        ) -> None:
            ns, ew = _local_horiz_to_geo(
                local_north, local_east, surface_n, surface_e, unit_system
            )
            stations.append(
                SurveyStation(
                    md=md_val,
                    inc=inc_val,
                    azi=azi_val,
                    tvd=tvd_val,
                    ns=ns,
                    ew=ew,
                    dls=dls_val,
                    vs=ew,
                )
            )

        # Legacy placeholder path when no inc/azi build section is provided
        build_rate = request.build_rate
        max_inc = min(90.0, build_rate * ((request.target_tvdss - kop) / max(build_rate, 0.1)))

        build_length = max_inc / max(build_rate, 0.01) * 100 if build_rate else 500
        md2 = md + build_length
        inc2 = max_inc
        local_n, local_e, tvd, dls = _min_curvature_step(
            md, inc, azi, local_n, local_e, tvd, md2, inc2, azi
        )
        if dls > request.max_dls:
            errors.append(f"DLS {dls:.2f} exceeds max {request.max_dls} during build")
        md, inc = md2, inc2
        append_local_station(md, inc, azi, local_n, local_e, tvd, dls)

        target_local_n, target_local_e = _geo_horiz_to_local(
            request.target_northing,
            request.target_easting,
            surface_n,
            surface_e,
            unit_system,
        )
        dn = target_local_n - local_n
        de = target_local_e - local_e
        target_azi = _rad2deg(math.atan2(de, dn)) if (dn or de) else azi
        if target_azi < 0:
            target_azi += 360

        turn_length = abs(target_azi - azi) / max(request.turn_rate or 0.01, 0.01) * 100
        turn_length = min(turn_length, 500)
        md2 = md + turn_length
        local_n, local_e, tvd, dls = _min_curvature_step(
            md, inc, azi, local_n, local_e, tvd, md2, inc, target_azi
        )
        md, azi = md2, target_azi
        append_local_station(md, inc, azi, local_n, local_e, tvd, dls)

        remaining_tvd = request.target_tvdss - tvd
        if remaining_tvd > 0 and inc > 0:
            hold_md = remaining_tvd / math.cos(_deg2rad(inc))
            md2 = md + hold_md
            local_n, local_e, tvd, dls = _min_curvature_step(
                md, inc, azi, local_n, local_e, tvd, md2, inc, azi
            )
            md = md2
            append_local_station(md, inc, azi, local_n, local_e, tvd, dls)

        return TrajectoryResult(
            stations=stations,
            summary=_summary_from_stations(stations),
            validation_errors=errors,
            info_messages=info_messages,
        )


def build_request_from_context(
    well,
    subsurface,
    params: TrajectoryParams,
) -> TrajectoryRequest:
    primary_target = subsurface.targets[0] if subsurface and subsurface.targets else None
    targets = []
    if subsurface and subsurface.targets:
        targets = [
            {
                "name": t.name,
                "northing": t.northing,
                "easting": t.easting,
                "tvdss": t.tvdss,
            }
            for t in subsurface.targets
        ]

    return TrajectoryRequest(
        unit_system=well.unit_system,
        kop=params.kop or 500.0,
        build_rate=params.build_rate or 2.0,
        turn_rate=params.turn_rate or 0.0,
        max_dls=params.max_dls or (subsurface.max_dls if subsurface and subsurface.max_dls else 3.0),
        target_northing=primary_target.northing if primary_target else 0,
        target_easting=primary_target.easting if primary_target else 1000,
        target_tvdss=primary_target.tvdss if primary_target else 8000,
        surface_northing=well.northing or 0,
        surface_easting=well.easting or 0,
        sections=params.sections,
        targets=targets,
    )
