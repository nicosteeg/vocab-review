import { useState } from 'preact/hooks'
import { DIRECTIONS, type Directions, type Settings as SettingsValue } from '../domain/types'
import { backupFileName, makeBackup, parseBackup } from '../storage/backup'
import type { Snapshot } from '../storage/db'
import { EXPORT_HELP } from './messages'
import { shareOrDownload } from './share'

type Props = {
  snapshot: Snapshot
  persistDenied: boolean
  onSaveSettings: (settings: SettingsValue) => Promise<void>
  onRestore: (snapshot: Snapshot) => Promise<void>
  onBack: () => void
}

const DIRECTION_LABELS: Record<Directions, string> = {
  both: 'Les deux sens',
  'en-fr': 'Anglais → Français',
  'fr-en': 'Français → Anglais',
}

export function Settings({ snapshot, persistDenied, onSaveSettings, onRestore, onBack }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const active = snapshot.words.filter((w) => w.status === 'actif').length

  async function exportBackup() {
    const now = new Date()
    try {
      await shareOrDownload(backupFileName(now), JSON.stringify(makeBackup(snapshot, now)))
    } catch (error) {
      setMessage(`Export impossible : ${String(error)}`)
    }
  }

  async function restore(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const restored = parseBackup(await file.text())
      if (!confirm('Remplacer toutes les données actuelles ?')) return
      await onRestore(restored)
      setMessage(`Sauvegarde restaurée : ${restored.words.length} mots.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  function changeNewPerDay(event: Event) {
    const value = Math.round(Number((event.currentTarget as HTMLInputElement).value))
    if (Number.isFinite(value) && value >= 0 && value <= 100) void onSaveSettings({ ...snapshot.settings, newPerDay: value })
  }

  function changeDirections(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value as Directions
    if (DIRECTIONS.includes(value)) void onSaveSettings({ ...snapshot.settings, directions: value })
  }

  return (
    <main class="screen settings">
      <header class="topbar">
        <button class="ghost" onClick={onBack}>
          Retour
        </button>
        <h1>Réglages</h1>
        <span />
      </header>

      <section>
        <label class="row">
          Nouvelles cartes par jour
          <input type="number" inputMode="numeric" min={0} max={100} value={snapshot.settings.newPerDay} onChange={changeNewPerDay} />
        </label>
        <label class="row">
          Sens de révision
          <select value={snapshot.settings.directions} onChange={changeDirections}>
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {DIRECTION_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <p class="note">{active} mots actifs.</p>
      </section>

      <section>
        <h2>Sauvegarde</h2>
        <button class="secondary" onClick={() => void exportBackup()}>
          Exporter une sauvegarde
        </button>
        <label class="secondary file">
          Restaurer une sauvegarde
          <input type="file" accept="application/json,.json" onChange={(e) => void restore(e)} />
        </label>
        {persistDenied && <p class="note warning">Le stockage de l’app n’est pas garanti sur cet appareil : fais des sauvegardes régulières.</p>}
        {message && (
          <p class="message" role="status">
            {message}
          </p>
        )}
      </section>

      <section>
        <h2>Ajouter des mots</h2>
        <p class="note">{EXPORT_HELP}</p>
      </section>
    </main>
  )
}
