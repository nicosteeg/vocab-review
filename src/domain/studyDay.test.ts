import { describe, expect, it } from 'vitest'
import { studyDay } from './studyDay'

describe('studyDay', () => {
  it('compte encore pour la veille avant 4 h du matin', () => {
    expect(studyDay(new Date(2026, 8, 27, 3, 59))).toBe('2026-09-26')
  })

  it('bascule sur le jour même à 4 h pile', () => {
    expect(studyDay(new Date(2026, 8, 27, 4, 0))).toBe('2026-09-27')
  })

  it('reste sur le même jour jusqu’à minuit', () => {
    expect(studyDay(new Date(2026, 8, 27, 23, 59))).toBe('2026-09-27')
  })

  it('complète mois et jour sur deux chiffres', () => {
    expect(studyDay(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})
