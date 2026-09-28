/** Propose le fichier via la feuille de partage (iOS : « Enregistrer dans Fichiers »), sinon le télécharge. */
export async function shareOrDownload(fileName: string, text: string): Promise<void> {
  const file = new File([text], fileName, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (error) {
      if ((error as Error).name !== 'AbortError') throw error
    }
    return
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
