/** Accès limité aux fichiers que l'utilisateur choisit dans le sélecteur Google. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const SPREADSHEET = 'application/vnd.google-apps.spreadsheet'
const STATE_KEY = 'vocab-review.oauth-state'
const PENDING_KEY = 'vocab-review.pending-sync'

export type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type RedirectOutcome =
  | { kind: 'none' }
  | { kind: 'token'; accessToken: string; pickedFileId: string | null; resumeSync: boolean }
  | { kind: 'error'; error: 'auth-denied' | 'auth-failed' | 'state-mismatch' }

type AuthRequest = { clientId: string; redirectUri: string; state: string }

/**
 * Connexion et choix du fichier en un seul passage chez Google : `trigger_onepick` affiche
 * le sélecteur de Google après l'écran d'accord (qu'il exige à chaque fois).
 * Pas d'`include_granted_scopes` : le jeton ne doit couvrir que les fichiers choisis.
 */
export function buildAuthUrl({ clientId, redirectUri, state }: AuthRequest): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: DRIVE_SCOPE,
    state,
    trigger_onepick: 'true',
    prompt: 'consent',
    mimetypes: SPREADSHEET,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** Mémorise le `state` et la synchro en attente, puis renvoie l'URL Google où rediriger. */
export function beginAuth(request: AuthRequest, storage: AuthStorage): string {
  storage.setItem(STATE_KEY, request.state)
  storage.setItem(PENDING_KEY, '1')
  return buildAuthUrl(request)
}

/** Lit le retour de Google dans le fragment d'URL (`#access_token=…&picked_file_ids=…` ou `#error=…`). */
export function consumeRedirect(hash: string, storage: AuthStorage): RedirectOutcome {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has('access_token') && !params.has('error')) return { kind: 'none' }

  const expected = storage.getItem(STATE_KEY)
  const resumeSync = storage.getItem(PENDING_KEY) === '1'
  storage.removeItem(STATE_KEY)
  storage.removeItem(PENDING_KEY)

  if (!expected || params.get('state') !== expected) return { kind: 'error', error: 'state-mismatch' }
  const error = params.get('error')
  if (error) return { kind: 'error', error: error === 'access_denied' ? 'auth-denied' : 'auth-failed' }

  const picked = (params.get('picked_file_ids') ?? '').split(',').filter(Boolean)
  return { kind: 'token', accessToken: params.get('access_token') ?? '', pickedFileId: picked[0] ?? null, resumeSync }
}
