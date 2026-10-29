import type { ActionId, PlotId, PlotState } from '../../shared/actions.ts'
import type { Emotion } from './feelings.ts'

export type PersonaLens = 'memory' | 'present' | 'possibility'

/** Who decided: Claude on localhost, the deterministic policy, or the policy standing in for an unreachable Claude. */
export type Source = 'live' | 'simulated' | 'fallback'

export interface Layer { year: number; state: PlotState; note?: string; by?: string }
export interface Mark { kind: 'tree' | 'plaque' | 'memorial'; year: number; text?: string }

export interface Plot {
  id: PlotId
  name: string
  state: PlotState
  layers: Layer[]
  marks: Mark[]
}

export type Want = PlotState | 'tree' | 'plaque'

export interface Desire {
  key: string
  kind: 'need' | 'memory' | 'dream'
  plot: PlotId | 'any'
  wants: Want[]
  text: string
}

export type CharacterId = 'mio' | 'lena' | 'roth'

/** A stretch of a life, entered at a given age. */
export interface Stage {
  fromAge: number
  stage: string
  lens: PersonaLens
  wish: Desire | null
  /** what they say when they have nothing to ask */
  idle: string
}

export interface LifeEvent { age: number; icon: string; text: string }

export interface Person {
  id: CharacterId
  name: string
  born: number
  stages: Stage[]
  events: LifeEvent[]
  /** set only by the aging system in lifeEvents(), never by the daemon's works */
  diedYear?: number
}

export interface Whisper {
  id: string
  key: string
  personId: CharacterId
  lens: PersonaLens
  kind: Desire['kind']
  plot: PlotId | 'any'
  wants: Want[]
  text: string
  firstHeard: number
  lastHeard: number
  heardCount: number
  /** told to the daemon by the player */
  told: boolean
  resolvedYear?: number
}

export interface Work {
  id: string
  action: ActionId
  plot: PlotId | 'none'
  startYear: number
  completionYear: number
  reason: string
  source: Source
  status: 'building' | 'done'
  forWhispers: string[]
}

export interface DecisionRecord {
  noticed: string
  action: ActionId
  plot: PlotId | 'none'
  durationYears: number
  startYear: number
  completionYear: number
  reason: string
  utterance: string
  source: Source
  notes: string[]
  workId: string
  model?: string
}

export type LedgerEntry =
  | { id: string; year: number; type: 'decision'; decision: DecisionRecord }
  | { id: string; year: number; type: 'completion'; text: string; tooLate: boolean; utterance: string; workId: string }
  | { id: string; year: number; type: 'event'; text: string }
  | { id: string; year: number; type: 'refusal'; text: string; errors: string[] }

/** delighted/bittersweet/surprised: about their own wish. mixed/disrupted: someone else's wish, landing in their reality. */
export type Mood = 'delighted' | 'bittersweet' | 'surprised' | 'mixed' | 'disrupted'

export interface Reaction { id: string; year: number; personId: CharacterId; workId: string; mood: Mood; line: string }
export interface Milestone { id: string; year: number; personId: CharacterId; icon: string; text: string; death?: boolean }

export interface Weights { memory: number; use: number; play: number; stillness: number }

export interface City {
  seed: number
  year: number
  rng: number
  nextId: number
  plots: Record<PlotId, Plot>
  people: Person[]
  whispers: Whisper[]
  works: Work[]
  ledger: LedgerEntry[]
  reactions: Reaction[]
  milestones: Milestone[]
  weights: Weights
  /** the daemon has something to think about this year */
  needsThought: boolean
  thoughtReasons: string[]
  lastThoughtYear: number
  /** last year each character's wish was told to the daemon */
  toldYear: Partial<Record<CharacterId, number>>
  /** the year a storm will fell the old linden (not the daemon's doing) */
  stormYear: number
  /** every wish the player carried to the daemon, by year */
  tells: { year: number; personId: CharacterId }[]
  /** how each person felt, recorded once a year; derived from the city, never a cause of anything */
  moods: { year: number; personId: CharacterId; emotion: Emotion }[]
}
