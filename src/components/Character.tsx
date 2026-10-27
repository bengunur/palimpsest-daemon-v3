// The three people of the square, drawn from simple shapes. Everything about how they look
// is derived from their age: height, proportions, clothes, posture, idle rhythm.
import type { CharacterId, Person } from '../sim/types.ts'
import { ageOf, figureScale, stageOf } from '../sim/world.ts'
import { P } from './geo.ts'

/** Where each person stands, in plan units. */
export const SPOTS: Record<CharacterId, [number, number]> = {
  mio: [300, 311],
  lena: [506, 297],
  roth: [198, 334],
}

export const ACCENT: Record<CharacterId, string> = { mio: '#e9b320', lena: '#3a6fb8', roth: '#8a5a3c' }

/** Everyone is drawn a little larger than life, so identity reads at normal zoom. */
export const ZOOM = 1.35

const SKIN = '#f0c9a4'
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

interface Body { legH: number; bodyH: number; headR: number }

function proportions(p: Person, age: number): Body {
  if (p.id === 'mio') {
    const t = clamp01((age - 7) / 9)
    return { legH: lerp(16, 25, t), bodyH: lerp(19, 23, t), headR: lerp(10.5, 8.2, t) }
  }
  if (p.id === 'roth') return { legH: 17, bodyH: 27, headR: 8 }
  return { legH: 24, bodyH: 23, headR: 8 }
}

/** Unscaled figure height — used to place things above the head. */
export function figureHeight(p: Person, year: number) {
  const b = proportions(p, ageOf(p, year))
  return (b.legH + b.bodyH + b.headR * 2) * figureScale(p, year) * ZOOM
}

export function screenSpot(id: CharacterId): [number, number] {
  const [x, y] = SPOTS[id]
  return P(x, y, 0)
}

function Legs({ b, color, boots }: { b: Body; color: string; boots?: string }) {
  return (
    <g>
      <rect x={-5.5} y={-b.legH} width={4.2} height={b.legH} rx={1.6} fill={color} />
      <rect x={1.3} y={-b.legH} width={4.2} height={b.legH} rx={1.6} fill={color} />
      {boots && <><rect x={-6} y={-5} width={5.2} height={5} rx={1.4} fill={boots} /><rect x={0.8} y={-5} width={5.2} height={5} rx={1.4} fill={boots} /></>}
    </g>
  )
}

function Coat({ b, color, long = 0, shade }: { b: Body; color: string; long?: number; shade?: string }) {
  const top = -b.legH - b.bodyH
  const bot = -b.legH + 3 + long
  return (
    <g>
      <path d={`M -7.5 ${top + 3} Q 0 ${top - 1.5} 7.5 ${top + 3} L 10 ${bot} Q 0 ${bot + 2.5} -10 ${bot} Z`} fill={color} />
      {shade && <path d={`M 3 ${top + 2} L 10 ${bot} Q 6 ${bot + 1.5} 3 ${bot + 1.5} Z`} fill={shade} opacity={0.5} />}
    </g>
  )
}

function Head({ b, hair, children }: { b: Body; hair: React.ReactNode; children?: React.ReactNode }) {
  const cy = -b.legH - b.bodyH - b.headR + 1.5
  return (
    <g transform={`translate(0,${cy})`}>
      {hair}
      <circle r={b.headR} fill={SKIN} />
      <circle cx={b.headR * 0.32} cy={-b.headR * 0.05} r={0.95} fill="#3a2e26" />
      <circle cx={b.headR * 0.72} cy={-b.headR * 0.05} r={0.95} fill="#3a2e26" />
      <path d={`M ${b.headR * 0.35} ${b.headR * 0.38} Q ${b.headR * 0.55} ${b.headR * 0.5} ${b.headR * 0.75} ${b.headR * 0.36}`} stroke="#9a5a44" strokeWidth={0.8} fill="none" />
      <circle cx={b.headR * 0.2} cy={b.headR * 0.25} r={1.6} fill="#e89a8a" opacity={0.45} />
      {children}
    </g>
  )
}

