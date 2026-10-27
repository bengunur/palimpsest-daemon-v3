import { useCallback, useEffect, useRef, useState } from 'react'
import { ACTIONS } from '../shared/actions.ts'
import type { PlotId } from '../shared/actions.ts'
import { Inspector } from './components/Inspector.tsx'
import { Ledger, SourceBadge } from './components/Ledger.tsx'
import { Scene } from './components/Scene.tsx'
import { Timeline } from './components/Timeline.tsx'
import { decideLive, decideSimulated } from './sim/daemon.ts'
import { activeWait, advanceYear, buildingWorks, carryWhisper, createCity, plotName } from './sim/engine.ts'
import { LENS_INFO } from './sim/interpret.ts'
import { IS_LOCAL, probeLive } from './sim/live.ts'
import type { LiveStatus } from './sim/live.ts'
import { buildSnapshot } from './sim/snapshot.ts'
import type { City, LedgerEntry, Lens } from './sim/types.ts'
import { END_YEAR, isPresent, phaseOf } from './sim/world.ts'

const LENSES: Lens[] = ['ground', 'memory', 'present', 'possibility', 'palimpsest']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const DEMO_SEED = 7

type Brain = 'live' | 'simulated'

export default function App() {
  const [city, setCityState] = useState<City>(() => createCity(DEMO_SEED))
  const cityRef = useRef(city)
  const setCity = useCallback((c: City) => { cityRef.current = c; setCityState(c) }, [])
  const [lens, setLens] = useState<Lens>('ground')
  const [hover, setHover] = useState<PlotId | null>(null)
  const [selected, setSelected] = useState<PlotId | null>(null)
  const [thinking, setThinking] = useState<string | null>(null)
  const [live, setLive] = useState<LiveStatus>({ available: false })
  const [brain, setBrain] = useState<Brain>('simulated')
  const brainRef = useRef<Brain>('simulated')
  brainRef.current = brain
  const [caption, setCaption] = useState<string | null>(null)
  const [demoOn, setDemoOn] = useState(false)
  const demoToken = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    probeLive().then((s) => { setLive(s); if (s.available) setBrain('live') })
  }, [])

  /** The daemon deliberates. Only ever called when the city asks for a thought. */
  const think = useCallback(async (c: City, opts: { forceSim?: boolean; pause?: number } = {}): Promise<City> => {
    const useLive = !opts.forceSim && brainRef.current === 'live' && live.available
    setThinking(useLive ? 'the daemon is deliberating (Claude, locally)…' : 'the daemon is deliberating…')
    let next: City
    if (useLive) {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 90_000)
      next = await decideLive(c, buildSnapshot(c), ctrl.signal)
      clearTimeout(t)
    } else {
      await sleep(opts.pause ?? 650)
      next = decideSimulated(c)
    }
    setThinking(null)
    setCity(next)
    return next
  }, [live.available, setCity])

  const step = useCallback(async (opts: { forceSim?: boolean; pause?: number } = {}): Promise<City> => {
    if (busy.current) return cityRef.current
    busy.current = true
    try {
      let c = advanceYear(cityRef.current)
      setCity(c)
      if (c.needsThought) c = await think(c, opts)
      return c
    } finally {
      busy.current = false
    }
  }, [setCity, think])

  // thoughts that are not caused by a year passing: the first listening, or a carried whisper
  useEffect(() => {
    if (!city.needsThought || demoOn || busy.current) return
    const t = setTimeout(async () => {
      if (busy.current || !cityRef.current.needsThought) return
      busy.current = true
      try { await think(cityRef.current) } finally { busy.current = false }
    }, 900)
    return () => clearTimeout(t)
  }, [city, demoOn, think])

  const untilSomethingFinishes = useCallback(async () => {
    const start = cityRef.current.ledger.length
    for (let i = 0; i < 15 && cityRef.current.year < END_YEAR; i++) {
      const c = await step()
      if (c.ledger.slice(start).some((e) => e.type === 'completion')) break
      await sleep(420)
    }
  }, [step])

  const reset = useCallback((seed: number) => {
    demoToken.current++
    setDemoOn(false)
    setCaption(null)
    setSelected(null)
    setCity(createCity(seed))
  }, [setCity])

  const runDemo = useCallback(async () => {
    const token = ++demoToken.current
    const alive = () => demoToken.current === token
    const wait = async (ms: number) => { await sleep(ms); if (!alive()) throw new Error('demo stopped') }
    setDemoOn(true)
    setSelected(null)
    try {
      let c = createCity(DEMO_SEED)
      setCity(c)
      setLens('ground')
      setCaption('Kleiner Ilmplatz, Weimar, 2026. A daemon is listening. Nothing it does takes under a year.')
      await wait(3600)
      setLens('memory')
      setCaption('Through the Resident’s eyes: a garden under the stones, paved over in 1979.')
      await wait(3600)
      setLens('present')
      setCaption('Through the Student’s eyes: nowhere quiet to read.')
      await wait(3000)
      setLens('possibility')
      setCaption('Through the Child’s eyes: the fountain is a volcano.')
      await wait(3000)
      setLens('ground')
      setCaption('The daemon weighs memory against need…')
      c = await think(c, { forceSim: true, pause: 900 })
      const d = lastDecision(c)
      if (d) setCaption(`It decides to ${ACTIONS[d.action].label}${d.plot !== 'none' ? ` at the ${plotName(d.plot)}` : ''}. Begun ${d.startYear}. Finished ${d.completionYear}.`)
      await wait(4200)

      const first = c.works.find((w) => w.action !== 'wait')
      while (alive() && c.year < (first?.completionYear ?? 2034)) {
        const before = c.ledger.length
        c = await step({ forceSim: true, pause: 300 })
        setCaption(captionFor(c, c.ledger.slice(before)))
        await wait(1500)
      }
      setLens('memory')
      await wait(2600)
      setLens('possibility')
      await wait(2400)
      setLens('ground')
      setCaption('Decades pass, one year at a time.')
      while (alive() && c.year < 2058) {
        c = await step({ forceSim: true, pause: 60 })
        await wait(170)
      }
      setLens('palimpsest')
      setCaption('2058. Every layer at once. Everything it built was for someone who had already left. That is what a city is.')
      await wait(6000)
      setCaption(null)
    } catch {
      /* stopped */
    } finally {
      if (alive()) setDemoOn(false)
    }
  }, [setCity, step, think])

  // keyboard: 1–5 lenses, space = one year
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' && e.key === ' ') return
      const i = Number(e.key) - 1
      if (i >= 0 && i < LENSES.length) setLens(LENSES[i])
      if (e.key === ' ' && !demoOn && !thinking) { e.preventDefault(); step() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [demoOn, thinking, step])

  const focus = hover ?? selected
  const waitWork = activeWait(city)
  const building = buildingWorks(city)
  const status = thinking ? thinking
    : waitWork ? `waiting and listening until ${waitWork.completionYear}`
    : building.length ? `tending ${building.length} work${building.length > 1 ? 's' : ''} in the ground`
    : 'listening'
  const atEnd = city.year >= END_YEAR
  const controlsLocked = demoOn || !!thinking || atEnd

  return (
    <div className="app">
      <header className="top">
        <div className="title">
          <h1>Palimpsest</h1>
          <p>The City That Is Always Too Late · <span>Kleiner Ilmplatz, Weimar</span></p>
        </div>
        <ModeBanner live={live} brain={brain} setBrain={setBrain} demo={demoOn} />
        <div className="year" key={city.year}><span>{city.year}</span></div>
      </header>

      <aside className="left">
        <section>
          <h2>Lenses</h2>
          <div className="lenses" role="radiogroup" aria-label="Perspective">
            {LENSES.map((l, i) => (
              <button key={l} role="radio" aria-checked={lens === l} className={`lens-btn lens-${l} ${lens === l ? 'on' : ''}`} onClick={() => setLens(l)}>
                <span className="k">{i + 1}</span>
                <span className="n">{LENS_INFO[l].name}</span>
                <span className="w">{LENS_INFO[l].who}</span>
              </button>
            ))}
          </div>
          <p className="blurb">{LENS_INFO[lens].blurb}</p>
        </section>
        <section>
          <h2>People, {city.year}</h2>
          <People city={city} />
        </section>
      </aside>

      <main className="stage">
        <Scene city={city} lens={lens} focus={focus} selected={selected} onHover={setHover} onSelect={(id) => setSelected(selected === id ? null : id)} />
        {caption && <p className="caption" key={caption}>{caption}</p>}
        <div className="inspector-wrap">
          <Inspector city={city} lens={lens} plotId={focus} canCarry={!demoOn && !thinking && city.carriedYear !== city.year && !atEnd}
            onCarry={(id) => setCity(carryWhisper(cityRef.current, id))} />
        </div>
      </main>

      <aside className="right">
        <section className="daemon">
          <h2>The daemon’s ledger</h2>
          <p className="who"><b>Der Langsame</b> — {status}</p>
          <Weights city={city} />
        </section>
        <Ledger city={city} thinking={thinking} />
      </aside>

      <footer className="bottom">
        <Timeline city={city} />
        <div className="controls">
          <button className="primary" disabled={controlsLocked} onClick={() => step()}>+1 year</button>
          <button disabled={controlsLocked} onClick={untilSomethingFinishes}>until something finishes</button>
          <span className="sep" />
          {demoOn
            ? <button onClick={() => reset(DEMO_SEED)}>■ stop demo</button>
            : <button onClick={runDemo} disabled={!!thinking}>▶ 45-second demo</button>}
          <button disabled={demoOn || !!thinking} onClick={() => reset(1 + Math.floor(Math.random() * 999))}>new city</button>
          <button disabled={demoOn || !!thinking} onClick={() => reset(city.seed)}>restart</button>
          <span className="seed">seed {city.seed}</span>
          {atEnd && <span className="end">{END_YEAR}. The daemon continues without you.</span>}
          <span className="keys">keys: 1–5 lenses · space +1 year</span>
        </div>
      </footer>
    </div>
  )
}

