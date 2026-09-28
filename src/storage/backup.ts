import { DIRECTIONS, type Directions } from '../domain/types'
import type { Snapshot } from './db'

export type Backup = Snapshot & { app: 'vocab-review'; version: 1; exportedAt: string }

export class InvalidBackupError extends Error {
  constructor(reason: string) {
    super(`Sauvegarde invalide : ${reason}`)
    this.name = 'InvalidBackupError'
  }
}

export function makeBackup(snapshot: Snapshot, now: Date): Backup {
  return { app: 'vocab-review', version: 1, exportedAt: now.toISOString(), ...snapshot }
}

/** Nom du fichier, avec la date locale : vocab-review-AAAA-MM-JJ.json */
export function backupFileName(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `vocab-review-${now.getFullYear()}-${month}-${day}.json`
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isWord(v: unknown): boolean {
  return (
    isObject(v) && isString(v.key) && isString(v.en) && Array.isArray(v.fr) && v.fr.every(isString) &&
    (v.status === 'actif' || v.status === 'retiré') && isString(v.addedAt) && isNumber(v.order)
  )
}

function isCard(v: unknown): boolean {
  if (!isObject(v) || !isObject(v.fsrs)) return false
  const f = v.fsrs
  return (
    isString(v.id) && isString(v.wordKey) && (v.direction === 'en-fr' || v.direction === 'fr-en') &&
    (v.introducedAt === undefined || isString(v.introducedAt)) &&
    isString(f.due) && (f.last_review === undefined || isString(f.last_review)) &&
    ['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state'].every((k) =>
      isNumber(f[k]),
    )
  )
}

function isSyncMeta(v: unknown): boolean {
  return isObject(v) && isString(v.fileId) && isString(v.modifiedTime) && isString(v.syncedAt)
}

/** Lit et vérifie un fichier de sauvegarde ; lève InvalidBackupError sinon. */
export function parseBackup(text: string): Snapshot {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new InvalidBackupError('ce n’est pas du JSON')
  }
  if (!isObject(data) || data.app !== 'vocab-review') throw new InvalidBackupError('ce n’est pas une sauvegarde Vocab Review')
  if (data.version !== 1) throw new InvalidBackupError(`version ${String(data.version)} inconnue`)
  if (!Array.isArray(data.words) || !data.words.every(isWord)) throw new InvalidBackupError('mots illisibles')
  if (!Array.isArray(data.cards) || !data.cards.every(isCard)) throw new InvalidBackupError('cartes illisibles')
  if (!isObject(data.settings) || !isNumber(data.settings.newPerDay)) throw new InvalidBackupError('réglages illisibles')
  // Absent des sauvegardes faites avant l'arrivée du réglage : les deux sens
  const directions = data.settings.directions ?? 'both'
  if (!DIRECTIONS.includes(directions as Directions)) throw new InvalidBackupError('sens de révision inconnu')
  if (data.syncMeta !== null && !isSyncMeta(data.syncMeta)) throw new InvalidBackupError('infos de synchro illisibles')
  return {
    words: data.words as Snapshot['words'],
    cards: data.cards as Snapshot['cards'],
    settings: { newPerDay: data.settings.newPerDay, directions: directions as Directions },
    syncMeta: data.syncMeta as Snapshot['syncMeta'],
  }
}
