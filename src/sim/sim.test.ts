import { describe, expect, it } from 'vitest'
import { ACTIONS, ACTION_IDS, validateDecision } from '../../shared/actions.ts'
import type { ValidationContext } from '../../shared/actions.ts'
import { advanceYear, createCity, validationContext } from './engine.ts'
import { decideSimulated } from './daemon.ts'
import type { City } from './types.ts'
import { END_YEAR } from './world.ts'

function run(seed: number, until = END_YEAR): City {
  let c = createCity(seed)
  if (c.needsThought) c = decideSimulated(c)
  while (c.year < until) {
    c = advanceYear(c)
    if (c.needsThought) c = decideSimulated(c)
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
  it('every action has a minimum of at least one year', () => {
    for (const id of ACTION_IDS) expect(ACTIONS[id].minYears).toBeGreaterThanOrEqual(1)
  })

  it('clamps short durations up to the action minimum and says so', () => {
    for (const asked of [0, -3, 0.4, 1, 3]) {
      const v = validateDecision({ action: 'plant_garden', plotId: 'westbed', durationYears: asked, noticed: '', reason: '', utterance: '' }, ctx())
      expect(v.ok).toBe(true)
      if (v.ok) {
        expect(v.decision.durationYears).toBeGreaterThanOrEqual(ACTIONS.plant_garden.minYears)
        expect(v.decision.completionYear - v.decision.startYear).toBeGreaterThanOrEqual(1)
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

  it('no physical change completes in under a year, across many seeds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const c = run(seed)
      for (const w of c.works) expect(w.completionYear - w.startYear).toBeGreaterThanOrEqual(1)
      for (const id of Object.keys(c.plots) as (keyof City['plots'])[]) {
        for (const layer of c.plots[id].layers.filter((l) => l.by)) {
          const work = c.works.find((w) => w.id === layer.by)!
          expect(layer.year).toBe(work.completionYear)
        }
      }
    }
  })
})

describe('validator rejects what it must', () => {
  it('unknown actions', () => expect(validateDecision({ action: 'demolish_everything', plotId: 'westbed', durationYears: 2 }, ctx()).ok).toBe(false))
  it('incompatible targets', () => expect(validateDecision({ action: 'plant_garden', plotId: 'fountain', durationYears: 5 }, ctx()).ok).toBe(false))
  it('busy plots', () => expect(validateDecision({ action: 'add_play_space', plotId: 'fountain', durationYears: 3 }, ctx()).ok).toBe(false))
  it('over capacity', () => expect(validateDecision({ action: 'plant_garden', plotId: 'westbed', durationYears: 5 }, ctx({ building: 2 })).ok).toBe(false))
  it('non-objects', () => expect(validateDecision('rm -rf /', ctx()).ok).toBe(false))
})

describe('the city', () => {
  it('is reproducible from its seed', () => {
    expect(JSON.stringify(run(7, 2050))).toBe(JSON.stringify(run(7, 2050)))
  })

  it('differs between seeds', () => {
    const a = run(3).works.map((w) => `${w.action}@${w.plot}`).join()
    const outcomes = new Set([4, 5, 6, 8, 11, 12].map((s) => run(s).works.map((w) => `${w.action}@${w.plot}:${w.startYear}`).join()))
    expect(outcomes.size + (outcomes.has(a) ? 0 : 1)).toBeGreaterThan(1)
  })

  it('validation context marks plots under construction as busy', () => {
    let c = createCity(7)
    c = decideSimulated(c)
    const vc = validationContext(c)
    const work = c.works.find((w) => w.action !== 'wait')
    if (work) expect(vc.plots.find((p) => p.id === work.plot)!.busy).toBe(true)
  })

  it('prints the seed-7 chronicle', () => {
    const c = run(7)
    const lines = c.ledger.map((e) =>
      e.type === 'decision'
        ? `${e.year} DECIDE ${e.decision.action}@${e.decision.plot} ${e.decision.startYear}->${e.decision.completionYear} | ${e.decision.reason}`
        : e.type === 'completion' ? `${e.year} DONE ${e.text}${e.tooLate ? ' [TOO LATE]' : ''}`
        : `${e.year} ${e.type.toUpperCase()} ${e.text}`,
    )
    if (process.env.CHRONICLE) console.log(lines.join('\n'))
    expect(lines.length).toBeGreaterThan(10)
  })
})
