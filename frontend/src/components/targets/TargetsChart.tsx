import { useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import type { Target, Well } from '@/lib/api'
import {
  asteriskTrace,
  isVerticalWell,
  labelOffset,
  surfaceSquareHalfSize,
  surfaceSquareTraces,
  targetNameAnnotations,
  verticalWellLineTrace,
} from '@/lib/chartTargets'
import { chartSceneAspect, lengthUnit, localChartPad, plotTvd, toLocalTargetCoordinate, LOCAL_SURFACE_EAST, LOCAL_SURFACE_NORTH, tvdZAxis } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Props = {
  targets: Target[]
  well?: Well | null
  unitSystem?: string
}

type ChartMode = 'local' | 'geographic'

const GEO_PAD_M = 500

function hasLocalCoords(well: Well | null | undefined) {
  return (
    well?.easting != null &&
    well?.northing != null &&
    !Number.isNaN(well.easting) &&
    !Number.isNaN(well.northing)
  )
}

export function TargetsChart({ targets, well, unitSystem = 'API' }: Props) {
  const [mode, setMode] = useState<ChartMode>('geographic')
  const u = lengthUnit(unitSystem)

  const plot = useMemo(() => {
    const names = targets.map((t) => t.name)
    const tvd = targets.map((t) => t.tvdss)
    const vertical = isVerticalWell(well, targets)
    const traces: Record<string, unknown>[] = []

    if (mode === 'local') {
      const surfaceEastM = well?.easting ?? 0
      const surfaceNorthM = well?.northing ?? 0
      const east = targets.map((t) => toLocalTargetCoordinate(t.easting, surfaceEastM, unitSystem))
      const north = targets.map((t) => toLocalTargetCoordinate(t.northing, surfaceNorthM, unitSystem))

      const allX = [...east]
      const allY = [...north]
      const allZ = [...tvd]

      if (hasLocalCoords(well)) {
        allX.push(LOCAL_SURFACE_EAST)
        allY.push(LOCAL_SURFACE_NORTH)
        allZ.push(0)
      }

      if (!allX.length) {
        return null
      }

      const horizPad = GEO_PAD_M
      const depthPad = localChartPad(unitSystem)
      const minX = Math.min(...allX) - horizPad
      const maxX = Math.max(...allX) + horizPad
      const minY = Math.min(...allY) - horizPad
      const maxY = Math.max(...allY) + horizPad
      const maxZ = Math.max(...allZ, 0) + depthPad
      const offset = labelOffset(minX, maxX)

      if (hasLocalCoords(well)) {
        const wellEast = LOCAL_SURFACE_EAST
        const wellNorth = LOCAL_SURFACE_NORTH

        traces.push(
          ...surfaceSquareTraces(
            wellEast,
            wellNorth,
            0,
            surfaceSquareHalfSize(unitSystem, false),
            `Surface<br>East: 0.00 ${u}<br>North: 0.00 ${u}<br>TVD: 0 ${u}<extra></extra>`,
            { fillColor: '#2563eb', borderColor: '#2563eb' },
          ),
        )

        if (vertical) {
          const line = verticalWellLineTrace(wellEast, wellNorth, east, north, tvd, '#2563eb')
          if (line) traces.push(line)
        }
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
          autosize: true,
          margin: { t: 0, r: 0, b: 0, l: 0 },
          paper_bgcolor: 'white',
          plot_bgcolor: 'white',
          showlegend: false,
          scene: {
            xaxis: { title: { text: `East (${u})` }, showgrid: true, range: [minX, maxX] },
            yaxis: { title: { text: `North (${u})` }, showgrid: true, range: [minY, maxY] },
            zaxis: tvdZAxis(maxZ, u, unitSystem),
            ...chartSceneAspect(minX, maxX, minY, maxY, plotTvd(maxZ), 0, false, unitSystem),
            annotations: east.length
              ? targetNameAnnotations(east, north, tvd, names, offset)
              : [],
          },
        },
      }
    }

    const east = targets.map((t) => t.easting)
    const north = targets.map((t) => t.northing)

    const allX = [...east]
    const allY = [...north]
    const allZ = [...tvd]

    if (hasLocalCoords(well)) {
      allX.push(well!.easting!)
      allY.push(well!.northing!)
      allZ.push(0)
    }

    if (!allX.length) {
      return null
    }

    const minX = Math.min(...allX) - GEO_PAD_M
    const maxX = Math.max(...allX) + GEO_PAD_M
    const minY = Math.min(...allY) - GEO_PAD_M
    const maxY = Math.max(...allY) + GEO_PAD_M
    const maxZ = Math.max(...allZ, 0) + localChartPad(unitSystem)
    const offset = labelOffset(minX, maxX)

    if (hasLocalCoords(well)) {
      const wellEast = well!.easting!
      const wellNorth = well!.northing!

      traces.push(
        ...surfaceSquareTraces(
          wellEast,
          wellNorth,
          0,
          surfaceSquareHalfSize(unitSystem, true),
          `Surface<br>Easting: %{x:.2f} m<br>Northing: %{y:.2f} m<br>TVD: 0 ${u}<extra></extra>`,
          { fillColor: '#2563eb', borderColor: '#2563eb' },
        ),
      )

      if (vertical) {
        const line = verticalWellLineTrace(wellEast, wellNorth, east, north, tvd, '#2563eb')
        if (line) traces.push(line)
      }
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
        autosize: true,
        margin: { t: 0, r: 0, b: 0, l: 0 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        showlegend: false,
        scene: {
          xaxis: { title: { text: 'Easting (m)' }, showgrid: true, range: [minX, maxX] },
          yaxis: { title: { text: 'Northing (m)' }, showgrid: true, range: [minY, maxY] },
          zaxis: tvdZAxis(maxZ, u, unitSystem),
          ...chartSceneAspect(minX, maxX, minY, maxY, plotTvd(maxZ), 0, true, unitSystem),
          annotations: east.length ? targetNameAnnotations(east, north, tvd, names, offset) : [],
        },
      },
    }
  }, [targets, well, unitSystem, u, mode])

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <div className="flex shrink-0 justify-end px-3 pt-3">
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

      <div className="targets-chart-plot relative min-h-0 flex-1">
        <style>{`
          .targets-chart-plot .annotation-text-g rect.bg {
            rx: 6px;
            ry: 6px;
          }
        `}</style>
        {'error' in (plot ?? {}) ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            {(plot as { error: string }).error}
          </div>
        ) : plot ? (
          <Plot
            data={plot.traces}
            layout={plot.layout}
            className="absolute inset-0 h-full w-full"
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            config={{ displayModeBar: false, responsive: true }}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            Add targets to preview their locations.
          </div>
        )}
      </div>
    </div>
  )
}
