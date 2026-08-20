import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, docId } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type RefData = {
  countries: string[]
  coordinate_systems: string[]
  projection_systems: string[]
  datums: string[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCountry?: string
  onCreated?: () => void
}

const emptyForm = {
  name: '',
  location_country: '',
  environment: 'Onshore',
  ground_level_elevation: '',
  water_depth: '',
  block: '',
  field: '',
  coordinate_system: '',
  projection_system: '',
  datum: '',
  unit_system: 'API',
}

export function ProjectFormDrawer({ open, onOpenChange, initialCountry = '', onCreated }: Props) {
  const navigate = useNavigate()
  const [ref, setRef] = useState<RefData | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    api.get<RefData>('/reference').then((data) => {
      const countries =
        initialCountry && !data.countries.includes(initialCountry)
          ? [...data.countries, initialCountry]
          : data.countries
      setRef({ ...data, countries })
    })
    setForm({
      ...emptyForm,
      location_country: initialCountry,
    })
    setError('')
  }, [open, initialCountry])

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const lengthUnit = form.unit_system === 'SI' ? 'm' : 'ft'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
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

      const created = await api.post<{ _id?: string; id?: string }>('/projects', body)
      const id = docId(created)
      if (!id) {
        throw new Error('Project was created but no id was returned')
      }
      onOpenChange(false)
      onCreated?.()
      navigate(`/projects/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right" modal={false}>
      <DrawerContent className="bg-card text-card-foreground shadow-xl">
        <DrawerHeader className="space-y-1 border-b border-border/80 bg-card px-6 py-5">
          <DrawerTitle className="text-xl tracking-tight">New Project</DrawerTitle>
          <DrawerDescription className="text-muted-foreground">
            {initialCountry
              ? `Creating a project in ${initialCountry}`
              : 'Enter project details to begin trajectory planning'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!ref ? (
            <p className="text-sm text-muted-foreground">Loading form...</p>
          ) : (
            <form id="new-project-form" onSubmit={submit}>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend>Project</FieldLegend>
                  <FieldDescription>Basic identity and measurement system for this project.</FieldDescription>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="project-name">Name</FieldLabel>
                      <Input
                        id="project-name"
                        placeholder="e.g. North Field Development"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        required
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Unit System</FieldLabel>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={form.unit_system}
                        onValueChange={(v) => {
                          if (v) set('unit_system', v)
                        }}
                        className="w-full"
                      >
                        <ToggleGroupItem value="API" className="flex-1">
                          API
                        </ToggleGroupItem>
                        <ToggleGroupItem value="SI" className="flex-1">
                          SI
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <FieldDescription>
                        {form.unit_system === 'SI' ? 'Meters and °/30m' : 'Feet and °/100ft'}
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSeparator />

                <FieldSet>
                  <FieldLegend>Location</FieldLegend>
                  <FieldDescription>Geographic and operational setting for the asset.</FieldDescription>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="project-location">Country</FieldLabel>
                      <NativeSelect
                        id="project-location"
                        value={form.location_country}
                        onChange={(e) => set('location_country', e.target.value)}
                      >
                        <NativeSelectOption value="">Select country</NativeSelectOption>
                        {ref.countries.map((c) => (
                          <NativeSelectOption key={c} value={c}>
                            {c}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="project-environment">Environment</FieldLabel>
                      <NativeSelect
                        id="project-environment"
                        value={form.environment}
                        onChange={(e) => set('environment', e.target.value)}
                      >
                        <NativeSelectOption value="Onshore">Onshore</NativeSelectOption>
                        <NativeSelectOption value="Offshore">Offshore</NativeSelectOption>
                      </NativeSelect>
                    </Field>

                    {form.environment.toLowerCase() === 'onshore' ? (
                      <Field>
                        <FieldLabel htmlFor="project-gle">
                          Ground Level Elevation ({lengthUnit})
                        </FieldLabel>
                        <div className="relative">
                          <Input
                            id="project-gle"
                            type="number"
                            step="any"
                            min={0}
                            placeholder="0"
                            className="pr-10"
                            value={form.ground_level_elevation}
                            onChange={(e) => set('ground_level_elevation', e.target.value)}
                            required
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                            {lengthUnit}
                          </span>
                        </div>
                        <FieldDescription>Must be 0 or greater. Elevation relative to the project datum.</FieldDescription>
                      </Field>
                    ) : (
                      <Field>
                        <FieldLabel htmlFor="project-wd">Water Depth ({lengthUnit})</FieldLabel>
                        <div className="relative">
                          <Input
                            id="project-wd"
                            type="number"
                            step="any"
                            min={0}
                            placeholder="0"
                            className="pr-10"
                            value={form.water_depth}
                            onChange={(e) => set('water_depth', e.target.value)}
                            required
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                            {lengthUnit}
                          </span>
                        </div>
                        <FieldDescription>Must be 0 or greater. Water depth at the well location.</FieldDescription>
                      </Field>
                    )}

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="project-block">Block</FieldLabel>
                        <Input
                          id="project-block"
                          placeholder="Block"
                          value={form.block}
                          onChange={(e) => set('block', e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="project-field">Field</FieldLabel>
                        <Input
                          id="project-field"
                          placeholder="Field"
                          value={form.field}
                          onChange={(e) => set('field', e.target.value)}
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </FieldSet>

                <FieldSeparator />

                <FieldSet>
                  <FieldLegend>Coordinate Reference</FieldLegend>
                  <FieldDescription>CRS used to interpret northing and easting values (always in meters).</FieldDescription>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="project-crs">Coordinate System</FieldLabel>
                      <NativeSelect
                        id="project-crs"
                        value={form.coordinate_system}
                        onChange={(e) => set('coordinate_system', e.target.value)}
                      >
                        <NativeSelectOption value="">Select...</NativeSelectOption>
                        {ref.coordinate_systems.map((c) => (
                          <NativeSelectOption key={c} value={c}>
                            {c}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="project-proj">Projection System</FieldLabel>
                      <NativeSelect
                        id="project-proj"
                        value={form.projection_system}
                        onChange={(e) => set('projection_system', e.target.value)}
                      >
                        <NativeSelectOption value="">Select...</NativeSelectOption>
                        {ref.projection_systems.map((c) => (
                          <NativeSelectOption key={c} value={c}>
                            {c}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="project-datum">Datum</FieldLabel>
                      <NativeSelect
                        id="project-datum"
                        value={form.datum}
                        onChange={(e) => set('datum', e.target.value)}
                      >
                        <NativeSelectOption value="">Select...</NativeSelectOption>
                        {ref.datums.map((c) => (
                          <NativeSelectOption key={c} value={c}>
                            {c}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                  </FieldGroup>
                </FieldSet>

                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>
            </form>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2 border-t border-border/80 bg-muted/30 px-6 py-4">
          <Button type="submit" form="new-project-form" disabled={saving || !ref} className="flex-1">
            {saving ? 'Saving...' : 'Save Project'}
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