function lastDecision(c: City) {
  const e = [...c.ledger].reverse().find((x) => x.type === 'decision')
  return e && e.type === 'decision' ? e.decision : null
}

function captionFor(c: City, fresh: LedgerEntry[]): string {
  const done = fresh.find((e) => e.type === 'completion')
  if (done && done.type === 'completion') return `${c.year}. ${done.text}${done.tooLate ? ' Too late.' : ''}`
  const dec = fresh.find((e) => e.type === 'decision')
  if (dec && dec.type === 'decision') {
    const d = dec.decision
    return d.action === 'wait'
      ? `${c.year}. The daemon waits: “${d.utterance}”`
      : `${c.year}. Meanwhile it begins to ${ACTIONS[d.action].label} at the ${plotName(d.plot)} — until ${d.completionYear}.`
  }
  const ev = fresh.find((e) => e.type === 'event')
  if (ev && ev.type === 'event') return `${c.year}. ${ev.text}`
  const work = c.works.find((w) => w.status === 'building' && w.action !== 'wait')
  return work ? `${c.year}. Still building. ${work.completionYear - c.year} more year${work.completionYear - c.year === 1 ? '' : 's'}.` : `${c.year}.`
}

function ModeBanner({ live, brain, setBrain, demo }: { live: LiveStatus; brain: Brain; setBrain: (b: Brain) => void; demo: boolean }) {
  if (demo) return <div className="mode mode-sim"><SourceBadge source="simulated" /> Demo: the deterministic simulated daemon, seed {DEMO_SEED}. Not live AI.</div>
  if (live.available) {
    return (
      <div className={`mode ${brain === 'live' ? 'mode-live' : 'mode-sim'}`}>
        {brain === 'live'
          ? <><SourceBadge source="live" model={live.model} /> Decisions come from Claude via a local <code>claude -p</code> server.</>
          : <><SourceBadge source="simulated" /> Live Claude is available, but switched off.</>}
        <button className="link" onClick={() => setBrain(brain === 'live' ? 'simulated' : 'live')}>{brain === 'live' ? 'use simulated' : 'use live Claude'}</button>
      </div>
    )
  }
  return (
    <div className="mode mode-sim">
      <SourceBadge source="simulated" />
      {IS_LOCAL
        ? <> Live thinking is off — run <code>npm run daemon</code> to let Claude decide.</>
        : <> You are watching a simulated daemon. Its real thinking (Claude) runs only on a local machine — <a href="https://github.com/bengunur/palimpsest-daemon#live-daemon-local-only">see README</a>.</>}
    </div>
  )
}

function People({ city }: { city: City }) {
  const here = city.people.filter((p) => isPresent(p, city.year))
  const gone = city.people.filter((p) => p.leaves <= city.year && p.leaves > 2025).sort((a, b) => b.leaves - a.leaves).slice(0, 3)
  return (
    <ul className="people-list">
      {here.map((p) => {
        const ph = phaseOf(p, city.year)
        return <li key={p.id} className={`lens-${ph.lens}`}><i /> <b>{p.name}</b> <span>{ph.role}</span></li>
      })}
      {gone.map((p) => <li key={p.id} className="gone"><i /> <b>{p.name}</b> <span>left {p.leaves}</span></li>)}
    </ul>
  )
}

function Weights({ city }: { city: City }) {
  const w = city.weights
  return (
    <div className="weights" title="What the daemon values. These drift: when its works arrive too late, it trusts memory more and usefulness less.">
      {(['memory', 'use', 'play', 'stillness'] as const).map((k) => (
        <div key={k}><span>{k}</span><i style={{ width: `${w[k] * 160}%` }} /><b>{w[k].toFixed(2)}</b></div>
      ))}
    </div>
  )
}
