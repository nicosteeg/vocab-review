import { describe, expect, it } from 'vitest'
import { parseExport } from './csv'

describe('parseExport', () => {
  it('lit une paire anglais → français', () => {
    expect(parseExport('English,French,reach,atteindre\n')).toEqual({
      pairs: [{ en: 'reach', fr: 'atteindre' }],
      skipped: 0,
    })
  })

  it('remet une paire français → anglais dans le sens EN/FR', () => {
    expect(parseExport('French,English,atteindre,reach\n').pairs).toEqual([{ en: 'reach', fr: 'atteindre' }])
  })

  it('reconnaît les noms de langue en français, avec ou sans accents ni majuscules', () => {
    const csv = 'Anglais,Français,reach,atteindre\nfrancais,ANGLAIS,parvenir,achieve\n'
    expect(parseExport(csv).pairs).toEqual([
      { en: 'reach', fr: 'atteindre' },
      { en: 'achieve', fr: 'parvenir' },
    ])
  })

  it('gère les guillemets, virgules et retours à la ligne dans les champs', () => {
    const csv = 'English,French,"well, actually","eh bien, en fait"\nEnglish,French,"line one\nline two","ligne un\nligne deux"\n'
    expect(parseExport(csv).pairs).toEqual([
      { en: 'well, actually', fr: 'eh bien, en fait' },
      { en: 'line one\nline two', fr: 'ligne un\nligne deux' },
    ])
  })

  it('ignore une ligne d’en-tête, les autres langues et les textes vides, en les comptant', () => {
    const csv = [
      'Source language,Target language,Source text,Translation',
      'Spanish,French,hola,bonjour',
      'English,French,,vide',
      'English,French,reach,atteindre',
    ].join('\n')
    expect(parseExport(csv)).toEqual({ pairs: [{ en: 'reach', fr: 'atteindre' }], skipped: 3 })
  })

  it('ignore les lignes vides sans les compter, retire les espaces et le BOM', () => {
    const csv = '﻿English,French,  reach  , atteindre \n\n   \n'
    expect(parseExport(csv)).toEqual({ pairs: [{ en: 'reach', fr: 'atteindre' }], skipped: 0 })
  })

  it('renvoie zéro paire pour un contenu sans rapport', () => {
    expect(parseExport('a;b;c\n1;2;3\n')).toEqual({ pairs: [], skipped: 2 })
  })
})
