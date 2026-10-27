// The daemon's complete vocabulary. Shared by the browser and the local AI server,
// so both sides enforce exactly the same rules. Nothing here takes under a year.

export type PlotId = 'westbed' | 'linden' | 'fountain' | 'steps' | 'eastlot' | 'arcade'

export type PlotState =
  | 'paved' | 'parking' | 'fountain' | 'steps' | 'arcade' | 'old_tree' | 'stump'
  | 'garden' | 'courtyard' | 'play' | 'garden_play' | 'ruin'

export type ActionId =
  | 'plant_garden' | 'establish_shared_courtyard' | 'add_play_space'
  | 'preserve_trace' | 'plant_tree' | 'wait'

export const PLOT_IDS: PlotId[] = ['westbed', 'linden', 'fountain', 'steps', 'eastlot', 'arcade']

export const PLOT_NAMES: Record<PlotId, string> = {
  westbed: 'West Bed',
  linden: 'Linden Corner',
  fountain: 'Fountain',
  steps: 'Broad Steps',
  eastlot: 'East Lot',
  arcade: 'Arcade',
}

export interface ActionSpec {
  id: ActionId
  label: string
  minYears: number
  maxYears: number
  /** plot states this action may be applied to; null = takes no plot (wait) */
  targets: PlotState[] | null
  /** does it change the physical state of the plot (as opposed to adding a mark)? */
  transforms: boolean
}

const ALL_STATES: PlotState[] = [
  'paved', 'parking', 'fountain', 'steps', 'arcade', 'old_tree', 'stump',
  'garden', 'courtyard', 'play', 'garden_play', 'ruin',
]

export const ACTIONS: Record<ActionId, ActionSpec> = {
  plant_garden: {
    id: 'plant_garden', label: 'plant a garden', minYears: 6, maxYears: 10,
    targets: ['paved', 'parking', 'ruin', 'courtyard', 'play'], transforms: true,
  },
  establish_shared_courtyard: {
    id: 'establish_shared_courtyard', label: 'establish a shared courtyard', minYears: 5, maxYears: 8,
    targets: ['paved', 'parking', 'arcade', 'ruin', 'steps'], transforms: true,
  },
  add_play_space: {
    id: 'add_play_space', label: 'add a play space', minYears: 5, maxYears: 9,
    targets: ['paved', 'parking', 'garden', 'courtyard', 'fountain', 'ruin', 'steps'], transforms: true,
  },
  preserve_trace: {
    id: 'preserve_trace', label: 'preserve a trace', minYears: 1, maxYears: 3,
    targets: ALL_STATES, transforms: false,
  },
  plant_tree: {
    id: 'plant_tree', label: 'plant a tree', minYears: 1, maxYears: 2,
    targets: ['paved', 'parking', 'courtyard', 'garden', 'play', 'garden_play', 'ruin', 'steps', 'stump'],
    transforms: false,
  },
  wait: {
    id: 'wait', label: 'wait and listen', minYears: 1, maxYears: 4,
    targets: null, transforms: false,
  },
}

export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[]

/** The plot state that results from completing an action. */
export function resultState(action: ActionId, from: PlotState): PlotState {
  switch (action) {
    case 'plant_garden': return 'garden'
    case 'establish_shared_courtyard': return 'courtyard'
    case 'add_play_space': return from === 'garden' ? 'garden_play' : 'play'
    default: return from
  }
}

/** Maximum number of physical works the daemon can tend at once. */
export const CAPACITY = 2
export const MAX_TEXT = { noticed: 220, reason: 260, utterance: 160 }

