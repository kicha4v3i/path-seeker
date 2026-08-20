import Plot from 'react-plotly.js'
import type { SurveyStation } from '@/lib/api'
import { lengthUnit } from '@/lib/utils'

type Props = {
  stations: SurveyStation[]
  unitSystem: string
}

export function TrajectoryCharts({ stations, unitSystem }: Props) {
  if (!stations.length) return <p className="text-text-muted">No survey data to chart.</p>

  const u = lengthUnit(unitSystem)
  const md = stations.map((s) => s.md)
  const tvd = stations.map((s) => s.tvd)
  const ns = stations.map((s) => s.ns)
  const ew = stations.map((s) => s.ew)
  const inc = stations.map((s) => s.inc)
  const azi = stations.map((s) => s.azi)
  const dls = stations.map((s) => s.dls)
  const vs = stations.map((s) => s.vs || s.ew)

  const layout = { margin: { t: 30, r: 20, b: 40, l: 50 }, paper_bgcolor: 'white', plot_bgcolor: '#fafafa' }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-border p-2">
        <h3 className="mb-2 text-sm font-semibold">Section View</h3>
        <Plot data={[{ x: vs, y: tvd, type: 'scatter', mode: 'lines+markers', line: { color: 'hsl(168, 70%, 22%)' } }]} layout={{ ...layout, xaxis: { title: `VS (${u})` }, yaxis: { title: `TVD (${u})`, autorange: 'reversed' } }} style={{ width: '100%', height: 280 }} config={{ displayModeBar: false }} />
      </div>
      <div className="rounded-lg border border-border p-2">
        <h3 className="mb-2 text-sm font-semibold">Plan View</h3>
        <Plot data={[{ x: ew, y: ns, type: 'scatter', mode: 'lines+markers', line: { color: '#2563eb' } }]} layout={{ ...layout, xaxis: { title: 'Easting (m)' }, yaxis: { title: 'Northing (m)' } }} style={{ width: '100%', height: 280 }} config={{ displayModeBar: false }} />
      </div>
      <div className="rounded-lg border p-2 lg:col-span-2">
        <h3 className="mb-2 text-sm font-semibold">3D View</h3>
        <Plot data={[{ x: ew, y: ns, z: tvd, type: 'scatter3d', mode: 'lines+markers', line: { color: '#059669', width: 4 } }]} layout={{ ...layout, scene: { xaxis: { title: 'E (m)' }, yaxis: { title: 'N (m)' }, zaxis: { title: `TVD (${u})` } } }} style={{ width: '100%', height: 320 }} config={{ displayModeBar: false }} />
      </div>
      <div className="rounded-lg border border-border p-2">
        <h3 className="mb-2 text-sm font-semibold">Inclination vs MD</h3>
        <Plot data={[{ x: md, y: inc, type: 'scatter', mode: 'lines', line: { color: '#7c3aed' } }]} layout={{ ...layout, xaxis: { title: `MD (${u})` }, yaxis: { title: 'Inc (°)' } }} style={{ width: '100%', height: 280 }} config={{ displayModeBar: false }} />
      </div>
      <div className="rounded-lg border border-border p-2">
        <h3 className="mb-2 text-sm font-semibold">Azimuth vs MD</h3>
        <Plot data={[{ x: md, y: azi, type: 'scatter', mode: 'lines', line: { color: '#d97706' } }]} layout={{ ...layout, xaxis: { title: `MD (${u})` }, yaxis: { title: 'Azi (°)' } }} style={{ width: '100%', height: 280 }} config={{ displayModeBar: false }} />
      </div>
      <div className="rounded-lg border p-2 lg:col-span-2">
        <h3 className="mb-2 text-sm font-semibold">DLS vs MD</h3>
        <Plot data={[{ x: md, y: dls, type: 'scatter', mode: 'lines', line: { color: '#dc2626' } }]} layout={{ ...layout, xaxis: { title: `MD (${u})` }, yaxis: { title: unitSystem === 'SI' ? 'DLS (°/30m)' : 'DLS (°/100ft)' } }} style={{ width: '100%', height: 280 }} config={{ displayModeBar: false }} />
      </div>
    </div>
  )
}
