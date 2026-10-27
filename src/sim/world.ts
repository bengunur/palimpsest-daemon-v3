import { PLOT_NAMES } from '../../shared/actions.ts'
import type { PlotId } from '../../shared/actions.ts'
import { randInt } from './rng.ts'
import type { City, Person, Plot } from './types.ts'

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
    linden: plot('linden', [{ year: 1871, state: 'old_tree', note: 'linden planted for the new Reich, outlived it' }]),
    fountain: plot('fountain', [{ year: 1908, state: 'fountain', note: 'switched off in 2019, budget' }]),
    steps: plot('steps', [{ year: 1931, state: 'steps', note: 'built for a library that moved away' }]),
    eastlot: plot('eastlot', [
      { year: 1890, state: 'paved', note: 'weekly market' },
      { year: 1999, state: 'parking', note: 'twelve spaces' },
    ]),
    arcade: plot('arcade', [{ year: 1926, state: 'arcade', note: 'covered walk of the Konsum building' }]),
  }
}

/**
 * The cast. Arrival and departure years vary with the seed, so the daemon's
 * timing collides with different lives in every run.
 */
export function cast(city: City): Person[] {
  const j = (lo: number, hi: number) => randInt(city, lo, hi)
  return [
    {
      id: 'roth', name: 'Frau Roth', born: 1949, arrives: 1955, leaves: 2038 + j(0, 4),
      leaveText: 'Frau Roth died in winter. Her window stayed lit for a week.',
      phases: [
        {
          from: 1955, lens: 'memory', role: 'Resident since 1955',
          desires: [
            { key: 'roth_garden', kind: 'memory', plot: 'westbed', wants: ['garden', 'garden_play'], text: 'My mother grew beans here. Under these stones there is still soil.' },
            { key: 'roth_linden', kind: 'memory', plot: 'linden', wants: ['plaque'], text: 'We danced under the linden every Midsummer. Nobody dances now.' },
          ],
        },
        {
          from: 2033, lens: 'memory', role: 'Resident, slower now',
          desires: [
            { key: 'roth_linden', kind: 'memory', plot: 'linden', wants: ['plaque'], text: 'We danced under the linden every Midsummer. Nobody dances now.' },
            { key: 'roth_bench', kind: 'need', plot: 'any', wants: ['courtyard'], text: 'One bench in the shade. That is all I ask of anyone now.' },
          ],
        },
      ],
    },
    {
      id: 'lena', name: 'Lena', born: 2002, arrives: 2026, leaves: 2029 + j(0, 1),
      leaveText: 'Lena graduated and moved to Leipzig.',
      phases: [{
        from: 2026, lens: 'present', role: 'Student, 24',
        desires: [
          { key: 'lena_read', kind: 'need', plot: 'westbed', wants: ['garden', 'garden_play'], text: 'Nowhere quiet to read. That stone corner could be green.' },
          { key: 'lena_table', kind: 'need', plot: 'arcade', wants: ['courtyard'], text: 'A table under the arcade with a socket. That’s all.' },
        ],
      }],
    },
    {
      id: 'mio', name: 'Mio', born: 2019, arrives: 2026, leaves: 2061 + j(0, 3),
      leaveText: 'Mio moved away, with a child of their own.',
      phases: [
        {
          from: 2026, lens: 'possibility', role: 'Child, 7',
          desires: [
            { key: 'mio_volcano', kind: 'dream', plot: 'fountain', wants: ['play'], text: 'The fountain is a volcano. It needs a ladder.' },
            { key: 'mio_dragons', kind: 'dream', plot: 'eastlot', wants: ['play', 'garden'], text: 'The cars sleep here. Dragons could sleep here instead.' },
          ],
        },
        {
          from: 2033, lens: 'possibility', role: 'Teenager',
          desires: [{ key: 'mio_night', kind: 'dream', plot: 'steps', wants: ['courtyard'], text: 'The steps are the only place we are allowed to exist after nine.' }],
        },
        {
          from: 2038, lens: 'present', role: 'Student',
          desires: [
            { key: 'mio_study', kind: 'need', plot: 'any', wants: ['garden', 'garden_play', 'courtyard'], text: 'I need somewhere quiet to study. Was the garden ever finished?' },
            { key: 'mio_heat', kind: 'need', plot: 'any', wants: ['tree'], text: 'Summers on this stone are unbearable now.' },
          ],
        },
        {
          from: 2047, lens: 'memory', role: 'Resident',
          desires: [{ key: 'mio_remember', kind: 'memory', plot: 'westbed', wants: ['plaque'], text: 'I watched that garden being built for my whole childhood. Someone should write it down.' }],
        },
      ],
    },
    {
      id: 'ada', name: 'Ada', born: 2026, arrives: 2031 + j(0, 1), leaves: 2050 + j(0, 2),
      leaveText: 'Ada left for an apprenticeship in Jena.',
      phases: [
        {
          from: 2031, lens: 'possibility', role: 'Child, 5',
          desires: [{ key: 'ada_play', kind: 'dream', plot: 'any', wants: ['play', 'garden_play'], text: 'Where is the playground? There is no playground.' }],
        },
        {
          from: 2040, lens: 'present', role: 'Teenager',
          desires: [{ key: 'ada_roof', kind: 'need', plot: 'arcade', wants: ['courtyard'], text: 'A roof to sit under when it rains, without buying coffee.' }],
        },
      ],
    },
    {
      id: 'chidi', name: 'Chidi Okafor', born: 1994, arrives: 2031 + j(0, 1), leaves: 2052 + j(0, 3),
      leaveText: 'The Okafors moved to a flat with a balcony.',
      phases: [{
        from: 2031, lens: 'present', role: 'Parent',
        desires: [{ key: 'chidi_shade', kind: 'need', plot: 'any', wants: ['tree'], text: 'No shade anywhere for a pram in July.' }],
      }],
    },
    {
      id: 'jonas', name: 'Jonas', born: 2014, arrives: 2034 + j(0, 1), leaves: 2038 + j(0, 1),
      leaveText: 'Jonas finished the master’s and left for Rotterdam.',
      phases: [{
        from: 2034, lens: 'present', role: 'Student',
        desires: [{ key: 'jonas_gather', kind: 'need', plot: 'steps', wants: ['courtyard'], text: 'Somewhere to gather that isn’t a bar.' }],
      }],
    },
    {
      id: 'weber', name: 'Herr Weber', born: 1979, arrives: 2043 + j(0, 2), leaves: 2066 + j(0, 4),
      leaveText: 'Herr Weber died. He had lived here twenty years and called himself new.',
      phases: [{
        from: 2043, lens: 'memory', role: 'Newcomer, retired',
        desires: [{ key: 'weber_know', kind: 'memory', plot: 'eastlot', wants: ['plaque'], text: 'I am new here. I would like to know what this place used to be.' }],
      }],
    },
    {
      id: 'yuki', name: 'Yuki', born: 2021, arrives: 2041 + j(0, 1), leaves: 2045 + j(0, 1),
      leaveText: 'Yuki went home to Sapporo, where it is cooler.',
      phases: [{
        from: 2041, lens: 'present', role: 'Exchange student',
        desires: [{ key: 'yuki_heat', kind: 'need', plot: 'any', wants: ['tree'], text: 'It was 39 degrees in June. The stone held it all night.' }],
      }],
    },
    {
      id: 'noor', name: 'Noor', born: 2049, arrives: 2054 + j(0, 2), leaves: 2080 + j(0, 4),
      leaveText: 'Noor grew up and left.',
      phases: [{
        from: 2054, lens: 'possibility', role: 'Child',
        desires: [{ key: 'noor_jungle', kind: 'dream', plot: 'any', wants: ['garden', 'garden_play'], text: 'The old garden is a jungle. There is definitely a tiger.' }],
      }],
    },
    {
      id: 'selin', name: 'Selin', born: 2034, arrives: 2053 + j(0, 1), leaves: 2057 + j(0, 1),
      leaveText: 'Selin graduated.',
      phases: [{
        from: 2053, lens: 'present', role: 'Student',
        desires: [{ key: 'selin_table', kind: 'need', plot: 'any', wants: ['courtyard'], text: 'A long table outside where strangers end up talking.' }],
      }],
    },
    {
      id: 'brandt', name: 'Herr Brandt', born: 1990, arrives: 2057 + j(0, 2), leaves: 2074 + j(0, 3),
      leaveText: 'Herr Brandt moved to the edge of town, where parking is easy.',
      phases: [{
        from: 2057, lens: 'present', role: 'Resident, with an elderly mother',
        desires: [{ key: 'brandt_parking', kind: 'need', plot: 'eastlot', wants: ['parking'], text: 'Bring back the car park. My mother cannot walk from the Ring.' }],
      }],
    },
    {
      id: 'lio', name: 'Lio', born: 2058, arrives: 2063 + j(0, 2), leaves: 2084 + j(0, 2),
      leaveText: 'Lio left to study somewhere with a sea.',
      phases: [
        {
          from: 2063, lens: 'possibility', role: 'Child, 5',
          desires: [{ key: 'lio_forest', kind: 'dream', plot: 'any', wants: ['tree'], text: 'If there were ten more trees it would be a forest and I could get lost.' }],
        },
        {
          from: 2076, lens: 'present', role: 'Teenager',
          desires: [{ key: 'lio_courtyard', kind: 'need', plot: 'steps', wants: ['courtyard'], text: 'The steps are too old and too sacred to sit on now.' }],
        },
      ],
    },
    {
      id: 'juno', name: 'Juno', born: 2052, arrives: 2071 + j(0, 3), leaves: 2086 + j(0, 4),
      leaveText: 'Juno left.',
      phases: [{
        from: 2071, lens: 'memory', role: 'Visitor, Mio’s child',
        desires: [{ key: 'juno_volcano', kind: 'memory', plot: 'fountain', wants: ['plaque'], text: 'My parent says there was a volcano here once. I would like proof.' }],
      }],
    },
  ]
}

export function phaseOf(p: Person, year: number) {
  let phase = p.phases[0]
  for (const ph of p.phases) if (ph.from <= year) phase = ph
  return phase
}

export function isPresent(p: Person, year: number) {
  return p.arrives <= year && year < p.leaves
}
