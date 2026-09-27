import { describe, expect, it } from 'vitest'
import { isNew, newFsrsState, rate } from './scheduler'

const now = new Date('2026-09-27T10:00:00.000Z')
const DAY = 86_400_000
const dueIn = (due: string) => new Date(due).getTime() - now.getTime()

describe('scheduler', () => {
  it('crée une carte nouvelle, due tout de suite', () => {
    const state = newFsrsState(now)
    expect(isNew(state)).toBe(true)
    expect(state.due).toBe(now.toISOString())
    expect(state.last_review).toBeUndefined()
  })

  it('« Pas su » sur une carte nouvelle la reprogramme au lendemain', () => {
    const next = rate(newFsrsState(now), 'pas-su', now)
    expect(isNew(next)).toBe(false)
    expect(dueIn(next.due)).toBe(DAY)
    expect(next.last_review).toBe(now.toISOString())
  })

  it('« Su » donne un intervalle plus long que « Pas su », d’au moins 2 jours', () => {
    const su = rate(newFsrsState(now), 'su', now)
    const pasSu = rate(newFsrsState(now), 'pas-su', now)
    expect(dueIn(su.due)).toBeGreaterThanOrEqual(2 * DAY)
    expect(dueIn(su.due)).toBeGreaterThan(dueIn(pasSu.due))
  })

  it('fonctionne sur un état relu depuis du JSON', () => {
    const first = rate(newFsrsState(now), 'su', now)
    const later = new Date(first.due)
    const reread = JSON.parse(JSON.stringify(first))
    const second = rate(reread, 'su', later)
    expect(new Date(second.due).getTime()).toBeGreaterThan(later.getTime() + 3 * DAY)
  })
})
