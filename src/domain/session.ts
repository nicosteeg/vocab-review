import { rate } from './scheduler'
import type { Grade, StoredCard } from './types'

type Snapshot = { queue: StoredCard[]; firstAnswers: Record<string, Grade> }

/**
 * `queue[0]` est la carte affichée. `previous` permet d'annuler la dernière réponse.
 * `practice` (révision libre) : les réponses ne replanifient ni n'enregistrent rien.
 */
export type SessionState = Snapshot & { total: number; practice: boolean; previous?: Snapshot }

/** `save` : carte à écrire en base, s'il y en a une. */
export type Step = { state: SessionState; save?: StoredCard }

export function startSession(queue: StoredCard[], options: { practice?: boolean } = {}): SessionState {
  return { queue, firstAnswers: {}, total: queue.length, practice: options.practice ?? false }
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
  const reschedule = isFirst && !state.practice
  const updated = reschedule
    ? { ...card, fsrs: rate(card.fsrs, grade, now), introducedAt: card.introducedAt ?? now.toISOString() }
    : card
  return {
    state: {
      queue: grade === 'su' ? rest : [...rest, updated],
      firstAnswers: isFirst ? { ...state.firstAnswers, [card.id]: grade } : state.firstAnswers,
      total: state.total,
      practice: state.practice,
      previous: { queue: state.queue, firstAnswers: state.firstAnswers },
    },
    save: reschedule ? updated : undefined,
  }
}

export function canUndo(state: SessionState): boolean {
  return state.previous !== undefined
}

/** Annule la dernière réponse ; `save` remet la carte en base dans son état d'avant. */
export function undo(state: SessionState): Step {
  if (!state.previous) return { state }
  const { queue, firstAnswers } = state.previous
  return { state: { queue, firstAnswers, total: state.total, practice: state.practice }, save: state.practice ? undefined : queue[0] }
}

export function progress(state: SessionState): { done: number; total: number } {
  return { done: state.total - state.queue.length, total: state.total }
}

export function summary(state: SessionState): { total: number; percent: number } {
  const answers = Object.values(state.firstAnswers)
  const known = answers.filter((g) => g === 'su').length
  return { total: state.total, percent: answers.length === 0 ? 0 : Math.round((known / answers.length) * 100) }
}
