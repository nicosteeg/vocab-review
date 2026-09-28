import { describe, expect, it } from 'vitest'
import { card, word } from '../test/builders'
import { backupFileName, InvalidBackupError, makeBackup, parseBackup } from './backup'
import type { Snapshot } from './db'

const now = new Date(2026, 8, 7, 10, 0)
const snapshot: Snapshot = {
  words: [word('reach', { fr: ['atteindre', 'parvenir à'] }), word('gone', { status: 'retiré', order: 1 })],
  cards: [card('reach', 'en-fr', { lastReview: '2026-09-01T10:00:00.000Z', due: '2026-09-04T10:00:00.000Z' }), card('reach', 'fr-en')],
  settings: { newPerDay: 12, directions: 'fr-en' },
  syncMeta: { fileId: 'f1', modifiedTime: '2026-09-01T09:00:00.000Z', syncedAt: '2026-09-01T10:00:00.000Z' },
}
const withChange = (change: (b: Record<string, unknown>) => void) => {
  const b = JSON.parse(JSON.stringify(makeBackup(snapshot, now)))
  change(b)
  return JSON.stringify(b)
}

describe('sauvegarde', () => {
  it('relit à l’identique ce qu’elle a exporté', () => {
    const text = JSON.stringify(makeBackup(snapshot, now))
    expect(parseBackup(text)).toEqual(snapshot)
  })

  it('accepte une sauvegarde sans infos de synchro', () => {
    const text = JSON.stringify(makeBackup({ ...snapshot, syncMeta: null }, now))
    expect(parseBackup(text).syncMeta).toBeNull()
  })

  it('lit une ancienne sauvegarde sans sens de révision comme « les deux »', () => {
    const text = withChange((b) => delete (b.settings as Record<string, unknown>).directions)
    expect(parseBackup(text).settings).toEqual({ newPerDay: 12, directions: 'both' })
  })

  it('nomme le fichier avec la date locale', () => {
    expect(backupFileName(now)).toBe('vocab-review-2026-09-07.json')
  })

  it.each([
    ['du texte qui n’est pas du JSON', 'pas du json'],
    ['un autre fichier JSON', JSON.stringify({ hello: 'world' })],
    ['une version inconnue', withChange((b) => (b.version = 2))],
    ['un mot sans traductions', withChange((b) => ((b.words as Record<string, unknown>[])[0].fr = 'atteindre'))],
    ['un statut inconnu', withChange((b) => ((b.words as Record<string, unknown>[])[0].status = 'archivé'))],
    ['une carte sans date due', withChange((b) => delete (b.cards as { fsrs: Record<string, unknown> }[])[0].fsrs.due)],
    ['un sens de carte inconnu', withChange((b) => ((b.cards as Record<string, unknown>[])[0].direction = 'es-fr'))],
    ['des réglages absents', withChange((b) => delete b.settings)],
    ['un sens de révision inconnu', withChange((b) => ((b.settings as Record<string, unknown>).directions = 'es-fr'))],
  ])('refuse %s', (_label, text) => {
    expect(() => parseBackup(text)).toThrow(InvalidBackupError)
  })
})
