import { describe, expect, it } from 'vitest'
import { errorMessage, mergeMessage, syncMessage } from './messages'

describe('messages', () => {
  it('résume une synchro avec les bons pluriels', () => {
    expect(mergeMessage({ added: 12, removed: 1, restored: 0 })).toBe('12 nouveaux mots · 1 retiré')
    expect(mergeMessage({ added: 1, removed: 0, restored: 2 })).toBe('1 nouveau mot · 0 retiré · 2 revenus')
  })

  it('indique le code HTTP d’une erreur Drive', () => {
    expect(errorMessage('drive-error', 503)).toBe('Erreur Google Drive (503).')
  })

  it('explique comment exporter quand aucun export n’est trouvé', () => {
    expect(errorMessage('no-export')).toContain('Exporter vers Google Sheets')
  })

  it('dit « Déjà à jour » quand rien n’a changé', () => {
    expect(syncMessage({ kind: 'up-to-date' })).toBe('Déjà à jour.')
  })
})
