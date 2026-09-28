import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../test/memoryStorage'
import { beginAuth, buildAuthUrl, consumeRedirect, DRIVE_SCOPE } from './auth'

const request = { clientId: 'client-123', redirectUri: 'https://me.github.io/vocab-review/', state: 'abc' }

describe('auth Google', () => {
  it('demande uniquement l’accès aux fichiers choisis dans le sélecteur Google', () => {
    const url = new URL(buildAuthUrl(request))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-123',
      redirect_uri: 'https://me.github.io/vocab-review/',
      response_type: 'token',
      scope: DRIVE_SCOPE,
      state: 'abc',
      trigger_onepick: 'true',
      prompt: 'consent',
      mimetypes: 'application/vnd.google-apps.spreadsheet',
    })
  })

  it('ne réclame pas les permissions déjà accordées (sinon l’ancien accès à tout le Drive reviendrait)', () => {
    expect(new URL(buildAuthUrl(request)).searchParams.has('include_granted_scopes')).toBe(false)
  })

  it('mémorise le state et la synchro en attente avant de rediriger', () => {
    const storage = memoryStorage()
    expect(beginAuth(request, storage)).toBe(buildAuthUrl(request))
    expect(Object.fromEntries(storage.data)).toEqual({ 'vocab-review.oauth-state': 'abc', 'vocab-review.pending-sync': '1' })
  })

  it('ignore une URL sans retour Google', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc' })
    expect(consumeRedirect('', storage)).toEqual({ kind: 'none' })
    expect(consumeRedirect('#section', storage)).toEqual({ kind: 'none' })
    expect(storage.data.size).toBe(1)
  })

  it('récupère le jeton et le fichier choisi, puis nettoie le stockage', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc', 'vocab-review.pending-sync': '1' })
    const outcome = consumeRedirect('#state=abc&picked_file_ids=file-1&access_token=tok&token_type=Bearer&expires_in=3599', storage)
    expect(outcome).toEqual({ kind: 'token', accessToken: 'tok', pickedFileId: 'file-1', resumeSync: true })
    expect(storage.data.size).toBe(0)
  })

  it('ne garde que le premier fichier si plusieurs ont été choisis', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc' })
    const outcome = consumeRedirect('#state=abc&picked_file_ids=file-1,file-2&access_token=tok', storage)
    expect(outcome).toMatchObject({ kind: 'token', pickedFileId: 'file-1' })
  })

  it('signale l’absence de fichier choisi', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc', 'vocab-review.pending-sync': '1' })
    const outcome = consumeRedirect('#state=abc&access_token=tok', storage)
    expect(outcome).toEqual({ kind: 'token', accessToken: 'tok', pickedFileId: null, resumeSync: true })
  })

  it('signale un state différent de celui envoyé', () => {
    const storage = memoryStorage({ 'vocab-review.oauth-state': 'abc' })
    expect(consumeRedirect('#state=evil&access_token=tok', storage)).toEqual({ kind: 'error', error: 'state-mismatch' })
    expect(consumeRedirect('#state=abc&access_token=tok', memoryStorage())).toEqual({ kind: 'error', error: 'state-mismatch' })
  })

  it('distingue le refus de l’utilisateur des autres erreurs Google', () => {
    const denied = consumeRedirect('#state=abc&error=access_denied', memoryStorage({ 'vocab-review.oauth-state': 'abc' }))
    const other = consumeRedirect('#state=abc&error=invalid_scope', memoryStorage({ 'vocab-review.oauth-state': 'abc' }))
    expect(denied).toEqual({ kind: 'error', error: 'auth-denied' })
    expect(other).toEqual({ kind: 'error', error: 'auth-failed' })
  })
})
