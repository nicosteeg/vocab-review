import { describe, expect, it } from 'vitest'
import { card, word } from '../test/builders'
import { DEFAULT_SETTINGS, type Directions, type Settings } from './types'
import { buildExtraNewQueue, buildFreeReviewQueue, buildQueue, FREE_REVIEW_SIZE } from './queue'

// Heure locale : ces tests ne dépendent pas du fuseau de la machine.
const now = new Date(2026, 8, 27, 10, 0)
const at = (day: number, hour = 10) => new Date(2026, 8, day, hour, 0).toISOString()
const ids = (cards: { id: string }[]) => cards.map((c) => c.id)
const sorted = (cards: { id: string }[]) => ids(cards).sort()
// Hasard neutre : le mélange ne change rien, ce qui permet de vérifier les règles de sélection.
const keep = () => 0.999999
const settings = (overrides: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...overrides })
const input = (words: ReturnType<typeof word>[], cards: ReturnType<typeof card>[], overrides: Partial<Settings> = {}, random = keep) => ({
  words,
  cards,
  settings: settings(overrides),
  now,
  random,
})
/** Mots jamais vus, avec leurs deux cartes nouvelles. */
const unseen = (keys: string[]) => ({
  words: keys.map((key, order) => word(key, { order })),
  cards: keys.flatMap((key) => [card(key, 'en-fr'), card(key, 'fr-en')]),
})

