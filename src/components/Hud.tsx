import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ACTIONS } from '../../shared/actions.ts'
import { currentWhisper, plotName, workFor } from '../sim/engine.ts'
import type { TellOutcome } from '../sim/engine.ts'
import { EMOTION_GLYPH, EMOTION_LABEL, feelingOf, moodHistory } from '../sim/feelings.ts'
import type { LiveStatus } from '../sim/live.ts'
import { lastWish, latestReaction, statusOf } from '../sim/status.ts'
import type { CharacterId, City, DecisionRecord } from '../sim/types.ts'
import { END_YEAR, START_YEAR } from '../sim/world.ts'
import { ACCENT, Face, Figure } from './Character.tsx'
import { Ledger, SourceBadge } from './Ledger.tsx'
import { moodIcon } from './Scene.tsx'

const ORDER: CharacterId[] = ['mio', 'lena', 'roth']

/**
 * The bubble: who they are now, how the square feels to them this year, what they want now, and the one
 * thing the player can do. A speech bubble when they have something to say; a thought cloud otherwise.
 */
export function CharacterBubble({ city, id, outcome, thinking, onTell, onClose }: {
  city: City; id: CharacterId; outcome: TellOutcome | null; thinking: boolean; onTell: () => void; onClose: () => void
}) {
  const p = city.people.find((x) => x.id === id)!
  const st = statusOf(city, id)
  const reaction = latestReaction(city, id)

  if (st.memorial) {
    const last = lastWish(city, id)
    const garden = city.plots.westbed.state === 'garden' || city.plots.westbed.state === 'garden_play'
    return (
      <div className="bubble is-memorial" style={{ ['--accent' as string]: ACCENT[id] }}>
        <header><b>{p.name}</b><span>{st.years}</span><button className="x" onClick={onClose} aria-label="Close">×</button></header>
        {last && <q className="wish">{last.text}</q>}
        <p className="legacy">{garden ? 'Her garden grows on the West Bed.' : 'Her wish lives on in the daemon’s memory.'}</p>
      </div>
    )
  }

  const w = currentWhisper(city, id)
  const work = workFor(city, w)
  const toldNow = city.toldYear[id] === city.year
  const feeling = feelingOf(city, id)
  const thought = feeling?.kind === 'thought' && !w && !reaction
  const saysAgain = feeling && reaction && feeling.line === reaction.line
  let status: string | null = null
  if (toldNow && !work) {
    status = thinking ? 'The daemon is listening…'
      : outcome === 'busy' ? 'The daemon heard. Its hands are full.'
      : outcome === 'next-year' || outcome === 'already' ? 'The daemon heard. It answers one thing a year.'
      : 'The daemon heard — and chose something else.'
  }
  return (
    <div className={`bubble ${thought ? 'is-thought' : ''}`} style={{ ['--accent' as string]: ACCENT[id] }}>
      <header>
        <b>{p.name}</b><span>{st.age} · {st.label.toLowerCase()}</span>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
      </header>
      {feeling && <span className={`emo-chip emo-${feeling.emotion}`}>{`${EMOTION_GLYPH[feeling.emotion] || '·'} feels ${EMOTION_LABEL[feeling.emotion]}`}</span>}
      {reaction && <p className={`reaction mood-${reaction.mood}`}><i>{moodIcon(reaction.mood)}</i> “{reaction.line}”</p>}
      {feeling && !saysAgain && (feeling.kind === 'speech' || thought
        ? <q className={thought ? 'idle thinks' : 'says'}>{feeling.line}</q>
        : <p className="aside"><i>thinks</i> {feeling.line}</p>)}
      {w && <q className="wish">{w.text}</q>}
      {work && (
        <div className="building">
          <span>The daemon is building it</span>
          <div className="bar"><i style={{ width: `${Math.max(4, ((city.year - work.startYear) / (work.completionYear - work.startYear)) * 100)}%` }} /></div>
          <span className="ready">ready {work.completionYear}</span>
        </div>
      )}
      {w && !work && !toldNow && <button className="tell" onClick={onTell} disabled={thinking}>Tell the daemon</button>}
      {status && <p className="status">{status}</p>}
      <MoodStrip city={city} id={id} />
    </div>
  )
}

