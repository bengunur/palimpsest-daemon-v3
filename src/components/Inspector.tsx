import type { PlotId } from '../../shared/actions.ts'
import { ACTIONS } from '../../shared/actions.ts'
import { buildingWorks, personName } from '../sim/engine.ts'
import { GROUND_LABEL, LENS_INFO, readPlot } from '../sim/interpret.ts'
import type { City, Lens, Whisper } from '../sim/types.ts'
import { isPresent } from '../sim/world.ts'

interface Props {
  city: City
  lens: Lens
  plotId: PlotId | null
  canCarry: boolean
  onCarry: (whisperId: string) => void
}

function WhisperRow({ w, city, canCarry, onCarry }: { w: Whisper; city: City; canCarry: boolean; onCarry: (id: string) => void }) {
  const person = city.people.find((p) => p.id === w.personId)
  const here = !!person && isPresent(person, city.year)
  return (
    <li className={`whisper lens-${w.lens} ${here ? '' : 'gone'}`}>
      <q>{w.text}</q>
      <span className="meta">
        {personName(city, w.personId)}{here ? '' : ' (gone)'} · heard {w.heardCount}× since {w.firstHeard}{w.carried ? ' · carried' : ''}
      </span>
      {canCarry && <button className="carry" onClick={() => onCarry(w.id)} title="Repeat this whisper to the daemon so it counts as heard once more. Once per year.">carry to the daemon</button>}
    </li>
  )
}

export function Inspector({ city, lens, plotId, canCarry, onCarry }: Props) {
  const open = city.whispers.filter((w) => w.resolvedYear === undefined)
  if (!plotId) {
    const everywhere = open.filter((w) => w.plot === 'any')
    return (
      <div className="inspector">
        <h3>The square</h3>
        <p className="hint">Hover or click a plot to read it through the <b>{LENS_INFO[lens].name}</b> lens.</p>
        {everywhere.length > 0 && (
          <>
            <h4>Heard everywhere</h4>
            <ul className="whispers">{everywhere.map((w) => <WhisperRow key={w.id} w={w} city={city} canCarry={canCarry} onCarry={onCarry} />)}</ul>
          </>
        )}
      </div>
    )
  }
  const p = city.plots[plotId]
  const notes = readPlot(lens, p, city)
  const work = buildingWorks(city).find((w) => w.plot === plotId)
  const here = open.filter((w) => w.plot === plotId)
  return (
    <div className="inspector">
      <h3>{p.name}</h3>
      <p className="ground-state">{GROUND_LABEL[p.state]}{work && <> · <span className="building">{ACTIONS[work.action].label}, {work.startYear} → {work.completionYear}</span></>}</p>
      {lens !== 'ground' && (
        <div className={`reading lens-${lens}`}>
          <h4>{LENS_INFO[lens].name} reads</h4>
          {notes.map((n, i) => <p key={i} className={n.faded ? 'faded' : ''}>{n.kind === 'whisper' ? <q>{n.text}</q> : n.text}{n.by && <span className="meta"> — {n.by}</span>}</p>)}
        </div>
      )}
      <h4>Layers</h4>
      <ol className="layers">
        {p.layers.map((l, i) => <li key={i}><span className="yr">{l.year}</span> {GROUND_LABEL[l.state].toLowerCase()}{l.note ? ` — ${l.note}` : ''}{l.by ? ' — the daemon' : ''}</li>)}
        {p.marks.map((m, i) => <li key={`m${i}`}><span className="yr">{m.year}</span> {m.kind === 'tree' ? 'a tree planted' : 'a trace set in bronze'}</li>)}
      </ol>
      {here.length > 0 && (
        <>
          <h4>Whispers here</h4>
          <ul className="whispers">{here.map((w) => <WhisperRow key={w.id} w={w} city={city} canCarry={canCarry} onCarry={onCarry} />)}</ul>
        </>
      )}
    </div>
  )
}