function Mio({ age }: { age: number }) {
  const p = { id: 'mio' } as Person
  const b = proportions(p, age)
  const top = -b.legH - b.bodyH
  const r = b.headR
  if (age < 11) {
    // the yellow raincoat and backpack
    return (
      <g>
        <rect x={-12} y={top + 4} width={8} height={12} rx={2.5} fill="#c98a12" />
        <Legs b={b} color="#4a5a7a" boots="#d2452f" />
        <Coat b={b} color="#f2c230" shade="#c99a14" />
        <line x1={-6} y1={top + 4} x2={-3} y2={top + 15} stroke="#a26f0c" strokeWidth={1.4} />
        <Head b={b} hair={<path d={`M ${-r - 2} 1 Q ${-r - 2} ${-r - 3} 0 ${-r - 3} Q ${r + 2} ${-r - 3} ${r + 1.5} -1 L ${r - 1} -2 Q 0 ${-r + 2} ${-r + 1} 2 Z`} fill="#f2c230" />} />
      </g>
    )
  }
  if (age < 18) {
    const teen = age >= 13
    return (
      <g transform={teen ? 'rotate(-3)' : undefined}>
        {!teen && <rect x={-12} y={top + 3} width={8} height={11} rx={2} fill="#2f3f66" />}
        <Legs b={b} color="#2f3542" boots="#f2f2ee" />
        <Coat b={b} color="#f0bd2c" shade="#c99a14" />
        <path d={`M -4 ${top + 3} Q 0 ${top + 7} 4 ${top + 3}`} stroke="#c99a14" strokeWidth={1.2} fill="none" />
        <Head b={b} hair={<path d={`M ${-r - 1} 0 Q ${-r} ${-r - 3} ${r * 0.3} ${-r - 2} Q ${r + 1.5} ${-r} ${r + 0.5} -2 L ${-r} 2 Z`} fill="#4a3426" />}>
          {teen && (
            <g>
              <path d={`M ${-r - 1.2} 0 Q 0 ${-r * 2 - 1} ${r + 1.2} 0`} stroke="#222" strokeWidth={1.6} fill="none" />
              <rect x={-r - 3} y={-2.5} width={3.4} height={5} rx={1.2} fill="#222" />
              <rect x={r - 0.4} y={-2.5} width={3.4} height={5} rx={1.2} fill="#222" />
            </g>
          )}
        </Head>
      </g>
    )
  }
  // grown up: yellow is the scarf now
  return (
    <g>
      <Legs b={b} color="#3a3f4c" />
      <Coat b={b} color={age < 26 ? '#6c7a5a' : '#c8952a'} long={3} shade="#2a2a2a" />
      <path d={`M -6 ${top + 2} Q 0 ${top + 7} 6 ${top + 2} L 5 ${top + 14} L 2 ${top + 13} L 3 ${top + 5} Q 0 ${top + 6} -5 ${top + 4} Z`} fill="#f2c230" />
      {age < 26 && <rect x={6} y={top + 13} width={7} height={9} rx={1} fill="#7a3b2e" transform={`rotate(12 ${9} ${top + 17})`} />}
      <Head b={b} hair={<path d={`M ${-r - 1} 1 Q ${-r} ${-r - 3} ${r * 0.3} ${-r - 2} Q ${r + 1.5} ${-r} ${r + 0.5} -2 L ${-r} 3 Z`} fill="#4a3426" />} />
    </g>
  )
}

