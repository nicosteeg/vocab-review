import { describe, expect, it } from 'vitest'
import { card } from '../test/builders'
import { answer, canUndo, currentCard, progress, startSession, summary, undo } from './session'
import { isNew } from './scheduler'

const now = new Date('2026-09-27T10:00:00.000Z')
const a = card('a', 'en-fr')
const b = card('b', 'en-fr')

describe('session', () => {
  it('commence sur la première carte de la file', () => {
    const state = startSession([a, b])
    expect(currentCard(state)?.id).toBe('a:en-fr')
    expect(progress(state)).toEqual({ done: 0, total: 2 })
    expect(canUndo(state)).toBe(false)
  })

  it('« Su » retire la carte et renvoie sa nouvelle planification à enregistrer', () => {
    const { state, save } = answer(startSession([a, b]), 'su', now)
    expect(state.queue.map((c) => c.id)).toEqual(['b:en-fr'])
    expect(save?.id).toBe('a:en-fr')
    expect(isNew(save!.fsrs)).toBe(false)
    expect(save?.introducedAt).toBe(now.toISOString())
    expect(progress(state)).toEqual({ done: 1, total: 2 })
  })

  it('« Pas su » renvoie la carte en fin de file et l’enregistre', () => {
    const { state, save } = answer(startSession([a, b]), 'pas-su', now)
    expect(state.queue.map((c) => c.id)).toEqual(['b:en-fr', 'a:en-fr'])
    expect(save?.fsrs.last_review).toBe(now.toISOString())
    expect(progress(state)).toEqual({ done: 0, total: 2 })
  })

  it('ne replanifie pas une carte déjà répondue dans la session', () => {
    let step = answer(startSession([a]), 'pas-su', now)
    const firstSave = step.save
    step = answer(step.state, 'pas-su', now)
    expect(step.save).toBeUndefined()
    expect(step.state.queue).toEqual([firstSave])
    step = answer(step.state, 'su', now)
    expect(step.save).toBeUndefined()
    expect(step.state.queue).toEqual([])
  })

  it('garde introducedAt d’une carte déjà introduite', () => {
    const seen = card('s', 'en-fr', { lastReview: '2026-09-20T10:00:00.000Z', due: '2026-09-27T09:00:00.000Z' })
    const { save } = answer(startSession([seen]), 'su', now)
    expect(save?.introducedAt).toBe('2026-09-20T10:00:00.000Z')
  })

  it('« Annuler » remet la file et renvoie la carte d’avant la réponse, une seule fois', () => {
    const started = startSession([a, b])
    const answered = answer(started, 'su', now).state
    const undone = undo(answered)
    expect(undone.state.queue).toEqual([a, b])
    expect(undone.save).toEqual(a)
    expect(canUndo(undone.state)).toBe(false)
    expect(undo(undone.state).save).toBeUndefined()
  })

  it('après « Annuler », la réponse suivante replanifie à nouveau la carte', () => {
    const answered = answer(startSession([a]), 'pas-su', now).state
    const redo = answer(undo(answered).state, 'su', now)
    expect(redo.save).toBeDefined()
    expect(redo.state.queue).toEqual([])
  })

  it('calcule le pourcentage sur la première réponse à chaque carte', () => {
    let state = startSession([a, b])
    state = answer(state, 'pas-su', now).state // a : raté
    state = answer(state, 'su', now).state // b : su
    state = answer(state, 'su', now).state // a : su au 2e essai, ne compte pas
    expect(currentCard(state)).toBeUndefined()
    expect(summary(state)).toEqual({ total: 2, percent: 50 })
  })

  it('permet d’annuler la dernière réponse d’une session terminée', () => {
    const finished = answer(startSession([a]), 'su', now).state
    expect(currentCard(finished)).toBeUndefined()
    expect(canUndo(finished)).toBe(true)
    const undone = undo(finished)
    expect(currentCard(undone.state)).toEqual(a)
    expect(undone.save).toEqual(a)
  })

  it('en révision libre, une réponse ne replanifie ni n’enregistre la carte', () => {
    const { state, save } = answer(startSession([a, b], { practice: true }), 'su', now)
    expect(save).toBeUndefined()
    expect(state.queue).toEqual([b])
    expect(state.practice).toBe(true)
  })

  it('en révision libre, « Pas su » renvoie quand même la carte en fin de file, sans l’enregistrer', () => {
    const { state, save } = answer(startSession([a, b], { practice: true }), 'pas-su', now)
    expect(save).toBeUndefined()
    expect(state.queue).toEqual([b, a])
  })

  it('en révision libre, « Annuler » ne réécrit rien en base', () => {
    const answered = answer(startSession([a], { practice: true }), 'su', now).state
    const undone = undo(answered)
    expect(undone.save).toBeUndefined()
    expect(undone.state.queue).toEqual([a])
    expect(undone.state.practice).toBe(true)
  })

  it('en révision libre, calcule quand même le bilan', () => {
    let state = startSession([a, b], { practice: true })
    state = answer(state, 'su', now).state
    state = answer(state, 'pas-su', now).state
    state = answer(state, 'su', now).state
    expect(summary(state)).toEqual({ total: 2, percent: 50 })
  })

  it('ne fait rien quand la file est vide', () => {
    const empty = startSession([])
    expect(answer(empty, 'su', now)).toEqual({ state: empty })
    expect(summary(empty)).toEqual({ total: 0, percent: 0 })
  })
})
