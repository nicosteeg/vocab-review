export type CardDirection = 'en-fr' | 'fr-en'
export type WordStatus = 'actif' | 'retiré'
export type Grade = 'su' | 'pas-su'

export type Word = {
  key: string
  en: string
  fr: string[]
  status: WordStatus
  addedAt: string
  order: number
}

/** État ts-fsrs sérialisable en JSON (dates au format ISO). */
export type FsrsState = {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string
}

export type StoredCard = {
  id: string
  wordKey: string
  direction: CardDirection
  fsrs: FsrsState
  introducedAt?: string
}

/** Sens révisés : les deux, ou un seul. */
export type Directions = 'both' | CardDirection
export const DIRECTIONS: readonly Directions[] = ['both', 'en-fr', 'fr-en']

export type Settings = { newPerDay: number; directions: Directions }
export const DEFAULT_SETTINGS: Settings = { newPerDay: 10, directions: 'both' }

export type SyncMeta = { fileId: string; modifiedTime: string; syncedAt: string }

export type Pair = { en: string; fr: string }