function Lena({ age, year, graduating }: { age: number; year: number; graduating: boolean }) {
  const p = { id: 'lena' } as Person
  const b = proportions(p, age)
  const top = -b.legH - b.bodyH
  const r = b.headR
  const student = age < 28
  const parent = age >= 34
  const hair = (
    <g>
      <path d={`M ${-r - 1} 2 Q ${-r - 1} ${-r - 2.5} 0 ${-r - 1.5} Q ${r + 1} ${-r - 1} ${r} 0 L ${r - 2} -3 Q 0 ${-r + 2} ${-r + 1} 3 Z`} fill="#3b2a22" />
      <path d={`M ${-r} -2 Q ${-r - 6} 2 ${-r - 4} 9`} stroke="#3b2a22" strokeWidth={3.2} fill="none" strokeLinecap="round" />
    </g>
  )
  return (
    <g>
      {parent && <Pram year={year} />}
      {student && <rect x={-13} y={top + 3} width={9} height={14} rx={2.5} fill="#24497e" />}
      <Legs b={b} color="#2c3445" />
      <Coat b={b} color={student ? '#3a6fb8' : '#2e4166'} shade="#1d2c48" long={student ? 0 : 2} />
      {!student && <path d={`M -2.5 ${top + 2} L 0 ${top + 9} L 2.5 ${top + 2} Z`} fill="#f4f1ea" />}
      {student && <line x1={-5} y1={top + 3} x2={-3} y2={top + 17} stroke="#1d3561" strokeWidth={1.6} />}
      {student
        ? <rect x={6} y={top + 11} width={6} height={8} rx={0.8} fill="#c2453a" transform={`rotate(-14 9 ${top + 15})`} />
        : !parent && <rect x={7} y={top + 12} width={8} height={10} rx={1.5} fill="#d8c7a2" />}
      <Head b={b} hair={hair}>
        {graduating && (
          <g className="cap-toss">
            <polygon points={`${-r - 3},${-r - 1} 0,${-r - 5} ${r + 3},${-r - 1} 0,${-r + 2}`} fill="#1d1d24" />
            <line x1={r + 1} y1={-r - 1} x2={r + 2} y2={-r + 5} stroke="#e9b320" strokeWidth={0.9} />
          </g>
        )}
      </Head>
    </g>
  )
}

function Pram({ year }: { year: number }) {
  const big = year - 2036 >= 5
  if (big) {
    // the baby is a child now, walking beside her
    return (
      <g transform="translate(15,0)">
        <rect x={-3} y={-12} width={2.6} height={12} fill="#556" />
        <rect x={0.4} y={-12} width={2.6} height={12} fill="#556" />
        <path d="M -5 -12 L 5 -12 L 4 -24 L -4 -24 Z" fill="#e57c5b" />
        <circle cx={0} cy={-28} r={5.5} fill={SKIN} />
        <path d="M -5.5 -28 Q -5 -34.5 0 -34 Q 5 -34 5.5 -29 Z" fill="#3b2a22" />
      </g>
    )
  }
  return (
    <g transform="translate(16,0)">
      <circle cx={-6} cy={-3} r={3} fill="#333" /><circle cx={6} cy={-3} r={3} fill="#333" />
      <path d="M -10 -6 L 10 -6 L 9 -16 L -9 -16 Z" fill="#9fb7d6" />
      <path d="M -9 -16 Q -9 -26 2 -25 L 2 -16 Z" fill="#6f8fbd" />
      <line x1={9} y1={-16} x2={-13} y2={-24} stroke="#333" strokeWidth={1.4} />
    </g>
  )
}

