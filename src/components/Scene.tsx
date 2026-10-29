import { PLOT_IDS, resultState } from '../../shared/actions.ts'
import type { PlotId } from '../../shared/actions.ts'
import { buildingWorks, currentWhisper, workFor } from '../sim/engine.ts'
import { feelingOf } from '../sim/feelings.ts'
import { GROUND_LABEL } from '../sim/interpret.ts'
import type { CharacterId, City } from '../sim/types.ts'
import { visionFor } from '../sim/visions.ts'
import { isPresent } from '../sim/world.ts'
import { ConstructionArt, MarksArt, PlotArt } from './Art.tsx'
import { ACCENT, Character, figureHeight, screenSpot } from './Character.tsx'
import { P, RECTS, SQUARE, center, depth, pts, rectPts } from './geo.ts'

interface Props {
  city: City
  layers: boolean
  selected: CharacterId | null
  hover: CharacterId | null
  tutorial: boolean
  onPick: (id: CharacterId) => void
  onHover: (id: CharacterId | null) => void
  onBackground: () => void
}

const ORDER = [...PLOT_IDS].sort((a, b) => depth(RECTS[a]) - depth(RECTS[b]))

/** The camera: how far it leans in when someone is chosen, and where in the frame their feet land. */
export const FOCUS_ZOOM = 1.6
const FRAME_CENTER: [number, number] = [85, 155]
// feet sit below the middle so the head, and the bubble above it, stay in view
const FEET_DROP = 130

/** Where the camera looks for a person: where they stand, or — after Frau Roth — her bench. */
export function focusPoint(city: City, id: CharacterId): [number, number] {
  const p = city.people.find((x) => x.id === id)!
  if (!isPresent(p, city.year) && p.diedYear !== city.year) {
    const r = RECTS.linden
    return P(r.x + r.w - 16, r.y + 84, 0)
  }
  return screenSpot(id)
}

