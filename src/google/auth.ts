export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const STATE_KEY = 'vocab-review.oauth-state'
const PENDING_KEY = 'vocab-review.pending-sync'

export type Token = { accessToken: string; expiresAt: number }
export type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type RedirectOutcome =
  | { kind: 'none' }
  | { kind: 'token'; token: Token; resumeSync: boolean }
  | { kind: 'error'; error: 'auth-denied' | 'auth-failed' | 'state-mismatch' }

type AuthRequest = { clientId: string; redirectUri: string; state: string }

export function buildAuthUrl({ clientId, redirectUri, state }: AuthRequest): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: DRIVE_SCOPE,
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** Mémorise le `state` et la synchro en attente, puis renvoie l'URL Google où rediriger. */
export function beginAuth(request: AuthRequest, storage: AuthStorage): string {
  storage.setItem(STATE_KEY, request.state)
  storage.setItem(PENDING_KEY, '1')
  return buildAuthUrl(request)
}

/** Lit le retour de Google dans le fragment d'URL (`#access_token=…` ou `#error=…`). */
export function consumeRedirect(hash: string, storage: AuthStorage, nowMs: number): RedirectOutcome {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has('access_token') && !params.has('error')) return { kind: 'none' }

  const expected = storage.getItem(STATE_KEY)
  const resumeSync = storage.getItem(PENDING_KEY) === '1'
  storage.removeItem(STATE_KEY)
  storage.removeItem(PENDING_KEY)

  if (!expected || params.get('state') !== expected) return { kind: 'error', error: 'state-mismatch' }
  const error = params.get('error')
  if (error) return { kind: 'error', error: error === 'access_denied' ? 'auth-denied' : 'auth-failed' }

  const expiresIn = Number(params.get('expires_in') ?? '3600')
  return {
    kind: 'token',
    token: { accessToken: params.get('access_token') ?? '', expiresAt: nowMs + expiresIn * 1000 },
    resumeSync,
  }
}

/** Jeton utilisable s'il reste plus d'une minute avant son expiration. */
export function usableToken(token: Token | null, nowMs: number): string | null {
  return token && token.expiresAt - 60_000 > nowMs ? token.accessToken : null
}
