import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function lengthUnit(system: string) {
  return system === 'SI' ? 'm' : 'ft'
}

export function dlsUnit(system: string) {
  return system === 'SI' ? '°/30m' : '°/100ft'
}

/** Northing/easting are stored in meters. */
export function metersToLengthUnit(valueMeters: number, _unitSystem: string) {
  // return unitSystem === 'SI' ? valueMeters : valueMeters / 0.3048
  return valueMeters
}

/** Meters to feet factor for API geographic → local north/east. */
export const METERS_TO_FEET = 3.281

/** Geographic → local: (value − surface), × 3.281 for API. */
export function toLocalCoordinate(
  valueMeters: number,
  surfaceMeters: number,
  unitSystem: string,
) {
  const offsetMeters = valueMeters - surfaceMeters
  return unitSystem === 'SI' ? offsetMeters : offsetMeters * METERS_TO_FEET
}

/** Local → geographic meters for storage and geographic display. */
export function toGeographicCoordinate(
  localValue: number,
  surfaceMeters: number,
  unitSystem: string,
) {
  return unitSystem === 'SI'
    ? surfaceMeters + localValue
    : surfaceMeters + localValue / METERS_TO_FEET
}

/** Local grid: geographic → local offset for survey display. */
export function localOffsetFromSurface(
  valueMeters: number,
  surfaceMeters: number,
  unitSystem: string,
) {
  return toLocalCoordinate(valueMeters, surfaceMeters, unitSystem)
}

/** Geographic → local for targets on the local chart. */
export function toLocalTargetCoordinate(
  valueMeters: number,
  surfaceMeters: number,
  unitSystem: string,
) {
  return toLocalCoordinate(valueMeters, surfaceMeters, unitSystem)
}

/** Surface location in local coordinates is always the origin. */
export const LOCAL_SURFACE_EAST = 0
export const LOCAL_SURFACE_NORTH = 0

export function isSurfaceSurveyStation(station: { md: number }) {
  return station.md === 0
}

export function localChartPad(unitSystem: string) {
  return unitSystem === 'SI' ? 500 : 1500
}

/** Plotly 3D axis range: zero at top, positive TVD increasing downward. */
export function tvdPlotRange(minTvd: number, maxTvd: number): [number, number] {
  return [maxTvd, minTvd]
}

/** Map entered TVD to plot Z (negative downward avoids reversed-axis GL bugs). */
export function plotTvd(tvd: number) {
  return -tvd
}

function tvdTickStep(depth: number, unitSystem: string) {
  const pad = localChartPad(unitSystem)
  if (depth <= pad * 2) return pad / 3
  if (depth <= pad * 6) return pad
  return pad * 2
}

/** Z axis config with positive TVD tick labels on negative plot coordinates. */
export function tvdZAxis(maxTvd: number, unit: string, unitSystem: string) {
  const pad = localChartPad(unitSystem)
  const depth = Math.max(maxTvd, 0) + pad
  const step = tvdTickStep(depth, unitSystem)
  const tickvals: number[] = [0]

  for (let tvd = step; tvd <= depth; tvd += step) {
    tickvals.push(plotTvd(tvd))
  }
  if (tickvals[tickvals.length - 1] !== plotTvd(depth)) {
    tickvals.push(plotTvd(depth))
  }

  return {
    title: { text: `TVD (${unit})` },
    showgrid: true,
    zeroline: true,
    range: [plotTvd(depth), 0] as [number, number],
    tickmode: 'array' as const,
    tickvals,
    ticktext: tickvals.map((v) => String(-v)),
  }
}

/** Data spans in comparable length units for proportional display. */
export function chartDisplayAspect(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  plotMinZ: number,
  plotMaxZ: number,
  geographic: boolean,
  unitSystem: string,
) {
  const xSpan = Math.max(maxX - minX, 1)
  const ySpan = Math.max(maxY - minY, 1)
  const zSpan = Math.max(plotMaxZ - plotMinZ, 1)
  // const zSpanNormalized = geographic && unitSystem !== 'SI' ? zSpan * 0.3048 : zSpan
  const zSpanNormalized = zSpan

  return {
    horizSpan: Math.max(xSpan, ySpan),
    vertSpan: Math.max(zSpanNormalized, 1),
  }
}

export type ChartSceneSpans = { x: number; y: number; z: number }

/** Scale scene axes to data spans; convert TVD to meters in geographic API view. */
export function chartSceneAspect(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  plotMinZ: number,
  plotMaxZ: number,
  geographic: boolean,
  unitSystem: string,
  /** When provided, spans only grow so KOP/depth updates don't reshape the scene. */
  holdSpans?: ChartSceneSpans,
) {
  let xSpan = Math.max(maxX - minX, 1)
  let ySpan = Math.max(maxY - minY, 1)
  const zSpan = Math.max(plotMaxZ - plotMinZ, 1)
  // let zSpanMeters = geographic && unitSystem !== 'SI' ? zSpan * 0.3048 : zSpan
  let zSpanMeters = zSpan

  if (holdSpans) {
    xSpan = Math.max(xSpan, holdSpans.x)
    ySpan = Math.max(ySpan, holdSpans.y)
    zSpanMeters = Math.max(zSpanMeters, holdSpans.z)
    holdSpans.x = xSpan
    holdSpans.y = ySpan
    holdSpans.z = zSpanMeters
  }

  const maxSpan = Math.max(xSpan, ySpan, zSpanMeters)
  const xRatio = xSpan / maxSpan
  const yRatio = ySpan / maxSpan
  // Keep depth visually taller than plan axes (typical well-trajectory presentation).
  const zRatio = Math.max(zSpanMeters / maxSpan, Math.max(xRatio, yRatio) * 1.5)

  return {
    aspectmode: 'manual' as const,
    aspectratio: {
      x: xRatio,
      y: yRatio,
      z: zRatio,
    },
  }
}
