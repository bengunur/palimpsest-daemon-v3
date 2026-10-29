import { describe, expect, it } from 'vitest'
import { decideSimulated } from './daemon.ts'
import { advanceYear, applyDecision, createCity, currentWhisper, tellDaemon } from './engine.ts'
import { EMOTIONS, feelingOf, moodHistory } from './feelings.ts'
import type { Emotion } from './feelings.ts'
import type { CharacterId, City } from './types.ts'
import { END_YEAR, isPresent } from './world.ts'

const IDS: CharacterId[] = ['mio', 'lena', 'roth']
const think = (c: City) => (c.needsThought ? decideSimulated(c) : c)
const step = (c: City) => think(advanceYear(c))
const emotions = (c: City) => IDS.map((id) => feelingOf(c, id)?.emotion ?? null)

/** The daemon builds a playground on the East Lot, starting now. (Applied directly: the validator is not the subject here.) */
function playground(c: City, years = 7): City {
  return applyDecision(c, {
    noticed: '', action: 'add_play_space', plotId: 'eastlot', durationYears: years,
    startYear: c.year, completionYear: c.year + years, reason: '', utterance: '',
  }, 'simulated', [])
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v) }
  return o
}

describe('feelings are read off the city, never a cause', () => {
  it('are deterministic and never mutate the city', () => {
    let c = createCity(5)
    for (let i = 0; i < 12; i++) c = step(c)
    const frozen = deepFreeze(structuredClone(c))
    for (const id of IDS) expect(feelingOf(frozen, id)).toEqual(feelingOf(c, id))
  })

  it('recording them does not change what the daemon does (same seed, same chronicle)', () => {
    let a = createCity(9)
    let b = createCity(9)
    for (let i = 0; i < 30; i++) { a = step(a); b = step(b) }
    expect(a.ledger).toEqual(b.ledger)
    expect(a.rng).toBe(b.rng)
  })

  it('one mood per person per year, and none for the dead', () => {
    let c = tellDaemon(createCity(4), 'roth').city
    c = think(c)
    while (c.year < END_YEAR) c = step(c)
    const roth = c.people.find((p) => p.id === 'roth')!
    const seen = new Set<string>()
    for (const m of c.moods) {
      const k = `${m.year}:${m.personId}`
      expect(seen.has(k)).toBe(false)
      seen.add(k)
      if (m.personId === 'roth') expect(isPresent(roth, m.year)).toBe(true)
    }
    expect(moodHistory(c, 'mio', 8)).toHaveLength(8)
  })
})

describe('the daemon is slow in people too', () => {
  it('telling a wish never changes anyone’s emotion in the same year (25 seeds, many years)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let c = createCity(seed)
      while (c.year < 2050) {
        for (const id of IDS) {
          if (!currentWhisper(c, id)) continue
          const before = emotions(c)
          const after = think(tellDaemon(c, id).city)
          expect(emotions(after)).toEqual(before)
        }
        c = step(c)
        if ((c.year + seed) % 4 === 0) c = think(tellDaemon(c, IDS[(c.year + seed) % 3]).city)
      }
    }
  })

  it('a decision is invisible in the year it is made; feelings arrive from the next year', () => {
    const c = createCity(7)
    const decided = playground(c)
    expect(emotions(decided)).toEqual(emotions(c))
    expect(emotions(advanceYear(decided))).not.toEqual(emotions(advanceYear(c)))
  })

  it('waiting for your own wish drifts from hope to frustration to resignation, year by year', () => {
    let c = playground(createCity(7), 9)
    const mio: Emotion[] = []
    while (c.year < 2034) { c = advanceYear(c); mio.push(feelingOf(c, 'mio')!.emotion) }
    // Mio is 8 in 2027: one year of hope, then impatience, then giving up — never a jump to joy
    expect(mio[0]).toBe('happy')
    expect(mio).toContain('frustrated')
    expect(mio.indexOf('frustrated')).toBeGreaterThan(0)
    expect(new Set(mio).size).toBeGreaterThanOrEqual(3)
  })
})

describe('one square, three realities', () => {
  it('the same playground under construction: Mio is hopeful, Lena is frustrated, Frau Roth does not much care', () => {
    const c = advanceYear(playground(createCity(7)))
    expect(feelingOf(c, 'mio')!.emotion).toBe('happy')
    expect(feelingOf(c, 'lena')!.emotion).toBe('frustrated')
    expect(feelingOf(c, 'roth')!.emotion).toBe('calm')
    // and they say it in their own words
    const lines = IDS.map((id) => feelingOf(c, id)!.line)
    expect(new Set(lines).size).toBe(3)
  })

  it('across many games, the three rarely feel the same thing at once', () => {
    let differ = 0
    let total = 0
    for (let seed = 1; seed <= 10; seed++) {
      let c = think(tellDaemon(createCity(seed), IDS[seed % 3]).city)
      while (c.year < 2045) {
        c = step(c)
        const e = emotions(c).filter((x) => x !== null)
        total++
        if (new Set(e).size > 1) differ++
      }
    }
    expect(differ / total).toBeGreaterThan(0.6)
  })

  it('every emotion occurs somewhere in ordinary play', () => {
    const seen = new Set<Emotion>()
    for (let seed = 1; seed <= 12; seed++) {
      let c = think(tellDaemon(createCity(seed), IDS[seed % 3]).city)
      while (c.year < END_YEAR) {
        c = step(c)
        if (c.year % 3 === seed % 3) c = think(tellDaemon(c, IDS[(c.year + seed) % 3]).city)
        for (const m of c.moods) seen.add(m.emotion)
      }
    }
    expect([...seen].sort()).toEqual([...EMOTIONS].sort())
  })
})
