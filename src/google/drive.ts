export type DriveFile = { id: string; name: string; modifiedTime: string }

export type DriveApi = {
  /** Nom et date de modification du fichier choisi dans le sélecteur. */
  getFile(token: string, fileId: string): Promise<DriveFile>
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

export function createDriveApi(fetchFn: Fetch = (input, init) => fetch(input, init)): DriveApi {
  async function get(url: string, token: string): Promise<Response> {
    const response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) throw new DriveError(response.status)
    return response
  }

  return {
    async getFile(token, fileId) {
      const params = new URLSearchParams({ fields: 'id,name,modifiedTime' })
      return (await (await get(`${API}/${encodeURIComponent(fileId)}?${params}`, token)).json()) as DriveFile
    },
    async exportCsv(token, fileId) {
      const response = await get(`${API}/${encodeURIComponent(fileId)}/export?mimeType=text%2Fcsv`, token)
      return response.text()
    },
  }
}
