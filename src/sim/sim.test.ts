import { describe, expect, it } from 'vitest'
import { ACTIONS, ACTION_IDS, validateDecision } from '../../shared/actions.ts'
import type { ValidationContext } from '../../shared/actions.ts'
import { advanceYear, createCity, currentWhisper, tellDaemon, validationContext } from './engine.ts'
import { decideSimulated } from './daemon.ts'
import type { CharacterId, City } from './types.ts'
import { END_YEAR, ageOf, figureScale, stageOf } from './world.ts'

const think = (c: City) => (c.needsThought ? decideSimulated(c) : c)
const step = (c: City) => think(advanceYear(c))
const tell = (c: City, id: CharacterId) => think(tellDaemon(c, id).city)
const mio = (c: City) => c.people.find((p) => p.id === 'mio')!

/** A player who tells someone's wish every few years. */
function play(seed: number, until = END_YEAR): City {
  const who: CharacterId[] = ['mio', 'lena', 'roth']
  let c = tell(createCity(seed), who[seed % 3])
  while (c.year < until) {
    c = step(c)
    if (c.year % 3 === 0) c = tell(c, who[(c.year + seed) % 3])
  }
  return c
}

const ctx = (over: Partial<ValidationContext> = {}): ValidationContext => ({
  year: 2030,
  plots: [{ id: 'westbed', state: 'paved', busy: false }, { id: 'fountain', state: 'fountain', busy: true }],
  building: 0,
  ...over,
})

describe('the one-year rule', () => {
  it('every action has a minimum of at least one year; major works at least five', () => {
    for (const id of ACTION_IDS) expect(ACTIONS[id].minYears).toBeGreaterThanOrEqual(1)
    for (const id of ['plant_garden', 'establish_shared_courtyard', 'add_play_space'] as const) expect(ACTIONS[id].minYears).toBeGreaterThanOrEqual(5)
  })

  it('clamps short durations up to the action minimum and says so', () => {
    for (const asked of [0, -3, 0.4, 1, 3]) {
      const v = validateDecision({ action: 'plant_garden', plotId: 'westbed', durationYears: asked, noticed: '', reason: '', utterance: '' }, ctx())
      expect(v.ok).toBe(true)
      if (v.ok) {
        expect(v.decision.durationYears).toBeGreaterThanOrEqual(ACTIONS.plant_garden.minYears)
        expect(v.notes.join(' ')).toMatch(/does not permit|whole years/)
      }
    }
  })

  it('even waiting takes a year', () => {
    const v = validateDecision({ action: 'wait', plotId: 'none', durationYears: 0 }, ctx())
    expect(v.ok && v.decision.durationYears).toBe(1)
  })

  it('start year always comes from the city, never from the brain', () => {
    const v = validateDecision({ action: 'wait', plotId: 'none', durationYears: 1, startYear: 1990, completionYear: 1991 }, ctx())
    expect(v.ok && v.decision.startYear).toBe(2030)
  })

  it('no work completes in the year it starts, and physical change happens exactly at completion (25 seeds)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const c = play(seed)
      for (const w of c.works) expect(w.completionYear - w.startYear).toBeGreaterThanOrEqual(1)
      for (const id of Object.keys(c.plots) as (keyof City['plots'])[]) {
        for (const layer of c.plots[id].layers.filter((l) => l.by)) {
          expect(layer.year).toBe(c.works.find((w) => w.id === layer.by)!.completionYear)
        }
      }
    }
  })

  it('telling a wish never changes the physical square before completion', () => {
    let c = tell(createCity(7), 'mio')
    const work = c.works.find((w) => w.action !== 'wait')!
    expect(work).toBeTruthy()
    expect(work.completionYear - work.startYear).toBeGreaterThanOrEqual(5)
    const before = c.plots[work.plot as keyof City['plots']].state
    while (c.year < work.completionYear - 1) {
      c = step(c)
      expect(c.plots[work.plot as keyof City['plots']].state).toBe(before)
    }
    c = step(c)
    expect(c.plots[work.plot as keyof City['plots']].layers.at(-1)!.year).toBe(work.completionYear)
  })
})

describe('validator rejects what it must', () => {
  it('unknown actions', () => expect(validateDecision({ action: 'demolish_everything', plotId: 'westbed', durationYears: 2 }, ctx()).ok).toBe(false))
  it('incompatible targets', () => expect(validateDecision({ action: 'plant_garden', plotId: 'fountain', durationYears: 7 }, ctx()).ok).toBe(false))
  it('busy plots', () => expect(validateDecision({ action: 'add_play_space', plotId: 'fountain', durationYears: 6 }, ctx()).ok).toBe(false))
  it('over capacity', () => expect(validateDecision({ action: 'plant_garden', plotId: 'westbed', durationYears: 7 }, ctx({ building: 2 })).ok).toBe(false))
  it('non-objects', () => expect(validateDecision('rm -rf /', ctx()).ok).toBe(false))
})

