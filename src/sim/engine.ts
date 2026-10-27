import { ACTIONS, CAPACITY, PLOT_IDS, PLOT_NAMES, resultState } from '../../shared/actions.ts'
import type { ActionId, PlotId, ValidDecision, ValidationContext } from '../../shared/actions.ts'
import { pick, randInt, uid } from './rng.ts'
import type { City, Plot, Source, Want, Whisper } from './types.ts'
import { END_YEAR, START_YEAR, cast, initialPlots, isPresent, phaseOf } from './world.ts'

const clone = <T,>(x: T): T => structuredClone(x)

// ── perception helpers ────────────────────────────────────────────────────────

export const TREE_MATURES = 8

function plotsInScope(c: City, scope: PlotId | 'any'): Plot[] {
  return scope === 'any' ? PLOT_IDS.map((id) => c.plots[id]) : [c.plots[scope]]
}

/** Is a want already true somewhere in the physical city? Trees only count once they cast shade. */
export function isSatisfied(c: City, scope: PlotId | 'any', wants: Want[]): boolean {
  return plotsInScope(c, scope).some((p) =>
    wants.some((w) => {
      if (w === 'tree') return p.marks.some((m) => m.kind === 'tree' && c.year - m.year >= TREE_MATURES)
      if (w === 'plaque') return p.marks.some((m) => m.kind === 'plaque')
      return p.state === w
    }),
  )
}

/** What a finished action would make true on a plot. */
export function wantProduced(action: ActionId, p: Plot): Want | null {
  if (action === 'plant_tree') return 'tree'
  if (action === 'preserve_trace') return 'plaque'
  if (ACTIONS[action].transforms) return resultState(action, p.state)
  return null
}

export function openWhispers(c: City): Whisper[] {
  return c.whispers.filter((w) => w.resolvedYear === undefined)
}

/** Whispers that a given action on a given plot would answer. */
export function supporters(c: City, action: ActionId, plotId: PlotId | 'none'): Whisper[] {
  if (plotId === 'none') return []
  const want = wantProduced(action, c.plots[plotId])
  if (!want) return []
  return openWhispers(c).filter((w) => w.wants.includes(want) && (w.plot === 'any' || w.plot === plotId))
}

export function personName(c: City, id: string) {
  return c.people.find((p) => p.id === id)?.name ?? id
}

export function buildingWorks(c: City) {
  return c.works.filter((w) => w.status === 'building' && w.action !== 'wait')
}

export function activeWait(c: City) {
  return c.works.find((w) => w.status === 'building' && w.action === 'wait')
}

