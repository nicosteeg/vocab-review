import { describe, expect, it, vi } from 'vitest'
import { onBecomeVisible } from './visibility'

function fakeDocument(state: DocumentVisibilityState) {
  return Object.assign(new EventTarget(), { visibilityState: state })
}

describe('onBecomeVisible', () => {
  it('prévient quand l’app redevient visible (retour d’arrière-plan sur iOS)', () => {
    const doc = fakeDocument('visible')
    const callback = vi.fn()
    onBecomeVisible(doc, callback)
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('ne prévient pas quand l’app passe en arrière-plan', () => {
    const doc = fakeDocument('hidden')
    const callback = vi.fn()
    onBecomeVisible(doc, callback)
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(callback).not.toHaveBeenCalled()
  })

  it('ne prévient plus après désabonnement', () => {
    const doc = fakeDocument('visible')
    const callback = vi.fn()
    const unsubscribe = onBecomeVisible(doc, callback)
    unsubscribe()
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(callback).not.toHaveBeenCalled()
  })
})
