import { useCallback, useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Table } from 'lucide-react'
import { api, type Project, type SurveyStation, type Target, type Trajectory, type Well } from '@/lib/api'
import { useAppHeader } from '@/components/AppHeaderContext'
import { SurfaceLocationChart } from '@/components/SurfaceLocationChart'
import { TrajectoryActionsDrawer } from '@/components/trajectory/TrajectoryActionsQuestionnaire'
import { SurveyDrawer } from '@/components/trajectory/SurveyDrawer'
import { TargetsDrawer } from '@/components/targets/TargetsDrawer'
import type { SurveyRow } from '@/components/trajectory/survey-columns'
import { DEFAULT_SURVEY_ROW } from '@/components/trajectory/survey-columns'
import { isDeviatedWell } from '@/lib/chartTargets'
import { buildSurveyRows, buildSurveyStations, alignSurveyStationsToWellSurface, isKopOnlySurvey, surveyRowsFromStations, surveyStationsToGeographic, surveyStationsToLocal } from '@/lib/surveyRows'
import { lengthUnit } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'

export function TrajectoryPage() {
  const { projectId, wellId } = useParams()
  const location = useLocation()
  const [project, setProject] = useState<Project | null>(null)
  const [well, setWell] = useState<Well | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [targetsOpen, setTargetsOpen] = useState(false)
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [kop, setKop] = useState<number | null>(null)
  const [kopInput, setKopInput] = useState('')
  const [kopError, setKopError] = useState('')
  const [surveyRows, setSurveyRows] = useState<SurveyRow[]>([{ ...DEFAULT_SURVEY_ROW }])
  const [surveyStations, setSurveyStations] = useState<SurveyStation[]>([])

  const loadTargets = useCallback(() => {
    if (!wellId) return
    api
      .get<{ targets?: Target[] }>(`/wells/${wellId}/subsurface`)
      .then((s) => setTargets(s.targets ?? []))
      .catch(() => setTargets([]))
  }, [wellId])

  const loadTrajectory = useCallback(() => {
    if (!wellId) return
    api
      .get<Trajectory | null>(`/wells/${wellId}/trajectory`)
      .then((traj) => {
        const loadedKop = traj?.params?.kop ?? null
        setKop(loadedKop)
        setKopInput(loadedKop != null ? String(loadedKop) : '')
        const stations = traj?.survey_stations ?? []
        setSurveyStations(stations)
        setSurveyRows(
          stations.length ? surveyRowsFromStations(stations) : buildSurveyRows(loadedKop),
        )
      })
      .catch(() => {
        setKop(null)
        setKopInput('')
        setSurveyStations([])
        setSurveyRows([{ ...DEFAULT_SURVEY_ROW }])
      })
  }, [wellId])

  const loadPageData = useCallback(async () => {
    if (!wellId) return
    const wellData = await api.get<Well>(`/wells/${wellId}`)
    setWell(wellData)

    const traj = await api.get<Trajectory | null>(`/wells/${wellId}/trajectory`).catch(() => null)
    const loadedKop = traj?.params?.kop ?? null
    setKop(loadedKop)
    setKopInput(loadedKop != null ? String(loadedKop) : '')
    const unitSystem = wellData.unit_system || 'API'
    const stations = traj?.survey_stations?.length
      ? surveyStationsToLocal(
          alignSurveyStationsToWellSurface(traj.survey_stations, wellData),
          wellData,
          unitSystem,
        )
      : buildSurveyStations(wellData, loadedKop)
    setSurveyStations(stations)
    setSurveyRows(
      stations.length ? surveyRowsFromStations(stations) : buildSurveyRows(loadedKop),
    )
  }, [wellId])

  useEffect(() => {
    if (!wellId) return
    void loadPageData()
  }, [wellId, location.pathname, loadPageData])

  useEffect(() => {
    if (!projectId) return
    api.get<Project>(`/projects/${projectId}`).then(setProject)
  }, [projectId])

  useEffect(() => {
    loadTargets()
  }, [loadTargets])

  useAppHeader(
    project?.name || 'Loading project...',
    well?.name || 'Loading well...',
  )

  const unitSystem = project?.unit_system || well?.unit_system || 'API'
  const u = lengthUnit(unitSystem)
  const deviated = isDeviatedWell(well, targets)
  const kopOnly = isKopOnlySurvey(surveyStations, kop)

  const saveKop = useCallback(
    async (value: number | null) => {
      if (!wellId || !well) return

      setKopError('')
      try {
        const traj = await api.put<Trajectory>(`/wells/${wellId}/trajectory`, { kop: value })
        const savedKop = traj.params?.kop ?? null
        setKop(savedKop)
        setKopInput(savedKop != null ? String(savedKop) : '')
        const stations = traj.survey_stations?.length
          ? surveyStationsToLocal(
              alignSurveyStationsToWellSurface(traj.survey_stations, well),
              well,
              unitSystem,
            )
          : buildSurveyStations(well, savedKop)
        setSurveyStations(stations)
        setSurveyRows(
          traj.survey_stations?.length
            ? surveyRowsFromStations(traj.survey_stations)
            : buildSurveyRows(savedKop),
        )
      } catch (err) {
        setKopError(err instanceof Error ? err.message : 'Failed to save KOP')
      }
    },
    [wellId, well, unitSystem],
  )

  const deleteSurveyRow = useCallback(
    async (index: number) => {
      if (!wellId || !well) return
      if (index === 0) return
      if (kop != null && kop > 0 && index === 1) return

      const nextStations = surveyStations.filter((_, i) => i !== index)
      const nextRows = surveyRows.filter((_, i) => i !== index)

      setSurveyStations(nextStations)
      setSurveyRows(nextRows.length ? nextRows : [{ ...DEFAULT_SURVEY_ROW }])

      try {
        await api.put<Trajectory>(`/wells/${wellId}/trajectory`, {
          survey_stations: surveyStationsToGeographic(nextStations, well, unitSystem),
        })
      } catch {
        // Keep optimistic UI; reload on next visit if persist fails.
      }
    },
    [wellId, kop, surveyStations, surveyRows, well, unitSystem],
  )

  const applyKop = useCallback(() => {
    if (!kopInput.trim()) {
      void saveKop(null)
      return
    }

    const value = Number(kopInput)
    if (Number.isNaN(value) || value <= 0) {
      setKopError(`Enter a valid KOP depth greater than 0 ${u}.`)
      return
    }

    void saveKop(value)
  }, [kopInput, saveKop, u])

  const handleKopKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        applyKop()
      }
    },
    [applyKop],
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 justify-end">
        <ButtonGroup>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Survey table"
            title="Survey table"
            onClick={() => setSurveyOpen(true)}
          >
            <Table className="size-4" />
          </Button>
          <Button variant="outline">Lithology</Button>
          <Button variant="outline" onClick={() => setTargetsOpen(true)}>
            Targets
          </Button>
        </ButtonGroup>
      </div>

      <SurfaceLocationChart
        well={well}
        targets={targets}
        unitSystem={unitSystem}
        kop={kop}
        kopInput={kopInput}
        kopError={kopError}
        onKopInputChange={(value) => {
          setKopInput(value)
          if (kopError) setKopError('')
        }}
        onKopApply={applyKop}
        onKopKeyDown={handleKopKeyDown}
        finalSurveyStation={
          surveyStations.length ? surveyStations[surveyStations.length - 1] : null
        }
        surveyStations={surveyStations}
        wellId={wellId}
        actionsOpen={actionsOpen}
        onActionsOpenChange={setActionsOpen}
        className="min-h-[480px] flex-1 lg:min-h-0"
      />

      <TrajectoryActionsDrawer
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        deviated={deviated}
        kopOnly={kopOnly}
        wellId={wellId}
        kop={kop}
        targets={targets}
        onTrajectoryGenerated={(stations) => {
          const local = well
            ? surveyStationsToLocal(stations, well, unitSystem)
            : stations
          setSurveyStations(local)
          setSurveyRows(surveyRowsFromStations(local))
        }}
      />

      <SurveyDrawer
        open={surveyOpen}
        onOpenChange={setSurveyOpen}
        kop={kop}
        rows={surveyRows}
        onDeleteRow={deleteSurveyRow}
      />

      <TargetsDrawer
        open={targetsOpen}
        onOpenChange={setTargetsOpen}
        wellId={wellId}
        well={well}
        unitSystem={unitSystem}
        onSaved={loadTargets}
      />
    </div>
  )
}
