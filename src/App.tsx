import { useCallback, useEffect, useRef, useState } from 'react'
import { music } from './audio/music.ts'
import { CharacterBubble, CharacterDock, DecisionCard, FloatingBubble, SoundControl, ThoughtsDrawer, Tutorial, YearPill } from './components/Hud.tsx'
import { SourceBadge } from './components/Ledger.tsx'
import { Scene } from './components/Scene.tsx'
import { decideLive, decideSimulated } from './sim/daemon.ts'
import { advanceYear, buildingWorks, createCity, tellDaemon } from './sim/engine.ts'
import type { TellOutcome } from './sim/engine.ts'
import { probeLive } from './sim/live.ts'
import type { LiveStatus } from './sim/live.ts'
import { buildSnapshot } from './sim/snapshot.ts'
import type { CharacterId, City, DecisionRecord } from './sim/types.ts'
import { END_YEAR, isPresent } from './sim/world.ts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const START_SEED = 7

type Brain = 'live' | 'simulated'

const SOUND_KEY = 'palimpsest.sound'
interface Sound { volume: number; muted: boolean }

function loadSound(): Sound {
  try {
    const s = JSON.parse(localStorage.getItem(SOUND_KEY) ?? 'null') as Partial<Sound> | null
    if (s && typeof s.volume === 'number') return { volume: Math.max(0, Math.min(1, s.volume)), muted: !!s.muted }
  } catch { /* private window or blocked storage: defaults */ }
  return { volume: 0.3, muted: false }
}

/** What the music hears of the city: the clank of sites grows with every year of work; Frau Roth's voice. */
function musicWorld(c: City) {
  const years = buildingWorks(c).reduce((n, w) => n + Math.max(0, c.year - w.startYear), 0)
  return { clank: Math.min(1, years * 0.12), rothAlive: isPresent(c.people.find((p) => p.id === 'roth')!, c.year) }
}

function lastDecision(c: City, after: number): DecisionRecord | null {
  for (let i = c.ledger.length - 1; i >= after; i--) {
    const e = c.ledger[i]
    if (e.type === 'decision') return e.decision
  }
  return null
}