/** The last eight years, one small face each: the daemon's slowness, read in a person. */
export function MoodStrip({ city, id }: { city: City; id: CharacterId }) {
  const years = moodHistory(city, id, 8)
  return (
    <div className="mood-strip" aria-label={`How the last ${years.length} years felt`}>
      <span className="ms-from">{years[0].year}</span>
      {years.map(({ year, emotion }) => (
        <span key={year} className={`ms ${emotion ? '' : 'empty'} ${year === city.year ? 'now' : ''}`}
          title={emotion ? `${year}: ${EMOTION_LABEL[emotion]}` : year < START_YEAR ? `${year}: before the story` : `${year}: not on the square`}>
          {emotion && (
            <svg viewBox="-9 -9 18 18" aria-hidden="true">
              <circle r={8.2} className="ms-head" />
              <g transform="translate(-4.4,0)"><Face r={8} emotion={emotion} /></g>
            </svg>
          )}
        </span>
      ))}
      <span className="ms-to">{city.year}</span>
    </div>
  )
}

/**
 * Positions its child next to the selected character in screen space and keeps it inside the
 * viewport: above the head when there is room, below the feet when there is not.
 */
export function FloatingBubble({ anchorId, children }: { anchorId: CharacterId; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; tail: number; below: boolean } | null>(null)

  // Follow the anchor every frame: characters grow with CSS transitions, switch, and the window resizes.
  // State only changes when the placement actually moves, so this stays cheap.
  useLayoutEffect(() => {
    let frame = 0
    let last = ''
    const place = () => {
      frame = requestAnimationFrame(place)
      const anchor = document.querySelector(`[data-anchor="${anchorId}"]`)
      const box = ref.current
      if (!anchor || !box) return
      const a = anchor.getBoundingClientRect()
      const ch = anchor.closest('.character')?.getBoundingClientRect()
      const w = box.offsetWidth
      const h = box.offsetHeight
      const margin = 10
      const top0 = 56 // below the top strip
      const cx = a.left + a.width / 2
      const left = Math.round(Math.min(window.innerWidth - w - margin, Math.max(margin, cx - w / 2)))
      let below = false
      let top = a.top - h - 14
      if (top < top0) { below = true; top = (ch ? ch.bottom : a.bottom) + 14 }
      top = Math.round(Math.min(window.innerHeight - h - margin, Math.max(top0, top)))
      const tail = Math.round(Math.max(18, Math.min(w - 18, cx - left)))
      const key = `${left},${top},${tail},${below}`
      if (key !== last) { last = key; setPos({ left, top, tail, below }) }
    }
    place()
    return () => cancelAnimationFrame(frame)
  }, [anchorId])

  return (
    <div ref={ref} className={`floating-bubble ${pos?.below ? 'below' : 'above'}`} onClick={(e) => e.stopPropagation()}
      style={pos ? { left: pos.left, top: pos.top, ['--tail' as string]: `${pos.tail}px` } : { visibility: 'hidden', left: 0, top: 0 }}>
      {children}
    </div>
  )
}

/** Three portraits: the same people as in the city, drawn from the same simulation. */
export function CharacterDock({ city, selected, onPick }: { city: City; selected: CharacterId | null; onPick: (id: CharacterId) => void }) {
  return (
    <nav className="dock" aria-label="Perspectives">
      {ORDER.map((id) => {
        const p = city.people.find((x) => x.id === id)!
        const st = statusOf(city, id)
        const year = st.memorial ? p.diedYear! - 1 : city.year
        const wish = !st.memorial && currentWhisper(city, id) && !workFor(city, currentWhisper(city, id))
        const emotion = feelingOf(city, id)?.emotion
        return (
          <button key={id} className={`portrait ${selected === id ? 'on' : ''} ${st.memorial ? 'memorial' : ''} ${selected && selected !== id ? 'dim' : ''}`}
            style={{ ['--accent' as string]: ACCENT[id] }} onClick={() => onPick(id)} aria-pressed={selected === id}
            title={st.memorial ? `${p.name}, ${st.years} — revisit her last wish` : `See the square as ${p.name} does`}>
            <svg viewBox="-20 -62 40 66" className="face" aria-hidden="true">
              <circle cx={0} cy={-26} r={30} className="face-bg" />
              <g transform="translate(0,-2) scale(0.95)"><Figure person={p} year={year} emotion={emotion} /></g>
            </svg>
            <span className="who"><b>{p.name}</b><span>{st.memorial ? `🕯 ${st.years}` : `${st.age} · ${st.label}`}</span></span>
            {wish && <i className="dot" title="Has a wish" />}
          </button>
        )
      })}
    </nav>
  )
}

