import type { MergeStats } from '../domain/merge'
import type { SyncError, SyncOutcome } from '../sync'

export const EXPORT_HELP =
  'Sur un ordinateur, ouvre translate.google.com → Enregistrées → Exporter vers Google Sheets. Puis touche Synchroniser et choisis la feuille « Saved translations » la plus récente.'

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export function mergeMessage({ added, removed, restored }: MergeStats): string {
  const parts = [plural(added, 'nouveau mot', 'nouveaux mots'), plural(removed, 'retiré', 'retirés')]
  if (restored > 0) parts.push(plural(restored, 'revenu', 'revenus'))
  return parts.join(' · ')
}

export function errorMessage(error: SyncError, status?: number): string {
  switch (error) {
    case 'offline':
      return 'Pas de connexion. Tu peux quand même réviser.'
    case 'auth-denied':
      return 'Accès Google refusé.'
    case 'auth-failed':
      return 'Connexion Google impossible.'
    case 'state-mismatch':
      return 'Connexion interrompue, réessaie.'
    case 'no-file-chosen':
      return `Aucun fichier choisi. ${EXPORT_HELP}`
    case 'unrecognized-format':
      return 'Format de l’export non reconnu. Rien n’a été modifié.'
    case 'drive-error':
      return `Erreur Google Drive (${status ?? '?'}).`
  }
}

export function syncMessage(outcome: Exclude<SyncOutcome, { kind: 'need-auth' }>): string {
  switch (outcome.kind) {
    case 'up-to-date':
      return 'Déjà à jour.'
    case 'merged':
      return mergeMessage(outcome.merge.stats)
    case 'error':
      return errorMessage(outcome.error, outcome.status)
  }
}
