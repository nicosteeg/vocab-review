type Props = {
  dueCount: number
  newCount: number
  /** Au moins un mot actif (sinon : premier lancement ou tout est retiré). */
  hasWords: boolean
  /** Taille du lot « Encore N nouvelles cartes » (0 s'il n'en reste plus). */
  extraNewCount: number
  /** Faux si le réglage « Nouvelles cartes par jour » vaut 0. */
  extraNewEnabled: boolean
  freeReviewCount: number
  lastSync: string | null
  syncing: boolean
  message: string | null
  onReview: () => void
  onExtraNew: () => void
  onFreeReview: () => void
  onSync: () => void
  onSettings: () => void
}

const formatDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export function Home(props: Props) {
  const dayDone = props.hasWords && props.dueCount + props.newCount === 0
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

      {!props.hasWords && (
        <button class="primary big" disabled>
          Rien à réviser
        </button>
      )}
      {props.hasWords && !dayDone && (
        <button class="primary big" onClick={props.onReview}>
          Réviser
        </button>
      )}
      {dayDone && (
        <section class="extras">
          <p class="done-today">Session du jour terminée ✓</p>
          {props.extraNewEnabled && (
            <button class="primary big" disabled={props.extraNewCount === 0} onClick={props.onExtraNew}>
              {props.extraNewCount === 0
                ? 'Plus de nouvelles cartes'
                : `Encore ${plural(props.extraNewCount, 'nouvelle carte', 'nouvelles cartes')}`}
            </button>
          )}
          <button class="secondary" disabled={props.freeReviewCount === 0} onClick={props.onFreeReview}>
            Révision libre
          </button>
        </section>
      )}

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
