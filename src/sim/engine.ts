import { ACTIONS, CAPACITY, PLOT_IDS, PLOT_NAMES, resultState } from '../../shared/actions.ts'
import type { ActionId, PlotId, ValidDecision, ValidationContext } from '../../shared/actions.ts'
import { recordFeelings } from './feelings.ts'
import { pick, rand, randInt, uid } from './rng.ts'
import type { CharacterId, City, Mood, Person, Plot, Source, Want, Whisper, Work } from './types.ts'
import { END_YEAR, START_YEAR, ageOf, cast, initialPlots, isPresent, mortality, stageOf } from './world.ts'

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

export function person(c: City, id: string): Person | undefined {
  return c.people.find((p) => p.id === id)
}

export function personName(c: City, id: string) {
  return person(c, id)?.name ?? id
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

/** The whisper a character is currently voicing, if any. */
export function currentWhisper(c: City, id: CharacterId): Whisper | undefined {
  const p = person(c, id)
  if (!p || !isPresent(p, c.year)) return undefined
  const wish = stageOf(p, c.year).wish
  return wish ? openWhispers(c).find((w) => w.key === wish.key) : undefined
}

/** The building work (if any) that answers this whisper. */
export function workFor(c: City, w: Whisper | undefined): Work | undefined {
  return w && buildingWorks(c).find((k) => k.forWhispers.includes(w.id))
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

export function createCity(seed: number): City {
  const c: City = {
    seed, year: START_YEAR, rng: seed * 7919 + 17, nextId: 1,
    plots: initialPlots(), people: cast(), whispers: [], works: [], ledger: [], reactions: [], milestones: [],
    weights: { memory: 0.4, use: 0.25, play: 0.2, stillness: 0.15 },
    needsThought: false, thoughtReasons: [], lastThoughtYear: START_YEAR - 1, toldYear: {},
    stormYear: 0, tells: [], moods: [],
  }
  c.stormYear = randInt(c, 2048, 2056)
  c.ledger.push({
    id: uid(c, 'e'), year: c.year, type: 'event',
    text: 'The daemon of Kleiner Ilmplatz has been listening since 1871. It has never once been in a hurry.',
  })
  gatherWhispers(c)
  recordFeelings(c)
  return c
}

/** Each living person repeats what they still want. Repetition is how the daemon learns what is real. */
function gatherWhispers(c: City): number {
  let created = 0
  for (const w of openWhispers(c)) {
    if (isSatisfied(c, w.plot, w.wants)) w.resolvedYear = c.year
  }
  for (const p of c.people) {
    if (!isPresent(p, c.year)) continue
    const st = stageOf(p, c.year)
    const d = st.wish
    if (!d || isSatisfied(c, d.plot, d.wants)) continue
    const open = c.whispers.find((w) => w.key === d.key && w.resolvedYear === undefined)
    if (open) {
      if (open.lastHeard < c.year) { open.heardCount++; open.lastHeard = c.year }
      continue
    }
    c.whispers.push({
      id: uid(c, 'w'), key: d.key, personId: p.id, lens: st.lens, kind: d.kind, plot: d.plot,
      wants: d.wants, text: d.text, firstHeard: c.year, lastHeard: c.year, heardCount: 1, told: false,
    })
    created++
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

/**
 * Birthdays, milestones and — for Frau Roth — death. Driven only by age and the seeded RNG,
 * never by what the daemon builds.
 */
export function lifeEvents(c: City): string[] {
  const reasons: string[] = []
  for (const p of c.people) {
    if (!isPresent(p, c.year)) continue
    const age = ageOf(p, c.year)
    for (const ev of p.events) {
      if (ev.age !== age) continue
      c.milestones.push({ id: uid(c, 'm'), year: c.year, personId: p.id, icon: ev.icon, text: ev.text })
      c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: `${p.name}, ${age}: ${ev.text}` })
    }
    if (p.id === 'roth' && rand(c) < mortality(age)) {
      p.diedYear = c.year
      c.milestones.push({ id: uid(c, 'm'), year: c.year, personId: p.id, icon: '🕯', text: `${p.born}–${c.year}`, death: true })
      c.plots.linden.marks.push({ kind: 'memorial', year: c.year, text: `Frau Roth, ${p.born}–${c.year}` })
      c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: `Frau Roth died in winter, aged ${age}. Her bench by the linden stays.` })
      reasons.push('Frau Roth died')
    }
  }
  return reasons
}

