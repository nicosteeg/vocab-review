import { createEmptyCard, fsrs, Rating, State, type Card } from 'ts-fsrs'
import type { FsrsState, Grade } from './types'

// Pas d'étapes d'apprentissage en minutes : un mot raté revient le lendemain,
// la répétition immédiate est gérée par la session (voir session.ts).
const scheduler = fsrs({ enable_short_term: false })

function fromCard(card: Card): FsrsState {
  const { due, last_review, ...rest } = card
  return {
    ...rest,
    due: due.toISOString(),
    ...(last_review ? { last_review: last_review.toISOString() } : {}),
  }
}

export function newFsrsState(now: Date): FsrsState {
  return fromCard(createEmptyCard(now))
}

export function rate(state: FsrsState, grade: Grade, now: Date): FsrsState {
  const rating = grade === 'su' ? Rating.Good : Rating.Again
  return fromCard(scheduler.next(state, now, rating).card)
}

export function isNew(state: FsrsState): boolean {
  return state.state === State.New
}
