import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { api, type Formation, type Target, type Well } from '@/lib/api'
import { lengthUnit } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { getTargetColumns } from '@/components/targets/targets-columns'
import { TargetsChart } from '@/components/targets/TargetsChart'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  wellId?: string
  well?: Well | null
  unitSystem?: string
  onSaved?: () => void
}

const defaultTarget = (index: number): Target => ({
  name: `Target ${index}`,
  northing: 0,
  easting: 0,
  tvdss: 0,
  tolerance: 'none',
})

export function TargetsDrawer({
  open,
  onOpenChange,
  wellId,
  well,
  unitSystem = 'API',
  onSaved,
}: Props) {
  const [targets, setTargets] = useState<Target[]>([defaultTarget(1)])
  const [formations, setFormations] = useState<Formation[]>([])
  const [maxDls, setMaxDls] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const tvdUnit = lengthUnit(unitSystem)

  useEffect(() => {
    if (!open || !wellId) return
    setError('')
    api
      .get<{ formations?: Formation[]; targets?: Target[]; max_dls?: number | null }>(
        `/wells/${wellId}/subsurface`,
      )
      .then((s) => {
        setFormations(s.formations ?? [])
        setTargets(s.targets?.length ? s.targets : [defaultTarget(1)])
        setMaxDls(s.max_dls ?? null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load targets')
      })
  }, [open, wellId])

  const updateTarget = (index: number, patch: Partial<Target>) => {
    setTargets((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addTarget = () => {
    setTargets((rows) => [...rows, defaultTarget(rows.length + 1)])
  }

  const removeTarget = (index: number) => {
    setTargets((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)))
  }

  const columns = useMemo(
    () =>
      getTargetColumns(tvdUnit, {
        onUpdate: updateTarget,
        onRemove: removeTarget,
      }),
    [tvdUnit],
  )

  const save = async () => {
    if (!wellId) return
    setSaving(true)
    setError('')
    try {
      await api.put(`/wells/${wellId}/subsurface`, {
        formations,
        targets,
        max_dls: maxDls,
      })
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save targets')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <DrawerContent className="data-[swipe-axis=y]:h-[min(85vh,720px)] data-[swipe-axis=y]:max-h-[85vh]">
        <DrawerHeader className="border-b border-border/80 px-6 py-4 text-left">
          <DrawerTitle>Targets</DrawerTitle>
          <DrawerDescription>
            Enter target positions. Northing and easting are in meters; TVD uses the project unit
            system ({tvdUnit}).
          </DrawerDescription>
        </DrawerHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-6 py-4 lg:grid-cols-[min(100%,520px)_minmax(0,1fr)] lg:items-stretch">
          <div className="flex min-h-0 w-full max-w-[520px] flex-col gap-3 overflow-hidden">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={addTarget}>
                <Plus className="size-4" />
                Add Target
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <DataTable columns={columns} data={targets} />
            </div>
          </div>

          <div className="flex h-full min-h-[240px] flex-col overflow-hidden rounded-lg border border-border bg-white">
            <TargetsChart targets={targets} well={well} unitSystem={unitSystem} />
          </div>
        </div>

        <DrawerFooter className="border-t border-border/80 px-6 py-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save Targets'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
