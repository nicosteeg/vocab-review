import { useEffect, useState } from 'preact/hooks'
import { GOOGLE_CLIENT_ID, redirectUri } from '../config'
import { buildQueue } from '../domain/queue'
import { isNew } from '../domain/scheduler'
import type { StoredCard } from '../domain/types'
import { beginAuth, consumeRedirect } from '../google/auth'
import { createDriveApi } from '../google/drive'
import { openStore, type Snapshot, type Store } from '../storage/db'
import { runSync } from '../sync'
import { Home } from './Home'
import { errorMessage, syncMessage } from './messages'
import { Review } from './Review'
import { Settings } from './Settings'
import { onBecomeVisible } from './visibility'

type Screen = { name: 'home' } | { name: 'review'; queue: StoredCard[] } | { name: 'settings' }

const drive = createDriveApi()

/** Ce que renvoie le passage chez Google : jeton et fichier choisi dans le sélecteur. */
type Picked = { token: string; fileId: string | null }

export function App() {
  const [store, setStore] = useState<Store | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [message, setMessage] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [persistDenied, setPersistDenied] = useState(false)
  // Force un nouveau rendu (et donc de nouveaux compteurs) au retour de l'arrière-plan.
  const [, setResumedAt] = useState(0)

  useEffect(() => {
    void start()
    return onBecomeVisible(document, () => setResumedAt(Date.now()))
  }, [])

  async function start() {
    let opened: Store
    let loaded: Snapshot
    try {
      opened = await openStore()
      loaded = await opened.load()
    } catch {
      setMessage('Stockage indisponible sur ce navigateur (navigation privée ?).')
      return
    }
    setStore(opened)
    setSnapshot(loaded)
    navigator.storage?.persist?.().then((ok) => setPersistDenied(!ok), () => setPersistDenied(true))

    const outcome = consumeRedirect(location.hash, localStorage)
    if (outcome.kind === 'none') return
    history.replaceState(null, '', location.pathname + location.search)
    if (outcome.kind === 'error') setMessage(errorMessage(outcome.error))
    if (outcome.kind === 'token' && outcome.resumeSync) {
      await sync(opened, loaded, { token: outcome.accessToken, fileId: outcome.pickedFileId })
    }
  }

  /** Sans `picked`, passe par Google (connexion + sélecteur) ; au retour, importe le fichier choisi. */
  async function sync(target: Store, current: Snapshot, picked: Picked | null) {
    setSyncing(true)
    setMessage(null)
    try {
      const outcome = await runSync({
        token: picked?.token ?? null,
        fileId: picked?.fileId ?? null,
        online: navigator.onLine,
        snapshot: current,
        drive,
        now: new Date(),
      })
      if (outcome.kind === 'need-auth') {
        const request = { clientId: GOOGLE_CLIENT_ID, redirectUri: redirectUri(), state: crypto.randomUUID() }
        location.assign(beginAuth(request, localStorage))
        return
      }
      if (outcome.kind === 'merged') {
        await target.applySync(outcome.merge.words, outcome.merge.newCards, outcome.meta)
        setSnapshot(await target.load())
      }
      setMessage(syncMessage(outcome))
    } catch (error) {
      setMessage(`Erreur inattendue : ${String(error)}`)
    } finally {
      setSyncing(false)
    }
  }

  async function reload() {
    if (store) setSnapshot(await store.load())
  }

  if (!store || !snapshot) return <main class="screen">{message ?? 'Chargement…'}</main>

  if (screen.name === 'review') {
    return (
      <Review
        queue={screen.queue}
        words={snapshot.words}
        onSave={(card) => store.saveCard(card)}
        onExit={async () => {
          await reload()
          setScreen({ name: 'home' })
        }}
      />
    )
  }

  if (screen.name === 'settings') {
    return (
      <Settings
        snapshot={snapshot}
        persistDenied={persistDenied}
        onSaveSettings={async (settings) => {
          await store.saveSettings(settings)
          await reload()
        }}
        onRestore={async (restored) => {
          await store.replaceAll(restored)
          await reload()
        }}
        onBack={() => setScreen({ name: 'home' })}
      />
    )
  }

  const queue = buildQueue({ ...snapshot, now: new Date() })
  const newCount = queue.filter((c) => isNew(c.fsrs)).length
  return (
    <Home
      dueCount={queue.length - newCount}
      newCount={newCount}
      lastSync={snapshot.syncMeta?.syncedAt ?? null}
      syncing={syncing}
      message={message}
      onReview={() => {
        setMessage(null)
        setScreen({ name: 'review', queue: buildQueue({ ...snapshot, now: new Date() }) })
      }}
      onSync={() => void sync(store, snapshot, null)}
      onSettings={() => setScreen({ name: 'settings' })}
    />
  )
}
