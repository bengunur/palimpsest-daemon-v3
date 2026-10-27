import { PLOT_IDS, resultState } from '../../shared/actions.ts'
import type { PlotId } from '../../shared/actions.ts'
import { buildingWorks } from '../sim/engine.ts'
import { heat, readPlot } from '../sim/interpret.ts'
import type { City, Lens } from '../sim/types.ts'
import { isPresent, phaseOf } from '../sim/world.ts'
import { ConstructionArt, MarksArt, PlotArt } from './Art.tsx'
import { P, RECTS, SQUARE, center, depth, pts, rectPts, wrap } from './geo.ts'

interface Props {
  city: City
  lens: Lens
  focus: PlotId | null
  selected: PlotId | null
  onHover: (id: PlotId | null) => void
  onSelect: (id: PlotId) => void
}

const ORDER = [...PLOT_IDS].sort((a, b) => depth(RECTS[a]) - depth(RECTS[b]))

export function Scene({ city, lens, focus, selected, onHover, onSelect }: Props) {
  const works = buildingWorks(city)
  return (
    <svg className={`scene lens-${lens}`} viewBox="-440 -215 1050 720" role="img" aria-label={`Kleiner Ilmplatz in ${city.year}, seen through the ${lens} lens`}>
      <defs>
        <pattern id="cobble" width="7" height="5" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
          <circle cx="2" cy="2" r="0.9" className="cobble-dot" />
        </pattern>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="6" className="hatch-line" />
        </pattern>
      </defs>

      <g className="ground-layer">
        <polygon className="flat f-street" points={rectPts({ x: SQUARE.x - 14, y: SQUARE.y - 14, w: SQUARE.w + 28, d: SQUARE.d + 28 })} />
        <Backdrop />
        {ORDER.map((id) => {
          const p = city.plots[id]
          const r = RECTS[id]
          const work = works.find((w) => w.plot === id)
          const transforming = work && (work.action === 'plant_garden' || work.action === 'establish_shared_courtyard' || work.action === 'add_play_space')
          const progress = work ? (city.year - work.startYear) / (work.completionYear - work.startYear) : 0
          return (
            <g key={id} className={`plot ${focus === id ? 'is-focus' : ''} ${selected === id ? 'is-selected' : ''}`}
              onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(id)}>
              <polygon className="hit" points={rectPts(r)} />
              {transforming
                ? <ConstructionArt r={r} id={id} from={p.state} target={resultState(work.action, p.state)} progress={progress} />
                : <PlotArt state={p.state} r={r} id={id} />}
              <MarksArt marks={p.marks} r={r} year={city.year} />
              {work && !transforming && <PendingMark r={r} />}
              <polygon className="outline" points={rectPts(r, 0, 2)} />
            </g>
          )
        })}
        {lens === 'present' && heat(city) > 0.2 && ORDER.filter((id) => ['paved', 'parking', 'steps'].includes(city.plots[id].state)).map((id) => (
          <polygon key={id} className="heat" style={{ opacity: heat(city) * 0.55 }} points={rectPts(RECTS[id])} />
        ))}
      </g>

      {lens === 'memory' && ORDER.map((id) => (
        <g key={id} className="ghost ghost-memory">
          {city.plots[id].layers.slice(0, -1).filter((l) => l.state !== city.plots[id].state).map((l) => (
            <PlotArt key={l.year} state={l.state} r={RECTS[id]} id={id} />
          ))}
        </g>
      ))}

      {lens === 'palimpsest' && <Palimpsest city={city} />}

      <People city={city} lens={lens} />

      {works.map((w) => {
        const r = RECTS[w.plot as PlotId]
        const [x, y] = P(center(r)[0], center(r)[1], 70)
        const done = city.year - w.startYear
        const total = w.completionYear - w.startYear
        return (
          <g key={w.id} className="work-tag" transform={`translate(${x},${y})`}>
            <rect x={-62} y={-13} width={124} height={22} rx={2} />
            <text textAnchor="middle" y={2}>{w.startYear} → {w.completionYear} · {done}/{total}</text>
          </g>
        )
      })}

      {lens !== 'palimpsest' && <Notes city={city} lens={lens} focus={focus ?? selected} />}
    </svg>
  )
}

function PendingMark({ r }: { r: { x: number; y: number; w: number; d: number } }) {
  const [cx, cy] = center(r)
  const ring = Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, 0] as [number, number, number] })
  return <polygon className="pending" points={pts(ring)} />
}

/** Weimar-ish facades along the north and west edges. They never change; they are slower than the daemon. */
function Backdrop() {
  const north: [number, number, number][] = [[-70, 90, 108], [90, 220, 92], [220, 410, 118], [410, 610, 138]]
  const west: [number, number, number][] = [[0, 150, 100], [150, 290, 84], [290, 434, 104]]
  return (
    <g className="backdrop">
      {west.map(([y0, y1, h], i) => <House key={`w${i}`} x0={-72} x1={-14} y0={y0} y1={y1} h={h} ridge="y" />)}
      {north.map(([x0, x1, h], i) => <House key={`n${i}`} x0={x0} x1={x1} y0={-72} y1={-14} h={h} ridge="x" />)}
    </g>
  )
}

