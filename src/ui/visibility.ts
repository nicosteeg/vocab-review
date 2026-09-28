export type VisibilityTarget = {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/**
 * Appelle `callback` chaque fois que la page redevient visible : iOS rouvre souvent une app
 * de l'écran d'accueil sans la recharger. Renvoie la fonction de désabonnement.
 */
export function onBecomeVisible(target: VisibilityTarget, callback: () => void): () => void {
  const listener = () => {
    if (target.visibilityState === 'visible') callback()
  }
  target.addEventListener('visibilitychange', listener)
  return () => target.removeEventListener('visibilitychange', listener)
}
