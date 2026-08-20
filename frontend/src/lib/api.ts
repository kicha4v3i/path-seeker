const API_URL = import.meta.env.VITE_API_URL || '/api'

function getToken(): string | null {
  if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    return (window as unknown as { __clerk_token?: string }).__clerk_token ?? null
  }
  return 'dev-token'
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = err.detail
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ')
      : typeof detail === 'string'
        ? detail
        : err.error || res.statusText || 'Request failed'
    throw new Error(message)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export type Project = {
  _id?: string
  id?: string
  name: string
  location_country: string
  environment: string
  ground_level_elevation?: number | null
  water_depth?: number | null
  block: string
  field: string
  coordinate_system: string
  projection_system: string
  datum: string
  unit_system?: string
}

export function formatEnvironment(env: string) {
  if (!env) return ''
  const lower = env.toLowerCase()
  if (lower === 'onshore') return 'Onshore'
  if (lower === 'offshore') return 'Offshore'
  return env.charAt(0).toUpperCase() + env.slice(1)
}

export type Well = {
  _id?: string
  id?: string
  project_id: string
  name: string
  unit_system: string
  surface_coord_type: string
  latitude?: number | null
  longitude?: number | null
  northing?: number | null
  easting?: number | null
  rkb_to_datum?: number | null
}

export type Formation = {
  formation_name: string
  lithology: string
  tvd_top: number
  tvd_bottom: number
}

export type Target = {
  name: string
  northing: number
  easting: number
  tvdss: number
  tolerance: string
  radius_of_tolerance?: number | null
  major_radius?: number | null
  minor_radius?: number | null
  azimuth?: number | null
}

export type SurveyStation = {
  md: number
  inc: number
  azi: number
  tvd: number
  ns: number
  ew: number
  dls: number
  vs: number
}

export type Trajectory = {
  _id?: string
  id?: string
  well_id: string
  mode?: string
  survey_method?: string
  params?: {
    kop?: number | null
    build_rate?: number | null
    turn_rate?: number | null
    max_dls?: number | null
  }
  survey_stations?: SurveyStation[]
}

export function docId(obj: { _id?: unknown; id?: unknown }) {
  const raw = obj._id ?? obj.id
  if (raw == null) return ''
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object' && raw !== null && '$oid' in raw) {
    return String((raw as { $oid: string }).$oid)
  }
  return String(raw)
}
