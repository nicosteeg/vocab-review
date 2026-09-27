import { cardId, normalizeText } from './keys'
import { newFsrsState } from './scheduler'
import type { Pair, StoredCard, Word } from './types'

export type MergeStats = { added: number; removed: number; restored: number }
export type MergeResult = { words: Word[]; newCards: StoredCard[]; stats: MergeStats }

type Group = { en: string; fr: string[] }

function groupPairs(pairs: Pair[]): Map<string, Group> {
  const groups = new Map<string, Group>()
  for (const pair of pairs) {
    const key = normalizeText(pair.en)
    const group = groups.get(key) ?? { en: pair.en.trim().replace(/\s+/g, ' '), fr: [] }
    const fr = pair.fr.trim().replace(/\s+/g, ' ')
    if (!group.fr.some((existing) => normalizeText(existing) === normalizeText(fr))) group.fr.push(fr)
    groups.set(key, group)
  }
  return groups
}

/**
 * Fusionne l'export (reflet exact de la liste Google Translate) avec les mots connus.
 * Renvoie tous les mots à jour et uniquement les cartes à créer ; les cartes existantes ne changent pas.
 */
export function mergeImport(words: Word[], pairs: Pair[], now: Date): MergeResult {
  const groups = groupPairs(pairs)
  const stats: MergeStats = { added: 0, removed: 0, restored: 0 }
  const newCards: StoredCard[] = []
  let nextOrder = words.reduce((max, w) => Math.max(max, w.order), -1) + 1

  const updated = words.map((word): Word => {
    const group = groups.get(word.key)
    if (!group) {
      if (word.status === 'actif') stats.removed++
      return { ...word, status: 'retiré' }
    }
    if (word.status === 'retiré') stats.restored++
    return { ...word, fr: group.fr, status: 'actif' }
  })

  const known = new Set(words.map((w) => w.key))
  for (const [key, group] of groups) {
    if (known.has(key)) continue
    updated.push({ key, en: group.en, fr: group.fr, status: 'actif', addedAt: now.toISOString(), order: nextOrder++ })
    for (const direction of ['en-fr', 'fr-en'] as const) {
      newCards.push({ id: cardId(key, direction), wordKey: key, direction, fsrs: newFsrsState(now) })
    }
    stats.added++
  }

  return { words: updated, newCards, stats }
}