describe('lives move on', () => {
  it('Mio ages from a child of 7 to a teenager of 15 who wants something else', () => {
    let c = createCity(7)
    expect(ageOf(mio(c), c.year)).toBe(7)
    expect(stageOf(mio(c), c.year).stage).toBe('child')
    expect(currentWhisper(c, 'mio')!.text).toMatch(/playground/)
    while (c.year < 2034) c = advanceYear(c)
    expect(ageOf(mio(c), c.year)).toBe(15)
    expect(stageOf(mio(c), c.year).stage).toBe('teenager')
    expect(stageOf(mio(c), c.year).wish!.wants).not.toContain('play')
  })

  it('Mio visibly grows every year of childhood', () => {
    const p = mio(createCity(1))
    for (let y = 2026; y < 2034; y++) expect(figureScale(p, y + 1)).toBeGreaterThan(figureScale(p, y))
  })

  it('Lena graduates in 2030, and her study wish ends there', () => {
    let c = createCity(3)
    while (c.year < 2030) c = advanceYear(c)
    expect(c.milestones.some((m) => m.personId === 'lena' && m.year === 2030 && /Graduated/.test(m.text))).toBe(true)
    expect(stageOf(c.people.find((p) => p.id === 'lena')!, 2030).stage).toBe('graduate')
  })

  it('Frau Roth is frail at 81 in 2036 (if still alive)', () => {
    const roth = createCity(1).people.find((p) => p.id === 'roth')!
    expect(stageOf(roth, 2036).stage).toBe('frail')
    expect(ageOf(roth, 2036)).toBe(81)
  })

  it('Frau Roth dies only through aging: at 80 or older, in different years across seeds, leaving a memorial', () => {
    const years = new Set<number>()
    for (let seed = 1; seed <= 30; seed++) {
      let c = createCity(seed)
      while (c.year < 2075) c = advanceYear(c) // no daemon decisions at all: death is independent of works
      const roth = c.people.find((p) => p.id === 'roth')!
      expect(roth.diedYear).toBeDefined()
      expect(ageOf(roth, roth.diedYear!)).toBeGreaterThanOrEqual(80)
      expect(c.plots.linden.marks.some((m) => m.kind === 'memorial')).toBe(true)
      expect(c.whispers.some((w) => w.personId === 'roth')).toBe(true)
      years.add(roth.diedYear!)
    }
    expect(years.size).toBeGreaterThan(3)
  })
})

describe('reactions and agency', () => {
  it('a playground for the child Mio, finished for the teenager Mio, is bittersweet', () => {
    let found = false
    for (let seed = 1; seed <= 40 && !found; seed++) {
      let c = tell(createCity(seed), 'mio')
      const work = c.works.find((w) => w.action === 'add_play_space')
      if (!work) continue
      while (c.year < work.completionYear) c = step(c)
      const r = c.reactions.find((x) => x.personId === 'mio' && x.workId === work.id)
      if (stageOf(mio(c), c.year).stage !== 'child') {
        expect(r?.mood).toBe('bittersweet')
        expect(r?.line).toMatch(/when I was little/)
        found = true
      }
    }
    expect(found).toBe(true)
  })

  it('telling Mio’s wish does not dictate the outcome', () => {
    const outcomes = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const w = tell(createCity(seed), 'mio').works[0]
      outcomes.add(`${w?.action}@${w?.plot}`)
    }
    expect(outcomes.size).toBeGreaterThan(1)
    // ...but it always makes the daemon answer with something that lasts years
    for (let seed = 1; seed <= 40; seed++) {
      const w = tell(createCity(seed), 'mio').works[0]
      expect(w.completionYear - w.startYear).toBeGreaterThanOrEqual(1)
    }
  })

  it('one decision per year: a second wish told the same year waits', () => {
    let c = tell(createCity(5), 'mio')
    const r = tellDaemon(c, 'lena')
    expect(['next-year', 'busy']).toContain(r.outcome)
    c = r.city
    expect(c.needsThought).toBe(false)
  })

  it('is reproducible from its seed', () => {
    expect(JSON.stringify(play(7, 2050))).toBe(JSON.stringify(play(7, 2050)))
  })

  it('validation context marks plots under construction as busy', () => {
    const c = tell(createCity(7), 'lena')
    const work = c.works.find((w) => w.action !== 'wait')
    if (work) expect(validationContext(c).plots.find((p) => p.id === work.plot)!.busy).toBe(true)
  })

  it('prints a chronicle', () => {
    const c = play(7)
    const lines = c.ledger.map((e) =>
      e.type === 'decision' ? `${e.year} DECIDE ${e.decision.action}@${e.decision.plot} ${e.decision.startYear}->${e.decision.completionYear} | ${e.decision.reason}`
        : e.type === 'completion' ? `${e.year} DONE ${e.text}` : `${e.year} ${e.type.toUpperCase()} ${e.text}`)
    lines.push(...c.reactions.map((r) => `${r.year} REACT ${r.personId} ${r.mood}: ${r.line}`))
    if (process.env.CHRONICLE) console.log(lines.join('\n'))
    expect(lines.length).toBeGreaterThan(10)
  })
})
