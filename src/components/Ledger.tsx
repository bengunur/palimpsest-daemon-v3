import { ACTIONS } from '../../shared/actions.ts'
import { plotName } from '../sim/engine.ts'
import type { City, DecisionRecord, LedgerEntry, Source } from '../sim/types.ts'

export function SourceBadge({ source, model }: { source: Source; model?: string }) {
  if (source === 'live') return <span className="badge badge-live" title="Decided by Claude, running locally via claude -p">LIVE · {model ?? 'claude'}</span>
  if (source === 'fallback') return <span className="badge badge-fallback" title="Claude was unreachable or refused; the deterministic policy decided">SIMULATED · fallback</span>
  return <span className="badge badge-sim" title="Decided by the deterministic, seeded policy — not by an AI model">SIMULATED</span>
}

function Decision({ d }: { d: DecisionRecord }) {
  const spec = ACTIONS[d.action]
  return (
    <article className={`entry entry-decision ${d.action === 'wait' ? 'is-wait' : ''}`}>
      <header><span className="yr">{d.startYear}</span><SourceBadge source={d.source} model={d.model} /></header>
      <dl>
        <dt>Noticed</dt><dd>{d.noticed}</dd>
        <dt>Decided</dt><dd className="decided">{spec.label}{d.plot !== 'none' && <> · <em>{plotName(d.plot)}</em></>}</dd>
        <dt>Because</dt><dd>{d.reason}</dd>
      </dl>
      <div className="span">
        <span>{d.startYear}</span>
        <i style={{ flexGrow: d.durationYears }} />
        <span>{d.completionYear}</span>
        <b>{d.durationYears} {d.durationYears === 1 ? 'year' : 'years'}</b>
      </div>
      {d.utterance && <p className="utterance">“{d.utterance}”</p>}
      {d.notes.map((n, i) => <p key={i} className="vnote">{n}</p>)}
    </article>
  )
}

function Entry({ e }: { e: LedgerEntry }) {
  switch (e.type) {
    case 'decision': return <Decision d={e.decision} />
    case 'completion':
      return (
        <article className={`entry entry-done ${e.tooLate ? 'too-late' : ''}`}>
          <header><span className="yr">{e.year}</span><span className="kicker">finished</span>{e.tooLate && <span className="stamp">too late</span>}</header>
          <p>{e.text}</p>
          <p className="utterance">“{e.utterance}”</p>
        </article>
      )
    case 'refusal':
      return (
        <article className="entry entry-refusal">
          <header><span className="yr">{e.year}</span><span className="kicker">refused by the city</span></header>
          <p>{e.text}</p>
          {e.errors.map((x, i) => <p key={i} className="vnote">{x}</p>)}
        </article>
      )
    default:
      return <p className="entry entry-event"><span className="yr">{e.year}</span> {e.text}</p>
  }
}

export function Ledger({ city, thinking }: { city: City; thinking: string | null }) {
  const entries = [...city.ledger].reverse()
  return (
    <div className="ledger" aria-live="polite">
      {thinking && (
        <div className="entry entry-thinking">
          <span className="yr">{city.year}</span> <span className="dots">{thinking}</span>
        </div>
      )}
      {entries.map((e) => <Entry key={e.id} e={e} />)}
    </div>
  )
}
