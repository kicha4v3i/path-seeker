import { DEFAULT_SURVEY_ROW, type SurveyRow } from '@/components/trajectory/survey-columns'
import type { SurveyStation, Well } from '@/lib/api'
import { toGeographicCoordinate, toLocalCoordinate } from '@/lib/utils'

export function buildSurveyStations(_well: Well | null, kop: number | null): SurveyStation[] {
  const stations: SurveyStation[] = [
    { md: 0, inc: 0, azi: 0, tvd: 0, ns: 0, ew: 0, dls: 0, vs: 0 },
  ]

  if (kop != null && kop > 0) {
    stations.push({
      md: kop,
      inc: 0,
      azi: 0,
      tvd: kop,
      ns: 0,
      ew: 0,
      dls: 0,
      vs: 0,
    })
  }

  return stations
}

/** Shift survey N/E so MD=0 matches the well surface (handles legacy 0,0 surface rows). */
export function alignSurveyStationsToWellSurface(
  stations: SurveyStation[],
  well: Well | null,
): SurveyStation[] {
  if (!stations.length || well?.northing == null || well.easting == null) {
    return stations
  }

  const anchorNs = stations[0].ns
  const anchorEw = stations[0].ew
  const dn = well.northing - anchorNs
  const de = well.easting - anchorEw
  if (Math.abs(dn) < 1e-9 && Math.abs(de) < 1e-9) {
    return stations
  }

  return stations.map((station, index) => {
    const ew = station.ew + de
    const next: SurveyStation = {
      ...station,
      ns: station.ns + dn,
      ew,
      vs: ew,
    }
    if (index === 0) {
      next.ns = well.northing!
      next.ew = well.easting!
      next.vs = well.easting!
    }
    return next
  })
}

/** Geographic survey stations from API → local north/east (active working values). */
export function surveyStationsToLocal(
  stations: SurveyStation[],
  well: Well | null,
  unitSystem: string,
): SurveyStation[] {
  if (!stations.length || well?.northing == null || well.easting == null) {
    return stations
  }

  return stations.map((station) => {
    if (station.md === 0) {
      return { ...station, ns: 0, ew: 0, vs: 0 }
    }

    const ns = toLocalCoordinate(station.ns, well.northing!, unitSystem)
    const ew = toLocalCoordinate(station.ew, well.easting!, unitSystem)
    return { ...station, ns, ew, vs: ew }
  })
}

/** Local survey stations → geographic meters for API persistence. */
export function surveyStationsToGeographic(
  stations: SurveyStation[],
  well: Well | null,
  unitSystem: string,
): SurveyStation[] {
  if (!stations.length || well?.northing == null || well.easting == null) {
    return stations
  }

  return stations.map((station) => {
    if (station.md === 0) {
      return {
        ...station,
        ns: well.northing!,
        ew: well.easting!,
        vs: well.easting!,
      }
    }

    const ns = toGeographicCoordinate(station.ns, well.northing!, unitSystem)
    const ew = toGeographicCoordinate(station.ew, well.easting!, unitSystem)
    return { ...station, ns, ew, vs: ew }
  })
}

export function buildSurveyRows(kop: number | null): SurveyRow[] {
  const rows: SurveyRow[] = [{ ...DEFAULT_SURVEY_ROW }]
  if (kop != null && kop > 0) {
    rows.push({
      md: kop,
      inc: 0,
      azi: 0,
      tvd: kop,
      dls: 0,
    })
  }
  return rows
}

export function surveyRowsFromStations(stations: SurveyStation[]): SurveyRow[] {
  if (!stations.length) return [{ ...DEFAULT_SURVEY_ROW }]

  return stations.map((station) => ({
    md: station.md,
    inc: station.inc,
    azi: station.azi,
    tvd: station.tvd,
    dls: station.dls,
  }))
}

export function isKopSurveyRow(index: number, kop: number | null) {
  return kop != null && kop > 0 && index === 1
}

/** True when survey data is limited to surface plus an optional KOP row. */
export function isKopOnlySurvey(stations: SurveyStation[], kop: number | null) {
  if (kop == null || kop <= 0) return false
  if (stations.length <= 1) return true
  if (stations.length === 2) return stations[1]?.md === kop
  return false
}
