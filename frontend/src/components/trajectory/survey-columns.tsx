import type { ColumnDef } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type SurveyRow = {
  md: number
  inc: number
  azi: number
  tvd: number
  dls: number
}

export const DEFAULT_SURVEY_ROW: SurveyRow = {
  md: 0,
  inc: 0,
  azi: 0,
  tvd: 0,
  dls: 0,
}

type SurveyColumnActions = {
  isReadOnlyRow?: (index: number) => boolean
  canDeleteRow?: (index: number) => boolean
  onUpdate: (index: number, patch: Partial<SurveyRow>) => void
  onDelete?: (index: number) => void
}

function numberCell(
  rowIndex: number,
  value: number,
  onChange: (value: number) => void,
  readOnly: boolean,
) {
  if (readOnly) {
    return <span className="tabular-nums text-muted-foreground">{value}</span>
  }

  return (
    <Input
      type="number"
      step="any"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="h-8 tabular-nums"
    />
  )
}

export function getSurveyColumns(actions: SurveyColumnActions): ColumnDef<SurveyRow>[] {
  const readOnly = (index: number) => actions.isReadOnlyRow?.(index) ?? index === 0

  return [
    {
      accessorKey: 'md',
      header: 'MD',
      cell: ({ row }) =>
        numberCell(
          row.index,
          row.original.md,
          (md) => actions.onUpdate(row.index, { md }),
          readOnly(row.index),
        ),
    },
    {
      accessorKey: 'inc',
      header: 'Inclination',
      cell: ({ row }) =>
        numberCell(
          row.index,
          row.original.inc,
          (inc) => actions.onUpdate(row.index, { inc }),
          readOnly(row.index),
        ),
    },
    {
      accessorKey: 'azi',
      header: 'Azimuth',
      cell: ({ row }) =>
        numberCell(
          row.index,
          row.original.azi,
          (azi) => actions.onUpdate(row.index, { azi }),
          readOnly(row.index),
        ),
    },
    {
      accessorKey: 'tvd',
      header: 'TVD',
      cell: ({ row }) =>
        numberCell(
          row.index,
          row.original.tvd,
          (tvd) => actions.onUpdate(row.index, { tvd }),
          readOnly(row.index),
        ),
    },
    {
      accessorKey: 'dls',
      header: 'DLS',
      cell: ({ row }) =>
        numberCell(
          row.index,
          row.original.dls,
          (dls) => actions.onUpdate(row.index, { dls }),
          readOnly(row.index),
        ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const canDelete = actions.canDeleteRow?.(row.index) ?? false
        if (!canDelete) {
          return <div className="h-8" />
        }

        return (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={`Delete survey station at MD ${row.original.md}`}
              onClick={() => actions.onDelete?.(row.index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )
      },
    },
  ]
}
