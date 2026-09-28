import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { card, word } from '../test/builders'
import { DEFAULT_SETTINGS, type StoredCard } from '../domain/types'
import { openStore } from './db'

let counter = 0
const freshStore = () => openStore(`test-${counter++}`)
const meta = { fileId: 'f1', modifiedTime: '2026-09-27T09:00:00.000Z', syncedAt: '2026-09-27T10:00:00.000Z' }

describe('openStore', () => {
  it('renvoie une base vide avec les réglages par défaut', async () => {
    const store = await freshStore()
    expect(await store.load()).toEqual({ words: [], cards: [], settings: DEFAULT_SETTINGS, syncMeta: null })
  })

  it('enregistre une synchro puis la relit', async () => {
    const store = await freshStore()
    await store.applySync([word('a')], [card('a', 'en-fr'), card('a', 'fr-en')], meta)
    const snap = await store.load()
    expect(snap.words).toEqual([word('a')])
    expect(snap.cards.map((c) => c.id).sort()).toEqual(['a:en-fr', 'a:fr-en'])
    expect(snap.syncMeta).toEqual(meta)
  })

  it('n’écrit rien si une partie de la synchro échoue', async () => {
    const store = await freshStore()
    const broken = { wordKey: 'a' } as StoredCard // pas d'id : IndexedDB refuse
    await expect(store.applySync([word('a')], [broken], meta)).rejects.toThrow()
    expect(await store.load()).toEqual({ words: [], cards: [], settings: DEFAULT_SETTINGS, syncMeta: null })
  })

  it('ne remplace pas une carte déjà en base par une carte neuve de la synchro', async () => {
    // Restauration faite pendant qu'une synchro calculée sur une base vide était en cours
    const store = await freshStore()
    const reviewed = card('reach', 'en-fr', { lastReview: '2026-09-20T10:00:00.000Z', due: '2026-09-30T10:00:00.000Z' })
    await store.replaceAll({ words: [word('reach')], cards: [reviewed], settings: DEFAULT_SETTINGS, syncMeta: null })
    await store.applySync([word('reach')], [card('reach', 'en-fr'), card('reach', 'fr-en')], meta)
    const cards = (await store.load()).cards
    expect(cards.find((c) => c.id === 'reach:en-fr')).toEqual(reviewed)
    expect(cards.map((c) => c.id).sort()).toEqual(['reach:en-fr', 'reach:fr-en'])
  })

  it('met à jour une carte et les réglages', async () => {
    const store = await freshStore()
    await store.applySync([word('a')], [card('a', 'en-fr')], meta)
    const reviewed = card('a', 'en-fr', { lastReview: '2026-09-27T10:00:00.000Z', due: '2026-09-30T10:00:00.000Z' })
    await store.saveCard(reviewed)
    await store.saveSettings({ newPerDay: 5 })
    const snap = await store.load()
    expect(snap.cards).toEqual([reviewed])
    expect(snap.settings).toEqual({ newPerDay: 5 })
  })

  it('remplace toutes les données lors d’une restauration', async () => {
    const store = await freshStore()
    await store.applySync([word('old')], [card('old', 'en-fr')], meta)
    const restored = { words: [word('new')], cards: [card('new', 'fr-en')], settings: { newPerDay: 3 }, syncMeta: null }
    await store.replaceAll(restored)
    expect(await store.load()).toEqual(restored)
  })
})

describe('openStore — restauration invalide', () => {
  it('garde les données actuelles si la restauration échoue', async () => {
    const store = await freshStore()
    await store.applySync([word('keep')], [card('keep', 'en-fr')], meta)
    const before = await store.load()
    const broken = { words: [word('x')], cards: [{ wordKey: 'x' } as StoredCard], settings: DEFAULT_SETTINGS, syncMeta: null }
    await expect(store.replaceAll(broken)).rejects.toThrow()
    expect(await store.load()).toEqual(before)
  })
})
