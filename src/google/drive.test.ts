import { describe, expect, it, vi } from 'vitest'
import { createDriveApi, DriveError, exportQuery } from './drive'

const names = ['Saved translations', "L'export"]
const reply = (status: number, body: string) => new Response(body, { status })

describe('Drive', () => {
  it('cherche la feuille d’export la plus récente par nom', async () => {
    const file = { id: 'f1', name: 'Saved translations', modifiedTime: '2026-09-27T09:00:00.000Z' }
    const fetchFn = vi.fn(async () => reply(200, JSON.stringify({ files: [file] })))
    const drive = createDriveApi(names, fetchFn)

    expect(await drive.findLatestExport('tok')).toEqual(file)

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    const params = new URL(url).searchParams
    expect(url.startsWith('https://www.googleapis.com/drive/v3/files?')).toBe(true)
    expect(params.get('q')).toBe(exportQuery(names))
    expect(params.get('orderBy')).toBe('modifiedTime desc')
    expect(params.get('pageSize')).toBe('1')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('échappe les apostrophes dans la requête', () => {
    expect(exportQuery(["L'export"])).toBe(
      "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'L\\'export')",
    )
  })

  it('renvoie null quand aucune feuille ne correspond', async () => {
    const drive = createDriveApi(names, async () => reply(200, JSON.stringify({ files: [] })))
    expect(await drive.findLatestExport('tok')).toBeNull()
  })

  it('exporte la feuille en CSV', async () => {
    const fetchFn = vi.fn(async () => reply(200, 'English,French,reach,atteindre\n'))
    const drive = createDriveApi(names, fetchFn)
    expect(await drive.exportCsv('tok', 'f/1')).toBe('English,French,reach,atteindre\n')
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://www.googleapis.com/drive/v3/files/f%2F1/export?mimeType=text%2Fcsv',
    )
  })

  it('lève une DriveError avec le code HTTP en cas d’échec', async () => {
    const drive = createDriveApi(names, async () => reply(401, 'nope'))
    await expect(drive.findLatestExport('tok')).rejects.toEqual(new DriveError(401))
    await expect(drive.exportCsv('tok', 'f1')).rejects.toMatchObject({ status: 401 })
  })
})
