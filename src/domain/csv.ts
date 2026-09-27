import Papa from 'papaparse'
import type { Pair } from './types'

const ENGLISH = new Set(['english', 'anglais', 'en'])
const FRENCH = new Set(['french', 'francais', 'fr'])

function language(label: string): 'en' | 'fr' | null {
  const n = label.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  if (ENGLISH.has(n)) return 'en'
  if (FRENCH.has(n)) return 'fr'
  return null
}

export type ParseResult = { pairs: Pair[]; skipped: number }

/**
 * Lit le CSV de l'export Google Translate → Sheets.
 * Colonnes : langue source, langue cible, texte source, texte traduit.
 * `skipped` compte les lignes non vides qui ne sont pas une paire anglais ↔ français.
 */
export function parseExport(csvText: string): ParseResult {
  const { data } = Papa.parse<string[]>(csvText.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  const pairs: Pair[] = []
  let skipped = 0
  for (const row of data) {
    const [from = '', to = '', source = '', target = ''] = row
    const src = source.trim()
    const tgt = target.trim()
    const a = language(from)
    const b = language(to)
    if (src && tgt && a === 'en' && b === 'fr') pairs.push({ en: src, fr: tgt })
    else if (src && tgt && a === 'fr' && b === 'en') pairs.push({ en: tgt, fr: src })
    else skipped++
  }
  return { pairs, skipped }
}
