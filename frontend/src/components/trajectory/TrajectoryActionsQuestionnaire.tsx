import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical, X, Zap } from 'lucide-react'
import { api, type SurveyStation, type Target, type Trajectory } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import changeDirectionBearingIcon from '@/assets/change-direction-bearing.png'
import buildHoldBearingIcon from '@/assets/build-hold-bearing.png'
import buildHoldBuildBearingIcon from '@/assets/build-hold-build-bearing.png'

type ActionChoice = {
  value: string
  label: string
  imageSrc?: string
}

const changeBearingChoices: readonly ActionChoice[] = [
  {
    value: 'build',
    label: 'Change direction',
    imageSrc: changeDirectionBearingIcon,
  },
  {
    value: 'build-hold',
    label: 'Build & Hold',
    imageSrc: buildHoldBearingIcon,
  },
  {
    value: 'build-hold-build',
    label: 'Curve-Hold-Curve',
    imageSrc: buildHoldBuildBearingIcon,
  },
]

type Step =
  | {
      id: 'action' | 'change-bearing-mode'
      prompt: string
      description: string
      choices: readonly ActionChoice[]
    }
  | {
      id: 'build-params' | 'hold-params' | 'build-hold-params' | 'curve-hold-curve-params'
      prompt: string
      description: string
    }

type BuildParams = {
  inclination: string
  azimuth: string
  tvd: string
  dls: string
}

const emptyBuildParams: BuildParams = {
  inclination: '',
  azimuth: '',
  tvd: '',
  dls: '',
}

type HoldParams = {
  tangentLength: string
  tvd: string
}

const emptyHoldParams: HoldParams = {
  tangentLength: '',
  tvd: '',
}

type BuildHoldParams = {
  dls: string
}

const emptyBuildHoldParams: BuildHoldParams = {
  dls: '',
}

type CurveHoldCurveParams = {
  dls1: string
  dls2: string
  targetIndex: string
  alignAlongIndex: string
  inclination: string
  azimuth: string
}

const emptyCurveHoldCurveParams: CurveHoldCurveParams = {
  dls1: '',
  dls2: '',
  targetIndex: '',
  alignAlongIndex: '',
  inclination: '',
  azimuth: '',
}

function getActionChoices(deviated: boolean, kopOnly: boolean): readonly ActionChoice[] {
  if (deviated && kopOnly) {
    return [
      { value: 'change-bearing', label: 'Change Bearing' },
      { value: 'build-hold', label: 'Build & Hold' },
      { value: 'generate', label: 'Generate Full Trajectory' },
    ]
  }

  return [
    { value: 'change-bearing', label: 'Change Bearing' },
    { value: 'hold', label: 'Hold Bearing' },
    { value: 'build-hold', label: 'Build & Hold' },
    { value: 'generate', label: 'Generate full trajectory' },
  ]
}

function getParamSteps(mode: string | null): Step[] {
  if (mode === 'build') {
    return [
      {
        id: 'build-params',
        prompt: 'Enter change direction parameters',
        description:
          'Enter DLS, Azimuth, and either Inclination or TVD. The unused field is disabled once a pair is complete.',
      },
    ]
  }

  if (mode === 'hold') {
    return [
      {
        id: 'hold-params',
        prompt: 'Enter Hold parameters',
        description:
          'Enter either Tangent Length or Hold up to TVD. The unused field is disabled once one is set.',
      },
    ]
  }

  if (mode === 'build-hold') {
    return [
      {
        id: 'build-hold-params',
        prompt: 'Enter Build & Hold parameters',
        description: 'Uses the next unreached target in TVD order as the endpoint. Only DLS is required.',
      },
    ]
  }

  if (mode === 'build-hold-build') {
    return [
      {
        id: 'curve-hold-curve-params',
        prompt: 'Enter Curve-Hold-Curve parameters',
        description:
          'Enter DLS for each curve and choose the target. Align along is optional; when set, landing inclination and azimuth are calculated.',
      },
    ]
  }

  return []
}

