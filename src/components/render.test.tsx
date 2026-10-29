import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { decideSimulated } from '../sim/daemon.ts'
import { advanceYear, applyDecision, createCity, tellDaemon } from '../sim/engine.ts'
import { statusOf } from '../sim/status.ts'
import type { CharacterId, City } from '../sim/types.ts'
import { ageOf } from '../sim/world.ts'
import { EMOTIONS } from '../sim/feelings.ts'
import { Face } from './Character.tsx'
import { CharacterBubble, CharacterDock, DecisionCard } from './Hud.tsx'
import { FOCUS_ZOOM, Scene } from './Scene.tsx'

const noop = () => {}
const IDS: CharacterId[] = ['mio', 'lena', 'roth']
function scene(c: City, selected: CharacterId | null = null) {
  return renderToString(<Scene city={c} layers={false} selected={selected} hover={null} tutorial={false} onPick={noop} onHover={noop} onBackground={noop} />)
}
const bubble = (c: City, id: CharacterId) =>
  renderToString(<CharacterBubble city={c} id={id} outcome={null} thinking={false} onTell={noop} onClose={noop} />)
const step = (c: City) => { const n = advanceYear(c); return n.needsThought ? decideSimulated(n) : n }

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v) }
  return o
}

describe('the acceptance loop renders', () => {
  it('click Mio → wish → tell → multi-year build → years pass → a teenager with a new wish', () => {
    let c = createCity(7)
    expect(scene(c, 'mio')).toContain('ch-mio')
    let html = bubble(c, 'mio')
    expect(html).toContain('playground')
    expect(html).toContain('Tell the daemon')

    const told = tellDaemon(c, 'mio')
    expect(told.outcome).toBe('thinking')
    c = decideSimulated(told.city)
    const d = c.ledger.findLast((e) => e.type === 'decision')!
    expect(d.type === 'decision' && d.decision.durationYears).toBeGreaterThanOrEqual(5)
    if (d.type === 'decision') expect(renderToString(<DecisionCard d={d.decision} onClose={noop} />)).toContain('SIMULATED')
    html = scene(c)
    expect(html).toContain('work-sign')
    expect(html).toContain('ready ')

    const work = c.works.find((w) => w.action !== 'wait')!
    while (c.year < work.completionYear) { c = step(c); scene(c, 'mio') }
    expect(c.plots[work.plot as keyof City['plots']].layers.at(-1)!.year).toBe(work.completionYear)

    expect(scene(c, 'mio')).toMatch(/st-teenager|st-student/)
    expect(bubble(c, 'mio')).not.toContain('I wish there was a playground here!')
  })

  it('renders every year to the end, through death, layers and visions', () => {
    let c = decideSimulated(tellDaemon(createCity(3), 'lena').city)
    while (c.year < 2086) {
      c = step(c)
      for (const id of [null, ...IDS]) scene(c, id)
      for (const id of IDS) bubble(c, id)
      renderToString(<CharacterDock city={c} selected={IDS[c.year % 3]} onPick={noop} />)
    }
    expect(c.plots.linden.marks.some((m) => m.kind === 'memorial')).toBe(true)
  }, 120_000) // sixty years × every perspective: slow on modest machines
})

