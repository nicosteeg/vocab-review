import { rate } from './scheduler'
import type { Grade, StoredCard } from './types'

type Snapshot = { queue: StoredCard[]; firstAnswers: Record<string, Grade> }

/** `queue[0]` est la carte affichée. `previous` permet d'annuler la dernière réponse. */
export type SessionState = Snapshot & { total: number; previous?: Snapshot }

/** `save` : carte à écrire en base, s'il y en a une. */
export type Step = { state: SessionState; save?: StoredCard }

export function startSession(queue: StoredCard[]): SessionState {
  return { queue, firstAnswers: {}, total: queue.length }
}

export function currentCard(state: SessionState): StoredCard | undefined {
  return state.queue[0]
}

/**
 * Seule la première réponse à une carte met à jour sa planification.
 * « Pas su » renvoie la carte en fin de file jusqu'à ce qu'elle soit sue.
 */
export function answer(state: SessionState, grade: Grade, now: Date): Step {
  const [card, ...rest] = state.queue
  if (!card) return { state }
  const isFirst = !(card.id in state.firstAnswers)
  const updated = isFirst
    ? { ...card, fsrs: rate(card.fsrs, grade, now), introducedAt: card.introducedAt ?? now.toISOString() }
    : card
  return {
    state: {
      queue: grade === 'su' ? rest : [...rest, updated],
      firstAnswers: isFirst ? { ...state.firstAnswers, [card.id]: grade } : state.firstAnswers,
      total: state.total,
      previous: { queue: state.queue, firstAnswers: state.firstAnswers },
    },
    save: isFirst ? updated : undefined,
  }
}

export function canUndo(state: SessionState): boolean {
  return state.previous !== undefined
}

/** Annule la dernière réponse ; `save` remet la carte en base dans son état d'avant. */
export function undo(state: SessionState): Step {
  if (!state.previous) return { state }
  const { queue, firstAnswers } = state.previous
  return { state: { queue, firstAnswers, total: state.total }, save: queue[0] }
}

export function progress(state: SessionState): { done: number; total: number } {
  return { done: state.total - state.queue.length, total: state.total }
}

export function summary(state: SessionState): { total: number; percent: number } {
  const answers = Object.values(state.firstAnswers)
  const known = answers.filter((g) => g === 'su').length
  return { total: state.total, percent: answers.length === 0 ? 0 : Math.round((known / answers.length) * 100) }
}
