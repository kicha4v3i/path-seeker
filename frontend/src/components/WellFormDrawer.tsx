import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, docId, type Project, type Well } from '@/lib/api'
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
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  project?: Project | null
  well?: Well | null
  onSaved?: () => void
}

const emptyForm = {
  name: '',
  surface_coord_type: 'ne',
  latitude: '',
  longitude: '',
  northing: '',
  easting: '',
  rkb_to_datum: '',
}

function wellToForm(well: Well) {
  const coordType =
    well.surface_coord_type === 'latlong' || well.surface_coord_type === 'latitude_longitude'
      ? 'latlong'
      : 'ne'
  return {
    name: well.name || '',
    surface_coord_type: coordType,
    latitude: well.latitude?.toString() ?? '',
    longitude: well.longitude?.toString() ?? '',
    northing: well.northing?.toString() ?? '',
    easting: well.easting?.toString() ?? '',
    rkb_to_datum: well.rkb_to_datum?.toString() ?? '',
  }
}

export function WellFormDrawer({ open, onOpenChange, projectId, project, well, onSaved }: Props) {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [projectUnits, setProjectUnits] = useState(project?.unit_system || 'API')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(well && docId(well))

  useEffect(() => {
    if (!open) return
    setForm(well ? wellToForm(well) : emptyForm)
    setError('')
    if (project?.unit_system) {
      setProjectUnits(project.unit_system)
    } else if (well?.unit_system) {
      setProjectUnits(well.unit_system)
    } else if (projectId) {
      api.get<Project>(`/projects/${projectId}`).then((p) => {
        setProjectUnits(p.unit_system || 'API')
      })
    }
  }, [open, projectId, project, well])

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const lengthUnit = projectUnits === 'SI' ? 'm' : 'ft'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        unit_system: projectUnits,
        surface_coord_type: form.surface_coord_type,
        rkb_to_datum: form.rkb_to_datum ? parseFloat(form.rkb_to_datum) : null,
        latitude: null,
        longitude: null,
        northing: null,
        easting: null,
      }
      if (form.surface_coord_type === 'latlong') {
        body.latitude = parseFloat(form.latitude)
        body.longitude = parseFloat(form.longitude)
      } else {
        body.northing = parseFloat(form.northing)
        body.easting = parseFloat(form.easting)
      }

      if (isEdit && well) {
        await api.put(`/wells/${docId(well)}`, body)
        onOpenChange(false)
        onSaved?.()
      } else {
        const created = await api.post<{ _id?: string; id?: string }>(`/projects/${projectId}/wells`, body)
        const id = docId(created)
        if (!id) throw new Error('Well was created but no id was returned')
        onOpenChange(false)
        onSaved?.()
        navigate(`/projects/${projectId}/wells/${id}/subsurface`)
      }
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
          <DrawerTitle className="text-xl tracking-tight">{isEdit ? 'Edit Well' : 'New Well'}</DrawerTitle>
          <DrawerDescription className="text-muted-foreground">
            Units follow the project ({projectUnits}). Enter surface location and RKB to datum.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="well-form" onSubmit={submit}>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Well</FieldLegend>
                <FieldDescription>Basic well identity and surface position.</FieldDescription>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="well-name">Name</FieldLabel>
                    <Input
                      id="well-name"
                      placeholder="e.g. Well-01"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Surface Coordinates</FieldLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={form.surface_coord_type}
                      onValueChange={(v) => {
                        if (v) set('surface_coord_type', v)
                      }}
                      className="w-full"
                    >
                      <ToggleGroupItem value="ne" className="flex-1">
                        Northing / Easting
                      </ToggleGroupItem>
                      <ToggleGroupItem value="latlong" className="flex-1">
                        Lat / Long
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </Field>

                  {form.surface_coord_type === 'latlong' ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="well-lat">Latitude</FieldLabel>
                        <Input
                          id="well-lat"
                          type="number"
                          step="any"
                          value={form.latitude}
                          onChange={(e) => set('latitude', e.target.value)}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="well-lon">Longitude</FieldLabel>
                        <Input
                          id="well-lon"
                          type="number"
                          step="any"
                          value={form.longitude}
                          onChange={(e) => set('longitude', e.target.value)}
                          required
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="well-n">Northing (m)</FieldLabel>
                        <div className="relative">
                          <Input
                            id="well-n"
                            type="number"
                            step="any"
                            className="pr-10"
                            value={form.northing}
                            onChange={(e) => set('northing', e.target.value)}
                            required
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                            m
                          </span>
                        </div>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="well-e">Easting (m)</FieldLabel>
                        <div className="relative">
                          <Input
                            id="well-e"
                            type="number"
                            step="any"
                            className="pr-10"
                            value={form.easting}
                            onChange={(e) => set('easting', e.target.value)}
                            required
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                            m
                          </span>
                        </div>
                      </Field>
                    </div>
                  )}

                  <Field>
                    <FieldLabel htmlFor="well-rkb">RKB to Datum ({lengthUnit})</FieldLabel>
                    <div className="relative">
                      <Input
                        id="well-rkb"
                        type="number"
                        step="any"
                        className="pr-10"
                        value={form.rkb_to_datum}
                        onChange={(e) => set('rkb_to_datum', e.target.value)}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        {lengthUnit}
                      </span>
                    </div>
                    <FieldDescription>Rotary kelly bushing elevation relative to datum.</FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldSet>

              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>
          </form>
        </div>

        <DrawerFooter className="flex-row gap-2 border-t border-border/80 bg-muted/30 px-6 py-4">
          <Button type="submit" form="well-form" disabled={saving} className="flex-1">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Well'}
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