describe('buildQueue', () => {
  it('présente toutes les cartes dues, et elles seules', () => {
    const words = [word('a', { order: 0 }), word('b', { order: 1 }), word('c', { order: 2 })]
    const cards = [
      card('a', 'en-fr', { lastReview: at(20), due: at(25) }),
      card('b', 'en-fr', { lastReview: at(20), due: at(22) }),
      card('c', 'en-fr', { lastReview: at(20), due: at(26) }),
    ]
    expect(sorted(buildQueue(input(words, cards, {}, Math.random)))).toEqual(['a:en-fr', 'b:en-fr', 'c:en-fr'])
  })

  it('inclut une carte due plus tard dans la journée d’étude, pas celle due demain', () => {
    const words = [word('a'), word('b')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(24), due: at(27, 22) }),
      card('b', 'en-fr', { lastReview: at(24), due: at(28, 5) }),
    ]
    expect(ids(buildQueue(input(words, cards)))).toEqual(['a:en-fr'])
  })

  it('ignore les mots retirés', () => {
    const words = [word('a', { status: 'retiré' })]
    const cards = [card('a', 'en-fr', { lastReview: at(20), due: at(22) }), card('a', 'fr-en')]
    expect(buildQueue(input(words, cards))).toEqual([])
  })

  it('ajoute des nouvelles cartes aux cartes dues, dans la limite du jour', () => {
    const fresh = unseen(['n1', 'n2', 'n3'])
    const words = [word('d', { order: 9 }), ...fresh.words]
    const cards = [
      card('d', 'en-fr', { lastReview: at(20), due: at(22) }),
      card('d', 'fr-en', { lastReview: at(20), due: at(30) }),
      ...fresh.cards,
    ]
    const queue = buildQueue(input(words, cards, { newPerDay: 2 }))
    expect(queue).toHaveLength(3)
    expect(ids(queue)).toContain('d:en-fr')
    expect(queue.filter((c) => c.wordKey !== 'd').every((c) => c.direction === 'en-fr')).toBe(true)
  })

  it('déduit de la limite les cartes déjà introduites ce jour d’étude', () => {
    const fresh = unseen(['n1', 'n2'])
    const words = [word('seen', { order: 9 }), ...fresh.words]
    const cards = [card('seen', 'en-fr', { lastReview: at(27, 8), due: at(30) }), card('seen', 'fr-en'), ...fresh.cards]
    expect(buildQueue(input(words, cards, { newPerDay: 2 }))).toHaveLength(1)
  })

  it('tire les nouvelles cartes au hasard, pas dans l’ordre de l’export', () => {
    const { words, cards } = unseen(['n0', 'n1', 'n2', 'n3', 'n4', 'n5'])
    const inOrder = sorted(buildQueue(input(words, cards, { newPerDay: 3 }, keep)))
    const drawn = sorted(buildQueue(input(words, cards, { newPerDay: 3 }, () => 0)))
    expect(inOrder).toEqual(['n0:en-fr', 'n1:en-fr', 'n2:en-fr'])
    expect(drawn).toHaveLength(3)
    expect(drawn).not.toEqual(inOrder)
  })

  it('mélange l’ordre de la session', () => {
    const words = [word('a', { order: 0 }), word('b', { order: 1 }), word('c', { order: 2 })]
    const cards = [
      card('a', 'en-fr', { lastReview: at(20), due: at(22) }),
      card('b', 'en-fr', { lastReview: at(20), due: at(23) }),
      card('c', 'en-fr', { lastReview: at(20), due: at(24) }),
    ]
    expect(ids(buildQueue(input(words, cards, {}, keep)))).toEqual(['a:en-fr', 'b:en-fr', 'c:en-fr'])
    expect(ids(buildQueue(input(words, cards, {}, () => 0)))).toEqual(['b:en-fr', 'c:en-fr', 'a:en-fr'])
  })

  it('fait passer la carte FR→EN d’un mot appris avant les mots jamais vus', () => {
    const fresh = unseen(['n1', 'n2', 'n3'])
    const words = [...fresh.words, word('a', { order: 9 })]
    const cards = [...fresh.cards, card('a', 'en-fr', { lastReview: at(25), due: at(29) }), card('a', 'fr-en')]
    expect(ids(buildQueue(input(words, cards, { newPerDay: 1 }, () => 0)))).toEqual(['a:fr-en'])
  })

  it('ne propose la carte FR→EN nouvelle qu’une fois la carte EN→FR déjà révisée', () => {
    const { words, cards } = unseen(['b'])
    expect(ids(buildQueue(input(words, cards)))).toEqual(['b:en-fr'])
  })

  it('exclut un mot dont l’autre sens a été révisé ce jour d’étude', () => {
    const words = [word('a')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(27, 7), due: at(30) }),
      card('a', 'fr-en', { lastReview: at(20), due: at(22) }),
    ]
    expect(buildQueue(input(words, cards))).toEqual([])
  })

  it('ne met qu’un sens par mot quand les deux sont dus, le plus en retard', () => {
    const words = [word('a')]
    const cards = [
      card('a', 'en-fr', { lastReview: at(20), due: at(26) }),
      card('a', 'fr-en', { lastReview: at(19), due: at(24) }),
    ]
    expect(ids(buildQueue(input(words, cards)))).toEqual(['a:fr-en'])
  })

  it('n’ajoute aucune nouvelle carte si la limite est à 0', () => {
    const { words, cards } = unseen(['a'])
    expect(buildQueue(input(words, cards, { newPerDay: 0 }))).toEqual([])
  })
})

describe('sens de révision choisi', () => {
  const words = [word('a', { order: 0 }), word('b', { order: 1 })]
  const cards = [
    card('a', 'en-fr', { lastReview: at(20), due: at(22) }),
    card('a', 'fr-en', { lastReview: at(19), due: at(21) }),
    card('b', 'en-fr'),
    card('b', 'fr-en'),
  ]
  const queue = (directions: Directions) => sorted(buildQueue(input(words, cards, { directions })))

  it('en « Anglais → Français » seulement, ne propose aucune carte FR→EN', () => {
    expect(queue('en-fr')).toEqual(['a:en-fr', 'b:en-fr'])
  })

  it('en « Français → Anglais » seulement, un mot jamais vu arrive directement en FR→EN', () => {
    expect(queue('fr-en')).toEqual(['a:fr-en', 'b:fr-en'])
  })

  it('reprend les cartes d’un sens réactivé là où elles en étaient', () => {
    const paused = [card('a', 'en-fr', { lastReview: at(10), due: at(15) }), card('a', 'fr-en', { lastReview: at(26), due: at(30) })]
    expect(ids(buildQueue(input([word('a')], paused, { directions: 'fr-en' })))).toEqual([])
    expect(ids(buildQueue(input([word('a')], paused, { directions: 'both' })))).toEqual(['a:en-fr'])
  })
})