const COMPLETION_LINES = {
  tooLate: [
    'It is finished. The one who asked has gone. I will keep it for whoever comes.',
    'I was not late. Everyone else was early.',
  ],
  inTime: [
    'It is finished. They are older now, but they came to look.',
    'Done. Whether it is still wanted is not my question.',
  ],
  nobody: ['Finished. It was for the square, not for anyone in particular.'],
}

/** Reaction lines, keyed by the wish that was asked (delighted / bittersweet) or by who they are now (surprised). */
const ASKED_LINES: Record<string, { delighted: string; bittersweet: string }> = {
  mio_play: { delighted: 'It’s here! It’s really here!', bittersweet: 'I don’t play here anymore. I wish it had been here when I was little.' },
  mio_hangout: { delighted: 'Our spot. Finally.', bittersweet: 'We used to sit on the cold steps. I’m away at university now.' },
  mio_study: { delighted: 'Quiet. Perfect.', bittersweet: 'I finished my degree before it opened.' },
  mio_remember: { delighted: 'Good. Now it won’t be forgotten.', bittersweet: 'Good. Now it won’t be forgotten.' },
  lena_study: { delighted: 'Finally. A place to think.', bittersweet: 'I graduated years ago. I needed this when I was studying.' },
  lena_lunch: { delighted: 'Lunch in the shade. Thank you.', bittersweet: 'I wanted this for lunch breaks. Now I have a baby.' },
  lena_kid: { delighted: 'She’s going to love this.', bittersweet: 'She’s too big for this now.' },
  roth_garden: { delighted: 'My mother’s garden… it’s back.', bittersweet: 'I waited so long. I can barely walk here anymore.' },
  roth_bench: { delighted: 'A bench. I can still sit, at least.', bittersweet: 'A bench. I can still sit, at least.' },
}
const SURPRISED: Record<CharacterId, string> = {
  mio: 'Oh. This is actually perfect now.',
  lena: 'Someone thought of us.',
  roth: 'How kind. Who thought of this?',
}

/** How each living character feels about a finished work — judged by who they are NOW. */
function react(c: City, w: Work) {
  if (w.plot === 'none') return
  const produced = wantProduced(w.action, c.plots[w.plot])
  for (const p of c.people) {
    if (!isPresent(p, c.year)) continue
    const asked = c.whispers.find((x) => w.forWhispers.includes(x.id) && x.personId === p.id)
    const wish = stageOf(p, c.year).wish
    const stillWants = !!wish && !!produced && wish.wants.includes(produced) && (wish.plot === 'any' || wish.plot === w.plot)
    let mood: Mood
    let line: string
    if (asked) {
      // still the same wish, and still able to enjoy it?
      const same = stillWants && wish!.key === asked.key && !(asked.key === 'roth_garden' && ageOf(p, c.year) >= 78)
      mood = same ? 'delighted' : 'bittersweet'
      line = ASKED_LINES[asked.key]?.[mood] ?? SURPRISED[p.id]
    } else if (stillWants) {
      mood = 'surprised'
      line = SURPRISED[p.id]
    } else {
      // someone else's wish, landing in this person's reality
      const side = produced ? SIDE_EFFECTS[`${p.id}:${stageOf(p, c.year).stage}:${produced}`] : undefined
      if (!side) continue
      ;[mood, line] = side
    }
    c.reactions.push({ id: uid(c, 'r'), year: c.year, personId: p.id, workId: w.id, mood, line })
  }
}

