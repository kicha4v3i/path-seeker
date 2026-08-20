import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button, Card, InputField, SelectField, UnitSystemToggle } from '@/components/ui'

type RefData = {
  countries: string[]
  coordinate_systems: string[]
  projection_systems: string[]
  datums: string[]
}

export function ProjectFormPage() {
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = Boolean(projectId && projectId !== 'new')
  const countryFromMap = searchParams.get('country') || ''

  const [ref, setRef] = useState<RefData | null>(null)
  const [form, setForm] = useState({
    name: '',
    location_country: countryFromMap,
    environment: 'Onshore',
    ground_level_elevation: '',
    water_depth: '',
    block: '',
    field: '',
    coordinate_system: '',
    projection_system: '',
    datum: '',
    unit_system: 'API',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit && countryFromMap) {
      setForm((f) => ({ ...f, location_country: countryFromMap }))
    }
  }, [countryFromMap, isEdit])

  useEffect(() => {
    api.get<RefData>('/reference').then((data) => {
      const countries =
        !isEdit && countryFromMap && !data.countries.includes(countryFromMap)
          ? [...data.countries, countryFromMap]
          : data.countries
      setRef({ ...data, countries })
    })
    if (isEdit && projectId) {
      api.get<Record<string, string | number | null | undefined>>(`/projects/${projectId}`).then((p) => {
        const env = String(p.environment || 'Onshore')
        setForm({
          name: String(p.name || ''),
          location_country: String(p.location_country || ''),
          environment: env.toLowerCase() === 'offshore' ? 'Offshore' : 'Onshore',
          ground_level_elevation: p.ground_level_elevation != null ? String(p.ground_level_elevation) : '',
          water_depth: p.water_depth != null ? String(p.water_depth) : '',
          block: String(p.block || ''),
          field: String(p.field || ''),
          coordinate_system: String(p.coordinate_system || ''),
          projection_system: String(p.projection_system || ''),
          datum: String(p.datum || ''),
          unit_system: String(p.unit_system || 'API'),
        })
      })
    }
  }, [projectId, isEdit])

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        location_country: form.location_country,
        environment: form.environment,
        block: form.block,
        field: form.field,
        coordinate_system: form.coordinate_system,
        projection_system: form.projection_system,
        datum: form.datum,
        unit_system: form.unit_system,
      }
      if (form.environment.toLowerCase() === 'onshore') {
        const gle = parseFloat(form.ground_level_elevation)
        if (Number.isNaN(gle) || gle < 0) {
          throw new Error('Ground Level Elevation must be zero or greater')
        }
        body.ground_level_elevation = gle
      } else {
        const wd = parseFloat(form.water_depth)
        if (Number.isNaN(wd) || wd < 0) {
          throw new Error('Water Depth must be zero or greater')
        }
        body.water_depth = wd
      }

      if (isEdit && projectId) {
        await api.put(`/projects/${projectId}`, body)
        navigate(`/projects/${projectId}`)
      } else {
        const created = await api.post<{ _id?: string; id?: string }>('/projects', body)
        navigate(`/projects/${created._id || created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  if (!ref) return <p>Loading...</p>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{isEdit ? 'Edit Project' : 'New Project'}</h1>
      <Card>
        <form onSubmit={submit} className="grid gap-4">
          <InputField label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          <UnitSystemToggle value={form.unit_system} onChange={(v) => set('unit_system', v)} />
          <SelectField label="Location" options={ref.countries} value={form.location_country} onChange={(e) => set('location_country', e.target.value)} />
          <SelectField label="Environment" options={['Onshore', 'Offshore']} value={form.environment} onChange={(e) => set('environment', e.target.value)} />
          {form.environment.toLowerCase() === 'onshore' ? (
            <InputField
              label={`Ground Level Elevation (${form.unit_system === 'SI' ? 'm' : 'ft'})`}
              type="number"
              step="any"
              min={0}
              value={form.ground_level_elevation}
              onChange={(e) => set('ground_level_elevation', e.target.value)}
              required
            />
          ) : (
            <InputField
              label={`Water Depth (${form.unit_system === 'SI' ? 'm' : 'ft'})`}
              type="number"
              step="any"
              min={0}
              value={form.water_depth}
              onChange={(e) => set('water_depth', e.target.value)}
              required
            />
          )}
          <InputField label="Block" value={form.block} onChange={(e) => set('block', e.target.value)} />
          <InputField label="Field" value={form.field} onChange={(e) => set('field', e.target.value)} />
          <SelectField label="Coordinate System" options={ref.coordinate_systems} value={form.coordinate_system} onChange={(e) => set('coordinate_system', e.target.value)} />
          <SelectField label="Projection System" options={ref.projection_systems} value={form.projection_system} onChange={(e) => set('projection_system', e.target.value)} />
          <SelectField label="Datum" options={ref.datums} value={form.datum} onChange={(e) => set('datum', e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit">Save Project</Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