export function validationContext(c: City): ValidationContext {
  const busy = new Set(buildingWorks(c).map((w) => w.plot))
  return {
    year: c.year,
    plots: PLOT_IDS.map((id) => ({ id, state: c.plots[id].state, busy: busy.has(id) })),
    building: buildingWorks(c).length,
  }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

export function createCity(seed: number): City {
  const c: City = {
    seed, year: START_YEAR, rng: seed * 7919 + 17, nextId: 1,
    plots: initialPlots(), people: [], whispers: [], works: [], ledger: [],
    weights: { memory: 0.4, use: 0.25, play: 0.2, stillness: 0.15 },
    needsThought: false, thoughtReasons: [], lastThoughtYear: START_YEAR - 1, carriedYear: 0,
    stormYear: 0,
  }
  c.people = cast(c)
  c.stormYear = randInt(c, 2044, 2052)
  c.ledger.push({
    id: uid(c, 'e'), year: c.year, type: 'event',
    text: 'The daemon of Kleiner Ilmplatz has been listening since 1871. It has never once been in a hurry.',
  })
  const heard = gatherWhispers(c)
  if (heard > 0) requestThought(c, [`${heard} new whispers`])
  return c
}

/** Each present person repeats what they still want. Repetition is how the daemon learns what is real. */
function gatherWhispers(c: City): number {
  let created = 0
  for (const w of openWhispers(c)) {
    if (isSatisfied(c, w.plot, w.wants)) w.resolvedYear = c.year
  }
  for (const p of c.people) {
    if (!isPresent(p, c.year)) continue
    const phase = phaseOf(p, c.year)
    for (const d of phase.desires) {
      const open = c.whispers.find((w) => w.key === d.key && w.resolvedYear === undefined)
      if (isSatisfied(c, d.plot, d.wants)) continue
      if (open) {
        if (open.lastHeard < c.year) { open.heardCount++; open.lastHeard = c.year }
        open.lens = phase.lens
        continue
      }
      c.whispers.push({
        id: uid(c, 'w'), key: d.key, personId: p.id, lens: phase.lens, kind: d.kind, plot: d.plot,
        wants: d.wants, text: d.text, firstHeard: c.year, lastHeard: c.year, heardCount: 1, carried: false,
      })
      created++
    }
  }
  return created
}

function requestThought(c: City, reasons: string[]) {
  if (c.lastThoughtYear === c.year) { c.needsThought = false; return } // one decision per year
  if (activeWait(c) || c.year >= END_YEAR) { c.needsThought = false; return }
  if (buildingWorks(c).length >= CAPACITY) { c.needsThought = false; return }
  c.needsThought = true
  c.thoughtReasons = reasons
}

const COMPLETION_LINES = {
  tooLate: [
    'It is finished. The one who asked has gone. I will keep it for whoever comes.',
    'Done. I answered a question nobody here remembers asking.',
    'I was not late. Everyone else was early.',
  ],
  inTime: [
    'It is finished, and someone is still here to see it. This is rarer than you think.',
    'Done. They are older now, but they came to look.',
  ],
  nobody: [
    'Finished. It was for the square, not for anyone in particular.',
  ],
}

/** One year passes. This is the only place where the physical city changes. */
export function advanceYear(prev: City): City {
  const c = clone(prev)
  if (c.year >= END_YEAR) return c
  c.year++
  c.needsThought = false
  const reasons: string[] = []

  // 1. works mature
  for (const w of c.works) {
    if (w.status !== 'building' || w.completionYear > c.year) continue
    w.status = 'done'
    if (w.action === 'wait') { reasons.push('the waiting is over'); continue }
    const p = c.plots[w.plot as PlotId]
    const spec = ACTIONS[w.action]
    if (spec.transforms) {
      p.state = resultState(w.action, p.state)
      p.layers.push({ year: c.year, state: p.state, by: w.id })
    } else if (w.action === 'plant_tree') {
      p.marks.push({ kind: 'tree', year: c.year })
    } else if (w.action === 'preserve_trace') {
      const memory = c.whispers.find((x) => w.forWhispers.includes(x.id) && x.kind === 'memory')
      p.marks.push({ kind: 'plaque', year: c.year, text: memory ? `“${memory.text}” — ${personName(c, memory.personId)}` : `Here: ${p.layers.map((l) => `${l.year} ${l.state}`).join(', ')}` })
    }
    const askers = [...new Set(c.whispers.filter((x) => w.forWhispers.includes(x.id)).map((x) => x.personId))]
    const present = askers.filter((id) => isPresent(c.people.find((pp) => pp.id === id)!, c.year))
    const gone = askers.filter((id) => !present.includes(id))
    const tooLate = askers.length > 0 && present.length === 0
    let text = `${capital(spec.label.replace(/^(plant|establish|add|preserve)/, (m) => pastTense(m)))} at ${p.name} — begun ${w.startYear}.`
    if (gone.length) text += ` ${gone.map((id) => personName(c, id)).join(' and ')} ${gone.length > 1 ? 'are' : 'is'} no longer here.`
    if (present.length) text += ` ${present.map((id) => personName(c, id)).join(' and ')} ${present.length > 1 ? 'are' : 'is'} still here to see it.`
    if (tooLate) { c.weights.use = Math.max(0.1, c.weights.use - 0.02); c.weights.memory = Math.min(0.6, c.weights.memory + 0.02) }
    c.ledger.push({
      id: uid(c, 'e'), year: c.year, type: 'completion', workId: w.id, text, tooLate,
      utterance: pick(c, tooLate ? COMPLETION_LINES.tooLate : present.length ? COMPLETION_LINES.inTime : COMPLETION_LINES.nobody),
    })
    reasons.push(`${spec.label} finished`)
  }

  // 2. things the daemon did not decide
  if (c.year === c.stormYear && c.plots.linden.state === 'old_tree') {
    c.plots.linden.state = 'stump'
    c.plots.linden.layers.push({ year: c.year, state: 'stump', note: 'felled by a summer storm' })
    c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: `A summer storm felled the linden. It was ${c.year - 1871} years old — the only thing here slower than the daemon.` })
    reasons.push('the linden fell')
  }

  // 3. people come, go, and grow into someone else
  for (const p of c.people) {
    if (p.leaves === c.year) {
      c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: p.leaveText })
      if (openWhispers(c).some((w) => w.personId === p.id)) reasons.push(`${p.name} left`)
    } else if (p.arrives === c.year) {
      c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: `${p.name} arrived — ${phaseOf(p, c.year).role}.` })
    } else if (isPresent(p, c.year) && p.phases.some((ph) => ph.from === c.year)) {
      c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: `${p.name} is no longer who they were. Now: ${phaseOf(p, c.year).role}.` })
    }
  }

  // 4. listening
  const heard = gatherWhispers(c)
  if (heard > 0) reasons.push(`${heard} new whisper${heard > 1 ? 's' : ''}`)
  if (c.year - c.lastThoughtYear >= 4) reasons.push('four quiet years')
  if (c.carriedYear === c.year - 1) reasons.push('a whisper was carried to it last year')

  // the end of a wait is only worth a thought if something is still unanswered
  const inProgress = new Set(buildingWorks(c).flatMap((w) => w.forWhispers))
  const unanswered = openWhispers(c).some((w) => !inProgress.has(w.id))
  const worth = reasons.filter((r) => r !== 'the waiting is over' || unanswered)
  if (worth.length) requestThought(c, worth)
  return c
}