describe('perspectives: one shared city', () => {
  it('switching perspective never changes the simulation', () => {
    const c = deepFreeze(decideSimulated(tellDaemon(createCity(11), 'mio').city))
    const before = JSON.stringify(c)
    const physical = (html: string) => (html.match(/class="plot"/g) ?? []).length
    const counts = new Set<number>()
    for (const id of [null, ...IDS, 'lena', null, 'roth'] as (CharacterId | null)[]) {
      const html = scene(c, id) // would throw on any write to the frozen city
      counts.add(physical(html))
      if (id) expect(html).toContain(`persp-${id}`)
      if (id) expect(html.match(/is-dim/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    }
    expect(counts.size).toBe(1)
    expect(JSON.stringify(c)).toBe(before)
  })

  it('one timeline: every year ages all three at once, whoever is being looked at', () => {
    let c = createCity(4)
    for (let i = 0; i < 6; i++) {
      const ages = c.people.map((p) => ageOf(p, c.year))
      scene(c, IDS[i % 3])
      c = step(c)
      c.people.forEach((p, k) => expect(ageOf(p, c.year)).toBe(ages[k] + 1))
    }
    // construction keeps going regardless of perspective
    c = decideSimulated(tellDaemon(c, 'lena').city)
    const w = c.works.find((x) => x.status === 'building' && x.action !== 'wait')!
    while (c.year < w.completionYear) { scene(c, 'mio'); c = step(c) }
    expect(c.works.find((x) => x.id === w.id)!.status).toBe('done')
  })

  it('selector statuses come from the simulation', () => {
    let c = createCity(2)
    expect(statusOf(c, 'mio')).toMatchObject({ age: 7, label: 'Child' })
    expect(statusOf(c, 'lena')).toMatchObject({ age: 24, label: 'Student' })
    expect(statusOf(c, 'roth')).toMatchObject({ age: 71, label: 'Resident' })
    while (c.year < 2031) c = advanceYear(c)
    expect(statusOf(c, 'lena').label).toBe('Graduated')
    c = decideSimulated(tellDaemon(c, 'roth').city)
    const html = renderToString(<CharacterDock city={c} selected={null} onPick={noop} />)
    expect(html).toContain('29 · Graduated')
  })
})

describe('memorial', () => {
  it('after Frau Roth dies she becomes a memorial: revisitable, but silent to the daemon', () => {
    let c = createCity(9)
    while (c.people.find((p) => p.id === 'roth')!.diedYear === undefined) c = advanceYear(c)
    c = advanceYear(c)
    const st = statusOf(c, 'roth')
    expect(st.memorial).toBe(true)
    expect(st.label).toBe('In memory')
    const r = tellDaemon(c, 'roth')
    expect(r.outcome).toBe('nothing')
    expect(r.city).toBe(c)
    const html = bubble(c, 'roth')
    expect(html).not.toContain('Tell the daemon')
    expect(html).toContain(st.years!)
    expect(scene(c, 'roth')).toContain('memorial-anchor')
    expect(renderToString(<CharacterDock city={c} selected="roth" onPick={noop} />)).toContain('🕯')
  })
})

describe('conflicting realities', () => {
  it('a playground built for someone else lands differently in Frau Roth’s reality', () => {
    let c = createCity(5)
    c = applyDecision(c, { noticed: '', action: 'add_play_space', plotId: 'eastlot', durationYears: 5, startYear: c.year, completionYear: c.year + 5, reason: '', utterance: '' }, 'simulated', [])
    while (c.year < 2031) c = advanceYear(c)
    const roth = c.reactions.find((r) => r.personId === 'roth')
    expect(roth?.mood).toBe('mixed')
    expect(roth?.line).toMatch(/Noisy/)
  })
})

describe('feelings on screen', () => {
  it('every emotion draws a distinct face', () => {
    const faces = EMOTIONS.map((e) => renderToString(<svg><Face r={8} emotion={e} /></svg>))
    expect(new Set(faces).size).toBe(EMOTIONS.length)
    for (const e of EMOTIONS) expect(faces[EMOTIONS.indexOf(e)]).toContain(`face-${e}`)
  })

  it('the bubble names the feeling, says it in their words, and shows the mood strip', () => {
    let c = applyDecision(createCity(7), { noticed: '', action: 'add_play_space', plotId: 'eastlot', durationYears: 7, startYear: 2026, completionYear: 2033, reason: '', utterance: '' }, 'simulated', [])
    c = advanceYear(c)
    const mio = bubble(c, 'mio')
    expect(mio).toContain('feels happy')
    expect(mio).toContain('mood-strip')
    expect(bubble(c, 'lena')).toContain('feels frustrated')
    // the characters in the square wear the same feelings
    const html = scene(c)
    expect(html).toContain('emo-happy')
    expect(html).toContain('emo-frustrated')
  })

  it('choosing someone moves the camera in; letting go moves it back', () => {
    const c = createCity(7)
    expect(scene(c)).toContain('scale(1)')
    for (const id of IDS) expect(scene(c, id)).toContain(`scale(${FOCUS_ZOOM})`)
  })
})
