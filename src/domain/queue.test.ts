import { describe, expect, it } from 'vitest'
import { card, word } from '../test/builders'
import { DEFAULT_SETTINGS } from './types'
import { buildQueue } from './queue'

// Heure locale : ces tests ne dépendent pas du fuseau de la machine.
const now = new Date(2026, 8, 27, 10, 0)
const at = (day: number, hour = 10) => new Date(2026, 8, day, hour, 0).toISOString()
const ids = (cards: { id: string }[]) => cards.map((c) => c.id)
const settings = DEFAULT_SETTINGS

describe('buildQueue', () => {
  it('met les cartes dues en premier, les plus en retard d’abord', () => {
    const words = [word('a', { order: 0 }), word('b', { order: 1 }), word('c', { order: 2 })]
    const cards = [
      card('a', 'en-fr', { lastReview: at(20), due: at(25) }),
      card('b', 'en-fr', { lastReview: at(20), due: at(22) }),
      card('c', 'en-fr', { lastReview: at(20), due: at(26) }),
    ]
    expect(ids(buildQueue({ words, cards, settings, now }))).toEqual(['b:en-fr', 'a:en-fr', 'c:en-fr'])
  })

  it('inclut une carte due plus tard dans la journée d’étude, pas celle due demain', () => {
    const words = [word('a'), word('b')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(24), due: at(27, 22) }),
      card('b', 'en-fr', { lastReview: at(24), due: at(28, 5) }),
    ]
    expect(ids(buildQueue({ words, cards, settings, now }))).toEqual(['a:en-fr'])
  })

  it('ignore les mots retirés', () => {
    const words = [word('a', { status: 'retiré' })]
    const cards = [card('a', 'en-fr', { lastReview: at(20), due: at(22) }), card('a', 'fr-en')]
    expect(buildQueue({ words, cards, settings, now })).toEqual([])
  })

  it('ajoute les nouvelles cartes après les dues, par ordre d’ajout, dans la limite du jour', () => {
    const words = [word('d', { order: 0 }), word('n2', { order: 2 }), word('n1', { order: 1 }), word('n3', { order: 3 })]
    const cards = [
      card('d', 'en-fr', { lastReview: at(20), due: at(22) }),
      card('d', 'fr-en', { lastReview: at(20), due: at(30) }),
      ...['n1', 'n2', 'n3'].flatMap((k) => [card(k, 'en-fr'), card(k, 'fr-en')]),
    ]
    const queue = buildQueue({ words, cards, settings: { newPerDay: 2 }, now })
    expect(ids(queue)).toEqual(['d:en-fr', 'n1:en-fr', 'n2:en-fr'])
  })

  it('déduit de la limite les cartes déjà introduites ce jour d’étude', () => {
    const words = [word('seen', { order: 0 }), word('n1', { order: 1 }), word('n2', { order: 2 })]
    const cards = [
      card('seen', 'en-fr', { lastReview: at(27, 8), due: at(30) }),
      card('seen', 'fr-en'),
      card('n1', 'en-fr'), card('n1', 'fr-en'),
      card('n2', 'en-fr'), card('n2', 'fr-en'),
    ]
    expect(ids(buildQueue({ words, cards, settings: { newPerDay: 2 }, now }))).toEqual(['n1:en-fr'])
  })

  it('ne propose la carte fr-en nouvelle qu’une fois la carte en-fr déjà révisée', () => {
    const words = [word('a', { order: 0 }), word('b', { order: 1 })]
    const cards = [
      card('a', 'en-fr', { lastReview: at(25), due: at(29) }),
      card('a', 'fr-en'),
      card('b', 'en-fr'),
      card('b', 'fr-en'),
    ]
    expect(ids(buildQueue({ words, cards, settings, now }))).toEqual(['a:fr-en', 'b:en-fr'])
  })

  it('exclut un mot dont l’autre sens a été révisé ce jour d’étude', () => {
    const words = [word('a')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(27, 7), due: at(30) }),
      card('a', 'fr-en', { lastReview: at(20), due: at(22) }),
    ]
    expect(buildQueue({ words, cards, settings, now })).toEqual([])
  })

  it('ne met qu’un sens par mot quand les deux sont dus', () => {
    const words = [word('a')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(20), due: at(26) }),
      card('a', 'fr-en', { lastReview: at(19), due: at(24) }),
    ]
    expect(ids(buildQueue({ words, cards, settings, now }))).toEqual(['a:fr-en'])
  })

  it('n’ajoute aucune nouvelle carte si la limite est à 0', () => {
    const words = [word('a')]
    const cards = [card('a', 'en-fr'), card('a', 'fr-en')]
    expect(buildQueue({ words, cards, settings: { newPerDay: 0 }, now })).toEqual([])
  })
})
