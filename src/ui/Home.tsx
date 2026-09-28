type Props = {
  dueCount: number
  newCount: number
  lastSync: string | null
  syncing: boolean
  message: string | null
  onReview: () => void
  onSync: () => void
  onSettings: () => void
}

const formatDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export function Home(props: Props) {
  const empty = props.dueCount + props.newCount === 0
  return (
    <main class="screen home">
      <header class="topbar">
        <h1>Vocab</h1>
        <button class="ghost" onClick={props.onSettings}>
          Réglages
        </button>
      </header>

      <section class="counts">
        <div>
          <strong>{props.dueCount}</strong>
          <span>à revoir</span>
        </div>
        <div>
          <strong>{props.newCount}</strong>
          <span>nouvelles</span>
        </div>
      </section>

      <button class="primary big" disabled={empty} onClick={props.onReview}>
        {empty ? 'Rien à réviser' : 'Réviser'}
      </button>

      {props.message && (
        <p class="message" role="status">
          {props.message}
        </p>
      )}

      <footer class="sync">
        <button class="secondary" disabled={props.syncing} onClick={props.onSync}>
          {props.syncing ? 'Synchronisation…' : 'Synchroniser'}
        </button>
        <small>{props.lastSync ? `Dernière synchro : ${formatDate(props.lastSync)}` : 'Jamais synchronisé'}</small>
      </footer>
    </main>
  )
}
