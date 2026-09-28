import { describe, expect, it } from 'vitest'
import { word } from './test/builders'
import { DriveError, type DriveApi, type DriveFile } from './google/drive'
import { runSync, type SyncInput } from './sync'

const now = new Date('2026-09-27T10:00:00.000Z')
const file: DriveFile = { id: 'f1', name: 'Saved translations Sept2026', modifiedTime: '2026-09-27T09:00:00.000Z' }

function fakeDrive(options: { csv?: string; error?: Error } = {}): DriveApi & { read: string[]; exported: string[] } {
  const drive = {
    read: [] as string[],
    exported: [] as string[],
    async getFile(_token: string, fileId: string) {
      if (options.error) throw options.error
      drive.read.push(fileId)
      return { ...file, id: fileId }
    },
    async exportCsv(_token: string, fileId: string) {
      drive.exported.push(fileId)
      return options.csv ?? 'English,French,reach,atteindre\n'
    },
  }
  return drive
}

const input = (overrides: Partial<SyncInput> = {}): SyncInput => ({
  token: 'tok',
  fileId: 'f1',
  online: true,
  snapshot: { words: [], syncMeta: null },
  drive: fakeDrive(),
  now,
  ...overrides,
})

describe('runSync', () => {
  it('signale l’absence de réseau avant tout', async () => {
    expect(await runSync(input({ online: false, token: null, fileId: null }))).toEqual({ kind: 'error', error: 'offline' })
  })

  it('passe par Google (connexion et choix du fichier) sans jeton', async () => {
    expect(await runSync(input({ token: null, fileId: null }))).toEqual({ kind: 'need-auth' })
  })

  it('signale qu’aucun fichier n’a été choisi dans le sélecteur', async () => {
    const drive = fakeDrive()
    expect(await runSync(input({ fileId: null, drive }))).toEqual({ kind: 'error', error: 'no-file-chosen' })
    expect(drive.read).toEqual([])
  })

  it('lit le fichier choisi, fusionne et prépare les infos de synchro', async () => {
    const drive = fakeDrive()
    const outcome = await runSync(input({ drive, fileId: 'picked', snapshot: { words: [word('gone')], syncMeta: null } }))
    expect(drive.read).toEqual(['picked'])
    expect(drive.exported).toEqual(['picked'])
    if (outcome.kind !== 'merged') throw new Error(outcome.kind)
    expect(outcome.merge.stats).toEqual({ added: 1, removed: 1, restored: 0 })
    expect(outcome.meta).toEqual({ fileId: 'picked', modifiedTime: file.modifiedTime, syncedAt: now.toISOString() })
  })

  it('ne crée qu’un mot pour une expression enregistrée dans les deux sens', async () => {
    const drive = fakeDrive({ csv: 'English,French,reach,atteindre\nFrench,English,atteindre,Reach\n' })
    const outcome = await runSync(input({ drive }))
    if (outcome.kind !== 'merged') throw new Error(outcome.kind)
    expect(outcome.merge.words.map((w) => [w.en, w.fr])).toEqual([['reach', ['atteindre']]])
    expect(outcome.merge.newCards).toHaveLength(2)
  })

  it('ne retélécharge pas un fichier déjà importé et inchangé', async () => {
    const drive = fakeDrive()
    const syncMeta = { fileId: 'f1', modifiedTime: file.modifiedTime, syncedAt: '2026-09-26T10:00:00.000Z' }
    expect(await runSync(input({ drive, snapshot: { words: [], syncMeta } }))).toEqual({ kind: 'up-to-date' })
    expect(drive.exported).toEqual([])
  })

  it('réimporte un fichier modifié depuis la dernière synchro', async () => {
    const syncMeta = { fileId: 'f1', modifiedTime: '2026-09-20T09:00:00.000Z', syncedAt: '2026-09-20T10:00:00.000Z' }
    expect((await runSync(input({ snapshot: { words: [], syncMeta } }))).kind).toBe('merged')
  })

  it('refuse un fichier sans aucune paire reconnue, pour ne pas tout marquer « retiré »', async () => {
    const drive = fakeDrive({ csv: 'Spanish,French,hola,bonjour\n' })
    const outcome = await runSync(input({ drive, snapshot: { words: [word('keep')], syncMeta: null } }))
    expect(outcome).toEqual({ kind: 'error', error: 'unrecognized-format' })
  })

  it('abandonne sur un 401, le jeton venant toujours d’être obtenu', async () => {
    const outcome = await runSync(input({ drive: fakeDrive({ error: new DriveError(401) }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'auth-failed' })
  })

  it('remonte les autres erreurs Drive avec leur code', async () => {
    const outcome = await runSync(input({ drive: fakeDrive({ error: new DriveError(404) }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'drive-error', status: 404 })
  })

  it('traite un échec réseau de fetch comme une absence de connexion', async () => {
    const outcome = await runSync(input({ drive: fakeDrive({ error: new TypeError('Load failed') }) }))
    expect(outcome).toEqual({ kind: 'error', error: 'offline' })
  })
})
