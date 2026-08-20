import type { Target } from '@/lib/api'
import { plotTvd } from '@/lib/utils'

const SURFACE_SQUARE_WIDTH_M = 50
const COORD_EPS_M = 1e-4

/** True when every target shares the well surface northing and easting (stored in meters). */
export function isVerticalWell(
  well: { northing?: number | null; easting?: number | null } | null | undefined,
  targets: Target[],
): boolean {
  if (
    well?.northing == null ||
    well?.easting == null ||
    Number.isNaN(well.northing) ||
    Number.isNaN(well.easting) ||
    targets.length === 0
  ) {
    return false
  }

  const surfaceNorth = well.northing
  const surfaceEast = well.easting

  return targets.every(
    (t) =>
      Math.abs(t.northing - surfaceNorth) < COORD_EPS_M &&
      Math.abs(t.easting - surfaceEast) < COORD_EPS_M,
  )
}

/** True when at least one target is offset from the well surface location. */
export function isDeviatedWell(
  well: { northing?: number | null; easting?: number | null } | null | undefined,
  targets: Target[],
) {
  if (targets.length === 0) return false
  if (
    well?.northing == null ||
    well?.easting == null ||
    Number.isNaN(well.northing) ||
    Number.isNaN(well.easting)
  ) {
    return false
  }
  return !isVerticalWell(well, targets)
}

/** Polyline through survey stations (east/north/TVD already in chart units). */
export function surveyPathTrace(
  east: number[],
  north: number[],
  tvd: number[],
  lineColor = 'hsl(168, 70%, 22%)',
) {
  if (east.length < 2) return null

  return {
    type: 'scatter3d',
    // Invisible markers improve hover hit-testing along the densified path.
    mode: 'lines+markers',
    name: 'Trajectory',
    x: east,
    y: north,
    z: tvd.map(plotTvd),
    line: { color: lineColor, width: 4 },
    marker: { size: 2, opacity: 0, color: lineColor },
    // "none" hides the Plotly tooltip but still emits hover events for bearing readout.
    hoverinfo: 'none',
    showlegend: false,
  }
}

/** Vertical section from surface to KOP along the well surface location. */
export function kopVerticalLineTrace(
  surfaceX: number,
  surfaceY: number,
  kopTvd: number,
  lineColor = 'hsl(168, 70%, 22%)',
) {
  return {
    type: 'scatter3d',
    mode: 'lines',
    name: 'KOP',
    x: [surfaceX, surfaceX],
    y: [surfaceY, surfaceY],
    z: [0, plotTvd(kopTvd)],
    line: { color: lineColor, width: 3 },
    hoverinfo: 'skip',
    showlegend: false,
  }
}

/** Straight line segments from surface (z = 0) to each target TVD. */
export function verticalWellLineTrace(
  surfaceX: number,
  surfaceY: number,
  targetX: number[],
  targetY: number[],
  targetZ: number[],
  lineColor = 'hsl(168, 70%, 22%)',
) {
  if (!targetX.length) return null

  const x: (number | null)[] = []
  const y: (number | null)[] = []
  const z: (number | null)[] = []

  for (let i = 0; i < targetX.length; i++) {
    if (i > 0) {
      x.push(null)
      y.push(null)
      z.push(null)
    }
    x.push(surfaceX, targetX[i])
    y.push(surfaceY, targetY[i])
    z.push(0, plotTvd(targetZ[i]))
  }

  return {
    type: 'scatter3d',
    mode: 'lines',
    name: 'Well path',
    x,
    y,
    z,
    line: { color: lineColor, width: 3 },
    hoverinfo: 'skip',
    showlegend: false,
  }
}

export function surfaceSquareHalfSize(_unitSystem: string, _geographic: boolean) {
  return SURFACE_SQUARE_WIDTH_M / 2
}

type SurfaceSquareOptions = {
  fillColor?: string
  borderColor?: string
  fillOpacity?: number
  name?: string
}

/** Flat transparent square in the horizontal plane at the surface location. */
export function surfaceSquareTraces(
  centerX: number,
  centerY: number,
  centerZ: number,
  halfSize: number,
  hovertemplate: string,
  options: SurfaceSquareOptions = {},
) {
  const fillColor = options.fillColor ?? 'hsl(168, 70%, 22%)'
  const borderColor = options.borderColor ?? fillColor
  const fillOpacity = options.fillOpacity ?? 0.18
  const name = options.name ?? 'Surface'
  const hs = halfSize

  const x = [centerX - hs, centerX + hs, centerX + hs, centerX - hs]
  const y = [centerY - hs, centerY - hs, centerY + hs, centerY + hs]
  const z = [centerZ, centerZ, centerZ, centerZ]

  return [
    {
      type: 'mesh3d',
      x,
      y,
      z,
      i: [0, 0],
      j: [1, 2],
      k: [2, 3],
      color: fillColor,
      opacity: fillOpacity,
      flatshading: true,
      hoverinfo: 'skip',
      showlegend: false,
    },
    {
      type: 'scatter3d',
      x: [...x, x[0]],
      y: [...y, y[0]],
      z: [...z, z[0]],
      mode: 'lines',
      line: { color: borderColor, width: 2 },
      hoverinfo: 'skip',
      showlegend: false,
    },
    {
      type: 'scatter3d',
      x: [centerX],
      y: [centerY],
      z: [centerZ],
      mode: 'markers',
      name,
      marker: { size: 2, color: 'rgba(0,0,0,0)', opacity: 0 },
      hovertemplate,
      showlegend: false,
    },
  ]
}

/** Horizontal gap between target marker and name label (same units as chart X axis). */
export function labelOffset(min: number, max: number) {
  const span = max - min
  if (span <= 0) return 50
  return Math.max(span * 0.05, 25)
}

export function asteriskTrace(
  x: number[],
  y: number[],
  tvd: number[],
  names: string[],
  hovertemplate: string,
) {
  // Use markers (not text): Plotly text glyphs sit on the baseline, so "*"
  // appears offset from the true east/north/TVD point.
  return {
    x,
    y,
    z: tvd.map(plotTvd),
    type: 'scatter3d',
    mode: 'markers',
    name: 'Targets',
    marker: {
      symbol: 'cross',
      size: 8,
      color: '#f97316',
      line: { color: '#f97316', width: 2 },
    },
    customdata: names.map((name, i) => [name, tvd[i]]),
    hovertemplate,
    showlegend: false,
  }
}

/** @deprecated Use asteriskTrace — kept as alias. */
export const targetMarkerTrace = asteriskTrace

export function targetNameAnnotations(
  x: number[],
  y: number[],
  tvd: number[],
  names: string[],
  offset: number,
) {
  return names.map((name, i) => ({
    x: x[i] + offset,
    y: y[i],
    z: plotTvd(tvd[i]),
    text: name,
    xanchor: 'left',
    yanchor: 'middle',
    showarrow: false,
    bgcolor: 'rgba(255, 255, 255, 0.72)',
    bordercolor: 'rgba(148, 163, 184, 0.55)',
    borderwidth: 1,
    borderpad: 5,
    font: { size: 11, color: '#334155', family: 'Arial, sans-serif' },
  }))
}
