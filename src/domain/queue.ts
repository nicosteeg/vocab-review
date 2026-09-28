import { isNew } from './scheduler'
import { shuffle } from './shuffle'
import { studyDay } from './studyDay'
import type { CardDirection, Directions, Settings, StoredCard, Word } from './types'

/** `random` renvoie un nombre dans [0, 1[ : Math.random dans l'app, une valeur fixe dans les tests. */
export type QueueInput = { words: Word[]; cards: StoredCard[]; settings: Settings; now: Date; random: () => number }

export const FREE_REVIEW_SIZE = 20

const sameDay = (iso: string | undefined, today: string) => iso !== undefined && studyDay(new Date(iso)) === today

type Context = {
  today: string
  directions: Directions
  /** Mots actifs, dans l'ordre d'ajout (le hasard est appliqué ensuite). */
  active: Word[]
  /** Mots dont une carte a déjà été révisée ce jour d'étude. */
  blocked: Set<string>
  byWord: Map<string, Partial<Record<CardDirection, StoredCard>>>
  /** Cartes des mots actifs, dans les sens choisis. */
  eligible: StoredCard[]
}

function prepare({ words, cards, settings, now }: QueueInput): Context {
  const today = studyDay(now)
  const active = words.filter((w) => w.status === 'actif').sort((a, b) => a.order - b.order)
  const activeKeys = new Set(active.map((w) => w.key))
  const allowed = (direction: CardDirection) => settings.directions === 'both' || settings.directions === direction
  const byWord = new Map<string, Partial<Record<CardDirection, StoredCard>>>()
  for (const c of cards) byWord.set(c.wordKey, { ...byWord.get(c.wordKey), [c.direction]: c })
  return {
    today,
    directions: settings.directions,
    active,
    blocked: new Set(cards.filter((c) => sameDay(c.fsrs.last_review, today)).map((c) => c.wordKey)),
    byWord,
    eligible: cards.filter((c) => activeKeys.has(c.wordKey) && allowed(c.direction)),
  }
}

/** Garde la première carte de chaque mot. */
function onePerWord(cards: StoredCard[]): StoredCard[] {
  const seen = new Set<string>()
  const result: StoredCard[] = []
  for (const c of cards) {
    if (seen.has(c.wordKey)) continue
    seen.add(c.wordKey)
    result.push(c)
  }
  return result
}

/** Cartes dues, au plus une par mot : la plus en retard. */
function dueCards(ctx: Context): StoredCard[] {
  const due = ctx.eligible
    .filter((c) => !ctx.blocked.has(c.wordKey) && !isNew(c.fsrs) && studyDay(new Date(c.fsrs.due)) <= ctx.today)
    .sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due))
  return onePerWord(due)
}

/**
 * Nouvelles cartes possibles, une par mot, tirées au hasard. En mode « les deux », la carte
 * FR→EN d'un mot dont la carte EN→FR est apprise passe avant les mots jamais vus.
 */
function newCandidates(ctx: Context, taken: Set<string>, random: () => number): StoredCard[] {
  const learnedWords: StoredCard[] = []
  const unseenWords: StoredCard[] = []
  for (const word of ctx.active) {
    if (ctx.blocked.has(word.key) || taken.has(word.key)) continue
    const pair = ctx.byWord.get(word.key)
    const enFr = pair?.['en-fr']
    const frEn = pair?.['fr-en']
    if (ctx.directions !== 'both') {
      const only = pair?.[ctx.directions]
      if (only && isNew(only.fsrs)) unseenWords.push(only)
    } else if (enFr && isNew(enFr.fsrs)) unseenWords.push(enFr)
    else if (enFr && frEn && isNew(frEn.fsrs)) learnedWords.push(frEn)
  }
  return [...shuffle(learnedWords, random), ...shuffle(unseenWords, random)]
}

/**
 * Session du jour : toutes les cartes dues, puis des nouvelles cartes dans la limite du jour,
 * dans un ordre mélangé. Au plus une carte par mot, et aucune carte d'un mot déjà révisé ce jour d'étude.
 */
export function buildQueue(input: QueueInput): StoredCard[] {
  const ctx = prepare(input)
  const due = dueCards(ctx)
  const introducedToday = input.cards.filter((c) => sameDay(c.introducedAt, ctx.today)).length
  const remaining = Math.max(0, input.settings.newPerDay - introducedToday)
  const fresh = newCandidates(ctx, new Set(due.map((c) => c.wordKey)), input.random).slice(0, remaining)
  return shuffle([...due, ...fresh], input.random)
}

/** Lot de nouvelles cartes en plus de la limite du jour (« Encore N nouvelles cartes »). */
export function buildExtraNewQueue(input: QueueInput): StoredCard[] {
  const ctx = prepare(input)
  return shuffle(newCandidates(ctx, new Set(), input.random).slice(0, input.settings.newPerDay), input.random)
}

/** Révision libre : cartes déjà apprises, dues ou non, au hasard, une par mot. */
export function buildFreeReviewQueue(input: QueueInput): StoredCard[] {
  const learned = prepare(input).eligible.filter((c) => !isNew(c.fsrs))
  return onePerWord(shuffle(learned, input.random)).slice(0, FREE_REVIEW_SIZE)
}