function Roth({ age }: { age: number }) {
  const p = { id: 'roth' } as Person
  const b = proportions(p, age)
  const top = -b.legH - b.bodyH
  const r = b.headR
  const stoop = Math.min(22, Math.max(4, (age - 71) * 1.5 + 4))
  const walker = age >= 84
  return (
    <g>
      <Legs b={b} color="#5b4a40" boots="#3a2a22" />
      <g transform={`rotate(${stoop} 0 ${-b.legH})`}>
        <Coat b={b} color="#8a5a3c" long={6} shade="#5e3a24" />
        <path d={`M -7 ${top + 3} Q 0 ${top + 8} 7 ${top + 3}`} stroke="#c2a07a" strokeWidth={2} fill="none" />
        <Head b={b} hair={<ellipse cx={-r * 0.55} cy={-r * 0.7} rx={r * 0.45} ry={r * 0.4} fill="#d8d4cc" />}>
          <ellipse cx={0} cy={-r * 0.55} rx={r + 4} ry={2.4} fill="#6e4429" />
          <path d={`M ${-r + 1} ${-r * 0.55} Q 0 ${-r * 2} ${r - 1} ${-r * 0.55} Z`} fill="#7c4e30" />
          <rect x={-r + 1} y={-r * 0.9} width={r * 2 - 2} height={1.6} fill="#b5523b" />
        </Head>
      </g>
      {walker ? (
        <g stroke="#9aa0a6" strokeWidth={1.6} fill="none">
          <path d={`M 7 0 L 9 ${-b.legH - 6} L 20 ${-b.legH - 6} L 22 0`} />
          <line x1={9} y1={-b.legH + 4} x2={21} y2={-b.legH + 4} />
        </g>
      ) : (
        <g>
          <line x1={11} y1={0} x2={13} y2={-b.legH - 10} stroke="#4a3022" strokeWidth={1.8} strokeLinecap="round" />
          <path d={`M 13 ${-b.legH - 10} q 3 -3 5 0`} stroke="#4a3022" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

/** Just the drawn person, at a given age — shared by the city and the selector portraits. */
export function Figure({ person, year, graduating = false }: { person: Person; year: number; graduating?: boolean }) {
  const age = ageOf(person, year)
  if (person.id === 'mio') return <Mio age={age} />
  if (person.id === 'lena') return <Lena age={age} year={year} graduating={graduating} />
  return <Roth age={age} />
}

interface Props {
  person: Person
  year: number
  selected: boolean
  hovered: boolean
  dim: boolean
  indicator: '!' | '…' | null
  ring: boolean
  passing: boolean
  graduating: boolean
  onPick: () => void
  onHover: (on: boolean) => void
}

export function Character({ person, year, selected, hovered, dim, indicator, ring, passing, graduating, onPick, onHover }: Props) {
  const age = ageOf(person, year)
  const s = figureScale(person, year) * ZOOM
  const h = figureHeight(person, year)
  const [x, y] = screenSpot(person.id)
  const stage = stageOf(person, year).stage
  // the old move slowly; children cannot keep still
  const idle = person.id === 'roth' ? 2.6 + (age - 71) * 0.12 : person.id === 'mio' && age < 11 ? 0.9 : 2.2
  return (
    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
      className={`character ch-${person.id} st-${stage} ${selected ? 'is-selected' : ''} ${hovered ? 'is-hovered' : ''} ${dim ? 'is-dim' : ''} ${passing ? 'passing' : ''}`}
      onClick={(e) => { e.stopPropagation(); if (!passing) onPick() }}
      onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
      role="button" aria-label={`${person.name}, ${age}`} aria-pressed={selected} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() } }}>
      {ring && <ellipse className="tut-ring" cx={0} cy={0} rx={30} ry={11} />}
      <ellipse className="ch-shadow" cx={0} cy={0} rx={13 * s + 3} ry={4 * s + 1.5} />
      <ellipse className="ch-halo" cx={0} cy={0} rx={18 * s + 6} ry={6.5 * s + 2.5} style={{ stroke: ACCENT[person.id] }} />
      <g className="ch-scale" style={{ transform: `scale(${s})` }}>
        <g className={`ch-idle ${person.id === 'mio' && age < 11 ? 'hop' : 'bob'}`} style={{ animationDuration: `${idle}s` }}>
          <Figure person={person} year={year} graduating={graduating} />
        </g>
      </g>
      {passing && (
        <g className="leaves">
          {[-14, -2, 9, 18].map((dx, i) => <ellipse key={i} className="leaf" cx={dx} cy={-h - 20} rx={2.6} ry={1.4} style={{ animationDelay: `${i * 0.35}s` }} />)}
        </g>
      )}
      <rect className="ch-hit" x={-24} y={-h - 14} width={48} height={h + 30} />
      <circle className="anchor" data-anchor={person.id} cx={0} cy={-h - (indicator ? 24 : 6)} r={0.5} />
      {indicator && !passing && (
        <g transform={`translate(0,${(-h - 14).toFixed(1)})`}>
          <g className={`indicator ${indicator === '!' ? 'ind-wish' : 'ind-wait'}`}>
            <circle r={8.5} style={{ fill: indicator === '!' ? ACCENT[person.id] : '#fbf7ec', stroke: ACCENT[person.id] }} />
            <text y={3.8} textAnchor="middle">{indicator}</text>
          </g>
        </g>
      )}
      {!passing && (
        <g transform="translate(0,15)" className="ch-label">
          <rect x={-(person.name.length * 3.6 + 7)} y={-8} width={person.name.length * 7.2 + 14} height={13} rx={6.5} style={{ fill: ACCENT[person.id] }} />
          <text y={2} textAnchor="middle">{person.name}</text>
        </g>
      )}
    </g>
  )
}
