// The concise, structured view of the city that the live daemon (Claude) receives.
// It contains only what the daemon can perceive: plots, its own works, whispers — never people directly.
import { ACTIONS, ACTION_IDS, CAPACITY, PLOT_IDS } from '../../shared/actions.ts'
import { activeWait, buildingWorks, openWhispers, validationContext } from './engine.ts'
import type { City } from './types.ts'

export function buildSnapshot(c: City) {
  const ctx = validationContext(c)
  const inProgress = new Set(buildingWorks(c).flatMap((w) => w.forWhispers))
  const whispers = openWhispers(c)
    .map((w) => ({
      id: w.id,
      lens: w.lens,
      kind: w.kind,
      plot: w.plot,
      wants: w.wants,
      text: w.text,
      heard: w.heardCount,
      firstHeard: w.firstHeard,
      lastHeard: w.lastHeard,
      carriedByVisitor: w.carried,
      alreadyBeingAnswered: inProgress.has(w.id),
    }))
    .sort((a, b) => Number(a.alreadyBeingAnswered) - Number(b.alreadyBeingAnswered) || b.heard - a.heard)
    .slice(0, 8)

  return {
    year: c.year,
    why: c.thoughtReasons,
    capacity: { building: ctx.building, max: CAPACITY },
    waiting: !!activeWait(c),
    plots: PLOT_IDS.map((id) => {
      const p = c.plots[id]
      return {
        id,
        name: p.name,
        state: p.state,
        history: p.layers.slice(-4).map((l) => `${l.year} ${l.state}${l.note ? ` (${l.note})` : ''}`).join(' → '),
        marks: p.marks.map((m) => `${m.kind} ${m.year}`),
        underConstruction: ctx.plots.find((x) => x.id === id)!.busy,
      }
    }),
    works: buildingWorks(c).map((w) => ({ action: w.action, plot: w.plot, startYear: w.startYear, completionYear: w.completionYear })),
    whispers,
    recentDecisions: c.ledger
      .filter((e) => e.type === 'decision')
      .slice(-4)
      .map((e) => (e.type === 'decision' ? { year: e.year, action: e.decision.action, plot: e.decision.plot, reason: e.decision.reason } : null)),
    weights: c.weights,
    allowedActions: ACTION_IDS.map((id) => {
      const s = ACTIONS[id]
      return {
        action: id,
        minYears: s.minYears,
        maxYears: s.maxYears,
        validPlots: s.targets ? ctx.plots.filter((p) => !p.busy && s.targets!.includes(p.state)).map((p) => p.id) : ['none'],
      }
    }).filter((a) => a.validPlots.length > 0 && (a.action === 'wait' || ctx.building < CAPACITY)),
  }
}

export type Snapshot = ReturnType<typeof buildSnapshot>
