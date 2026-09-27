import { describe, expect, it } from 'vitest'
import { word } from './test/builders'
import { DriveError, type DriveApi, type DriveFile } from './google/drive'
import { runSync, type SyncInput } from './sync'

const now = new Date('2026-09-27T10:00:00.000Z')
const file: DriveFile = { id: 'f1', name: 'Saved translations', modifiedTime: '2026-09-27T09:00:00.000Z' }

function fakeDrive(options: { file?: DriveFile | null; csv?: string; error?: Error } = {}): DriveApi & { exports: number } {
  const drive = {
    exports: 0,
    async findLatestExport() {
      if (options.error) throw options.error
      return options.file === undefined ? file : options.file
    },
    async exportCsv() {
      drive.exports++
      return options.csv ?? 'English,French,reach,atteindre\n'
    },
  }
  return drive
}

const input = (overrides: Partial<SyncInput> = {}): SyncInput => ({
  token: 'tok',
  freshToken: false,
  online: true,
  snapshot: { words: [], syncMeta: null },
  drive: fakeDrive(),
  now,
  ...overrides,
})

describe('runSync', () => {
  it('signale l’absence de réseau avant tout', async () => {
    expect(await runSync(input({ online: false, token: null }))).toEqual({ kind: 'error', error: 'offline' })
  })

  it('demande une connexion Google sans jeton utilisable', async () => {
    expect(await runSync(input({ token: null }))).toEqual({ kind: 'need-auth' })
  })

  it('fusionne le dernier export et prépare les infos de synchro', async () => {
    const outcome = await runSync(input({ snapshot: { words: [word('gone')], syncMeta: null } }))
    expect(outcome.kind).toBe('merged')
    if (outcome.kind !== 'merged') return
    expect(outcome.merge.stats).toEqual({ added: 1, removed: 1, restored: 0 })
    expect(outcome.meta).toEqual({ fileId: 'f1', modifiedTime: file.modifiedTime, syncedAt: now.toISOString() })
  })

  it('ne crée qu’un mot pour une expression enregistrée dans les deux sens', async () => {
    const drive = fakeDrive({ csv: 'English,French,reach,atteindre\nFrench,English,atteindre,Reach\n' })
    const outcome = await runSync(input({ drive }))
    if (outcome.kind !== 'merged') throw new Error(outcome.kind)
    expect(outcome.merge.words.map((w) => [w.en, w.fr])).toEqual([['reach', ['atteindre']]])
    expect(outcome.merge.newCards).toHaveLength(2)
  })

  it('ne retélécharge pas un export déjà importé', async () => {
    const drive = fakeDrive()
    const syncMeta = { fileId: 'f1', modifiedTime: file.modifiedTime, syncedAt: '2026-09-26T10:00:00.000Z' }
    expect(await runSync(input({ drive, snapshot: { words: [], syncMeta } }))).toEqual({ kind: 'up-to-date' })
    expect(drive.exports).toBe(0)
  })

  it('réimporte un export modifié depuis la dernière synchro', async () => {
    const syncMeta = { fileId: 'f1', modifiedTime: '2026-09-20T09:00:00.000Z', syncedAt: '2026-09-20T10:00:00.000Z' }
    expect((await runSync(input({ snapshot: { words: [], syncMeta } }))).kind).toBe('merged')
  })

  it('signale l’absence d’export dans Drive', async () => {
    expect(await runSync(input({ drive: fakeDrive({ file: null }) }))).toEqual({ kind: 'error', error: 'no-export' })
  })

  it('refuse un export sans aucune paire reconnue, pour ne pas tout marquer « retiré »', async () => {
    const drive = fakeDrive({ csv: 'Spanish,French,hola,bonjour\n' })
    const outcome = await runSync(input({ drive, snapshot: { words: [word('keep')], syncMeta: null } }))
    expect(outcome).toEqual({ kind: 'error', error: 'unrecognized-format' })
  })

  it('redemande une connexion sur un 401 avec un ancien jeton', async () => {
    expect(await runSync(input({ drive: fakeDrive({ error: new DriveError(401) }) }))).toEqual({ kind: 'need-auth' })
  })

  it('abandonne sur un 401 avec un jeton tout neuf', async () => {
    const outcome = await runSync(input({ freshToken: true, drive: fakeDrive({ error: new DriveError(401) }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'auth-failed' })
  })

  it('remonte les autres erreurs Drive avec leur code', async () => {
    const outcome = await runSync(input({ drive: fakeDrive({ error: new DriveError(503) }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'drive-error', status: 503 })
  })

  it('traite un échec réseau de fetch comme une absence de connexion', async () => {
    const outcome = await runSync(input({ drive: fakeDrive({ error: new TypeError('Load failed') }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'offline' })
  })
})