/** JSON schema handed to `claude -p --json-schema`. Enums keep the model inside the vocabulary. */
export const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    noticed: { type: 'string', description: 'What you noticed in the city, one sentence.' },
    action: { type: 'string', enum: ACTION_IDS },
    plotId: { type: 'string', enum: [...PLOT_IDS, 'none'] },
    durationYears: { type: 'integer', minimum: 1, maximum: 12 },
    reason: { type: 'string', description: 'Why, in one or two sentences.' },
    utterance: { type: 'string', description: 'One line in your own voice.' },
  },
  required: ['noticed', 'action', 'plotId', 'durationYears', 'reason', 'utterance'],
  additionalProperties: false,
} as const

export interface ValidationContext {
  year: number
  plots: { id: PlotId; state: PlotState; busy: boolean }[]
  building: number
}

export interface ValidDecision {
  noticed: string
  action: ActionId
  plotId: PlotId | 'none'
  durationYears: number
  startYear: number
  completionYear: number
  reason: string
  utterance: string
}

export type ValidationResult =
  | { ok: true; decision: ValidDecision; notes: string[] }
  | { ok: false; errors: string[] }

function cleanText(v: unknown, max: number, field: string, notes: string[]): string {
  if (typeof v !== 'string') return ''
  // strip control characters; this text is only ever rendered, never executed
  let s = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (s.length > max) {
    s = s.slice(0, max - 1).trimEnd() + '…'
    notes.push(`The daemon's ${field} ran long; the city trimmed it.`)
  }
  return s
}

/**
 * The gatekeeper. Any decision — from Claude or from the simulated policy — passes through here.
 * Start year is always the city's current year; completion is always at least one year later.
 */
export function validateDecision(raw: unknown, ctx: ValidationContext): ValidationResult {
  const errors: string[] = []
  const notes: string[] = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['decision is not an object'] }
  const r = raw as Record<string, unknown>

  const action = r.action as ActionId
  const spec = ACTIONS[action]
  if (typeof action !== 'string' || !spec) {
    return { ok: false, errors: [`unknown action "${String(r.action)}"`] }
  }

  let plotId: PlotId | 'none' = 'none'
  if (spec.targets) {
    const p = ctx.plots.find((pl) => pl.id === r.plotId)
    if (!p) errors.push(`"${action}" needs a plot, got "${String(r.plotId)}"`)
    else if (!spec.targets.includes(p.state)) errors.push(`cannot ${spec.label} on ${PLOT_NAMES[p.id]} (it is ${p.state})`)
    else if (p.busy) errors.push(`${PLOT_NAMES[p.id]} is already under construction`)
    else plotId = p.id
    if (ctx.building >= CAPACITY) errors.push(`already tending ${ctx.building} works; capacity is ${CAPACITY}`)
  } else if (r.plotId && r.plotId !== 'none') {
    notes.push('Waiting needs no plot; the plot was ignored.')
  }

  let asked = typeof r.durationYears === 'number' ? r.durationYears : Number(r.durationYears)
  if (!Number.isFinite(asked)) asked = 0
  let duration = Math.round(asked)
  if (duration !== asked) notes.push(`The daemon asked for ${asked} years; the city counts only whole years.`)
  if (duration < spec.minYears) {
    notes.push(`The daemon asked for ${asked} year${asked === 1 ? '' : 's'}. The city does not permit this. Corrected to ${spec.minYears}.`)
    duration = spec.minYears
  } else if (duration > spec.maxYears) {
    notes.push(`The daemon asked for ${asked} years; even it may not take that long. Corrected to ${spec.maxYears}.`)
    duration = spec.maxYears
  }
  // The constraint, stated once more where it cannot be argued with.
  duration = Math.max(1, duration)

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    notes,
    decision: {
      noticed: cleanText(r.noticed, MAX_TEXT.noticed, 'observation', notes) || 'Something, quietly.',
      action,
      plotId,
      durationYears: duration,
      startYear: ctx.year,
      completionYear: ctx.year + duration,
      reason: cleanText(r.reason, MAX_TEXT.reason, 'reason', notes) || 'It did not say.',
      utterance: cleanText(r.utterance, MAX_TEXT.utterance, 'utterance', notes),
    },
  }
}
