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
  | 'no-export'
  | 'unrecognized-format'
  | 'drive-error'

export type SyncOutcome =
  | { kind: 'need-auth' }
  | { kind: 'up-to-date' }
  | { kind: 'merged'; merge: MergeResult; meta: SyncMeta }
  | { kind: 'error'; error: SyncError; status?: number }

export type SyncInput = {
  /** Jeton utilisable, ou null s'il faut passer par Google. */
  token: string | null
  /** Vrai si le jeton vient d'être obtenu : un 401 ne relance alors pas une redirection. */
  freshToken: boolean
  online: boolean
  snapshot: Pick<Snapshot, 'words' | 'syncMeta'>
  drive: DriveApi
  now: Date
}

/** Récupère le dernier export et calcule la fusion ; n'écrit rien. */
export async function runSync({ token, freshToken, online, snapshot, drive, now }: SyncInput): Promise<SyncOutcome> {
  if (!online) return { kind: 'error', error: 'offline' }
  if (!token) return { kind: 'need-auth' }
  try {
    const file = await drive.findLatestExport(token)
    if (!file) return { kind: 'error', error: 'no-export' }
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
      if (error.status === 401) return freshToken ? { kind: 'error', error: 'auth-failed' } : { kind: 'need-auth' }
      return { kind: 'error', error: 'drive-error', status: error.status }
    }
    if (error instanceof TypeError) return { kind: 'error', error: 'offline' } // échec réseau de fetch
    throw error
  }
}
