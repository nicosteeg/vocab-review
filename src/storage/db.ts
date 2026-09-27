import { openDB, type DBSchema, type IDBPTransaction } from 'idb'
import { DEFAULT_SETTINGS, type Settings, type StoredCard, type SyncMeta, type Word } from '../domain/types'

export type Snapshot = { words: Word[]; cards: StoredCard[]; settings: Settings; syncMeta: SyncMeta | null }

export type Store = {
  load(): Promise<Snapshot>
  saveCard(card: StoredCard): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  /** Écrit une synchro en une seule transaction : tout ou rien. */
  applySync(words: Word[], newCards: StoredCard[], meta: SyncMeta): Promise<void>
  /** Remplace toutes les données (restauration) en une seule transaction. */
  replaceAll(snapshot: Snapshot): Promise<void>
}

interface VocabDB extends DBSchema {
  words: { key: string; value: Word }
  cards: { key: string; value: StoredCard }
  kv: { key: 'settings' | 'syncMeta'; value: Settings | SyncMeta }
}

type WriteTx = IDBPTransaction<VocabDB, ('words' | 'cards' | 'kv')[], 'readwrite'>

export async function openStore(name = 'vocab-review'): Promise<Store> {
  const db = await openDB<VocabDB>(name, 1, {
    upgrade(database) {
      database.createObjectStore('words', { keyPath: 'key' })
      database.createObjectStore('cards', { keyPath: 'id' })
      database.createObjectStore('kv')
    },
  })

  /**
   * Exécute les écritures produites par `requests` dans une seule transaction.
   * Au premier échec, IndexedDB annule tout ; chaque requête est suivie dès sa création
   * pour qu'aucun rejet ne reste non géré.
   */
  async function write(requests: (tx: WriteTx) => Iterable<Promise<unknown>>): Promise<void> {
    const tx = db.transaction(['words', 'cards', 'kv'], 'readwrite')
    const pending: Promise<unknown>[] = []
    let failure: unknown
    try {
      for (const request of requests(tx)) pending.push(request)
    } catch (error) {
      failure = error
      tx.abort()
    }
    const results = await Promise.allSettled([...pending, tx.done])
    if (failure !== undefined) throw failure
    const rejected = results.find((r) => r.status === 'rejected')
    if (rejected) throw rejected.reason
  }

  return {
    async load() {
      const tx = db.transaction(['words', 'cards', 'kv'])
      const [words, cards, settings, syncMeta] = await Promise.all([
        tx.objectStore('words').getAll(),
        tx.objectStore('cards').getAll(),
        tx.objectStore('kv').get('settings'),
        tx.objectStore('kv').get('syncMeta'),
      ])
      return {
        words,
        cards,
        settings: (settings as Settings | undefined) ?? DEFAULT_SETTINGS,
        syncMeta: (syncMeta as SyncMeta | undefined) ?? null,
      }
    },
    async saveCard(card) {
      await db.put('cards', card)
    },
    async saveSettings(settings) {
      await db.put('kv', settings, 'settings')
    },
    applySync(words, newCards, meta) {
      return write(function* (tx) {
        for (const w of words) yield tx.objectStore('words').put(w)
        for (const c of newCards) yield tx.objectStore('cards').put(c)
        yield tx.objectStore('kv').put(meta, 'syncMeta')
      })
    },
    replaceAll(snapshot) {
      return write(function* (tx) {
        yield tx.objectStore('words').clear()
        yield tx.objectStore('cards').clear()
        yield tx.objectStore('kv').clear()
        for (const w of snapshot.words) yield tx.objectStore('words').put(w)
        for (const c of snapshot.cards) yield tx.objectStore('cards').put(c)
        yield tx.objectStore('kv').put(snapshot.settings, 'settings')
        if (snapshot.syncMeta) yield tx.objectStore('kv').put(snapshot.syncMeta, 'syncMeta')
      })
    },
  }
}
