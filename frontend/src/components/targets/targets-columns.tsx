import type { ColumnDef } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import type { Target } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type TargetColumnActions = {
  onUpdate: (index: number, patch: Partial<Target>) => void
  onRemove: (index: number) => void
}

export function getTargetColumns(
  tvdUnit: string,
  actions: TargetColumnActions,
): ColumnDef<Target>[] {
  return [
    {
      id: 'serial',
      header: () => (
        <span className="text-xs font-medium uppercase tracking-wide" title="Serial number">
          S.No
        </span>
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.index + 1}</span>
      ),
      size: 40,
    },
    {
      accessorKey: 'name',
      header: 'Target Name',
      cell: ({ row }) => (
        <Input
          value={row.original.name}
          onChange={(e) => actions.onUpdate(row.index, { name: e.target.value })}
          className="h-8 min-w-0"
        />
      ),
    },
    {
      accessorKey: 'northing',
      header: () => (
        <span title="Northing, m" className="text-xs font-medium uppercase tracking-wide">
          Northing
        </span>
      ),
      cell: ({ row }) => (
        <Input
          type="number"
          step="any"
          value={row.original.northing}
          onChange={(e) =>
            actions.onUpdate(row.index, { northing: parseFloat(e.target.value) || 0 })
          }
          className="h-8 tabular-nums"
        />
      ),
      size: 96,
    },
    {
      accessorKey: 'easting',
      header: () => (
        <span title="Easting, m" className="text-xs font-medium uppercase tracking-wide">
          Easting
        </span>
      ),
      cell: ({ row }) => (
        <Input
          type="number"
          step="any"
          value={row.original.easting}
          onChange={(e) =>
            actions.onUpdate(row.index, { easting: parseFloat(e.target.value) || 0 })
          }
          className="h-8 tabular-nums"
        />
      ),
      size: 96,
    },
    {
      accessorKey: 'tvdss',
      header: () => (
        <span title={`TVD, ${tvdUnit}`} className="text-xs font-medium uppercase tracking-wide">
          TVD, {tvdUnit}
        </span>
      ),
      cell: ({ row }) => (
        <Input
          type="number"
          step="any"
          value={row.original.tvdss}
          onChange={(e) =>
            actions.onUpdate(row.index, { tvdss: parseFloat(e.target.value) || 0 })
          }
          className="h-8 tabular-nums"
        />
      ),
      size: 96,
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={() => actions.onRemove(row.index)}
          aria-label={`Remove ${row.original.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
      size: 36,
    },
  ]
}
