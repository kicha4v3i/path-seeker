from enum import Enum


class UnitSystem(str, Enum):
    API = "API"
    SI = "SI"


class Environment(str, Enum):
    ONSHORE = "onshore"
    OFFSHORE = "offshore"


class SurfaceCoordType(str, Enum):
    LATLONG = "latlong"
    NE = "ne"


class ToleranceType(str, Enum):
    NONE = "none"
    CIRCULAR = "circular"
    ELLIPTICAL = "elliptical"


class MemberRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class TrajectoryMode(str, Enum):
    MANUAL = "manual"
    AI = "ai"


DEFAULT_LITHOLOGIES = [
    "Sandstone",
    "Shale",
    "Silty Sand",
    "Clayey Sand",
    "Siltstone",
    "Sandy Silt",
    "Clayey Silt",
    "Claystone",
    "Sandy Clay",
    "Silty Clay",
    "Conglomerate",
    "Chalk",
    "Limestone",
    "Chert",
    "Mudstone",
]

COUNTRIES = [
    "United States",
    "United Kingdom",
    "Canada",
    "Norway",
    "Brazil",
    "Mexico",
    "Australia",
    "United Arab Emirates",
    "Saudi Arabia",
    "Qatar",
    "Kuwait",
    "India",
    "China",
    "Malaysia",
    "Indonesia",
    "Nigeria",
    "Angola",
    "Egypt",
    "Netherlands",
    "Germany",
]

COORDINATE_SYSTEMS = [
    "WGS 84",
    "NAD83",
    "ETRS89",
    "GDA2020",
    "OSGB36",
]

PROJECTION_SYSTEMS = [
    "UTM",
    "Lambert Conformal Conic",
    "Transverse Mercator",
    "Albers Equal Area",
    "Local Grid",
]

DATUMS = [
    "WGS 84",
    "NAD83",
    "ETRS89",
    "ED50",
    "OSGB36",
    "GDA2020",
]
