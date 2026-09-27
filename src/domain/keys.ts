import type { CardDirection } from './types'

/** Forme canonique d'un texte : NFC, espaces réduits, minuscules. */
export function normalizeText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function cardId(wordKey: string, direction: CardDirection): string {
  return `${wordKey}:${direction}`
}
