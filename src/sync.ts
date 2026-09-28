import { parseExport } from './domain/csv'
import { mergeImport, type MergeResult } from './domain/merge'
import type { SyncMeta } from './domain/types'
import { DriveError, type DriveApi } from './google/drive'
import type { Snapshot } from './storage/db'

export type SyncError =
  | 'offline'
  | 'auth-denied'
  | 'auth-failed'
  | 'state-mismatch'
  | 'no-file-chosen'
  | 'unrecognized-format'
  | 'drive-error'

export type SyncOutcome =
  | { kind: 'need-auth' }
  | { kind: 'up-to-date' }
  | { kind: 'merged'; merge: MergeResult; meta: SyncMeta }
  | { kind: 'error'; error: SyncError; status?: number }

export type SyncInput = {
  /** Jeton reçu au retour du sélecteur Google, ou null s'il faut y passer. */
  token: string | null
  /** Fichier choisi dans le sélecteur, ou null si rien n'a été choisi. */
  fileId: string | null
  online: boolean
  snapshot: Pick<Snapshot, 'words' | 'syncMeta'>
  drive: DriveApi
  now: Date
}

/** Lit le fichier choisi et calcule la fusion ; n'écrit rien. */
export async function runSync({ token, fileId, online, snapshot, drive, now }: SyncInput): Promise<SyncOutcome> {
  if (!online) return { kind: 'error', error: 'offline' }
  if (!token) return { kind: 'need-auth' }
  if (!fileId) return { kind: 'error', error: 'no-file-chosen' }
  try {
    const file = await drive.getFile(token, fileId)
    const last = snapshot.syncMeta
    if (last && last.fileId === file.id && last.modifiedTime === file.modifiedTime) return { kind: 'up-to-date' }

    const { pairs } = parseExport(await drive.exportCsv(token, file.id))
    if (pairs.length === 0) return { kind: 'error', error: 'unrecognized-format' }

    return {
      kind: 'merged',
      merge: mergeImport(snapshot.words, pairs, now),
      meta: { fileId: file.id, modifiedTime: file.modifiedTime, syncedAt: now.toISOString() },
    }
  } catch (error) {
    if (error instanceof DriveError) {
      // Le jeton vient toujours d'être obtenu : un 401 n'est pas un simple jeton expiré
      if (error.status === 401) return { kind: 'error', error: 'auth-failed' }
      return { kind: 'error', error: 'drive-error', status: error.status }
    }
    if (error instanceof TypeError) return { kind: 'error', error: 'offline' } // échec réseau de fetch
    throw error
  }
}
