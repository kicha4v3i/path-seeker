export type ChartViewAlignment = 'default' | 'top' | 'section-east' | 'section-north'

export type SceneCamera = {
  eye: { x: number; y: number; z: number }
  center: { x: number; y: number; z: number }
  up: { x: number; y: number; z: number }
}

/** Plotly scene camera presets aligned to chart axes (X = East, Y = North, Z = TVD). */
export const CHART_VIEW_CAMERAS: Record<ChartViewAlignment, SceneCamera> = {
  default: {
    eye: { x: 1.6, y: 1.6, z: 1.1 },
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  },
  top: {
    eye: { x: 0, y: 0, z: 2.2 },
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  },
  'section-east': {
    eye: { x: 0, y: 2.2, z: 0 },
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  },
  'section-north': {
    eye: { x: 2.2, y: 0, z: 0 },
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  },
}

export const CHART_VIEW_LABELS: Record<ChartViewAlignment, string> = {
  default: '3D',
  top: 'Top',
  'section-east': 'E-Section',
  'section-north': 'N-Section',
}

type PlotlyStatic = {
  relayout: (root: HTMLElement, update: Record<string, unknown>) => Promise<unknown>
}

type PlotlyGraphDiv = HTMLElement & {
  _fullLayout?: {
    scene?: {
      camera?: SceneCamera
    }
  }
}

let plotlyPromise: Promise<PlotlyStatic> | null = null

function loadPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js/dist/plotly').then((mod) => mod.default as PlotlyStatic)
  }
  return plotlyPromise
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function lerpVec3(
  start: SceneCamera['eye'],
  end: SceneCamera['eye'],
  progress: number,
) {
  return {
    x: lerp(start.x, end.x, progress),
    y: lerp(start.y, end.y, progress),
    z: lerp(start.z, end.z, progress),
  }
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}

export function readSceneCamera(graphDiv: HTMLElement): SceneCamera | null {
  const camera = (graphDiv as PlotlyGraphDiv)._fullLayout?.scene?.camera
  if (!camera?.eye || !camera.center || !camera.up) return null

  return {
    eye: { x: camera.eye.x, y: camera.eye.y, z: camera.eye.z },
    center: { x: camera.center.x, y: camera.center.y, z: camera.center.z },
    up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
  }
}

export async function setSceneCamera(graphDiv: HTMLElement, camera: SceneCamera) {
  const Plotly = await loadPlotly()
  return Plotly.relayout(graphDiv, { 'scene.camera': camera })
}

export function animateSceneCamera(
  graphDiv: HTMLElement,
  target: SceneCamera,
  options: { duration?: number; onComplete?: (camera: SceneCamera) => void } = {},
) {
  const duration = options.duration ?? 600
  let frameId = 0
  let cancelled = false
  let plotly: PlotlyStatic | null = null

  const cancel = () => {
    cancelled = true
    if (frameId) cancelAnimationFrame(frameId)
  }

  void loadPlotly().then((loaded) => {
    if (cancelled) return

    plotly = loaded
    const start = readSceneCamera(graphDiv) ?? target
    const startTime = performance.now()

    const step = (now: number) => {
      if (cancelled || !plotly) return

      const progress = easeInOutCubic(Math.min(1, (now - startTime) / duration))
      const camera = {
        eye: lerpVec3(start.eye, target.eye, progress),
        center: lerpVec3(start.center, target.center, progress),
        up: lerpVec3(start.up, target.up, progress),
      }

      void plotly.relayout(graphDiv, { 'scene.camera': camera })

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        options.onComplete?.(camera)
      }
    }

    frameId = requestAnimationFrame(step)
  })

  return cancel
}
