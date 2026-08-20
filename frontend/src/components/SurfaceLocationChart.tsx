import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Map, PanelLeft, PanelTop } from 'lucide-react'
import Plot from 'react-plotly.js'
import type { SurveyStation, Target, Well } from '@/lib/api'
import { TrajectoryActionsTrigger } from '@/components/trajectory/TrajectoryActionsQuestionnaire'
import {
  asteriskTrace,
  isDeviatedWell,
  isVerticalWell,
  kopVerticalLineTrace,
  labelOffset,
  surfaceSquareHalfSize,
  surfaceSquareTraces,
  surveyPathTrace,
  targetNameAnnotations,
  verticalWellLineTrace,
} from '@/lib/chartTargets'
import {
  chartSceneAspect,
  cn,
  localChartPad,
  lengthUnit,
  plotTvd,
  toGeographicCoordinate,
  toLocalTargetCoordinate,
  LOCAL_SURFACE_EAST,
  LOCAL_SURFACE_NORTH,
  isSurfaceSurveyStation,
  tvdZAxis,
} from '@/lib/utils'
import {
  CHART_VIEW_CAMERAS,
  animateSceneCamera,
  type ChartViewAlignment,
} from '@/lib/chartViewCameras'
import { densifySurveyPath } from '@/lib/surveyPath'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type ChartMode = 'local' | 'geographic'

type Props = {
  well: Well | null
  targets?: Target[]
  unitSystem?: string
  className?: string
  kop?: number | null
  kopInput?: string
  kopError?: string
  onKopInputChange?: (value: string) => void
  onKopApply?: () => void
  onKopKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  finalSurveyStation?: SurveyStation | null
  surveyStations?: SurveyStation[]
  wellId?: string
  actionsOpen?: boolean
  onActionsOpenChange?: (open: boolean) => void
}

const GEO_PAD_M = 500

function hasLocalCoords(well: Well | null) {
  return (
    well?.easting != null &&
    well?.northing != null &&
    !Number.isNaN(well.easting) &&
    !Number.isNaN(well.northing)
  )
}

function formatCoord(value: number, decimals = 2) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatTrajectoryBearing(
  station: SurveyStation | null,
  mode: ChartMode,
  u: string,
  unitSystem: string,
  surfaceNorthingM: number,
  surfaceEastingM: number,
) {
  if (!station) return 'No survey data'

  const east =
    mode === 'local'
      ? isSurfaceSurveyStation(station)
        ? LOCAL_SURFACE_EAST
        : station.ew
      : toGeographicCoordinate(station.ew, surfaceEastingM, unitSystem)
  const north =
    mode === 'local'
      ? isSurfaceSurveyStation(station)
        ? LOCAL_SURFACE_NORTH
        : station.ns
      : toGeographicCoordinate(station.ns, surfaceNorthingM, unitSystem)
  const eastUnit = mode === 'local' ? u : 'm'
  const northUnit = mode === 'local' ? u : 'm'

  return `MD: ${formatCoord(station.md)} ${u} · East: ${formatCoord(east)} ${eastUnit} · North: ${formatCoord(north)} ${northUnit} · TVD: ${formatCoord(station.tvd)} ${u}`
}

function formatSurveyOrientation(station: SurveyStation | null) {
  if (!station) return null

  return `Inclination: ${formatCoord(station.inc)}° · Azimuth: ${formatCoord(station.azi)}°`
}

