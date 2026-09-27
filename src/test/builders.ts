import { cardId } from '../domain/keys'
import { newFsrsState } from '../domain/scheduler'
import type { CardDirection, StoredCard, Word } from '../domain/types'

export function word(key: string, overrides: Partial<Word> = {}): Word {
  return { key, en: key, fr: [`${key}-fr`], status: 'actif', addedAt: '2026-09-01T10:00:00.000Z', order: 0, ...overrides }
}

type CardOptions = { due?: string; lastReview?: string; introducedAt?: string }

/** Carte nouvelle si aucune option ; carte déjà révisée si `lastReview` est donné. */
export function card(key: string, direction: CardDirection, options: CardOptions = {}): StoredCard {
  const base = newFsrsState(new Date('2026-09-01T10:00:00.000Z'))
  const reviewed = options.lastReview !== undefined
  return {
    id: cardId(key, direction),
    wordKey: key,
    direction,
    fsrs: {
      ...base,
      ...(reviewed ? { state: 2, stability: 3, difficulty: 5, reps: 1, scheduled_days: 3, last_review: options.lastReview } : {}),
      due: options.due ?? base.due,
    },
    ...(options.introducedAt ? { introducedAt: options.introducedAt } : reviewed ? { introducedAt: options.lastReview } : {}),
  }
}
