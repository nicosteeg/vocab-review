import { describe, expect, it } from 'vitest'
import { shuffle } from './shuffle'

describe('shuffle', () => {
  it('garde tous les éléments, sans en ajouter ni en perdre', () => {
    expect(shuffle([1, 2, 3, 4, 5], Math.random).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('ne modifie pas la liste reçue', () => {
    const items = [1, 2, 3, 4]
    shuffle(items, () => 0)
    expect(items).toEqual([1, 2, 3, 4])
  })

  it('suit la source de hasard (mélange de Fisher–Yates)', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1])
  })

  it('ne change rien avec un hasard toujours proche de 1', () => {
    expect(shuffle([1, 2, 3, 4], () => 0.999999)).toEqual([1, 2, 3, 4])
  })

  it('produit des ordres différents avec le vrai hasard', () => {
    const orders = new Set(Array.from({ length: 50 }, () => shuffle([1, 2, 3, 4], Math.random).join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})