function getSteps(
  deviated: boolean,
  kopOnly: boolean,
  selectedAction: string | null,
  selectedBearingMode: string | null,
): Step[] {
  const choices = getActionChoices(deviated, kopOnly)
  const steps: Step[] = [
    {
      id: 'action',
      prompt: 'What trajectory action should run?',
      description:
        deviated && kopOnly
          ? 'Select the next step from the KOP.'
          : 'Select the next step from the current survey station.',
      choices,
    },
  ]

  if (selectedAction === 'change-bearing') {
    steps.push({
      id: 'change-bearing-mode',
      prompt: 'Change bearing',
      description: 'Select how the bearing should change.',
      choices: changeBearingChoices,
    })
    steps.push(...getParamSteps(selectedBearingMode))
  } else {
    steps.push(...getParamSteps(selectedAction))
  }

  return steps
}

function hasValue(value: string) {
  return value.trim() !== ''
}

function buildParamsComplete(params: BuildParams) {
  const hasInclination = hasValue(params.inclination)
  const hasAzimuth = hasValue(params.azimuth)
  const hasTvd = hasValue(params.tvd)
  const hasDls = hasValue(params.dls) && Number(params.dls) > 0

  return hasDls && ((hasAzimuth && hasInclination) || (hasAzimuth && hasTvd))
}

function buildHoldParamsComplete(params: BuildHoldParams) {
  return hasValue(params.dls) && Number(params.dls) > 0
}

function curveHoldCurveParamsComplete(params: CurveHoldCurveParams) {
  const dls1Ok = hasValue(params.dls1) && Number(params.dls1) > 0
  const dls2Ok = hasValue(params.dls2) && Number(params.dls2) > 0
  const targetOk = hasValue(params.targetIndex)
  const landingOk =
    hasValue(params.alignAlongIndex) ||
    (hasValue(params.inclination) && hasValue(params.azimuth))
  return dls1Ok && dls2Ok && targetOk && landingOk
}

function targetOptionLabel(target: Target, index: number) {
  const name = target.name?.trim()
  return name || `Target ${index + 1}`
}

function holdParamsComplete(params: HoldParams) {
  const hasTangent = hasValue(params.tangentLength) && Number(params.tangentLength) > 0
  const hasTvd = hasValue(params.tvd)
  return (hasTangent && !hasTvd) || (hasTvd && !hasTangent)
}

function getHoldParamLocks(params: HoldParams) {
  return {
    tangentDisabled: hasValue(params.tvd),
    tvdDisabled: hasValue(params.tangentLength),
  }
}

function getBuildParamLocks(params: BuildParams) {
  const hasInclination = hasValue(params.inclination)
  const hasAzimuth = hasValue(params.azimuth)
  const hasTvd = hasValue(params.tvd)

  return {
    inclinationDisabled: hasAzimuth && hasTvd,
    tvdDisabled: hasAzimuth && hasInclination,
  }
}

function stepIsComplete(
  step: Step,
  selectedAction: string | null,
  selectedBearingMode: string | null,
  buildParams: BuildParams,
  holdParams: HoldParams,
  buildHoldParams: BuildHoldParams,
  curveHoldCurveParams: CurveHoldCurveParams,
) {
  if (step.id === 'action') return selectedAction != null
  if (step.id === 'change-bearing-mode') return selectedBearingMode != null
  if (step.id === 'build-params') return buildParamsComplete(buildParams)
  if (step.id === 'hold-params') return holdParamsComplete(holdParams)
  if (step.id === 'build-hold-params') return buildHoldParamsComplete(buildHoldParams)
  if (step.id === 'curve-hold-curve-params') {
    return curveHoldCurveParamsComplete(curveHoldCurveParams)
  }
  return false
}

type GenerateResponse = {
  trajectory: Trajectory
  summary?: Record<string, number>
  validation_errors?: string[]
  info_messages?: string[]
}

type ActionsProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviated?: boolean
  kopOnly?: boolean
  wellId?: string
  kop?: number | null
  targets?: Target[]
  onTrajectoryGenerated?: (stations: SurveyStation[]) => void
}

type DragOffset = { x: number; y: number }

function usePanelDrag(open: boolean) {
  const [offset, setOffset] = useState<DragOffset>({ x: 0, y: 0 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  useEffect(() => {
    if (!open) setOffset({ x: 0, y: 0 })
  }, [open])

  function onDragHandlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onDragHandlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    })
  }

  function onDragHandlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return {
    offset,
    onDragHandlePointerDown,
    onDragHandlePointerMove,
    onDragHandlePointerUp,
  }
}

export function TrajectoryActionsTrigger({ open, onOpenChange }: ActionsProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Actions"
      aria-expanded={open}
      title="Actions"
      onMouseDown={(event) => {
        // Keep focus out of the KOP field so its blur handler does not run first.
        event.preventDefault()
      }}
      onClick={() => onOpenChange(!open)}
    >
      <Zap className="size-4" />
    </Button>
  )
}

export function TrajectoryActionsDrawer({
  open,
  onOpenChange,
  deviated = false,
  kopOnly = false,
  wellId,
  kop = null,
  targets = [],
  onTrajectoryGenerated,
}: ActionsProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [selectedBearingMode, setSelectedBearingMode] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [buildParams, setBuildParams] = useState<BuildParams>(emptyBuildParams)
  const [buildHoldParams, setBuildHoldParams] = useState<BuildHoldParams>(emptyBuildHoldParams)
  const [curveHoldCurveParams, setCurveHoldCurveParams] = useState<CurveHoldCurveParams>(
    emptyCurveHoldCurveParams,
  )
  const [holdParams, setHoldParams] = useState<HoldParams>(emptyHoldParams)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const {
    offset,
    onDragHandlePointerDown,
    onDragHandlePointerMove,
    onDragHandlePointerUp,
  } = usePanelDrag(open)

  const steps = useMemo(
    () => getSteps(deviated, kopOnly, selectedAction, selectedBearingMode),
    [deviated, kopOnly, selectedAction, selectedBearingMode],
  )
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)]
  const totalSteps = steps.length
  const isLastStep = stepIndex >= totalSteps - 1

  useEffect(() => {
    if (!open) {
      setSelectedAction(null)
      setSelectedBearingMode(null)
      setStepIndex(0)
      setBuildParams(emptyBuildParams)
      setBuildHoldParams(emptyBuildHoldParams)
      setCurveHoldCurveParams(emptyCurveHoldCurveParams)
      setHoldParams(emptyHoldParams)
      setSubmitError('')
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(steps.length - 1, 0))
    }
  }, [stepIndex, steps.length])

  async function handleSubmit() {
    setSubmitError('')

    if (!wellId) {
      setSubmitError('Well is not loaded yet.')
      return
    }

    if (!selectedAction) {
      setSubmitError('Select a trajectory action.')
      return
    }

    if (selectedAction === 'generate') {
      setSubmitError('Generate full trajectory is not connected to the engine yet.')
      return
    }

    if (selectedAction === 'change-bearing' && !selectedBearingMode) {
      setSubmitError('Select a change bearing section type.')
      return
    }

    const engineAction =
      selectedAction === 'change-bearing' ? selectedBearingMode! : selectedAction

    let sections: Record<string, string | number>[]
    let buildRate: number | undefined

    function buildSectionFromParams() {
      const dls = Number(buildParams.dls)
      return {
        type: 'build',
        inc: Number(buildParams.inclination),
        azi: Number(buildParams.azimuth),
        dls,
      }
    }

    function holdSectionFromParams() {
      if (hasValue(holdParams.tangentLength)) {
        return {
          type: 'hold',
          tangent_length: Number(holdParams.tangentLength),
        }
      }
      return {
        type: 'hold',
        tvd: Number(holdParams.tvd),
      }
    }

    if (engineAction === 'hold') {
      if (!holdParamsComplete(holdParams)) {
        setSubmitError('Enter either Tangent Length or Hold up to TVD.')
        return
      }
      sections = [holdSectionFromParams()]
    } else if (engineAction === 'build-hold') {
      if (!buildHoldParamsComplete(buildHoldParams)) {
        setSubmitError('Enter DLS.')
        return
      }
      const dls = Number(buildHoldParams.dls)
      buildRate = dls
      sections = [{ type: 'build-hold', dls }]
    } else if (engineAction === 'build-hold-build') {
      if (!curveHoldCurveParamsComplete(curveHoldCurveParams)) {
        setSubmitError('Enter DLS for both curves, a target, and landing inclination and azimuth.')
        return
      }
      if (hasValue(curveHoldCurveParams.alignAlongIndex)) {
        setSubmitError(
          'Align along calculation is not connected yet. Clear Align along and enter inclination and azimuth, or wait for the equation.',
        )
        return
      }
      const targetIndex = Number(curveHoldCurveParams.targetIndex)
      const selectedTarget = targets[targetIndex]
      if (!selectedTarget) {
        setSubmitError('Select a target.')
        return
      }
      const dls1 = Number(curveHoldCurveParams.dls1)
      const dls2 = Number(curveHoldCurveParams.dls2)
      buildRate = dls1
      sections = [
        {
          type: 'curve-hold-curve',
          dls: dls1,
          dls2,
          target: selectedTarget.name,
          target_index: targetIndex,
          inc: Number(curveHoldCurveParams.inclination),
          azi: Number(curveHoldCurveParams.azimuth),
        },
      ]
    } else {
      if (!buildParamsComplete(buildParams)) {
        setSubmitError('Enter DLS, Azimuth, and either Inclination or TVD.')
        return
      }

      if (hasValue(buildParams.tvd) && !hasValue(buildParams.inclination)) {
        setSubmitError('TVD & Azimuth build is not implemented yet. Use Inclination & Azimuth.')
        return
      }

      buildRate = Number(buildParams.dls)
      sections = [buildSectionFromParams()]
    }

    setSubmitting(true)
    try {
      const result = await api.post<GenerateResponse>(`/wells/${wellId}/trajectories/generate`, {
        mode: 'manual',
        kop: kop ?? undefined,
        build_rate: buildRate,
        sections,
      })
      const stations = result.trajectory?.survey_stations ?? []
      onTrajectoryGenerated?.(stations)
      if (result.validation_errors?.length) {
        setSubmitError(result.validation_errors.join(' '))
        return
      }
      if (result.info_messages?.length) {
        for (const message of result.info_messages) {
          window.alert(message)
        }
      }
      onOpenChange(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to generate trajectory')
    } finally {
      setSubmitting(false)
    }
  }

  function updateBuildParam(key: keyof BuildParams, value: string) {
    setBuildParams((current) => {
      const next = { ...current, [key]: value }

      if (key === 'inclination' && hasValue(next.inclination) && hasValue(next.azimuth)) {
        next.tvd = ''
      }
      if (key === 'tvd' && hasValue(next.tvd) && hasValue(next.azimuth)) {
        next.inclination = ''
      }
      if (key === 'azimuth' && hasValue(next.azimuth)) {
        if (hasValue(next.inclination) && hasValue(next.tvd)) {
          next.tvd = ''
        } else if (hasValue(next.inclination)) {
          next.tvd = ''
        } else if (hasValue(next.tvd)) {
          next.inclination = ''
        }
      }

      return next
    })
  }

  const buildLocks = getBuildParamLocks(buildParams)
  const holdLocks = getHoldParamLocks(holdParams)

  function updateHoldParam(key: keyof HoldParams, value: string) {
    setHoldParams((current) => {
      const next = { ...current, [key]: value }
      if (key === 'tangentLength' && hasValue(next.tangentLength)) {
        next.tvd = ''
      }
      if (key === 'tvd' && hasValue(next.tvd)) {
        next.tangentLength = ''
      }
      return next
    })
  }

  function selectAction(value: string) {
    setSelectedAction(value)
    setSelectedBearingMode(null)
    setSubmitError('')

    if (value === 'change-bearing' || value === 'hold' || value === 'build-hold') {
      setStepIndex(1)
      return
    }

    setStepIndex(0)
    if (value === 'generate') {
      setSubmitError('Generate full trajectory is not connected to the engine yet.')
    }
  }

  function selectBearingMode(value: string) {
    setSelectedBearingMode(value)
    setSubmitError('')
    setStepIndex(2)
  }

  function goNext() {
    if (!currentStep) return
    if (
      !stepIsComplete(
        currentStep,
        selectedAction,
        selectedBearingMode,
        buildParams,
        holdParams,
        buildHoldParams,
        curveHoldCurveParams,
      )
    ) {
      setSubmitError('Complete the required fields before continuing.')
      return
    }
    setSubmitError('')
    if (isLastStep) {
      void handleSubmit()
      return
    }
    setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  function goPrevious() {
    setSubmitError('')
    setStepIndex((index) => Math.max(index - 1, 0))
  }

  if (!open || typeof document === 'undefined' || !currentStep) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="trajectory-actions-title"
      aria-describedby="trajectory-actions-description"
      className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(36rem,calc(100dvh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl outline-none"
      style={{
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
      }}
    >
      <div className="relative shrink-0 border-b border-border bg-muted/40">
        <div
          className="cursor-grab touch-none px-4 py-3 pr-12 active:cursor-grabbing"
          onPointerDown={onDragHandlePointerDown}
          onPointerMove={onDragHandlePointerMove}
          onPointerUp={onDragHandlePointerUp}
          onPointerCancel={onDragHandlePointerUp}
        >
          <div className="flex items-start gap-2">
            <GripVertical
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2
                id="trajectory-actions-title"
                className="text-base font-semibold leading-none tracking-tight"
              >
                Trajectory Actions
              </h2>
              <p
                id="trajectory-actions-description"
                className="mt-1.5 text-sm text-muted-foreground"
              >
                Drag the header to move this panel. Choose an action to continue.
              </p>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute top-2.5 right-3 size-8"
          aria-label="Close actions"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <p className="text-sm font-medium text-muted-foreground tabular-nums">
          Step {stepIndex + 1} of {totalSteps}
        </p>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h3 className="text-base font-semibold text-pretty leading-none">{currentStep.prompt}</h3>
            <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{currentStep.description}</p>
          </div>

          {currentStep.id === 'action' ? (
            <div className="grid min-w-0 gap-2">
              {currentStep.choices.map((choice) => {
                const selected = selectedAction === choice.value
                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => selectAction(choice.value)}
                    className={cn(
                      'flex min-h-9 w-full cursor-pointer items-center rounded-lg border border-input bg-background px-3 py-2 text-start shadow-xs transition-colors outline-none select-none',
                      'hover:bg-accent/40',
                      selected && 'border-primary bg-primary/5',
                    )}
                  >
                    <span className="text-xs font-medium leading-snug">{choice.label}</span>
                  </button>
                )
              })}
            </div>
          ) : null}

          {currentStep.id === 'change-bearing-mode' ? (
            <TooltipProvider delayDuration={200}>
              <div className="grid min-w-0 grid-cols-3 gap-2">
                {currentStep.choices.map((choice) => {
                  const selected = selectedBearingMode === choice.value
                  return (
                    <Tooltip key={choice.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={choice.label}
                          onClick={() => selectBearingMode(choice.value)}
                          className={cn(
                            'flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-input bg-background px-2 py-4 text-center shadow-xs transition-colors outline-none select-none',
                            'hover:bg-accent/40',
                            selected && 'border-primary bg-primary/5',
                          )}
                        >
                          {choice.imageSrc ? (
                            <img
                              src={choice.imageSrc}
                              alt=""
                              aria-hidden="true"
                              className="size-8 shrink-0 object-contain dark:invert"
                            />
                          ) : null}
                          <span className="sr-only">{choice.label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{choice.label}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </TooltipProvider>
          ) : null}

          {currentStep.id === 'build-params' ? (
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="build-dls">DLS</FieldLabel>
                <Input
                  id="build-dls"
                  name="dls"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 2"
                  value={buildParams.dls}
                  onChange={(event) => updateBuildParam('dls', event.target.value)}
                />
              </Field>
              <Field data-disabled={buildLocks.inclinationDisabled || undefined}>
                <FieldLabel htmlFor="build-inclination">Inclination</FieldLabel>
                <Input
                  id="build-inclination"
                  name="inclination"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 30"
                  value={buildParams.inclination}
                  disabled={buildLocks.inclinationDisabled}
                  onChange={(event) => updateBuildParam('inclination', event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="build-azimuth">Azimuth</FieldLabel>
                <Input
                  id="build-azimuth"
                  name="azimuth"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 90"
                  value={buildParams.azimuth}
                  onChange={(event) => updateBuildParam('azimuth', event.target.value)}
                />
              </Field>
              <Field data-disabled={buildLocks.tvdDisabled || undefined}>
                <FieldLabel htmlFor="build-tvd">TVD</FieldLabel>
                <Input
                  id="build-tvd"
                  name="tvd"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 1500"
                  value={buildParams.tvd}
                  disabled={buildLocks.tvdDisabled}
                  onChange={(event) => updateBuildParam('tvd', event.target.value)}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {currentStep.id === 'build-hold-params' ? (
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="build-hold-dls">DLS</FieldLabel>
                <Input
                  id="build-hold-dls"
                  name="dls"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 2"
                  value={buildHoldParams.dls}
                  onChange={(event) =>
                    setBuildHoldParams((current) => ({
                      ...current,
                      dls: event.target.value,
                    }))
                  }
                />
              </Field>
            </FieldGroup>
          ) : null}

          {currentStep.id === 'curve-hold-curve-params' ? (
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="curve-hold-curve-dls1">DLS for curve 1</FieldLabel>
                <Input
                  id="curve-hold-curve-dls1"
                  name="dls1"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 2"
                  value={curveHoldCurveParams.dls1}
                  onChange={(event) =>
                    setCurveHoldCurveParams((current) => ({
                      ...current,
                      dls1: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="curve-hold-curve-dls2">DLS for curve 2</FieldLabel>
                <Input
                  id="curve-hold-curve-dls2"
                  name="dls2"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 2"
                  value={curveHoldCurveParams.dls2}
                  onChange={(event) =>
                    setCurveHoldCurveParams((current) => ({
                      ...current,
                      dls2: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="curve-hold-curve-target">Target</FieldLabel>
                <NativeSelect
                  id="curve-hold-curve-target"
                  name="target"
                  value={curveHoldCurveParams.targetIndex}
                  onChange={(event) => {
                    const targetIndex = event.target.value
                    setCurveHoldCurveParams((current) => ({
                      ...current,
                      targetIndex,
                      alignAlongIndex:
                        current.alignAlongIndex === targetIndex ? '' : current.alignAlongIndex,
                    }))
                  }}
                >
                  <NativeSelectOption value="">Select a target</NativeSelectOption>
                  {targets.map((target, index) => (
                    <NativeSelectOption key={`${target.name}-${index}`} value={String(index)}>
                      {targetOptionLabel(target, index)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="curve-hold-curve-align-along">Align along</FieldLabel>
                <NativeSelect
                  id="curve-hold-curve-align-along"
                  name="align_along"
                  value={curveHoldCurveParams.alignAlongIndex}
                  onChange={(event) => {
                    const alignAlongIndex = event.target.value
                    setCurveHoldCurveParams((current) => ({
                      ...current,
                      alignAlongIndex,
                      inclination: alignAlongIndex ? '' : current.inclination,
                      azimuth: alignAlongIndex ? '' : current.azimuth,
                    }))
                  }}
                >
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {targets
                    .map((target, index) => ({ target, index }))
                    .filter(({ index }) => String(index) !== curveHoldCurveParams.targetIndex)
                    .map(({ target, index }) => (
                      <NativeSelectOption key={`${target.name}-${index}`} value={String(index)}>
                        {targetOptionLabel(target, index)}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
              <Field
                data-disabled={hasValue(curveHoldCurveParams.alignAlongIndex) || undefined}
              >
                <FieldLabel htmlFor="curve-hold-curve-inclination">Inclination</FieldLabel>
                <Input
                  id="curve-hold-curve-inclination"
                  name="inclination"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder={
                    hasValue(curveHoldCurveParams.alignAlongIndex) ? 'Auto' : 'e.g. 90'
                  }
                  value={curveHoldCurveParams.inclination}
                  disabled={hasValue(curveHoldCurveParams.alignAlongIndex)}
                  onChange={(event) =>
                    setCurveHoldCurveParams((current) => ({
                      ...current,
                      inclination: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                data-disabled={hasValue(curveHoldCurveParams.alignAlongIndex) || undefined}
              >
                <FieldLabel htmlFor="curve-hold-curve-azimuth">Azimuth</FieldLabel>
                <Input
                  id="curve-hold-curve-azimuth"
                  name="azimuth"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder={
                    hasValue(curveHoldCurveParams.alignAlongIndex) ? 'Auto' : 'e.g. 90'
                  }
                  value={curveHoldCurveParams.azimuth}
                  disabled={hasValue(curveHoldCurveParams.alignAlongIndex)}
                  onChange={(event) =>
                    setCurveHoldCurveParams((current) => ({
                      ...current,
                      azimuth: event.target.value,
                    }))
                  }
                />
              </Field>
            </FieldGroup>
          ) : null}

          {currentStep.id === 'hold-params' ? (
            <FieldGroup className="gap-3">
              <Field data-disabled={holdLocks.tangentDisabled || undefined}>
                <FieldLabel htmlFor="hold-tangent-length">Tangent Length</FieldLabel>
                <Input
                  id="hold-tangent-length"
                  name="tangent_length"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 500"
                  value={holdParams.tangentLength}
                  disabled={holdLocks.tangentDisabled}
                  onChange={(event) => updateHoldParam('tangentLength', event.target.value)}
                />
              </Field>
              <Field data-disabled={holdLocks.tvdDisabled || undefined}>
                <FieldLabel htmlFor="hold-upto-tvd">Hold up to TVD</FieldLabel>
                <Input
                  id="hold-upto-tvd"
                  name="tvd"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 5000"
                  value={holdParams.tvd}
                  disabled={holdLocks.tvdDisabled}
                  onChange={(event) => updateHoldParam('tvd', event.target.value)}
                />
              </Field>
            </FieldGroup>
          ) : null}
        </div>

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <div className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="col-start-1 justify-self-start"
            disabled={stepIndex === 0}
            onClick={goPrevious}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="default"
            className="col-start-3 justify-self-end"
            disabled={submitting}
            onClick={goNext}
          >
            {submitting ? 'Generating...' : isLastStep ? 'Submit' : 'Next'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** @deprecated Use TrajectoryActionsTrigger + TrajectoryActionsDrawer */
export function TrajectoryActionsQuestionnaire(props: ActionsProps) {
  return (
    <>
      <TrajectoryActionsTrigger {...props} />
      <TrajectoryActionsDrawer {...props} />
    </>
  )
}
