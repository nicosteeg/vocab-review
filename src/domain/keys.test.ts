import { describe, expect, it } from 'vitest'
import { cardId, normalizeText } from './keys'

describe('keys', () => {
  it('normalise casse, espaces et forme Unicode', () => {
    expect(normalizeText('  To   Cope With ')).toBe('to cope with')
    expect(normalizeText('Café')).toBe(normalizeText('Café'))
  })

  it('construit l’identifiant d’une carte à partir du mot et du sens', () => {
    expect(cardId('reach', 'fr-en')).toBe('reach:fr-en')
  })
})
