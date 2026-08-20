import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { Droplets, FolderPlus, X } from 'lucide-react'
import type { Project } from '@/lib/api'
import { docId } from '@/lib/api'
import { Button } from '@/components/ui/button'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

/** Map Natural Earth / world-atlas names → app country list names */
const COUNTRY_ALIASES: Record<string, string> = {
  'United States of America': 'United States',
  'United Kingdom': 'United Kingdom',
  Russia: 'Russia',
  'Saudi Arabia': 'Saudi Arabia',
  'United Arab Emirates': 'United Arab Emirates',
  'Dem. Rep. Congo': 'Congo',
  'Dominican Rep.': 'Dominican Republic',
  "Côte d'Ivoire": "Côte d'Ivoire",
  'Eq. Guinea': 'Equatorial Guinea',
  'Central African Rep.': 'Central African Republic',
  'S. Sudan': 'South Sudan',
  Bosnia: 'Bosnia and Herzegovina',
  Czechia: 'Czech Republic',
  eSwatini: 'Eswatini',
}

type Anchor = {
  country: string
  x: number
  y: number
}

type HoverTip = {
  name: string
  x: number
  y: number
}

type Props = {
  projects: Project[]
  onNewProject?: (country: string) => void
}

export function WorldProjectMap({ projects, onNewProject }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null)
  const [lineReady, setLineReady] = useState(false)

  const countriesWithProjects = useMemo(() => {
    const set = new Set(projects.map((p) => p.location_country).filter(Boolean))
    return set
  }, [projects])

  const countryProjects = useMemo(() => {
    if (!anchor) return []
    return projects.filter((p) => p.location_country === anchor.country)
  }, [anchor, projects])

  const panel = useMemo(() => {
    if (!anchor || !containerRef.current) return null
    const w = containerRef.current.clientWidth
    const h = containerRef.current.clientHeight
    const panelW = 220
    const panelH = 160
    const preferRight = anchor.x < w * 0.55
    const x = preferRight
      ? Math.min(anchor.x + 80, w - panelW - 16)
      : Math.max(16, anchor.x - 80 - panelW)
    const y = Math.max(16, Math.min(anchor.y - panelH / 2, h - panelH - 16))
    return { x, y, w: panelW, h: panelH, preferRight }
  }, [anchor])

  const linePath = useMemo(() => {
    if (!anchor || !panel) return ''
    const startX = anchor.x
    const startY = anchor.y
    const endX = panel.preferRight ? panel.x : panel.x + panel.w
    const endY = panel.y + panel.h / 2
    const midX = (startX + endX) / 2
    return `M ${startX} ${startY} Q ${midX} ${startY} ${endX} ${endY}`
  }, [anchor, panel])

  const resolveCountry = (geoName: string) => COUNTRY_ALIASES[geoName] || geoName

  const pointerPos = (evt: React.MouseEvent) => {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    }
  }

  const onCountryHover = (geoName: string, evt: React.MouseEvent) => {
    const { x, y } = pointerPos(evt)
    setHoverTip({ name: resolveCountry(geoName), x, y })
  }

  const onCountryMove = (geoName: string, evt: React.MouseEvent) => {
    const { x, y } = pointerPos(evt)
    setHoverTip({ name: resolveCountry(geoName), x, y })
  }

  const onCountryClick = useCallback((geoName: string, evt: React.MouseEvent) => {
    const { x, y } = (() => {
      const el = containerRef.current
      if (!el) return { x: 0, y: 0 }
      const rect = el.getBoundingClientRect()
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
    })()
    const country = resolveCountry(geoName)
    setHoverTip(null)
    setLineReady(false)
    setAnchor({ country, x, y })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setLineReady(true))
    })
  }, [])

  const close = () => {
    setAnchor(null)
    setLineReady(false)
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-background">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 210 }}
        width={980}
        height={560}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup center={[10, 8]} zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = geo.properties.name as string
                const resolved = resolveCountry(name)
                const hasProjects = countriesWithProjects.has(resolved)
                const isActive = anchor?.country === resolved
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(evt) => onCountryHover(name, evt)}
                    onMouseMove={(evt) => onCountryMove(name, evt)}
                    onMouseLeave={() => setHoverTip(null)}
                    onClick={(evt) => onCountryClick(name, evt)}
                    style={{
                      default: {
                        fill: isActive
                          ? 'hsl(168 70% 22%)'
                          : hasProjects
                            ? 'hsl(168 40% 55%)'
                            : 'hsl(207 15% 78%)',
                        stroke: 'hsl(207 15% 46%)',
                        strokeWidth: 0.4,
                        outline: 'none',
                        cursor: 'pointer',
                        transition: 'fill 160ms ease',
                      },
                      hover: {
                        fill: 'hsl(168 70% 28%)',
                        stroke: 'hsl(168 70% 18%)',
                        strokeWidth: 0.6,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: 'hsl(168 70% 18%)',
                        outline: 'none',
                      },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {hoverTip && (
        <div
          className="pointer-events-none absolute z-20 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-md"
          style={{
            left: hoverTip.x + 14,
            top: hoverTip.y - 10,
          }}
        >
          {hoverTip.name}
        </div>
      )}

      {anchor && panel && (
        <>
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
            <circle
              cx={anchor.x}
              cy={anchor.y}
              r={5}
              fill="hsl(168 70% 22%)"
              className="map-pin-pulse"
            />
            <path
              d={linePath}
              fill="none"
              stroke="hsl(168 70% 22%)"
              strokeWidth={2}
              strokeLinecap="round"
              className={lineReady ? 'map-leader-line map-leader-line--active' : 'map-leader-line'}
            />
          </svg>

          <div
            className={`absolute z-20 w-[240px] rounded-xl border border-border/80 bg-card p-4 text-card-foreground shadow-lg ${
              lineReady ? 'map-action-box map-action-box--visible' : 'map-action-box'
            }`}
            style={{ left: panel.x, top: panel.y }}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
                <p className="text-sm font-semibold text-foreground">{anchor.country}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => {
                  onNewProject?.(anchor.country)
                  close()
                }}
              >
                <FolderPlus className="size-4" />
                New Project
              </Button>

              {countryProjects.length === 0 ? (
                <div className="space-y-1">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                    title="Create a project in this country first"
                  >
                    <Droplets className="size-4" />
                    New Well
                  </Button>
                  <p className="text-[11px] text-muted-foreground">Create a project first, then add a well.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">New Well in:</p>
                  {countryProjects.slice(0, 3).map((p) => (
                    <Link
                      key={docId(p)}
                      to={`/projects/${docId(p)}?newWell=1`}
                      className="flex items-center gap-2 rounded-md border border-border/80 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      <Droplets className="size-3.5 text-primary" />
                      {p.name}
                    </Link>
                  ))}
                  {countryProjects.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{countryProjects.length - 3} more projects</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
