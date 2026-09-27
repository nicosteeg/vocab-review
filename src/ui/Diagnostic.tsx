import { useEffect, useState } from 'preact/hooks'
import { EXPORT_FILE_NAMES, GOOGLE_CLIENT_ID, redirectUri } from '../config'
import { beginAuth, consumeRedirect } from '../google/auth'
import { createDriveApi } from '../google/drive'

/** Écran provisoire (tâche 4) : vérifie la connexion Google et montre le début du dernier export. */
export function Diagnostic() {
  const [lines, setLines] = useState<string[]>(['Pas encore testé.'])

  useEffect(() => {
    const outcome = consumeRedirect(location.hash, localStorage, Date.now())
    if (outcome.kind === 'none') return
    history.replaceState(null, '', location.pathname + location.search)
    if (outcome.kind === 'error') setLines([`Erreur : ${outcome.error}`])
    else void inspect(outcome.token.accessToken)
  }, [])

  async function inspect(token: string) {
    setLines(['Connecté. Recherche de l’export…'])
    try {
      const file = await createDriveApi(EXPORT_FILE_NAMES).findLatestExport(token)
      if (file) {
        const csv = await createDriveApi(EXPORT_FILE_NAMES).exportCsv(token, file.id)
        setLines([`Fichier : ${file.name}`, `Modifié : ${file.modifiedTime}`, '— 5 premières lignes —', ...csv.split('\n').slice(0, 5)])
        return
      }
      const params = new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        orderBy: 'modifiedTime desc',
        pageSize: '5',
        fields: 'files(name,modifiedTime)',
      })
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = (await response.json()) as { files?: { name: string; modifiedTime: string }[] }
      setLines(['Aucun export trouvé avec les noms connus. Feuilles récentes :', ...(body.files ?? []).map((f) => `${f.name} (${f.modifiedTime})`)])
    } catch (error) {
      setLines([`Erreur : ${String(error)}`])
    }
  }

  function connect() {
    const request = { clientId: GOOGLE_CLIENT_ID, redirectUri: redirectUri(), state: crypto.randomUUID() }
    location.assign(beginAuth(request, localStorage))
  }

  return (
    <main style={{ fontFamily: '-apple-system, sans-serif', padding: 'calc(env(safe-area-inset-top) + 16px) 16px' }}>
      <h1>Test de connexion</h1>
      <button style={{ fontSize: '1.1rem', padding: '14px 20px' }} onClick={connect}>
        Se connecter à Google
      </button>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{lines.join('\n')}</pre>
    </main>
  )
}