function capital(s: string) { return s[0].toUpperCase() + s.slice(1) }
function pastTense(verb: string) {
  return ({ plant: 'planted', establish: 'established', add: 'added', preserve: 'preserved' } as Record<string, string>)[verb] ?? verb
}

/** Turn a validated decision into a work. startYear/completionYear come from the validator, never from the brain. */
export function applyDecision(prev: City, d: ValidDecision, source: Source, notes: string[], model?: string): City {
  const c = clone(prev)
  const workId = uid(c, 'k')
  c.works.push({
    id: workId, action: d.action, plot: d.plotId, startYear: d.startYear, completionYear: d.completionYear,
    reason: d.reason, source, status: 'building',
    forWhispers: supporters(c, d.action, d.plotId).map((w) => w.id),
  })
  c.ledger.push({
    id: uid(c, 'e'), year: c.year, type: 'decision',
    decision: { ...d, plot: d.plotId, source, notes, workId, model },
  })
  c.needsThought = false
  c.lastThoughtYear = c.year
  return c
}

export function recordRefusal(prev: City, text: string, errors: string[]): City {
  const c = clone(prev)
  c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'refusal', text, errors })
  return c
}

/** The player's one act of participation per year: repeating a whisper so the daemon hears it twice. */
export function carryWhisper(prev: City, whisperId: string): City {
  const c = clone(prev)
  const w = c.whispers.find((x) => x.id === whisperId)
  if (!w || w.resolvedYear !== undefined || c.carriedYear === c.year) return prev
  w.carried = true
  w.heardCount++
  c.carriedYear = c.year
  c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: `You carried ${personName(c, w.personId)}’s whisper to the daemon: “${w.text}”` })
  requestThought(c, ['a whisper was carried to it'])
  return c
}

export function plotName(id: PlotId | 'none') {
  return id === 'none' ? '—' : PLOT_NAMES[id]
}
