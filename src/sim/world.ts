import { PLOT_NAMES } from '../../shared/actions.ts'
import type { PlotId } from '../../shared/actions.ts'
import type { Person, Plot, Stage } from './types.ts'

export const START_YEAR = 2026
export const END_YEAR = 2086

function plot(id: PlotId, layers: Plot['layers']): Plot {
  return { id, name: PLOT_NAMES[id], state: layers[layers.length - 1].state, layers, marks: [] }
}

/** Kleiner Ilmplatz before the daemon: already a palimpsest. */
export function initialPlots(): Record<PlotId, Plot> {
  return {
    westbed: plot('westbed', [
      { year: 1902, state: 'garden', note: 'kitchen gardens of the Ilm houses' },
      { year: 1979, state: 'paved', note: 'paved for the 30th anniversary parade' },
    ]),
    linden: plot('linden', [{ year: 1871, state: 'old_tree', note: 'planted 1871' }]),
    fountain: plot('fountain', [{ year: 1908, state: 'fountain', note: 'switched off in 2019' }]),
    steps: plot('steps', [{ year: 1931, state: 'steps', note: 'built for a library that moved away' }]),
    eastlot: plot('eastlot', [
      { year: 1890, state: 'paved', note: 'weekly market' },
      { year: 1999, state: 'parking', note: 'twelve spaces' },
    ]),
    arcade: plot('arcade', [{ year: 1926, state: 'arcade', note: 'covered walk of the Konsum building' }]),
  }
}

/**
 * The three people of the square. Their wishes belong to life stages, not to years:
 * the daemon's slowness collides with how fast people become someone else.
 */
export function cast(): Person[] {
  return [
    {
      id: 'mio', name: 'Mio', born: 2019,
      stages: [
        { fromAge: 0, stage: 'child', lens: 'possibility', idle: 'The fountain is a volcano.',
          wish: { key: 'mio_play', kind: 'dream', plot: 'any', wants: ['play', 'garden_play'], text: 'I wish there was a playground here!' } },
        { fromAge: 13, stage: 'teenager', lens: 'present', idle: 'Whatever.',
          wish: { key: 'mio_hangout', kind: 'need', plot: 'steps', wants: ['courtyard'], text: 'Somewhere to sit with friends at night.' } },
        { fromAge: 18, stage: 'student', lens: 'present', idle: 'Exams again.',
          wish: { key: 'mio_study', kind: 'need', plot: 'any', wants: ['garden', 'garden_play', 'courtyard'], text: 'I need somewhere quiet to study.' } },
        { fromAge: 26, stage: 'adult', lens: 'memory', idle: 'I grew up on this square.',
          wish: { key: 'mio_remember', kind: 'memory', plot: 'any', wants: ['plaque'], text: 'Someone should write down what this place was.' } },
      ],
      events: [
        { age: 11, icon: '🎒', text: 'Secondary school' },
        { age: 13, icon: '🎧', text: 'A teenager now' },
        { age: 18, icon: '📚', text: 'Off to university' },
        { age: 26, icon: '🏠', text: 'Stays in Weimar' },
      ],
    },
    {
      id: 'lena', name: 'Lena', born: 2002,
      stages: [
        { fromAge: 0, stage: 'student', lens: 'present', idle: 'Three chapters left.',
          wish: { key: 'lena_study', kind: 'need', plot: 'any', wants: ['garden', 'garden_play'], text: 'I wish there was a quiet outdoor study garden.' } },
        { fromAge: 28, stage: 'graduate', lens: 'present', idle: 'Work, mostly.',
          wish: { key: 'lena_lunch', kind: 'need', plot: 'arcade', wants: ['courtyard'], text: 'A table in the shade for my lunch break.' } },
        { fromAge: 34, stage: 'parent', lens: 'possibility', idle: 'She never sleeps.',
          wish: { key: 'lena_kid', kind: 'need', plot: 'any', wants: ['play', 'garden_play'], text: 'Is there anywhere my kid can play?' } },
      ],
      events: [
        { age: 28, icon: '🎓', text: 'Graduated!' },
        { age: 29, icon: '💼', text: 'First job' },
        { age: 34, icon: '🍼', text: 'A baby!' },
      ],
    },
    {
      id: 'roth', name: 'Frau Roth', born: 1955,
      stages: [
        { fromAge: 0, stage: 'resident', lens: 'memory', idle: 'We danced under that linden.',
          wish: { key: 'roth_garden', kind: 'memory', plot: 'westbed', wants: ['garden', 'garden_play'], text: 'I wish the old garden would come back.' } },
        { fromAge: 78, stage: 'frail', lens: 'memory', idle: 'Slowly, slowly.',
          wish: { key: 'roth_bench', kind: 'need', plot: 'any', wants: ['courtyard'], text: 'Just a bench in the shade.' } },
      ],
      events: [
        { age: 75, icon: '🎂', text: 'Turns 75' },
        { age: 78, icon: '🦯', text: 'Slower now' },
        { age: 80, icon: '🎂', text: 'Turns 80' },
      ],
    },
  ]
}

export const ageOf = (p: Person, year: number) => year - p.born

export function stageOf(p: Person, year: number): Stage {
  const age = ageOf(p, year)
  let s = p.stages[0]
  for (const st of p.stages) if (st.fromAge <= age) s = st
  return s
}

export function isPresent(p: Person, year: number) {
  return p.diedYear === undefined || year < p.diedYear
}

/** Mortality for Frau Roth, from 80 on. Only the aging system calls this. */
export const mortality = (age: number) => (age < 80 ? 0 : Math.min(0.9, 0.05 + 0.035 * (age - 80)))

/**
 * Visible growth: 0.62 at seven, a full-size figure by fifteen.
 * Adults stay at 1; the very old shrink a little.
 */
export function figureScale(p: Person, year: number) {
  const age = ageOf(p, year)
  if (age < 18) return 0.62 + (Math.min(15, Math.max(7, age)) - 7) * (0.38 / 8) + (age > 15 ? (age - 15) * 0.01 : 0)
  if (age > 75) return 1.03 - Math.min(0.08, (age - 75) * 0.008)
  return 1.03
}
