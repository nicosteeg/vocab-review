import { isNew } from './scheduler'
import { studyDay } from './studyDay'
import type { Settings, StoredCard, Word } from './types'

export type QueueInput = { words: Word[]; cards: StoredCard[]; settings: Settings; now: Date }

const sameDay = (iso: string | undefined, today: string) => iso !== undefined && studyDay(new Date(iso)) === today

/**
 * Cartes de la prochaine session : d'abord les cartes dues (les plus en retard d'abord),
 * puis les nouvelles dans la limite du jour. Au plus une carte par mot, et aucune carte
 * d'un mot dont l'autre sens a déjà été révisé ce jour d'étude.
 */
export function buildQueue({ words, cards, settings, now }: QueueInput): StoredCard[] {
  const today = studyDay(now)
  const active = new Map(words.filter((w) => w.status === 'actif').map((w) => [w.key, w]))
  const blocked = new Set(cards.filter((c) => sameDay(c.fsrs.last_review, today)).map((c) => c.wordKey))
  const taken = new Set<string>()
  const queue: StoredCard[] = []

  const due = cards
    .filter((c) => active.has(c.wordKey) && !blocked.has(c.wordKey) && !isNew(c.fsrs))
    .filter((c) => studyDay(new Date(c.fsrs.due)) <= today)
    .sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due))
  for (const c of due) {
    if (taken.has(c.wordKey)) continue
    taken.add(c.wordKey)
    queue.push(c)
  }

  const introducedToday = cards.filter((c) => sameDay(c.introducedAt, today)).length
  let remaining = Math.max(0, settings.newPerDay - introducedToday)
  const byWord = new Map<string, Partial<Record<StoredCard['direction'], StoredCard>>>()
  for (const c of cards) byWord.set(c.wordKey, { ...byWord.get(c.wordKey), [c.direction]: c })

  const ordered = [...active.values()].sort((a, b) => a.order - b.order)
  for (const word of ordered) {
    if (remaining === 0) break
    if (blocked.has(word.key) || taken.has(word.key)) continue
    const pair = byWord.get(word.key)
    const enFr = pair?.['en-fr']
    const frEn = pair?.['fr-en']
    const candidate = enFr && isNew(enFr.fsrs) ? enFr : enFr && frEn && isNew(frEn.fsrs) ? frEn : undefined
    if (!candidate) continue
    taken.add(word.key)
    queue.push(candidate)
    remaining--
  }

  return queue
}