/** The same physical result, seen from a life it was not built for. Keyed person:stage:result. */
const SIDE_EFFECTS: Record<string, [Mood, string]> = {
  'lena:student:play': ['disrupted', 'So much for studying outside.'],
  'lena:student:garden_play': ['mixed', 'Quiet… until three o’clock.'],
  'lena:graduate:play': ['mixed', 'Loud lunch breaks now.'],
  'lena:graduate:garden': ['mixed', 'Pretty. I’m never here in daylight.'],
  'lena:parent:garden': ['mixed', 'Lovely — but no running allowed.'],
  'lena:parent:courtyard': ['mixed', 'Nowhere for her to run.'],
  'mio:child:garden': ['disrupted', 'No running allowed? Boring.'],
  'mio:child:courtyard': ['disrupted', 'Grown-up tables. Not for me.'],
  'mio:teenager:play': ['mixed', 'Little kids everywhere now.'],
  'mio:teenager:garden': ['mixed', 'Plants. Great.'],
  'mio:teenager:garden_play': ['mixed', 'The swings are for babies.'],
  'mio:student:play': ['mixed', 'I used to want exactly this.'],
  'mio:adult:play': ['mixed', 'Some other child got my playground.'],
  'mio:adult:garden_play': ['mixed', 'Some other child got my playground.'],
  'roth:resident:play': ['mixed', 'Noisy. But the children laugh.'],
  'roth:resident:courtyard': ['mixed', 'Tables where the garden should be.'],
  'roth:frail:play': ['disrupted', 'Too loud for my old ears.'],
  'roth:frail:garden': ['mixed', 'Green again. I watch from the window.'],
  'roth:frail:garden_play': ['mixed', 'Green again, and loud.'],
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
    const present = askers.filter((id) => isPresent(person(c, id)!, c.year))
    const gone = askers.filter((id) => !present.includes(id))
    const tooLate = askers.length > 0 && present.length === 0
    let text = `${capital(spec.label.replace(/^(plant|establish|add|preserve)/, (m) => pastTense(m)))} at ${p.name} — begun ${w.startYear}.`
    if (gone.length) text += ` ${gone.map((id) => personName(c, id)).join(' and ')} did not live to see it.`
    if (tooLate) { c.weights.use = Math.max(0.1, c.weights.use - 0.02); c.weights.memory = Math.min(0.6, c.weights.memory + 0.02) }
    c.ledger.push({
      id: uid(c, 'e'), year: c.year, type: 'completion', workId: w.id, text, tooLate,
      utterance: pick(c, tooLate ? COMPLETION_LINES.tooLate : present.length ? COMPLETION_LINES.inTime : COMPLETION_LINES.nobody),
    })
    react(c, w)
    reasons.push(`${spec.label} finished`)
  }

  // 2. things nobody decided
  if (c.year === c.stormYear && c.plots.linden.state === 'old_tree') {
    c.plots.linden.state = 'stump'
    c.plots.linden.layers.push({ year: c.year, state: 'stump', note: 'felled by a summer storm' })
    c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: `A summer storm felled the linden. It was ${c.year - 1871} years old.` })
    reasons.push('the linden fell')
  }

  // 3. lives move on, independently of the daemon
  reasons.push(...lifeEvents(c))

  // 4. listening (new whispers are heard, but only telling makes the daemon act at once)
  gatherWhispers(c)
  if (c.year - c.lastThoughtYear >= 4) reasons.push('four quiet years')
  if (Object.values(c.toldYear).some((y) => y === c.year - 1)) reasons.push('a wish told last year')

  const inProgress = new Set(buildingWorks(c).flatMap((w) => w.forWhispers))
  const unanswered = openWhispers(c).some((w) => !inProgress.has(w.id))
  const worth = reasons.filter((r) => (r !== 'the waiting is over' && r !== 'four quiet years') || unanswered)
  if (worth.length) requestThought(c, worth)

  // 5. how the year felt, to each of them — read off the city, changes nothing in it
  recordFeelings(c)
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

export type TellOutcome = 'thinking' | 'next-year' | 'busy' | 'already' | 'nothing'

/**
 * The player's act of participation: carry a character's wish to the daemon.
 * The player cannot choose what the daemon does with it.
 */
export function tellDaemon(prev: City, id: CharacterId): { city: City; outcome: TellOutcome } {
  const w0 = currentWhisper(prev, id)
  if (!w0) return { city: prev, outcome: 'nothing' }
  if (prev.toldYear[id] === prev.year) return { city: prev, outcome: 'already' }
  const c = clone(prev)
  const w = c.whispers.find((x) => x.id === w0.id)!
  w.told = true
  w.heardCount++
  c.toldYear[id] = c.year
  c.tells.push({ year: c.year, personId: id })
  c.ledger.push({ id: uid(c, 'e'), year: c.year, type: 'event', text: `You told the daemon ${personName(c, id)}’s wish: “${w.text}”` })
  // a told wish interrupts the daemon's listening (a wait already at least a year old)
  const wait = activeWait(c)
  if (wait && wait.startYear < c.year) { wait.status = 'done'; wait.completionYear = c.year }
  requestThought(c, [`${personName(c, id)}’s wish was told to it`])
  if (c.needsThought) return { city: c, outcome: 'thinking' }
  return { city: c, outcome: buildingWorks(c).length >= CAPACITY ? 'busy' : 'next-year' }
}

export function plotName(id: PlotId | 'none') {
  return id === 'none' ? '—' : PLOT_NAMES[id]
}
