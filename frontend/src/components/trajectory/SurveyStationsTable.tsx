import { useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table'
import {
  DEFAULT_SURVEY_ROW,
  getSurveyColumns,
  type SurveyRow,
} from '@/components/trajectory/survey-columns'
import { isKopSurveyRow } from '@/lib/surveyRows'

type Props = {
  rows: SurveyRow[]
  kop: number | null
  onUpdate?: (index: number, patch: Partial<SurveyRow>) => void
  onDelete?: (index: number) => void
}

export function SurveyStationsTable({ rows, kop, onUpdate, onDelete }: Props) {
  const columns = useMemo(
    () =>
      getSurveyColumns({
        isReadOnlyRow: (index) => index === 0 || isKopSurveyRow(index, kop),
        canDeleteRow: (index) => index !== 0 && !isKopSurveyRow(index, kop),
        onUpdate: (index, patch) => {
          if (index === 0 || isKopSurveyRow(index, kop)) return
          onUpdate?.(index, patch)
        },
        onDelete: (index) => {
          if (index === 0 || isKopSurveyRow(index, kop)) return
          onDelete?.(index)
        },
      }),
    [kop, onUpdate, onDelete],
  )

  const data = rows.length ? rows : [{ ...DEFAULT_SURVEY_ROW }]

  return <DataTable columns={columns} data={data} />
}
