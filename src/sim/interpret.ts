// One square, several realities. Each lens reads the SAME plot differently.
import type { PlotState } from '../../shared/actions.ts'
import { TREE_MATURES, personName } from './engine.ts'
import type { City, Lens, PersonaLens, Plot, Whisper } from './types.ts'
import { isPresent } from './world.ts'

export const GROUND_LABEL: Record<PlotState, string> = {
  paved: 'Cobbled forecourt', parking: 'Car park, 12 spaces', fountain: 'Fountain (1908)', steps: 'The broad steps',
  arcade: 'Arcade', old_tree: 'Linden (1871)', stump: 'Linden stump', garden: 'Garden', courtyard: 'Shared courtyard',
  play: 'Play space', garden_play: 'Garden with a play edge', ruin: 'Unfinished work',
}

const PRESENT: Record<PlotState, string> = {
  paved: 'Nowhere to sit', parking: '12 cars · 0 people', fountain: 'Dry since 2019', steps: 'Seating, unofficially',
  arcade: 'Dry, but no tables', old_tree: 'Shade · library wifi', stump: 'Shade, lost', garden: 'Quiet · readable',
  courtyard: 'Tables · sockets · shared', play: 'Loud, useful, sticky', garden_play: 'Quiet until 3 pm', ruin: 'Blocked',
}

const POSSIBILITY: Record<PlotState, string> = {
  paved: 'Lava. Don’t touch.', parking: 'Dragon pasture', fountain: 'VOLCANO', steps: 'Mountain, 6 summits',
  arcade: 'Tunnel to the other side', old_tree: 'The tree that listens', stump: 'A throne', garden: 'Jungle (tigers likely)',
  courtyard: 'Banquet hall for ants', play: 'Ship', garden_play: 'Jungle with a ship in it', ruin: 'Castle',
}

export const LENS_INFO: Record<Lens, { name: string; who: string; blurb: string }> = {
  ground: { name: 'Ground', who: 'the physical square', blurb: 'Stone, soil, the things that are actually there. No one lives in this view.' },
  memory: { name: 'Memory', who: 'the Resident', blurb: 'What used to be here. Former states drawn in sepia; what the old remember.' },
  present: { name: 'Present', who: 'the Student', blurb: 'Is it useful today? Shade, seats, sockets, quiet, heat.' },
  possibility: { name: 'Possibility', who: 'the Child', blurb: 'What it could be. Every surface is already something else.' },
  palimpsest: { name: 'Palimpsest', who: 'the daemon', blurb: 'Every layer at once, lifted like sheets of tracing paper. The only view the daemon trusts.' },
}

export interface Note { text: string; by?: string; faded?: boolean; kind: 'label' | 'whisper' | 'trace' | 'warn' }

function whispersHere(c: City, p: Plot, lens: PersonaLens): Whisper[] {
  return c.whispers.filter((w) => w.lens === lens && w.plot === p.id)
}

function present(c: City, w: Whisper) {
  const person = c.people.find((x) => x.id === w.personId)
  return !!person && isPresent(person, c.year)
}

export function heat(c: City) {
  return Math.max(0, Math.min(1, (c.year - 2036) / 20))
}

/** What this lens says about this plot, this year. */
export function readPlot(lens: Lens, p: Plot, c: City): Note[] {
  const notes: Note[] = []
  if (lens === 'ground') {
    notes.push({ kind: 'label', text: GROUND_LABEL[p.state] })
    return notes
  }
  if (lens === 'memory') {
    const before = p.layers.slice(0, -1)
    if (before.length) {
      const last = before[before.length - 1]
      notes.push({ kind: 'label', text: `was ${GROUND_LABEL[last.state].toLowerCase()} · ${last.year}${last.note ? ` · ${last.note}` : ''}` })
    } else {
      notes.push({ kind: 'label', text: `${GROUND_LABEL[p.state]}, since ${p.layers[0].year}` })
    }
    for (const m of p.marks.filter((m) => m.kind === 'plaque')) notes.push({ kind: 'trace', text: m.text ?? 'A plaque.', by: `set in bronze ${m.year}` })
    for (const w of whispersHere(c, p, 'memory')) {
      const here = present(c, w)
      // a memory with no one left to hold it fades, unless the daemon preserved it
      if (!here && p.marks.some((m) => m.kind === 'plaque')) continue
      notes.push({ kind: 'whisper', text: w.text, by: personName(c, w.personId), faded: !here })
    }
    return notes
  }
  if (lens === 'present') {
    const hot = heat(c) > 0.2 && ['paved', 'parking', 'steps'].includes(p.state)
    const shade = p.marks.filter((m) => m.kind === 'tree' && c.year - m.year >= TREE_MATURES).length
    notes.push({ kind: hot ? 'warn' : 'label', text: hot ? `${PRESENT[p.state]} · ${Math.round(36 + heat(c) * 7)}°C in July` : PRESENT[p.state] })
    if (shade) notes.push({ kind: 'label', text: `shade from ${shade} tree${shade > 1 ? 's' : ''}` })
    for (const w of whispersHere(c, p, 'present').filter((w) => w.resolvedYear === undefined && present(c, w))) {
      notes.push({ kind: 'whisper', text: w.text, by: personName(c, w.personId) })
    }
    return notes
  }
  if (lens === 'possibility') {
    notes.push({ kind: 'label', text: POSSIBILITY[p.state] })
    for (const w of whispersHere(c, p, 'possibility').filter((w) => present(c, w))) {
      notes.push({ kind: 'whisper', text: w.text, by: personName(c, w.personId), faded: w.resolvedYear !== undefined })
    }
    return notes
  }
  // palimpsest
  notes.push({ kind: 'label', text: p.layers.map((l) => `${l.year} ${GROUND_LABEL[l.state].toLowerCase()}`).join(' → ') })
  return notes
}
