import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage'
import { beginAuth, buildAuthUrl, consumeRedirect, DRIVE_SCOPE, usableToken } from './auth'

const request = { clientId: 'client-123', redirectUri: 'https://me.github.io/vocab-review/', state: 'abc' }

describe('auth Google', () => {
  it('construit l’URL d’autorisation en flux « token »', () => {
    const url = new URL(buildAuthUrl(request))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-123',
      redirect_uri: 'https://me.github.io/vocab-review/',
      response_type: 'token',
      scope: DRIVE_SCOPE,
      include_granted_scopes: 'true',
      state: 'abc',
    })
  })

  it('mémorise le state et la synchro en attente avant de rediriger', () => {
    const storage = memoryStorage()
    expect(beginAuth(request, storage)).toBe(buildAuthUrl(request))
    expect(Object.fromEntries(storage.data)).toEqual({ 'vocab-review.oauth-state': 'abc', 'vocab-review.pending-sync': '1' })
  })

  it('ignore une URL sans retour Google', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc' })
    expect(consumeRedirect('', storage, 0)).toEqual({ kind: 'none' })
    expect(consumeRedirect('#section', storage, 0)).toEqual({ kind: 'none' })
    expect(storage.data.size).toBe(1)
  })

  it('récupère le jeton, calcule son expiration et nettoie le stockage', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc', 'vocab-review.pending-sync': '1' })
    const outcome = consumeRedirect('#state=abc&access_token=tok&token_type=Bearer&expires_in=3599', storage, 1_000)
    expect(outcome).toEqual({ kind: 'token', token: { accessToken: 'tok', expiresAt: 3_600_000 }, resumeSync: true })
    expect(storage.data.size).toBe(0)
  })

  it('signale un state différent de celui envoyé', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc' })
    expect(consumeRedirect('#state=evil&access_token=tok', storage, 0)).toEqual({ kind: 'error', error: 'state-mismatch' })
    expect(consumeRedirect('#state=abc&access_token=tok', memoryStorage(), 0)).toEqual({ kind: 'error', error: 'state-mismatch' })
  })

  it('distingue le refus de l’utilisateur des autres erreurs Google', () => {
    const denied = consumeRedirect('#state=abc&error=access_denied', memoryStorage({ 'vocab-review.oauth-state': 'abc' }), 0)
    const other = consumeRedirect('#state=abc&error=invalid_scope', memoryStorage({ 'vocab-review.oauth-state': 'abc' }), 0)
    expect(denied).toEqual({ kind: 'error', error: 'auth-denied' })
    expect(other).toEqual({ kind: 'error', error: 'auth-failed' })
  })

  it('n’utilise plus un jeton qui expire dans moins d’une minute', () => {
    const token = { accessToken: 'tok', expiresAt: 100_000 }
    expect(usableToken(token, 39_999)).toBe('tok')
    expect(usableToken(token, 40_000)).toBeNull()
    expect(usableToken(null, 0)).toBeNull()
  })
})
