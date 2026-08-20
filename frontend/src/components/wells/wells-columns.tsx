import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'
import type { Well } from '@/lib/api'
import { Button } from '@/components/ui/button'

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function surfaceLabel(w: Well) {
  return w.surface_coord_type === 'latlong' ? 'Lat/Long' : 'N/E'
}

type WellColumnActions = {
  onEdit: (well: Well) => void
  onDelete: (well: Well) => void
}

export function getWellColumns(
  rkbUnit: string,
  actions: WellColumnActions,
): ColumnDef<Well>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      id: 'coords',
      header: 'Coords',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{surfaceLabel(row.original)}</span>
      ),
    },
    {
      accessorKey: 'latitude',
      header: 'Latitude',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.latitude)}</span>,
    },
    {
      accessorKey: 'longitude',
      header: 'Longitude',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.longitude)}</span>,
    },
    {
      accessorKey: 'northing',
      header: 'Northing (m)',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.northing)}</span>,
    },
    {
      accessorKey: 'easting',
      header: 'Easting (m)',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.easting)}</span>,
    },
    {
      accessorKey: 'rkb_to_datum',
      header: `RKB to Datum (${rkbUnit})`,
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.rkb_to_datum)}</span>,
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${row.original.name}`}
            onClick={() => actions.onEdit(row.original)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${row.original.name}`}
            onClick={() => actions.onDelete(row.original)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]
}