export function SurfaceLocationChart({
  well,
  targets = [],
  unitSystem = 'API',
  className,
  kop = null,
  kopInput = '',
  kopError = '',
  onKopInputChange,
  onKopApply,
  onKopKeyDown,
  finalSurveyStation = null,
  surveyStations = [],
  wellId,
  actionsOpen = false,
  onActionsOpenChange,
}: Props) {
  const [mode, setMode] = useState<ChartMode>('local')
  const [viewAlignment, setViewAlignment] = useState<ChartViewAlignment>('default')
  const [viewRevision, setViewRevision] = useState(0)
  const [hoveredStation, setHoveredStation] = useState<SurveyStation | null>(null)
  const graphDivRef = useRef<HTMLElement | null>(null)
  const cancelCameraAnimationRef = useRef<(() => void) | null>(null)
  const plotReadyRef = useRef(false)
  const viewAlignmentRef = useRef(viewAlignment)
  const pathStationsRef = useRef<SurveyStation[]>([])
  const lockedSceneAspectRef = useRef<ReturnType<typeof chartSceneAspect> | null>(null)
  const axisBoundsRef = useRef<{
    minX: number
    maxX: number
    minY: number
    maxY: number
    maxZ: number
  } | null>(null)
  const axisBoundsScopeRef = useRef('')

  viewAlignmentRef.current = viewAlignment

  const deviated = isDeviatedWell(well, targets)
  const u = lengthUnit(unitSystem)
  const pathStations = useMemo(() => densifySurveyPath(surveyStations), [surveyStations])
  pathStationsRef.current = pathStations

  useEffect(() => {
    setHoveredStation(null)
  }, [surveyStations, mode])

  function resetAxisLayoutIfScopeChanged(scope: string) {
    if (axisBoundsScopeRef.current === scope) return
    axisBoundsScopeRef.current = scope
    axisBoundsRef.current = null
    lockedSceneAspectRef.current = null
  }

  function stabilizeAxisBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    maxZ: number,
  ) {
    const prev = axisBoundsRef.current
    const next = prev
      ? {
          minX: Math.min(prev.minX, minX),
          maxX: Math.max(prev.maxX, maxX),
          minY: Math.min(prev.minY, minY),
          maxY: Math.max(prev.maxY, maxY),
          maxZ: Math.max(prev.maxZ, maxZ),
        }
      : { minX, maxX, minY, maxY, maxZ }
    axisBoundsRef.current = next
    return next
  }

  function lockedSceneAspect(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    maxZ: number,
    geographic: boolean,
  ) {
    if (!lockedSceneAspectRef.current) {
      lockedSceneAspectRef.current = chartSceneAspect(
        minX,
        maxX,
        minY,
        maxY,
        plotTvd(maxZ),
        0,
        geographic,
        unitSystem,
      )
    }
    return lockedSceneAspectRef.current
  }

  useEffect(() => {
    return () => {
      cancelCameraAnimationRef.current?.()
    }
  }, [])

  useEffect(() => {
    const graphDiv = graphDivRef.current
    if (!graphDiv || !plotReadyRef.current) return

    cancelCameraAnimationRef.current?.()
    cancelCameraAnimationRef.current = animateSceneCamera(
      graphDiv,
      CHART_VIEW_CAMERAS[viewAlignment],
    )
  }, [viewAlignment, viewRevision])

  const plot = useMemo(() => {
    if (!well || !hasLocalCoords(well)) return null

    const axisBoundsScope = [
      mode,
      unitSystem,
      wellId ?? well.id ?? well._id,
      well.northing,
      well.easting,
      targets.length,
      targets.map((t) => `${t.northing},${t.easting},${t.tvdss}`).join(';'),
    ].join('|')
    resetAxisLayoutIfScopeChanged(axisBoundsScope)

    // Keep uirevision stable so Plotly preserves manual camera rotation across
    // survey/build updates. Axis rescoping uses axisBoundsScope above instead.
    const cameraUirevision = String(wellId ?? well.id ?? well._id ?? 'surface-location-chart')

    const names = targets.map((t) => t.name)
    const tvd = targets.map((t) => t.tvdss)
    const vertical = isVerticalWell(well, targets)
    const traces: Record<string, unknown>[] = []

    if (mode === 'local') {
      const surfaceEastM = well.easting!
      const surfaceNorthM = well.northing!
      const east = targets.map((t) => toLocalTargetCoordinate(t.easting, surfaceEastM, unitSystem))
      const north = targets.map((t) => toLocalTargetCoordinate(t.northing, surfaceNorthM, unitSystem))
      const wellEast = LOCAL_SURFACE_EAST
      const wellNorth = LOCAL_SURFACE_NORTH
      const pathEast = pathStations.map((s) =>
        isSurfaceSurveyStation(s) ? LOCAL_SURFACE_EAST : s.ew,
      )
      const pathNorth = pathStations.map((s) =>
        isSurfaceSurveyStation(s) ? LOCAL_SURFACE_NORTH : s.ns,
      )
      const pathTvd = pathStations.map((s) => s.tvd)

      const allX = [...east, wellEast, ...pathEast]
      const allY = [...north, wellNorth, ...pathNorth]
      const allZ = [...tvd, 0, ...pathTvd]
      if (kop != null) allZ.push(kop)

      const horizPad = GEO_PAD_M
      const depthPad = localChartPad(unitSystem)
      const bounds = stabilizeAxisBounds(
        Math.min(...allX) - horizPad,
        Math.max(...allX) + horizPad,
        Math.min(...allY) - horizPad,
        Math.max(...allY) + horizPad,
        Math.max(...allZ, 0) + depthPad,
      )
      const { minX, maxX, minY, maxY, maxZ } = bounds
      const offset = labelOffset(minX, maxX)

      traces.push(
        ...surfaceSquareTraces(
          wellEast,
          wellNorth,
          0,
          surfaceSquareHalfSize(unitSystem, false),
          `Surface<br>East: 0.00 ${u}<br>North: 0.00 ${u}<br>TVD: 0 ${u}<extra></extra>`,
          { name: well.name || 'Surface' },
        ),
      )

      const path = surveyPathTrace(pathEast, pathNorth, pathTvd)
      if (path) {
        traces.push(path)
      } else if (vertical) {
        const line = verticalWellLineTrace(wellEast, wellNorth, east, north, tvd)
        if (line) traces.push(line)
      } else if (kop != null) {
        traces.push(kopVerticalLineTrace(wellEast, wellNorth, kop))
      }

      if (east.length) {
        traces.push(
          asteriskTrace(
            east,
            north,
            tvd,
            names,
            '%{customdata[0]}<br>East: %{x:.2f} ' +
              `${u}<br>North: %{y:.2f} ${u}<br>TVD: %{customdata[1]:.2f} ${u}<extra></extra>`,
          ),
        )
      }

      return {
        traces,
        layout: {
          margin: { t: 10, r: 10, b: 10, l: 10 },
          paper_bgcolor: 'white',
          autosize: true,
          uirevision: cameraUirevision,
          scene: {
            uirevision: cameraUirevision,
            xaxis: { title: { text: `East (${u})` }, showgrid: true, zeroline: true, range: [minX, maxX] },
            yaxis: { title: { text: `North (${u})` }, showgrid: true, zeroline: true, range: [minY, maxY] },
            zaxis: tvdZAxis(maxZ, u, unitSystem),
            ...lockedSceneAspect(minX, maxX, minY, maxY, maxZ, false),
            annotations: east.length
              ? targetNameAnnotations(east, north, tvd, names, offset)
              : [],
          },
        },
      }
    }

    const east = targets.map((t) => t.easting)
    const north = targets.map((t) => t.northing)
    const wellEast = well.easting!
    const wellNorth = well.northing!
    const pathEast = pathStations.map((s) =>
      isSurfaceSurveyStation(s)
        ? wellEast
        : toGeographicCoordinate(s.ew, wellEast, unitSystem),
    )
    const pathNorth = pathStations.map((s) =>
      isSurfaceSurveyStation(s)
        ? wellNorth
        : toGeographicCoordinate(s.ns, wellNorth, unitSystem),
    )
    const pathTvd = pathStations.map((s) => s.tvd)

    const allX = [...east, wellEast, ...pathEast]
    const allY = [...north, wellNorth, ...pathNorth]
    const allZ = [...tvd, 0, ...pathTvd]
    if (kop != null) allZ.push(kop)

    const zPad = localChartPad(unitSystem)
    const bounds = stabilizeAxisBounds(
      Math.min(...allX) - GEO_PAD_M,
      Math.max(...allX) + GEO_PAD_M,
      Math.min(...allY) - GEO_PAD_M,
      Math.max(...allY) + GEO_PAD_M,
      Math.max(...allZ, 0) + zPad,
    )
    const { minX, maxX, minY, maxY, maxZ } = bounds
    const offset = labelOffset(minX, maxX)

    traces.push(
      ...surfaceSquareTraces(
        wellEast,
        wellNorth,
        0,
        surfaceSquareHalfSize(unitSystem, true),
        `Surface<br>Easting: %{x:.2f} m<br>Northing: %{y:.2f} m<br>TVD: 0 ${u}<extra></extra>`,
        { name: well.name || 'Surface' },
      ),
    )

    const path = surveyPathTrace(pathEast, pathNorth, pathTvd)
    if (path) {
      traces.push(path)
    } else if (vertical) {
      const line = verticalWellLineTrace(wellEast, wellNorth, east, north, tvd)
      if (line) traces.push(line)
    } else if (kop != null) {
      traces.push(kopVerticalLineTrace(wellEast, wellNorth, kop))
    }

    if (east.length) {
      traces.push(
        asteriskTrace(
          east,
          north,
          tvd,
          names,
          '%{customdata[0]}<br>Easting: %{x:.2f} m<br>Northing: %{y:.2f} m<br>TVD: %{customdata[1]:.2f} ' +
            `${u}<extra></extra>`,
        ),
      )
    }

    return {
      traces,
      layout: {
        margin: { t: 10, r: 10, b: 10, l: 10 },
        paper_bgcolor: 'white',
        autosize: true,
        uirevision: cameraUirevision,
        scene: {
          uirevision: cameraUirevision,
          xaxis: { title: { text: 'Easting (m)' }, showgrid: true, zeroline: true, range: [minX, maxX] },
          yaxis: { title: { text: 'Northing (m)' }, showgrid: true, zeroline: true, range: [minY, maxY] },
          zaxis: tvdZAxis(maxZ, u, unitSystem),
          ...lockedSceneAspect(minX, maxX, minY, maxY, maxZ, true),
          annotations: east.length ? targetNameAnnotations(east, north, tvd, names, offset) : [],
        },
      },
    }
  }, [well, wellId, targets, mode, unitSystem, kop, u, pathStations])

  function handlePlotHover(event: Readonly<{ points?: readonly Record<string, unknown>[] }>) {
    const point = event.points?.[0]
    if (!point || point.data == null || typeof point.data !== 'object') {
      setHoveredStation(null)
      return
    }

    const data = point.data as { name?: string }
    if (data.name !== 'Trajectory') {
      setHoveredStation(null)
      return
    }

    const index =
      typeof point.pointNumber === 'number'
        ? point.pointNumber
        : typeof point.pointIndex === 'number'
          ? point.pointIndex
          : -1
    const station = pathStationsRef.current[index]
    setHoveredStation(station ?? null)
  }

  function handlePlotUnhover() {
    setHoveredStation(null)
  }

  function handleViewAlignmentChange(value: string) {
    if (!value) {
      setViewRevision((revision) => revision + 1)
      return
    }

    if (
      value !== 'default' &&
      value !== 'top' &&
      value !== 'section-east' &&
      value !== 'section-north'
    ) {
      return
    }

    setViewAlignment((current) => {
      if (current === value) {
        setViewRevision((revision) => revision + 1)
      }
      return value
    })
  }

  if (!well) {
    return <p className="text-sm text-muted-foreground">Loading surface location...</p>
  }

  if (!hasLocalCoords(well)) {
    return (
      <p className="text-sm text-muted-foreground">
        Surface location chart requires northing and easting coordinates.
      </p>
    )
  }

  const bearingStation = hoveredStation ?? finalSurveyStation
  const surveyOrientation = formatSurveyOrientation(bearingStation)

  return (
    <div className={cn('surface-location-chart grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card p-4', className)}>
      <div className="chart-header flex flex-wrap items-start justify-between gap-x-4 gap-y-2 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Trajectory Bearing</h3>
          <p className="text-xs text-muted-foreground">
            {formatTrajectoryBearing(
              bearingStation,
              mode,
              u,
              unitSystem,
              well.northing!,
              well.easting!,
            )}
          </p>
          {surveyOrientation ? (
            <p className="text-xs text-muted-foreground">{surveyOrientation}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {deviated ? (
              <div className="flex items-center gap-2">
                <Label htmlFor="kop-input" className="shrink-0">
                  KOP ({u})
                </Label>
                <Input
                  id="kop-input"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 500"
                  value={kopInput}
                  onChange={(event) => {
                    onKopInputChange?.(event.target.value)
                  }}
                  onBlur={() => onKopApply?.()}
                  onKeyDown={onKopKeyDown}
                  aria-invalid={!!kopError}
                  className="h-9 w-36"
                />
              </div>
            ) : null}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={viewAlignment}
              onValueChange={handleViewAlignmentChange}
            >
              <ToggleGroupItem
                value="default"
                className="size-8 px-0"
                aria-label="3D view"
                title="3D view"
              >
                <Box className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="top"
                className="size-8 px-0"
                aria-label="Top view"
                title="Top view"
              >
                <Map className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="section-east"
                className="size-8 px-0"
                aria-label="Section view with easting on horizontal axis"
                title="Easting section"
              >
                <PanelTop className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="section-north"
                className="size-8 px-0"
                aria-label="Section view with northing on horizontal axis"
                title="Northing section"
              >
                <PanelLeft className="size-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Tabs
              value={mode}
              onValueChange={(value) => {
                if (value === 'local' || value === 'geographic') setMode(value)
              }}
              className="gap-0"
            >
              <TabsList className="h-10 w-fit gap-1">
                <TabsTrigger value="local" className="flex-none px-4">
                  Local
                </TabsTrigger>
                <TabsTrigger value="geographic" className="flex-none px-4">
                  Geographic
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <TrajectoryActionsTrigger
            open={actionsOpen}
            onOpenChange={(open) => onActionsOpenChange?.(open)}
          />
        </div>
        {deviated && kopError ? (
          <p className="w-full text-xs text-destructive">{kopError}</p>
        ) : null}
      </div>

      {plot ? (
        <div className="chart-body relative isolate min-h-0 overflow-hidden">
          <div className="targets-chart-plot relative h-full min-h-0 w-full overflow-hidden">
            <style>{`
              .surface-location-chart .targets-chart-plot .annotation-text-g rect.bg {
                rx: 6px;
                ry: 6px;
              }
              .surface-location-chart .chart-body .js-plotly-plot,
              .surface-location-chart .chart-body .plot-container,
              .surface-location-chart .chart-body .svg-container {
                width: 100% !important;
                height: 100% !important;
              }
            `}</style>
            <Plot
              data={plot.traces}
              layout={plot.layout}
              className="h-full w-full"
              style={{ width: '100%', height: '100%' }}
              useResizeHandler
              config={{ displayModeBar: false, responsive: true }}
              onHover={handlePlotHover}
              onUnhover={handlePlotUnhover}
              onInitialized={(_figure: unknown, graphDiv: HTMLElement) => {
                graphDivRef.current = graphDiv
                plotReadyRef.current = true
              }}
              onUpdate={(_figure: unknown, graphDiv: HTMLElement) => {
                graphDivRef.current = graphDiv
                plotReadyRef.current = true
              }}
              />
          </div>
        </div>
      ) : null}
    </div>
  )
}
