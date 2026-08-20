import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { api, type Formation, type Target } from '@/lib/api'
import { WellWizardNav } from '@/components/WellWizardNav'
import { Button, Card, InputField, SelectField } from '@/components/ui'

export function SubsurfacePage() {
  const { projectId, wellId } = useParams()
  const navigate = useNavigate()
  const [lithologies, setLithologies] = useState<string[]>([])
  const [formations, setFormations] = useState<Formation[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [maxDls, setMaxDls] = useState('')
  const [newLithology, setNewLithology] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<{ lithologies: string[] }>('/reference').then((r) => setLithologies(r.lithologies))
    if (wellId) {
      api.get<{ formations: Formation[]; targets: Target[]; max_dls?: number }>(`/wells/${wellId}/subsurface`).then((s) => {
        setFormations(s.formations?.length ? s.formations : [{ formation_name: '', lithology: '', tvd_top: 0, tvd_bottom: 0 }])
        setTargets(s.targets?.length ? s.targets : [{ name: 'Target 1', northing: 0, easting: 0, tvdss: 0, tolerance: 'none' }])
        setMaxDls(s.max_dls?.toString() ?? '')
      })
    }
  }, [wellId])

  const addFormation = () =>
    setFormations([...formations, { formation_name: '', lithology: '', tvd_top: 0, tvd_bottom: 0 }])

  const addTarget = () =>
    setTargets([...targets, { name: `Target ${targets.length + 1}`, northing: 0, easting: 0, tvdss: 0, tolerance: 'none' }])

  const addCustomLithology = async () => {
    if (!newLithology.trim()) return
    const res = await api.post<{ lithologies: string[] }>('/workspace/lithologies', { name: newLithology.trim() })
    setLithologies(res.lithologies)
    setNewLithology('')
  }

  const save = async () => {
    setError('')
    try {
      await api.put(`/wells/${wellId}/subsurface`, {
        formations,
        targets,
        max_dls: maxDls ? parseFloat(maxDls) : null,
      })
      navigate(`/projects/${projectId}/wells/${wellId}/trajectory`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <div className="space-y-6">
      <WellWizardNav active="subsurface" />
      <h1 className="text-2xl font-bold">Subsurface Data</h1>

      <Card title="Formations">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-text-muted">
                <th className="p-2">Formation Name</th>
                <th className="p-2">Lithology</th>
                <th className="p-2">TVD Top</th>
                <th className="p-2">TVD Bottom</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {formations.map((f, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2"><input className="w-full rounded border px-2 py-1" value={f.formation_name} onChange={(e) => { const n = [...formations]; n[i].formation_name = e.target.value; setFormations(n) }} /></td>
                  <td className="p-2">
                    <select className="w-full rounded border px-2 py-1" value={f.lithology} onChange={(e) => { const n = [...formations]; n[i].lithology = e.target.value; setFormations(n) }}>
                      <option value="">Select</option>
                      {lithologies.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><input type="number" className="w-full rounded border px-2 py-1" value={f.tvd_top} onChange={(e) => { const n = [...formations]; n[i].tvd_top = parseFloat(e.target.value) || 0; setFormations(n) }} /></td>
                  <td className="p-2"><input type="number" className="w-full rounded border px-2 py-1" value={f.tvd_bottom} onChange={(e) => { const n = [...formations]; n[i].tvd_bottom = parseFloat(e.target.value) || 0; setFormations(n) }} /></td>
                  <td className="p-2"><button type="button" onClick={() => setFormations(formations.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-500" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="secondary" onClick={addFormation}><Plus className="mr-1 inline h-4 w-4" />Add Row</Button>
          <input className="rounded border px-2 py-1 text-sm" placeholder="New lithology" value={newLithology} onChange={(e) => setNewLithology(e.target.value)} />
          <Button type="button" variant="secondary" onClick={addCustomLithology}>Add Lithology</Button>
        </div>
      </Card>

      <Card title="Targets">
        {targets.map((t, i) => (
          <div key={i} className="mb-4 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
            <InputField label="Name" value={t.name} onChange={(e) => { const n = [...targets]; n[i].name = e.target.value; setTargets(n) }} />
            <InputField label="Northing (m)" type="number" step="any" value={t.northing} onChange={(e) => { const n = [...targets]; n[i].northing = parseFloat(e.target.value) || 0; setTargets(n) }} />
            <InputField label="Easting (m)" type="number" step="any" value={t.easting} onChange={(e) => { const n = [...targets]; n[i].easting = parseFloat(e.target.value) || 0; setTargets(n) }} />
            <InputField label="TVD (TVDss)" type="number" step="any" value={t.tvdss} onChange={(e) => { const n = [...targets]; n[i].tvdss = parseFloat(e.target.value) || 0; setTargets(n) }} />
            <SelectField label="Tolerance" options={['none', 'circular', 'elliptical']} value={t.tolerance} onChange={(e) => { const n = [...targets]; n[i].tolerance = e.target.value; setTargets(n) }} />
            {t.tolerance === 'circular' && (
              <InputField label="Radius of Tolerance" type="number" step="any" value={t.radius_of_tolerance ?? ''} onChange={(e) => { const n = [...targets]; n[i].radius_of_tolerance = parseFloat(e.target.value); setTargets(n) }} />
            )}
            {t.tolerance === 'elliptical' && (
              <>
                <InputField label="Major Radius" type="number" step="any" value={t.major_radius ?? ''} onChange={(e) => { const n = [...targets]; n[i].major_radius = parseFloat(e.target.value); setTargets(n) }} />
                <InputField label="Minor Radius" type="number" step="any" value={t.minor_radius ?? ''} onChange={(e) => { const n = [...targets]; n[i].minor_radius = parseFloat(e.target.value); setTargets(n) }} />
                <InputField label="Azimuth" type="number" step="any" value={t.azimuth ?? ''} onChange={(e) => { const n = [...targets]; n[i].azimuth = parseFloat(e.target.value); setTargets(n) }} />
              </>
            )}
            <div className="flex items-end">
              <Button type="button" variant="danger" onClick={() => setTargets(targets.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addTarget}><Plus className="mr-1 inline h-4 w-4" />Add Target</Button>
      </Card>

      <Card title="Constraints">
        <InputField label="Max DLS" type="number" step="any" value={maxDls} onChange={(e) => setMaxDls(e.target.value)} />
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={save}>Save & Continue to Trajectory</Button>
    </div>
  )
}