function House({ x0, x1, y0, y1, h, ridge }: { x0: number; x1: number; y0: number; y1: number; h: number; ridge: 'x' | 'y' }) {
  const rh = 34
  const windows = []
  if (ridge === 'x') {
    for (let z = 22; z < h - 14; z += 30) for (let x = x0 + 16; x < x1 - 14; x += 28)
      windows.push(pts([[x, y1, z], [x + 10, y1, z], [x + 10, y1, z + 16], [x, y1, z + 16]]))
  } else {
    for (let z = 22; z < h - 14; z += 30) for (let y = y0 + 16; y < y1 - 14; y += 28)
      windows.push(pts([[x1, y, z], [x1, y + 10, z], [x1, y + 10, z + 16], [x1, y, z + 16]]))
  }
  const ym = (y0 + y1) / 2
  const xm = (x0 + x1) / 2
  return (
    <g className="house">
      <polygon className="m-house s" points={pts([[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]])} />
      <polygon className="m-house e" points={pts([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]])} />
      {windows.map((w, i) => <polygon key={i} className="window" points={w} />)}
      {ridge === 'x' ? (
        <>
          <polygon className="roof s" points={pts([[x0, y1, h], [x1, y1, h], [x1, ym, h + rh], [x0, ym, h + rh]])} />
          <polygon className="m-house e" points={pts([[x1, y0, h], [x1, y1, h], [x1, ym, h + rh]])} />
        </>
      ) : (
        <>
          <polygon className="roof e" points={pts([[x1, y0, h], [x1, y1, h], [xm, y1, h + rh], [xm, y0, h + rh]])} />
          <polygon className="m-house s" points={pts([[x0, y1, h], [x1, y1, h], [xm, y1, h + rh]])} />
        </>
      )}
    </g>
  )
}

function Palimpsest({ city }: { city: City }) {
  return (
    <g className="palimpsest">
      {ORDER.map((id) => {
        const layers = city.plots[id].layers
        const r = RECTS[id]
        return layers.slice(0, -1).map((l, i) => {
          const lift = (layers.length - 1 - i) * 30
          const [lx, ly] = P(r.x, r.y + r.d, 0)
          return (
            <g key={`${id}${l.year}`} className="ghost ghost-sheet" transform={`translate(0,${-lift})`} style={{ animationDelay: `${i * 120}ms` }}>
              <polygon className="sheet" points={rectPts(r)} />
              <PlotArt state={l.state} r={r} id={id} />
              <text className="sheet-year" x={lx - 4} y={ly - 4} textAnchor="end">{l.year}</text>
            </g>
          )
        })
      })}
    </g>
  )
}

function People({ city, lens }: { city: City; lens: Lens }) {
  const here = city.people.filter((p) => isPresent(p, city.year))
  return (
    <g className="people">
      {here.map((p, i) => {
        const w = city.whispers.find((x) => x.personId === p.id && x.resolvedYear === undefined && x.plot !== 'any')
        const plot = (w?.plot as PlotId) ?? PLOT_IDS[(i * 3) % PLOT_IDS.length]
        const r = RECTS[plot]
        const ox = ((i * 37) % 60) - 30
        const oy = ((i * 53) % 50) - 10
        const [x, y] = P(r.x + r.w * 0.5 + ox, r.y + r.d - 18 + oy * 0.3, 0)
        const pl = phaseOf(p, city.year).lens
        const dim = lens !== 'ground' && lens !== 'palimpsest' && lens !== pl
        return (
          <g key={p.id} className={`person lens-${pl} ${dim ? 'dim' : ''}`} transform={`translate(${x},${y})`}>
            <line x1={0} y1={0} x2={0} y2={-11} />
            <circle cx={0} cy={-14} r={3.2} />
            <text y={10} textAnchor="middle">{p.name}</text>
          </g>
        )
      })}
    </g>
  )
}

function Notes({ city, lens, focus }: { city: City; lens: Lens; focus: PlotId | null }) {
  return (
    <g className={`notes notes-${lens}`}>
      {ORDER.map((id) => {
        const r = RECTS[id]
        const [cx, cy] = center(r)
        const [x, y] = P(cx, cy, 0)
        const all = readPlot(lens, city.plots[id], city)
        const notes = focus === id ? all : all.slice(0, 2)
        let dy = 0
        return (
          <g key={id} transform={`translate(${x},${y})`} className={focus && focus !== id ? 'muted' : ''}>
            {notes.map((n, i) => {
              const lines = n.kind === 'label' ? [n.text.length > 44 && focus !== id ? n.text.slice(0, 43) + '…' : n.text] : wrap(n.text, 30).slice(0, focus === id ? 6 : 2)
              if (n.kind !== 'label' && focus !== id && wrap(n.text, 30).length > 2) lines[1] = lines[1].replace(/\W*$/, '') + '…'
              const h = lines.length * 13 + (n.by ? 12 : 0) + 8
              const wpx = Math.max(...lines.map((l) => l.length), (n.by ?? '').length + 2) * (lens === 'possibility' ? 6.4 : 5.9) + 16
              const top = dy
              dy += h + 4
              return (
                <g key={i} className={`note note-${n.kind} ${n.faded ? 'faded' : ''}`} transform={`translate(${-wpx / 2},${top - 20})`}>
                  <rect width={wpx} height={h} rx={2} />
                  {lines.map((l, k) => <text key={k} x={8} y={14 + k * 13}>{l}</text>)}
                  {n.by && <text className="by" x={8} y={14 + lines.length * 13}>— {n.by}</text>}
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}
