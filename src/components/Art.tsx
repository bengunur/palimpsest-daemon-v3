// Drawings of each physical plot state. Pure geometry + CSS classes, so the same drawing
// can appear solid (the ground), as a sepia ghost (memory), or half-built (construction).
import type { PlotId, PlotState } from '../../shared/actions.ts'
import type { Mark } from '../sim/types.ts'
import { P, boxFaces, cylinderSide, pts, rectPts, ring } from './geo.ts'
import type { Rect } from './geo.ts'

export function Box({ x, y, w, d, h, z = 0, m }: { x: number; y: number; w: number; d: number; h: number; z?: number; m: string }) {
  const f = boxFaces(x, y, w, d, h, z)
  return (
    <g className="box">
      <polygon className={`m-${m} s`} points={f.s} />
      <polygon className={`m-${m} e`} points={f.e} />
      <polygon className={`m-${m} t`} points={f.top} />
    </g>
  )
}

export function Tree({ x, y, s = 1, old = false }: { x: number; y: number; s?: number; old?: boolean }) {
  const h = 28 * s + (old ? 30 : 0)
  const r = 13 * s + (old ? 16 : 0)
  const [cx, cy] = P(x, y, h)
  const [sx, sy] = P(x, y, 0)
  return (
    <g className="tree">
      <ellipse className="shade" cx={sx + 4} cy={sy + 2} rx={r * 1.1} ry={r * 0.5} />
      <line className="trunk" x1={sx} y1={sy} x2={cx} y2={cy + r * 0.4} strokeWidth={old ? 4 : 2} />
      <circle className="canopy c1" cx={cx - r * 0.35} cy={cy + r * 0.1} r={r * 0.8} />
      <circle className="canopy c2" cx={cx + r * 0.35} cy={cy - r * 0.05} r={r * 0.75} />
      <circle className="canopy c3" cx={cx} cy={cy - r * 0.45} r={r * 0.7} />
    </g>
  )
}

function Flat({ r, cls, inset = 0 }: { r: Rect; cls: string; inset?: number }) {
  return <polygon className={`flat ${cls}`} points={rectPts(r, 0, inset)} />
}

function Garden({ r, playEdge }: { r: Rect; playEdge?: boolean }) {
  const n = 3
  const cw = (r.w - 24) / n
  const cd = (r.d - 24) / n
  const beds = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (playEdge && i === n - 1 && j === n - 1) continue
      beds.push(<Box key={`${i}${j}`} x={r.x + 12 + i * cw + 5} y={r.y + 12 + j * cd + 5} w={cw - 10} d={cd - 10} h={4} m="hedge" />)
    }
  }
  return (
    <g>
      <Flat r={r} cls="f-gravel" />
      {beds}
      <Tree x={r.x + 12 + cw * 0.5} y={r.y + 12 + cd * 1.5} s={0.55} />
      <Tree x={r.x + 12 + cw * 1.5} y={r.y + 12 + cd * 0.5} s={0.5} />
      <Box x={r.x + 12 + cw * 1.2} y={r.y + 12 + cd * 2 - 3} w={26} d={5} h={5} m="wood" />
      {playEdge && <Play r={{ x: r.x + 12 + cw * 2, y: r.y + 12 + cd * 2, w: cw, d: cd }} small />}
    </g>
  )
}

function Play({ r, small }: { r: Rect; small?: boolean }) {
  const cx = r.x + r.w / 2
  const cy = r.y + r.d / 2
  const k = small ? 0.45 : 1
  const a = P(cx - 30 * k, cy - 10 * k, 0)
  const b = P(cx - 30 * k, cy + 10 * k, 0)
  const top1 = P(cx - 30 * k, cy, 34 * k)
  const c = P(cx + 20 * k, cy - 10 * k, 0)
  const d = P(cx + 20 * k, cy + 10 * k, 0)
  const top2 = P(cx + 20 * k, cy, 34 * k)
  const seat = P(cx - 5 * k, cy, 10 * k)
  return (
    <g>
      {!small && <Flat r={r} cls="f-stone" />}
      <polygon className="flat f-sand" points={pts(ring(cx, cy, Math.min(r.w, r.d) * 0.4, 0, 24))} />
      <g className="line frame">
        <polyline points={`${a} ${top1} ${b}`} />
        <polyline points={`${c} ${top2} ${d}`} />
        <line x1={top1[0]} y1={top1[1]} x2={top2[0]} y2={top2[1]} />
        <line x1={(top1[0] + top2[0]) / 2} y1={(top1[1] + top2[1]) / 2} x2={seat[0]} y2={seat[1]} />
      </g>
      {!small && (
        <>
          <Box x={cx + 30} y={cy + 20} w={10} d={10} h={26} m="red" />
          <polygon className="slide" points={pts([[cx + 30, cy + 30, 26], [cx + 40, cy + 30, 26], [cx + 40, cy + 62, 0], [cx + 30, cy + 62, 0]])} />
          <circle className="ball" cx={P(cx - 40, cy + 40, 4)[0]} cy={P(cx - 40, cy + 40, 4)[1]} r={4} />
        </>
      )}
    </g>
  )
}

