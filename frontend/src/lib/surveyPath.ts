import type { SurveyStation } from '@/lib/api'

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

function direction(inc: number, azi: number): [number, number, number] {
  const incR = inc * DEG2RAD
  const aziR = azi * DEG2RAD
  return [
    Math.sin(incR) * Math.cos(aziR),
    Math.sin(incR) * Math.sin(aziR),
    Math.cos(incR),
  ]
}

function doglegAngle(inc1: number, azi1: number, inc2: number, azi2: number) {
  const t1 = direction(inc1, azi1)
  const t2 = direction(inc2, azi2)
  const cosA = Math.max(
    -1,
    Math.min(1, t1[0] * t2[0] + t1[1] * t2[1] + t1[2] * t2[2]),
  )
  return Math.acos(cosA)
}

function rf(angle: number) {
  if (Math.abs(angle) < 1e-12) return 1
  return Math.tan(angle / 2) / (angle / 2)
}

function attitudeFromDirection(tx: number, ty: number, tz: number) {
  const horizontal = Math.hypot(tx, ty)
  const inclination = Math.atan2(horizontal, tz) * RAD2DEG
  const azimuth = (((Math.atan2(ty, tx) * RAD2DEG) % 360) + 360) % 360
  return { inclination, azimuth }
}

/**
 * Densify section-end survey stations for chart display (mirrors backend survey_data).
 */
export function densifySurveyPath(
  stations: SurveyStation[],
  step = 100,
): SurveyStation[] {
  if (stations.length < 2 || step <= 0) return stations

  const out: SurveyStation[] = [stations[0]]

  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i]
    const to = stations[i + 1]
    const span = to.md - from.md
    if (span <= 1e-9) {
      out.push(to)
      continue
    }

    const t1 = direction(from.inc, from.azi)
    const t2 = direction(to.inc, to.azi)
    const alpha = doglegAngle(from.inc, from.azi, to.inc, to.azi)

    let mdStart = from.md - (from.md % step) + step
    if (mdStart <= from.md + 1e-9) mdStart += step

    for (let md = mdStart; md < to.md - 1e-9; md += step) {
      const frac = (md - from.md) / span
      const ai = frac * alpha
      let north: number
      let east: number
      let tvd: number
      let ti: [number, number, number]

      if (alpha < 1e-12) {
        ti = [
          t1[0] + frac * (t2[0] - t1[0]),
          t1[1] + frac * (t2[1] - t1[1]),
          t1[2] + frac * (t2[2] - t1[2]),
        ]
        const course = md - from.md
        north = from.ns + course * t1[0]
        east = from.ew + course * t1[1]
        tvd = from.tvd + course * t1[2]
      } else {
        const sinAlpha = Math.sin(alpha)
        ti = [
          (Math.sin(alpha - ai) / sinAlpha) * t1[0] + (Math.sin(ai) / sinAlpha) * t2[0],
          (Math.sin(alpha - ai) / sinAlpha) * t1[1] + (Math.sin(ai) / sinAlpha) * t2[1],
          (Math.sin(alpha - ai) / sinAlpha) * t1[2] + (Math.sin(ai) / sinAlpha) * t2[2],
        ]
        const course = md - from.md
        const ratio = rf(ai)
        north = from.ns + (course * ratio) / 2 * (t1[0] + ti[0])
        east = from.ew + (course * ratio) / 2 * (t1[1] + ti[1])
        tvd = from.tvd + (course * ratio) / 2 * (t1[2] + ti[2])
      }

      const { inclination, azimuth } = attitudeFromDirection(ti[0], ti[1], ti[2])
      out.push({
        md,
        inc: inclination,
        azi: azimuth,
        tvd,
        ns: north,
        ew: east,
        dls: 0,
        vs: east,
      })
    }

    out.push(to)
  }

  return out
}