export function DecisionCard({ d, onClose }: { d: DecisionRecord; onClose: () => void }) {
  return (
    <div className={`decision-card ${d.action === 'wait' ? 'is-wait' : ''}`} onClick={onClose} role="status">
      <header><SourceBadge source={d.source} model={d.model} /><span>The daemon decided</span><button className="x" aria-label="Close">×</button></header>
      <dl>
        <dt>Noticed</dt><dd>{d.noticed}</dd>
        <dt>Decided</dt><dd className="decided">{ACTIONS[d.action].label}{d.plot !== 'none' && <> · {plotName(d.plot)}</>}</dd>
        <dt>Why</dt><dd>{d.reason}</dd>
      </dl>
      <div className="span">
        <b>{d.startYear}</b><i /><b>{d.completionYear}</b>
        <em>{d.durationYears} {d.durationYears === 1 ? 'year' : 'years'}</em>
      </div>
      {d.notes.length > 0 && <p className="vnote">{d.notes[0]}</p>}
    </div>
  )
}

export function YearPill({ year, busy, thinking, canSkip, layers, onStep, onSkip, onLayers }: {
  year: number; busy: boolean; thinking: boolean; canSkip: boolean; layers: boolean; onStep: () => void; onSkip: () => void; onLayers: () => void
}) {
  const end = year >= END_YEAR
  const why = end ? 'The story ends here.' : thinking ? 'Wait — the daemon is thinking.' : busy ? 'Time is passing…' : null
  const skipWhy = why ?? (!canSkip ? 'Nothing is being built yet. Tell the daemon a wish first.' : null)
  return (
    <div className="year-pill">
      <button className={`round ${layers ? 'on' : ''}`} onClick={onLayers} title="Show every layer of the square’s history" aria-pressed={layers}>◐</button>
      <div className="yr" key={year}><span>{year}</span></div>
      <button className="step" onClick={onStep} disabled={!!why} title={why ?? 'One year passes for everyone'}>+1 year</button>
      <span className="skip-wrap" title={skipWhy ?? 'Play every year until the daemon finishes something'}>
        <button className="skip" onClick={onSkip} disabled={!!skipWhy}>⏭ until it’s finished</button>
      </span>
      {skipWhy && !why && <span className="why">{skipWhy}</span>}
    </div>
  )
}

export function Tutorial({ onClose }: { onClose: () => void }) {
  return (
    <div className="tutorial" onClick={onClose}>
      <p>Click a person. Hear a wish.<br />Watch the city answer <em>years too late</em>.</p>
    </div>
  )
}

export function ThoughtsDrawer({ city, live, brain, setBrain, thinking, onClose, onRestart, onNew }: {
  city: City; live: LiveStatus; brain: 'live' | 'simulated'; setBrain: (b: 'live' | 'simulated') => void
  thinking: string | null; onClose: () => void; onRestart: () => void; onNew: () => void
}) {
  return (
    <aside className="drawer">
      <header>
        <h2>The daemon’s thoughts</h2>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
      </header>
      <p className="drawer-mode">
        {live.available
          ? brain === 'live'
            ? <>Decisions come from <b>Claude</b> via a local <code>claude -p</code> bridge. <button className="link" onClick={() => setBrain('simulated')}>use simulated</button></>
            : <>Simulated daemon (live Claude available). <button className="link" onClick={() => setBrain('live')}>use live Claude</button></>
          : <>A <b>simulated</b> daemon: a deterministic policy, not AI. Real Claude thinking runs only on a local machine — <a href="https://github.com/bengunur/palimpsest-daemon-v3#live-daemon-local-only" target="_blank" rel="noreferrer">README</a>.</>}
      </p>
      <div className="drawer-actions">
        <button onClick={onRestart}>Restart</button>
        <button onClick={onNew}>New city</button>
        <span>seed {city.seed}</span>
      </div>
      <Ledger city={city} thinking={thinking} />
    </aside>
  )
}

/** Music: on/off and a volume slider. The music itself only starts after the first click anywhere. */
export function SoundControl({ volume, muted, onVolume, onMute }: {
  volume: number; muted: boolean; onVolume: (v: number) => void; onMute: () => void
}) {
  return (
    <div className={`sound ${muted ? 'off' : ''}`}>
      <button onClick={onMute} aria-pressed={!muted} aria-label={muted ? 'Unmute music' : 'Mute music'} title={muted ? 'Music off' : 'Music on'}>♪</button>
      <input type="range" min={0} max={100} step={1} value={Math.round(volume * 100)} aria-label="Music volume"
        onChange={(e) => onVolume(Number(e.target.value) / 100)} />
    </div>
  )
}
