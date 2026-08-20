"""Unit conversion helpers for API and SI systems."""

FT_TO_M = 0.3048


def length_to_display(value: float, from_system: str, to_system: str) -> float:
    if from_system == to_system:
        return value
    if from_system == "API" and to_system == "SI":
        return value * FT_TO_M
    if from_system == "SI" and to_system == "API":
        return value / FT_TO_M
    return value


def dls_label(unit_system: str) -> str:
    return "°/100ft" if unit_system == "API" else "°/30m"


def length_label(unit_system: str) -> str:
    return "ft" if unit_system == "API" else "m"