export function cameraTransform(city: City, selected: CharacterId | null): string {
  if (!selected) return 'translate(0px, 0px) scale(1)'
  const [fx, fy] = focusPoint(city, selected)
  const tx = FRAME_CENTER[0] - FOCUS_ZOOM * fx
  const ty = FRAME_CENTER[1] + FEET_DROP - FOCUS_ZOOM * fy
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${FOCUS_ZOOM})`
}
const TRANSFORMING = new Set(['plant_garden', 'establish_shared_courtyard', 'add_play_space'])

export function Scene({ city, layers, selected, hover, tutorial, onPick, onHover, onBackground }: Props) {
  const works = buildingWorks(city)
  const looking = selected ?? hover
  const vision = looking ? visionFor(city, looking) : null
  // people who died this year are still drawn, once, as they leave
  const people = city.people.filter((p) => isPresent(p, city.year) || p.diedYear === city.year)

  return (
    <svg className={`scene ${layers ? "show-layers" : ""} ${vision ? "has-vision" : ""} ${selected ? `persp persp-${selected}` : ""}`} viewBox="-430 -190 1030 690" onClick={onBackground}
      role="img" aria-label={`Kleiner Ilmplatz in ${city.year}`}>
      <defs>
        <pattern id="cobble" width="7" height="5" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
          <circle cx="2" cy="2" r="0.9" className="cobble-dot" />
        </pattern>
      </defs>

      <g className="camera" style={{ transform: cameraTransform(city, selected) }}>
        <g className="ground-layer">
          <polygon className="flat f-street" points={rectPts({ x: SQUARE.x - 14, y: SQUARE.y - 14, w: SQUARE.w + 28, d: SQUARE.d + 28 })} />
          <Backdrop />
          {ORDER.map((id) => {
            const p = city.plots[id]
            const r = RECTS[id]
            const work = works.find((w) => w.plot === id)
            const transforming = work && TRANSFORMING.has(work.action)
            const progress = work ? (city.year - work.startYear) / (work.completionYear - work.startYear) : 0
            return (
              <g key={id} className="plot">
                {transforming
                  ? <ConstructionArt r={r} id={id} from={p.state} target={resultState(work.action, p.state)} progress={progress} />
                  : <PlotArt state={p.state} r={r} id={id} />}
                <MarksArt marks={p.marks} r={r} year={city.year} />
              </g>
            )
          })}
        </g>

        {layers && <Palimpsest city={city} />}

        {vision && <VisionLayer city={city} vision={vision} />}

        {works.map((w) => <WorkSign key={w.id} city={city} plot={w.plot as PlotId} start={w.startYear} end={w.completionYear}
          label={w.action === 'plant_tree' ? 'a tree' : w.action === 'preserve_trace' ? 'a bronze trace' : GROUND_LABEL[resultState(w.action, city.plots[w.plot as PlotId].state)]} />)}

        {people.map((p) => {
          const w = currentWhisper(city, p.id)
          const indicator = !w ? null : workFor(city, w) ? '…' : '!'
          return (
            <Character key={p.id} person={p} year={city.year}
              selected={selected === p.id} hovered={hover === p.id} dim={!!selected && selected !== p.id}
              indicator={indicator} ring={tutorial && p.id === 'mio'} passing={p.diedYear === city.year}
              graduating={city.milestones.some((m) => m.personId === p.id && m.year === city.year && m.icon === '🎓')}
              emotion={feelingOf(city, p.id)?.emotion ?? 'calm'}
              onPick={() => onPick(p.id)} onHover={(on) => onHover(on ? p.id : null)} />
          )
        })}

        <MemorialAnchor city={city} selected={selected === "roth"} dim={!!selected && selected !== "roth"} onPick={() => onPick("roth")} />

        <Popups city={city} />
      </g>
    </svg>
  )
}

/** A translucent wish drawn onto real ground, tied to the person by a dotted thread. */
function VisionLayer({ city, vision }: { city: City; vision: NonNullable<ReturnType<typeof visionFor>> }) {
  const r = RECTS[vision.plot]
  const [cx, cy] = center(r)
  const [tx, ty] = P(cx, cy, 46)
  const [hx, hy] = screenSpot(vision.personId)
  const person = city.people.find((p) => p.id === vision.personId)!
  const headY = hy - figureHeight(person, city.year) * 0.8
  return (
    <g className={`vision vision-${vision.personId}`} style={{ ['--accent' as string]: ACCENT[vision.personId] }}>
      <g className="vision-art"><PlotArt state={vision.state} r={r} id={vision.plot} /></g>
      <polygon className="vision-edge" points={rectPts(r, 0, 3)} />
      <path className="vision-thread" d={`M ${hx} ${headY} Q ${(hx + tx) / 2} ${Math.min(headY, ty) - 60} ${tx} ${ty}`} />
      <g transform={`translate(${tx},${ty})`}>
        <g className="vision-tag">
          <text textAnchor="middle">{person.name} {vision.verb}</text>
        </g>
      </g>
    </g>
  )
}

/** The daemon's building sign: what, how far, and when — always physical, always ochre. */
function WorkSign({ city, plot, start, end, label }: { city: City; plot: PlotId; start: number; end: number; label: string }) {
  const [cx, cy] = center(RECTS[plot])
  const [x, y] = P(cx, cy, 78)
  const progress = Math.min(1, (city.year - start) / (end - start))
  const left = end - city.year
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className="work-sign">
      <line x1={0} y1={22} x2={0} y2={50} className="sign-post" />
      <rect x={-70} y={-20} width={140} height={44} rx={6} className="sign-board" />
      <text x={0} y={-5} textAnchor="middle" className="sign-title">🏗 {label}</text>
      <rect x={-58} y={2} width={116} height={7} rx={3.5} className="sign-track" />
      <rect x={-58} y={2} width={Math.max(4, 116 * progress)} height={7} rx={3.5} className="sign-fill" />
      <text x={0} y={19} textAnchor="middle" className="sign-year">ready {end} · {left} yr{left === 1 ? '' : 's'} left</text>
    </g>
  )
}

/** Milestones and reactions float above heads for the year they happen. */
function Popups({ city }: { city: City }) {
  const ms = city.milestones.filter((m) => m.year === city.year)
  const rs = city.reactions.filter((r) => r.year === city.year)
  return (
    <g className="popups">
      {city.people.map((p) => {
        const mine = [...ms.filter((m) => m.personId === p.id), ...rs.filter((r) => r.personId === p.id)]
        if (!mine.length) return null
        const [x, y] = screenSpot(p.id)
        const h = figureHeight(p, city.year)
        return (
          <g key={p.id} transform={`translate(${x.toFixed(1)},${(y - h - 40).toFixed(1)})`}>
            {mine.map((item, i) => {
              const isReaction = 'mood' in item
              const text = isReaction ? `${moodIcon(item.mood)} ${item.line}` : `${item.icon} ${item.text}`
              const w = Math.min(250, text.length * 6.1 + 20)
              const lines = isReaction && text.length > 40 ? splitTwo(text) : [text]
              const hh = lines.length * 14 + 10
              return (
                <g key={item.id} transform={`translate(0,${-i * 40})`}>
                  <g className={`pop ${isReaction ? `pop-reaction mood-${item.mood}` : 'pop-milestone'} ${'death' in item && item.death ? 'pop-death' : ''}`}>
                    <rect x={-(lines.length > 1 ? 130 : w / 2)} y={-hh + 4} width={lines.length > 1 ? 260 : w} height={hh} rx={hh / 2 > 14 ? 12 : hh / 2} />
                    {lines.map((l, k) => <text key={k} textAnchor="middle" y={-hh + 19 + k * 14}>{l}</text>)}
                  </g>
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

/**
 * After Frau Roth's death, her bench by the linden stands in for her: click it to revisit
 * her last wish. It can never tell the daemon anything new.
 */
function MemorialAnchor({ city, selected, dim, onPick }: { city: City; selected: boolean; dim: boolean; onPick: () => void }) {
  const roth = city.people.find((p) => p.id === 'roth')!
  if (roth.diedYear === undefined || roth.diedYear >= city.year) return null
  const r = RECTS.linden
  const [x, y] = P(r.x + r.w - 16, r.y + 84, 0)
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
      className={`character memorial-anchor ch-roth ${selected ? 'is-selected' : ''} ${dim ? 'is-dim' : ''}`}
      onClick={(e) => { e.stopPropagation(); onPick() }}
      role="button" aria-label={`Frau Roth, ${roth.born}–${roth.diedYear}, in memory`} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() } }}>
      <ellipse className="ch-halo" cx={0} cy={2} rx={34} ry={13} style={{ stroke: ACCENT.roth }} />
      <rect className="ch-hit" x={-30} y={-34} width={60} height={46} />
      <circle className="anchor" data-anchor="roth" cx={0} cy={-30} r={0.5} />
      <g transform="translate(0,20)" className="ch-label memorial-label">
        <rect x={-46} y={-8} width={92} height={13} rx={6.5} />
        <text y={2} textAnchor="middle">🕯 Frau Roth</text>
      </g>
    </g>
  )
}

export const moodIcon = (m: string) => ({ delighted: '♥', bittersweet: '…', surprised: '✦', mixed: '~', disrupted: '☁' } as Record<string, string>)[m] ?? '·'

function splitTwo(t: string): string[] {
  const mid = t.lastIndexOf(' ', Math.ceil(t.length / 2) + 4)
  return mid > 0 ? [t.slice(0, mid), t.slice(mid + 1)] : [t]
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
            <g key={`${id}${l.year}`} transform={`translate(0,${-lift})`}>
              <g className="ghost ghost-sheet">
                <polygon className="sheet" points={rectPts(r)} />
                <PlotArt state={l.state} r={r} id={id} />
                <text className="sheet-year" x={lx - 4} y={ly - 4} textAnchor="end">{l.year}</text>
              </g>
            </g>
          )
        })
      })}
    </g>
  )
}
