import { useMemo, useState } from 'preact/hooks'
import { answer, canUndo, currentCard, progress, startSession, summary, undo, type Step } from '../domain/session'
import type { Grade, StoredCard, Word } from '../domain/types'

type Props = {
  queue: StoredCard[]
  words: Word[]
  onSave: (card: StoredCard) => Promise<void>
  onExit: () => void
}

export function Review({ queue, words, onSave, onExit }: Props) {
  const [state, setState] = useState(() => startSession(queue))
  const [flipped, setFlipped] = useState(false)
  const byKey = useMemo(() => new Map(words.map((w) => [w.key, w])), [words])

  async function apply(step: Step) {
    setState(step.state)
    setFlipped(false)
    if (step.save) await onSave(step.save)
  }

  const card = currentCard(state)
  if (!card) {
    const { total, percent } = summary(state)
    return (
      <main class="screen done">
        <h2>Terminé</h2>
        <p>
          {total} {total > 1 ? 'cartes' : 'carte'} · {percent} % sues
        </p>
        <button class="primary big" onClick={onExit}>
          Retour
        </button>
        {canUndo(state) && (
          <button class="ghost" onClick={() => void apply(undo(state))}>
            Annuler la dernière réponse
          </button>
        )}
      </main>
    )
  }

  const word = byKey.get(card.wordKey)
  const english = word?.en ?? card.wordKey
  const french = word?.fr.join(' ; ') ?? ''
  const [front, back] = card.direction === 'en-fr' ? [english, french] : [french, english]
  const { done, total } = progress(state)
  const grade = (g: Grade) => void apply(answer(state, g, new Date()))
  const size = (text: string) => (text.length > 40 ? ' long' : '')

  return (
    <main class="screen review">
      <header class="topbar">
        <button class="ghost" onClick={onExit}>
          Fermer
        </button>
        <span class="progress">
          {done} / {total}
        </span>
        <button class="ghost" disabled={!canUndo(state)} onClick={() => void apply(undo(state))}>
          Annuler
        </button>
      </header>

      <button class="card" onClick={() => setFlipped(true)} aria-label={flipped ? 'Carte retournée' : 'Retourner la carte'}>
        <span class="direction">{card.direction === 'en-fr' ? 'Anglais → Français' : 'Français → Anglais'}</span>
        <span class={`front${size(front)}`}>{front}</span>
        {flipped ? <span class={`back${size(back)}`}>{back}</span> : <span class="hint">Touche pour voir la réponse</span>}
      </button>

      <footer class="answers">
        {flipped && (
          <>
            <button class="fail" onClick={() => grade('pas-su')}>
              Pas su
            </button>
            <button class="pass" onClick={() => grade('su')}>
              Su
            </button>
          </>
        )}
      </footer>
    </main>
  )
}
