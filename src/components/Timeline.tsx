import { ACTIONS } from '../../shared/actions.ts'
import { plotName } from '../sim/engine.ts'
import type { City } from '../sim/types.ts'
import { END_YEAR, START_YEAR } from '../sim/world.ts'

const SPAN = END_YEAR - START_YEAR

/** A Gantt strip of the daemon's slowness. Every bar is at least one year long. */
export function Timeline({ city }: { city: City }) {
  const x = (y: number) => `${((y - START_YEAR) / SPAN) * 100}%`
  const lanes: number[] = []
  const placed = city.works.map((w) => {
    let lane = lanes.findIndex((end) => end <= w.startYear)
    if (lane === -1) { lane = lanes.length; lanes.push(0) }
    lanes[lane] = w.completionYear
    return { w, lane }
  })
  const events = city.ledger.filter((e) => e.type === 'event' && e.year > START_YEAR)
  const decades = Array.from({ length: SPAN / 10 + 1 }, (_, i) => START_YEAR + 4 + i * 10).filter((y) => y <= END_YEAR)
  return (
    <div className="timeline" style={{ ['--lanes' as string]: Math.max(2, lanes.length) }}>
      <div className="tl-future" style={{ left: x(city.year) }} />
      {decades.map((y) => <span key={y} className="tl-decade" style={{ left: x(y) }}>{y}</span>)}
      {events.map((e) => (
        <span key={e.id} className="tl-event" style={{ left: x(e.year) }} title={`${e.year}: ${'text' in e ? e.text : ''}`} />
      ))}
      {placed.map(({ w, lane }) => {
        const end = Math.min(w.completionYear, END_YEAR)
        const built = Math.min(1, Math.max(0, (city.year - w.startYear) / (w.completionYear - w.startYear)))
        return (
          <div key={w.id} className={`tl-bar a-${w.action} ${w.status} src-${w.source}`}
            style={{ left: x(w.startYear), width: `calc(${x(end)} - ${x(w.startYear)})`, top: `calc(22px + ${lane} * 19px)` }}
            title={`${ACTIONS[w.action].label}${w.plot !== 'none' ? ` · ${plotName(w.plot)}` : ''}: ${w.startYear} → ${w.completionYear} (${w.source})`}>
            <i style={{ width: `${built * 100}%` }} />
            <span>{w.action === 'wait' ? 'wait' : `${ACTIONS[w.action].label.replace(/^\w+ (a |an )?/, '')} · ${plotName(w.plot)}`}</span>
          </div>
        )
      })}
      <div className="tl-now" style={{ left: x(city.year) }}><span>{city.year}</span></div>
    </div>
  )
}