function Courtyard({ r }: { r: Rect }) {
  const long = r.w >= r.d
  const tables = long
    ? [0.35, 0.65].map((f, i) => <g key={i}><Box x={r.x + 30} y={r.y + r.d * f - 6} w={r.w - 60} d={12} h={9} m="wood" /></g>)
    : [0.35, 0.65].map((f, i) => <g key={i}><Box x={r.x + r.w * f - 6} y={r.y + 30} w={12} d={r.d - 60} h={9} m="wood" /></g>)
  const corners: [number, number][] = [[r.x + 18, r.y + 18], [r.x + r.w - 18, r.y + 18], [r.x + r.w - 18, r.y + r.d - 18], [r.x + 18, r.y + r.d - 18]]
  return (
    <g>
      <Flat r={r} cls="f-pale" />
      {tables}
      <g className="line pergola">
        {corners.map(([x, y], i) => { const a = P(x, y, 0), b = P(x, y, 46); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /> })}
        <polygon points={pts(corners.map(([x, y]) => [x, y, 46] as [number, number, number]))} fill="none" />
      </g>
    </g>
  )
}

function Fountain({ r }: { r: Rect }) {
  const cx = r.x + r.w / 2
  const cy = r.y + r.d / 2
  const top = P(cx, cy, 40)
  return (
    <g>
      <Flat r={r} cls="f-stone" />
      <polygon className="flat cobble" points={rectPts(r)} />
      <polygon className="m-stone s" points={cylinderSide(cx, cy, 58, 0, 14)} />
      <polygon className="m-stone t" points={pts(ring(cx, cy, 58, 14))} />
      <polygon className="flat f-water" points={pts(ring(cx, cy, 50, 12))} />
      <Box x={cx - 5} y={cy - 5} w={10} d={10} h={30} m="stone" />
      <ellipse className="m-stone t" cx={top[0]} cy={top[1] + 8} rx={22} ry={10} />
    </g>
  )
}

function Steps({ r }: { r: Rect }) {
  const n = 6
  const sd = (r.d - 20) / n
  return (
    <g>
      <Flat r={r} cls="f-stone" />
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} x={r.x + 12} y={r.y + 10} w={r.w - 24} d={(n - i) * sd} h={(i + 1) * 6} m="stone" />
      ))}
    </g>
  )
}

function Parking({ r }: { r: Rect }) {
  const stalls = 8
  const sw = (r.w - 20) / stalls
  const cars = [0, 1, 3, 4, 6]
  return (
    <g>
      <Flat r={r} cls="f-asphalt" />
      <g className="line stall">
        {Array.from({ length: stalls + 1 }, (_, i) => {
          const a = P(r.x + 10 + i * sw, r.y + 8), b = P(r.x + 10 + i * sw, r.y + 52)
          return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        })}
      </g>
      {cars.map((i) => <Box key={i} x={r.x + 16 + i * sw} y={r.y + 12} w={sw - 12} d={34} h={11} m="car" />)}
    </g>
  )
}

function Ruin({ r }: { r: Rect }) {
  return (
    <g>
      <Flat r={r} cls="f-stone" />
      <Box x={r.x + 20} y={r.y + 20} w={r.w * 0.4} d={6} h={14} m="stone" />
      <Box x={r.x + 20} y={r.y + 26} w={6} d={r.d * 0.5} h={8} m="stone" />
      <Box x={r.x + r.w * 0.6} y={r.y + r.d * 0.6} w={30} d={6} h={5} m="stone" />
    </g>
  )
}

