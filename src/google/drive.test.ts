import { describe, expect, it, vi } from 'vitest'
import { createDriveApi, DriveError } from './drive'

const reply = (status: number, body: string) => new Response(body, { status })

describe('Drive', () => {
  it('lit le nom et la date de modification du fichier choisi', async () => {
    const file = { id: 'f/1', name: 'Saved translations Sept2026', modifiedTime: '2026-09-27T09:00:00.000Z' }
    const fetchFn = vi.fn(async () => reply(200, JSON.stringify(file)))
    const drive = createDriveApi(fetchFn)

    expect(await drive.getFile('tok', 'f/1')).toEqual(file)

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://www.googleapis.com/drive/v3/files/f%2F1?fields=id%2Cname%2CmodifiedTime')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('exporte la feuille en CSV', async () => {
    const fetchFn = vi.fn(async () => reply(200, 'English,French,reach,atteindre\n'))
    const drive = createDriveApi(fetchFn)
    expect(await drive.exportCsv('tok', 'f/1')).toBe('English,French,reach,atteindre\n')
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://www.googleapis.com/drive/v3/files/f%2F1/export?mimeType=text%2Fcsv',
    )
  })

  it('lève une DriveError avec le code HTTP en cas d’échec', async () => {
    const drive = createDriveApi(async () => reply(404, 'nope'))
    await expect(drive.getFile('tok', 'f1')).rejects.toEqual(new DriveError(404))
    await expect(drive.exportCsv('tok', 'f1')).rejects.toMatchObject({ status: 404 })
  })
})
