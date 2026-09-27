export type DriveFile = { id: string; name: string; modifiedTime: string }

export type DriveApi = {
  /** Feuille d'export Google Translate la plus récente, ou null s'il n'y en a pas. */
  findLatestExport(token: string): Promise<DriveFile | null>
  /** Contenu CSV du premier onglet de la feuille. */
  exportCsv(token: string, fileId: string): Promise<string>
}

export class DriveError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`Google Drive a répondu ${status}`)
    this.name = 'DriveError'
    this.status = status
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

const API = 'https://www.googleapis.com/drive/v3/files'
const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export function exportQuery(names: string[]): string {
  const byName = names.map((n) => `name contains ${quote(n)}`).join(' or ')
  return `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (${byName})`
}

export function createDriveApi(names: string[], fetchFn: Fetch = (input, init) => fetch(input, init)): DriveApi {
  async function get(url: string, token: string): Promise<Response> {
    const response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new DriveError(response.status)
    return response
  }

  return {
    async findLatestExport(token) {
      const params = new URLSearchParams({
        q: exportQuery(names),
        orderBy: 'modifiedTime desc',
        pageSize: '1',
        fields: 'files(id,name,modifiedTime)',
      })
      const body = (await (await get(`${API}?${params}`, token)).json()) as { files?: DriveFile[] }
      return body.files?.[0] ?? null
    },
    async exportCsv(token, fileId) {
      const response = await get(`${API}/${encodeURIComponent(fileId)}/export?mimeType=text%2Fcsv`, token)
      return response.text()
    },
  }
}
