import type { ActionId, PlotId, PlotState } from '../../shared/actions.ts'

export type Lens = 'ground' | 'memory' | 'present' | 'possibility' | 'palimpsest'
export type PersonaLens = 'memory' | 'present' | 'possibility'

/** Who decided: Claude on localhost, the deterministic policy, or the policy standing in for an unreachable Claude. */
export type Source = 'live' | 'simulated' | 'fallback'

export interface Layer { year: number; state: PlotState; note?: string; by?: string }
export interface Mark { kind: 'tree' | 'plaque'; year: number; text?: string }

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

export interface Phase { from: number; lens: PersonaLens; role: string; desires: Desire[] }

export interface Person {
  id: string
  name: string
  born: number
  arrives: number
  leaves: number
  leaveText: string
  phases: Phase[]
}

export interface Whisper {
  id: string
  key: string
  personId: string
  lens: PersonaLens
  kind: Desire['kind']
  plot: PlotId | 'any'
  wants: Want[]
  text: string
  firstHeard: number
  lastHeard: number
  heardCount: number
  carried: boolean
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
  weights: Weights
  /** the daemon has something to think about this year */
  needsThought: boolean
  thoughtReasons: string[]
  lastThoughtYear: number
  carriedYear: number
  /** the year a storm will fell the old linden (not the daemon's doing) */
  stormYear: number
}
