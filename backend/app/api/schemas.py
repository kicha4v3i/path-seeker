from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class ProjectCreate(BaseModel):
    name: str
    location_country: str = ""
    environment: str = "Onshore"
    ground_level_elevation: float | None = None
    water_depth: float | None = None
    block: str = ""
    field: str = ""
    coordinate_system: str = ""
    projection_system: str = ""
    datum: str = ""
    unit_system: str = "API"

    @field_validator("ground_level_elevation", "water_depth")
    @classmethod
    def non_negative_elevation_fields(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("must be zero or greater")
        return value

    @model_validator(mode="after")
    def validate_environment_fields(self):
        env = (self.environment or "").strip().lower()
        if env == "onshore":
            self.environment = "Onshore"
            if self.ground_level_elevation is None:
                raise ValueError("Ground Level Elevation is required for onshore projects")
            if self.ground_level_elevation < 0:
                raise ValueError("Ground Level Elevation must be zero or greater")
        elif env == "offshore":
            self.environment = "Offshore"
            if self.water_depth is None:
                raise ValueError("Water Depth is required for offshore projects")
            if self.water_depth < 0:
                raise ValueError("Water Depth must be zero or greater")
        if self.unit_system not in ("API", "SI"):
            raise ValueError("Unit system must be API or SI")
        return self


class ProjectUpdate(BaseModel):
    name: str | None = None
    location_country: str | None = None
    environment: str | None = None
    ground_level_elevation: float | None = None
    water_depth: float | None = None
    block: str | None = None
    field: str | None = None
    coordinate_system: str | None = None
    projection_system: str | None = None
    datum: str | None = None
    unit_system: str | None = None

    @field_validator("ground_level_elevation", "water_depth")
    @classmethod
    def non_negative_elevation_fields(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("must be zero or greater")
        return value


class WellCreate(BaseModel):
    name: str
    unit_system: str = "API"
    surface_coord_type: str = "ne"
    latitude: float | None = None
    longitude: float | None = None
    northing: float | None = None
    easting: float | None = None
    rkb_to_datum: float | None = None


class WellUpdate(WellCreate):
    name: str | None = None


class FormationSchema(BaseModel):
    formation_name: str = ""
    lithology: str = ""
    tvd_top: float = 0
    tvd_bottom: float = 0


class TargetSchema(BaseModel):
    name: str = "Target 1"
    northing: float = 0
    easting: float = 0
    tvdss: float = 0
    tolerance: str = "none"
    radius_of_tolerance: float | None = None
    major_radius: float | None = None
    minor_radius: float | None = None
    azimuth: float | None = None


class SubsurfaceUpdate(BaseModel):
    formations: list[FormationSchema] = Field(default_factory=list)
    targets: list[TargetSchema] = Field(default_factory=list)
    max_dls: float | None = None
    notes: str = ""


class TrajectoryGenerateRequest(BaseModel):
    mode: str = "manual"
    kop: float | None = None
    build_rate: float | None = None
    turn_rate: float | None = None
    max_dls: float | None = None
    source_prompt: str | None = None
    sections: list[dict] | None = None


class TrajectoryUpdate(BaseModel):
    kop: float | None = None
    survey_stations: list[dict] | None = None


class AIChatRequest(BaseModel):
    message: str


class MemberInvite(BaseModel):
    email: EmailStr
    role: str = "editor"


class LithologyAdd(BaseModel):
    name: str


class UserSettingsUpdate(BaseModel):
    default_unit_system: str | None = None
    display_unit_override: str | None = None