function Linden({ r, fallen }: { r: Rect; fallen?: boolean }) {
  const cx = r.x + r.w / 2
  const cy = r.y + r.d / 2
  return (
    <g>
      <Flat r={r} cls="f-stone" />
      <polygon className="flat f-grass" points={pts(ring(cx, cy, 72, 0, 28))} />
      {fallen ? (
        <>
          <polygon className="m-wood s" points={cylinderSide(cx, cy, 12, 0, 8)} />
          <polygon className="m-wood t" points={pts(ring(cx, cy, 12, 8, 18))} />
          <polygon className="ringline" points={pts(ring(cx, cy, 6, 8, 14))} />
        </>
      ) : (
        <>
          <polygon className="m-wood t" points={pts(ring(cx, cy, 30, 6, 28))} />
          <polygon className="m-wood s" points={cylinderSide(cx, cy, 30, 0, 6)} />
          <Tree x={cx} y={cy} s={1.6} old />
        </>
      )}
    </g>
  )
}

export function PlotArt({ state, r, id }: { state: PlotState; r: Rect; id?: PlotId }) {
  let art
  switch (state) {
    case 'paved': art = <><Flat r={r} cls="f-stone" /><polygon className="flat cobble" points={rectPts(r)} /></>; break
    case 'parking': art = <Parking r={r} />; break
    case 'fountain': art = <Fountain r={r} />; break
    case 'steps': art = <Steps r={r} />; break
    case 'arcade': art = <><Flat r={r} cls="f-stone" /><polygon className="flat cobble" points={rectPts(r)} /></>; break
    case 'old_tree': art = <Linden r={r} />; break
    case 'stump': art = <Linden r={r} fallen />; break
    case 'garden': art = <Garden r={r} />; break
    case 'garden_play': art = <Garden r={r} playEdge />; break
    case 'courtyard': art = <Courtyard r={r} />; break
    case 'play': art = <Play r={r} />; break
    case 'ruin': art = <Ruin r={r} />; break
  }
  return (
    <g className={`art art-${state}`}>
      {art}
      {id === 'arcade' && <ArcadeStructure r={r} />}
    </g>
  )
}

/** The arcade belongs to the building: whatever happens beneath it, the columns stay. */
function ArcadeStructure({ r }: { r: Rect }) {
  const cols = 8
  return (
    <g>
      {Array.from({ length: cols }, (_, i) => (
        <Box key={i} x={r.x + 10 + i * ((r.w - 28) / (cols - 1))} y={r.y + 36} w={8} d={8} h={52} m="plaster" />
      ))}
      <Box x={r.x} y={r.y - 4} w={r.w} d={44} h={10} z={52} m="plaster" />
    </g>
  )
}

export function MarksArt({ marks, r, year }: { marks: Mark[]; r: Rect; year: number }) {
  let t = 0
  return (
    <g>
      {marks.map((m, i) => {
        if (m.kind === 'tree') {
          const k = t++
          const fx = 0.22 + 0.56 * ((k * 0.618 + 0.15) % 1)
          const fy = 0.25 + 0.5 * ((k * 0.382 + 0.7) % 1)
          const age = Math.max(0, year - m.year)
          return <Tree key={i} x={r.x + r.w * fx} y={r.y + r.d * fy} s={0.35 + Math.min(1, age / 20) * 0.75} />
        }
        return <Box key={i} x={r.x + r.w - 26 - i * 3} y={r.y + r.d - 14} w={14} d={6} h={10} m="bronze" />
      })}
    </g>
  )
}

/** Fences, earth and a translucent future: what a plot looks like while the daemon is slowly at work. */
export function ConstructionArt({ r, target, from, progress, id }: { r: Rect; target: PlotState; from: PlotState; progress: number; id: PlotId }) {
  const inset = 6
  const posts: [number, number][] = []
  const step = 36
  for (let x = r.x + inset; x <= r.x + r.w - inset; x += step) { posts.push([x, r.y + inset], [x, r.y + r.d - inset]) }
  for (let y = r.y + inset; y <= r.y + r.d - inset; y += step) { posts.push([r.x + inset, y], [r.x + r.w - inset, y]) }
  return (
    <g className="construction">
      {progress >= 0.25 && <polygon className="flat f-earth" style={{ opacity: Math.min(0.9, progress * 1.4) }} points={rectPts(r, 0, inset)} />}
      {progress < 0.5 && <g style={{ opacity: 1 - progress * 1.6 }}><PlotArt state={from} r={r} id={id} /></g>}
      <g className="future" style={{ opacity: 0.12 + progress * 0.6 }}><PlotArt state={target} r={r} id={id} /></g>
      <polygon className="fence" points={rectPts(r, 10, inset)} />
      <g className="line fencepost">
        {posts.map(([x, y], i) => { const a = P(x, y, 0), b = P(x, y, 12); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /> })}
      </g>
    </g>
  )
}