describe('buildExtraNewQueue', () => {
  it('propose un lot de nouvelles cartes au-delà de la limite du jour', () => {
    const fresh = unseen(['n1', 'n2', 'n3', 'n4', 'n5'])
    const doneToday = ['t1', 't2'].map((key) => card(key, 'en-fr', { lastReview: at(27, 8), due: at(30) }))
    const words = [...fresh.words, word('t1', { order: 7 }), word('t2', { order: 8 })]
    const cards = [...fresh.cards, ...doneToday, card('t1', 'fr-en'), card('t2', 'fr-en')]
    const extra = buildExtraNewQueue(input(words, cards, { newPerDay: 2 }))
    expect(buildQueue(input(words, cards, { newPerDay: 2 }))).toEqual([])
    expect(extra).toHaveLength(2)
    expect(extra.every((c) => c.fsrs.state === 0 && !['t1', 't2'].includes(c.wordKey))).toBe(true)
  })

  it('respecte le sens choisi', () => {
    const { words, cards } = unseen(['n1', 'n2'])
    expect(sorted(buildExtraNewQueue(input(words, cards, { directions: 'fr-en' })))).toEqual(['n1:fr-en', 'n2:fr-en'])
  })

  it('est vide quand il ne reste aucune carte nouvelle', () => {
    const words = [word('a')]
    const cards = [card('a', 'en-fr', { lastReview: at(20), due: at(40) }), card('a', 'fr-en', { lastReview: at(20), due: at(40) })]
    expect(buildExtraNewQueue(input(words, cards))).toEqual([])
  })
})

describe('buildFreeReviewQueue', () => {
  const learned = (keys: string[]) => ({
    words: keys.map((key, order) => word(key, { order })),
    cards: keys.flatMap((key) => [
      card(key, 'en-fr', { lastReview: at(20), due: at(40) }),
      card(key, 'fr-en', { lastReview: at(27, 8), due: at(40) }),
    ]),
  })

  it(`tire au plus ${FREE_REVIEW_SIZE} cartes déjà apprises, une par mot, même non dues`, () => {
    const { words, cards } = learned(Array.from({ length: 25 }, (_, i) => `w${i}`))
    const queue = buildFreeReviewQueue(input(words, cards, {}, Math.random))
    expect(queue).toHaveLength(FREE_REVIEW_SIZE)
    expect(new Set(queue.map((c) => c.wordKey)).size).toBe(FREE_REVIEW_SIZE)
    expect(queue.every((c) => c.fsrs.state !== 0)).toBe(true)
  })

  it('ignore les cartes nouvelles, les mots retirés et le sens désactivé', () => {
    const base = learned(['a', 'b'])
    const words = [...base.words, word('gone', { status: 'retiré', order: 5 }), word('new', { order: 6 })]
    const cards = [...base.cards, card('gone', 'en-fr', { lastReview: at(20), due: at(40) }), card('new', 'en-fr'), card('new', 'fr-en')]
    expect(sorted(buildFreeReviewQueue(input(words, cards, { directions: 'en-fr' })))).toEqual(['a:en-fr', 'b:en-fr'])
  })

  it('est vide sans aucun mot appris', () => {
    const { words, cards } = unseen(['a'])
    expect(buildFreeReviewQueue(input(words, cards))).toEqual([])
  })
})
