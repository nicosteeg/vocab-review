const CUTOFF_HOURS = 4

/** Jour d'étude local au format AAAA-MM-JJ ; un jour commence à 4 h du matin. */
export function studyDay(date: Date): string {
  const shifted = new Date(date.getTime() - CUTOFF_HOURS * 3_600_000)
  const month = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${shifted.getFullYear()}-${month}-${day}`
}
