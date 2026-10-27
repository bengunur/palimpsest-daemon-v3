import { validateDecision } from '../../shared/actions.ts'
import { applyDecision, recordRefusal, validationContext } from './engine.ts'
import { simulatedDecision } from './policy.ts'
import type { City, Source } from './types.ts'

/** Validate any decision against the city as it is now, then apply it. Invalid decisions never touch the city. */
export function applyRaw(c: City, raw: unknown, source: Source, extraNotes: string[] = [], model?: string): { city: City; ok: boolean; errors: string[] } {
  const v = validateDecision(raw, validationContext(c))
  if (!v.ok) return { city: c, ok: false, errors: v.errors }
  return { city: applyDecision(c, v.decision, source, [...extraNotes, ...v.notes], model), ok: true, errors: [] }
}

export function decideSimulated(c: City, source: Source = 'simulated', notes: string[] = []): City {
  const r = applyRaw(c, simulatedDecision(c), source, notes)
  if (!r.ok) {
    // should be unreachable: the policy only proposes valid actions. Recorded rather than hidden.
    return applyRaw(recordRefusal(c, 'The simulated daemon proposed something the city refused.', r.errors),
      { noticed: 'Confusion.', action: 'wait', plotId: 'none', durationYears: 1, reason: 'It reconsiders.', utterance: '' }, source).city
  }
  return r.city
}

export interface LiveResponse {
  ok: boolean
  raw?: unknown
  model?: string
  ms?: number
  error?: string
  errors?: string[]
}

/** Ask local Claude (through the localhost server). Any failure falls back to the policy, labelled as such. */
export async function decideLive(c: City, snapshot: unknown, signal?: AbortSignal): Promise<City> {
  let res: LiveResponse
  try {
    const r = await fetch('/api/daemon/decide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }), signal,
    })
    res = (await r.json()) as LiveResponse
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  if (res.ok && res.raw) {
    const applied = applyRaw(c, res.raw, 'live', [], res.model)
    if (applied.ok) return applied.city
    const refused = recordRefusal(c, 'Claude proposed something the city does not permit. The simulated daemon stands in.', applied.errors)
    return decideSimulated(refused, 'fallback')
  }
  if (res.errors?.length) {
    const refused = recordRefusal(c, 'Claude proposed something the city does not permit. The simulated daemon stands in.', res.errors)
    return decideSimulated(refused, 'fallback')
  }
  return decideSimulated(c, 'fallback', [`Live daemon unreachable (${res.error ?? 'unknown error'}).`])
}
