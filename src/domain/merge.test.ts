import { describe, expect, it } from 'vitest'
import { word } from '../test/builders'
import { mergeImport } from './merge'
import { isNew } from './scheduler'

const now = new Date('2026-09-27T10:00:00.000Z')

describe('mergeImport', () => {
  it('crée un mot actif et ses deux cartes nouvelles pour une paire inconnue', () => {
    const result = mergeImport([], [{ en: 'reach', fr: 'atteindre' }], now)
    expect(result.words).toEqual([
      { key: 'reach', en: 'reach', fr: ['atteindre'], status: 'actif', addedAt: now.toISOString(), order: 0 },
    ])
    expect(result.newCards.map((c) => c.id)).toEqual(['reach:en-fr', 'reach:fr-en'])
    expect(result.newCards.every((c) => isNew(c.fsrs) && c.wordKey === 'reach')).toBe(true)
    expect(result.stats).toEqual({ added: 1, removed: 0, restored: 0 })
  })

  it('regroupe les paires de même mot anglais et dédoublonne les traductions', () => {
    const result = mergeImport(
      [],
      [
        { en: 'Reach', fr: 'atteindre' },
        { en: '  reach ', fr: 'parvenir à' },
        { en: 'REACH', fr: 'Atteindre' },
      ],
      now,
    )
    expect(result.words).toHaveLength(1)
    expect(result.words[0]).toMatchObject({ key: 'reach', en: 'Reach', fr: ['atteindre', 'parvenir à'] })
    expect(result.newCards).toHaveLength(2)
  })

  it('garde la progression d’un mot connu et remplace ses traductions par celles de l’export', () => {
    const known = word('reach', { fr: ['atteindre', 'ancienne'], order: 4, addedAt: '2026-01-01T00:00:00.000Z' })
    const result = mergeImport([known], [{ en: 'reach', fr: 'atteindre' }, { en: 'reach', fr: 'parvenir à' }], now)
    expect(result.words).toEqual([{ ...known, fr: ['atteindre', 'parvenir à'] }])
    expect(result.newCards).toEqual([])
    expect(result.stats).toEqual({ added: 0, removed: 0, restored: 0 })
  })

  it('réactive un mot retiré qui revient dans l’export', () => {
    const result = mergeImport([word('reach', { status: 'retiré' })], [{ en: 'reach', fr: 'atteindre' }], now)
    expect(result.words[0].status).toBe('actif')
    expect(result.newCards).toEqual([])
    expect(result.stats).toEqual({ added: 0, removed: 0, restored: 1 })
  })

  it('marque « retiré » un mot actif absent de l’export, sans recompter un mot déjà retiré', () => {
    const result = mergeImport(
      [word('reach'), word('gone', { status: 'retiré' })],
      [{ en: 'other', fr: 'autre' }],
      now,
    )
    expect(result.words.find((w) => w.key === 'reach')?.status).toBe('retiré')
    expect(result.words.find((w) => w.key === 'gone')?.status).toBe('retiré')
    expect(result.stats).toEqual({ added: 1, removed: 1, restored: 0 })
  })

  it('numérote les nouveaux mots à la suite, dans l’ordre de l’export', () => {
    const result = mergeImport([word('old', { order: 7 })], [
      { en: 'old', fr: 'vieux' },
      { en: 'first', fr: 'premier' },
      { en: 'second', fr: 'deuxième' },
    ], now)
    expect(result.words.map((w) => [w.key, w.order])).toEqual([['old', 7], ['first', 8], ['second', 9]])
  })

  it('ne modifie pas les mots reçus en entrée', () => {
    const known = word('reach')
    const frozen = structuredClone(known)
    mergeImport([known], [], now)
    expect(known).toEqual(frozen)
  })
})