export default function App() {
  const [city, setCityState] = useState<City>(() => createCity(START_SEED))
  const cityRef = useRef(city)
  const setCity = useCallback((c: City) => { cityRef.current = c; setCityState(c) }, [])
  const [selected, setSelected] = useState<CharacterId | null>(null)
  const [hover, setHover] = useState<CharacterId | null>(null)
  const [thinking, setThinking] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<TellOutcome | null>(null)
  const [card, setCard] = useState<DecisionRecord | null>(null)
  const [tutorial, setTutorial] = useState(true)
  const [drawer, setDrawer] = useState(false)
  const [layers, setLayers] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [live, setLive] = useState<LiveStatus>({ available: false })
  const [brain, setBrain] = useState<Brain>('simulated')
  const brainRef = useRef<Brain>('simulated')
  brainRef.current = brain
  const busy = useRef(false)
  const [sound, setSound] = useState<Sound>(loadSound)

  // music starts on the first touch of the page, as browsers require
  useEffect(() => {
    const start = () => music.unlock()
    window.addEventListener('pointerdown', start, { once: true })
    window.addEventListener('keydown', start, { once: true })
    return () => { window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', start) }
  }, [])

  useEffect(() => {
    music.setVolume(sound.volume)
    music.setMuted(sound.muted)
    try { localStorage.setItem(SOUND_KEY, JSON.stringify(sound)) } catch { /* not remembered, still works */ }
  }, [sound])

  // the music follows the city year by year; a work finished this year brings it home once
  const cadenceYear = useRef(0)
  useEffect(() => {
    music.setWorld(musicWorld(city))
    const finished = city.ledger.some((e) => e.type === 'completion' && e.year === city.year)
    if (finished && cadenceYear.current !== city.year) { cadenceYear.current = city.year; music.cadence() }
  }, [city])

  useEffect(() => {
    probeLive().then((s) => { setLive(s); if (s.available) setBrain('live') })
  }, [])

  // decision cards fade on their own
  useEffect(() => {
    if (!card) return
    const t = setTimeout(() => setCard(null), 9000)
    return () => clearTimeout(t)
  }, [card])

  /** The daemon deliberates — only when the city asks it to. */
  const think = useCallback(async (c: City, fromTell = false): Promise<City> => {
    const useLive = brainRef.current === 'live' && live.available
    setThinking(useLive ? 'the daemon is deliberating (Claude, locally)…' : 'the daemon is deliberating…')
    const before = c.ledger.length
    let next: City
    if (useLive) {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 90_000)
      next = await decideLive(c, buildSnapshot(c), ctrl.signal)
      clearTimeout(t)
    } else {
      await sleep(fromTell ? 900 : 350)
      next = decideSimulated(c)
    }
    setThinking(null)
    setCity(next)
    const d = lastDecision(next, before)
    if (d && (d.action !== 'wait' || fromTell)) setCard(d)
    return next
  }, [live.available, setCity])

  const step = useCallback(async (): Promise<City> => {
    if (busy.current) return cityRef.current
    busy.current = true
    try {
      let c = advanceYear(cityRef.current)
      setCity(c)
      setOutcome(null)
      if (c.needsThought) c = await think(c)
      return c
    } finally {
      busy.current = false
    }
  }, [setCity, think])

  const untilFinished = useCallback(async () => {
    setPlaying(true)
    try {
      const start = cityRef.current.ledger.length
      for (let i = 0; i < 15 && cityRef.current.year < END_YEAR; i++) {
        const c = await step()
        const fresh = c.ledger.slice(start)
        if (fresh.some((e) => e.type === 'completion')) break
        if (c.milestones.some((m) => m.year === c.year && m.death)) break
        await sleep(c.milestones.some((m) => m.year === c.year) ? 1400 : 650)
      }
    } finally {
      setPlaying(false)
    }
  }, [step])

  const tell = useCallback(async (id: CharacterId) => {
    if (busy.current) return
    const r = tellDaemon(cityRef.current, id)
    setCity(r.city)
    setOutcome(r.outcome)
    if (r.outcome !== 'thinking') return
    busy.current = true
    try {
      await think(r.city, true)
    } finally {
      busy.current = false
    }
  }, [setCity, think])

  const reset = useCallback((seed: number) => {
    setSelected(null); setCard(null); setOutcome(null); setDrawer(false)
    setCity(createCity(seed))
  }, [setCity])

  const pick = useCallback((id: CharacterId) => {
    setTutorial(false)
    setSelected((s) => (s === id ? null : id))
    setOutcome(null)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelected(null); setDrawer(false) }
      const tag = (e.target as HTMLElement).tagName
      if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'INPUT' && !playing && !thinking) { e.preventDefault(); step() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, thinking, step])

  const locked = playing || !!thinking

  return (
    <div className="game">
      <Scene city={city} layers={layers} selected={selected} hover={hover} tutorial={tutorial}
        onPick={pick} onHover={setHover} onBackground={() => setSelected(null)} />

      {selected && (
        <FloatingBubble anchorId={selected}>
          <CharacterBubble city={city} id={selected} outcome={outcome} thinking={!!thinking}
            onTell={() => tell(selected)} onClose={() => setSelected(null)} />
        </FloatingBubble>
      )}

      <header className="hud-top">
        <div className="brand">
          <h1>Palimpsest</h1>
          <span>the city that is always too late</span>
        </div>
        <div className="mode-chip" title={live.available && brain === 'live' ? 'Decisions are made by Claude on this machine' : 'Decisions are made by a deterministic simulated policy, not by AI'}>
          {live.available && brain === 'live' ? <SourceBadge source="live" model={live.model} /> : <SourceBadge source="simulated" />}
          <span>{live.available && brain === 'live' ? 'Claude decides' : 'simulated daemon'}</span>
        </div>
        <SoundControl volume={sound.volume} muted={sound.muted}
          onVolume={(volume) => { music.unlock(); setSound({ volume, muted: volume === 0 }) }}
          onMute={() => { music.unlock(); setSound((s) => ({ volume: s.muted && s.volume === 0 ? 0.3 : s.volume, muted: !s.muted })) }} />
        <button className="thoughts-btn" onClick={() => setDrawer((d) => !d)}>☰ The daemon’s thoughts</button>
      </header>

      {tutorial && <Tutorial onClose={() => setTutorial(false)} />}
      {thinking && <div className="thinking"><span>{thinking}</span></div>}
      {card && <DecisionCard d={card} onClose={() => setCard(null)} />}

      <div className="bottom-hud">
        <CharacterDock city={city} selected={selected} onPick={pick} />
        <YearPill year={city.year} busy={locked} thinking={!!thinking} canSkip={buildingWorks(city).length > 0} layers={layers}
          onStep={() => step()} onSkip={untilFinished} onLayers={() => setLayers((l) => !l)} />
      </div>

      {drawer && (
        <ThoughtsDrawer city={city} live={live} brain={brain} setBrain={setBrain} thinking={thinking}
          onClose={() => setDrawer(false)} onRestart={() => reset(city.seed)} onNew={() => reset(1 + Math.floor(Math.random() * 999))} />
      )}
    </div>
  )
}
