// The SIMULATED daemon: a deterministic, seeded utility policy with the daemon's motives.
// Used on the public site, in the demo, and as a labelled fallback when local Claude is unreachable.
import { ACTIONS, ACTION_IDS, CAPACITY, PLOT_IDS, resultState } from '../../shared/actions.ts'
import type { ActionId, PlotId } from '../../shared/actions.ts'
import { TREE_MATURES, buildingWorks, openWhispers, personName, supporters, validationContext } from './engine.ts'
import { pick, rand } from './rng.ts'
import type { City, Whisper } from './types.ts'
import { isPresent } from './world.ts'

export interface RawDecision {
  noticed: string
  action: ActionId
  plotId: PlotId | 'none'
  durationYears: number
  reason: string
  utterance: string
}

const PRODUCIBLE = new Set<string>(['garden', 'courtyard', 'play', 'garden_play', 'tree', 'plaque'])

const PRECIOUS = ['garden', 'courtyard', 'play', 'garden_play', 'fountain', 'steps', 'arcade', 'old_tree']

const VOICE: Record<ActionId, string[]> = {
  plant_garden: ['A garden is a sentence that takes years to say.', 'Soil remembers faster than people do. Still, it needs time.'],
  establish_shared_courtyard: ['A table is a slow kind of agreement.', 'I am building a place for strangers who have not arrived yet.'],
  add_play_space: ['Children grow faster than I build. I will build anyway.', 'Whoever asked will be too old for it. Someone smaller will not be.'],
  preserve_trace: ['Forgetting is the only thing that hurries me.', 'I am writing it down in the slowest ink there is.'],
  plant_tree: ['The tree and I agree about time.', 'I plant shade for people who are not yet hot.'],
  wait: ['I am listening. Listening takes a year, at least.', 'Nothing is urgent to stone.'],
}

const LENS_VERB = { memory: 'remembers', present: 'needs', possibility: 'dreams' } as const

function quote(c: City, w: Whisper) {
  return `${personName(c, w.personId)} ${LENS_VERB[w.lens]}: “${w.text}”`
}

function kindWeight(c: City, w: Whisper) {
  return w.kind === 'memory' ? c.weights.memory : w.kind === 'need' ? c.weights.use : c.weights.play
}

function isGone(c: City, w: Whisper) {
  const p = c.people.find((x) => x.id === w.personId)
  return !p || !isPresent(p, c.year)
}

interface Candidate { action: ActionId; plot: PlotId; sup: Whisper[]; score: number; restoresYear?: number; forgetting: number }

export function simulatedDecision(c: City): RawDecision {
  const ctx = validationContext(c)
  const inProgress = new Set(buildingWorks(c).flatMap((w) => w.forWhispers))
  const youngTree = PLOT_IDS.some((id) => c.plots[id].marks.some((m) => m.kind === 'tree' && c.year - m.year < TREE_MATURES))
    || buildingWorks(c).some((w) => w.action === 'plant_tree')

  const candidates: Candidate[] = []
  if (ctx.building < CAPACITY) {
    for (const action of ACTION_IDS) {
      const spec = ACTIONS[action]
      if (!spec.targets) continue
      if (action === 'plant_tree' && youngTree) continue
      for (const pc of ctx.plots) {
        if (pc.busy || !spec.targets.includes(pc.state)) continue
        const sup = supporters(c, action, pc.id).filter((w) => !inProgress.has(w.id))
        if (!sup.length) continue
        const plot = c.plots[pc.id]
        let score = 0
        for (const w of sup) score += kindWeight(c, w) * (1 + Math.log2(w.heardCount + (w.carried ? 1 : 0)))
        if (new Set(sup.map((w) => w.lens)).size > 1) score += 0.3
        let restoresYear: number | undefined
        if (spec.transforms) {
          const to = resultState(action, plot.state)
          const past = plot.layers.slice(0, -1).filter((l) => l.state === to || (to === 'garden_play' && l.state === 'garden'))
          if (past.length) { restoresYear = past[past.length - 1].year; score += c.weights.memory * 0.6 }
          if (PRECIOUS.includes(plot.state) && !(action === 'add_play_space' && plot.state === 'garden')) {
            score -= c.weights.memory * (plot.state === 'arcade' || plot.state === 'steps' ? 0.5 : 1.2)
          }
        }
        const forgetting = action === 'preserve_trace'
          ? sup.filter((w) => w.kind === 'memory' && (isGone(c, w) || w.lastHeard < c.year - 1)).length
          : 0
        score += forgetting * c.weights.memory * 1.5
        score += rand(c) * 0.2
        candidates.push({ action, plot: pc.id, sup, score, restoresYear, forgetting })
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  if (!best) {
    const full = ctx.building >= CAPACITY
    // something is asked that the daemon has no word for (e.g. un-making a garden back into a car park)
    const impossible = openWhispers(c).find((w) => w.wants.every((want) => !PRODUCIBLE.has(want)))
    if (!full && impossible) {
      return {
        noticed: `${quote(c, impossible)} Heard ${impossible.heardCount}×.`,
        action: 'wait', plotId: 'none', durationYears: 3,
        reason: 'This asks me to un-make something. I do not have that word. I will wait until the asking changes, or the asker does.',
        utterance: 'I only know how to add. Every city I have ever been was made this way.',
      }
    }
    return {
      noticed: full ? 'Two works are already in the ground.' : openWhispers(c).length ? 'The voices I hear ask for things already being made, or for things I cannot make.' : 'No voices asking for stone.',
      action: 'wait', plotId: 'none', durationYears: 2 + Math.round(c.weights.stillness * 10 * rand(c)),
      reason: full ? 'My hands are full. I will not start a third thing.' : 'Nothing has been asked that I can answer well. I let the square settle.',
      utterance: pick(c, VOICE.wait),
    }
  }

  const top = [...best.sup].sort((a, b) => b.heardCount - a.heardCount)[0]
  const heard = best.sup.reduce((n, w) => n + w.heardCount + (w.carried ? 1 : 0), 0)
  if (heard < 2) {
    return {
      noticed: `${quote(c, top)} Heard once, in ${top.firstHeard}.`,
      action: 'wait', plotId: 'none', durationYears: 1,
      reason: 'A need heard once might be weather. I wait to hear it again before I give it stone.',
      utterance: 'I have heard this once. Once is weather; twice is climate.',
    }
  }
  if (best.score < 0.35) {
    return {
      noticed: `${quote(c, top)} Faint.`,
      action: 'wait', plotId: 'none', durationYears: 2,
      reason: 'It is asked, but not strongly enough to outweigh what is already here.',
      utterance: pick(c, VOICE.wait),
    }
  }

  const spec = ACTIONS[best.action]
  const f = Math.min(1, Math.max(0, 0.3 + c.weights.memory * (best.restoresYear || best.forgetting ? 1 : 0.5) + rand(c) * 0.2 - 0.1))
  const durationYears = spec.minYears + Math.round((spec.maxYears - spec.minYears) * f)
  const plotName = c.plots[best.plot].name
  const lenses = new Set(best.sup.map((w) => w.lens))
  const since = Math.min(...best.sup.map((w) => w.firstHeard))

  let noticed = `${quote(c, top)}`
  if (best.sup.length > 1) {
    const other = best.sup.find((w) => w.personId !== top.personId)
    if (other) noticed += ` And ${personName(c, other.personId)} ${LENS_VERB[other.lens]} the same ground.`
  }
  noticed += ` Heard ${heard}× since ${since}.`

  let reason: string
  if (best.forgetting) {
    reason = `The one who remembered this is ${best.sup.some((w) => isGone(c, w)) ? 'gone' : 'falling silent'}. If I do not set it in stone at ${plotName}, the square forgets it within a generation.`
  } else if (best.restoresYear && lenses.size > 1) {
    reason = `Two realities ask for the same soil. Something like this stood here until it was erased; returning to it answers a need and repays a memory.`
  } else if (best.restoresYear) {
    reason = `This stood at ${plotName} once, from ${best.restoresYear}. Returning to it costs the city less forgetting.`
  } else if (best.action === 'add_play_space' && c.plots[best.plot].state === 'garden') {
    reason = 'Children want play; the garden holds a memory. A play edge keeps both, imperfectly — which is how cities keep things.'
  } else if (best.action === 'preserve_trace') {
    reason = `${personName(c, top.personId)} still remembers. I would rather set it in stone while someone is here to say whether I got it right.`
  } else if (best.action === 'plant_tree') {
    reason = 'Heat is a need that will outlive everyone asking about it. A tree answers people not yet born.'
  } else {
    reason = `${spec.label[0].toUpperCase() + spec.label.slice(1)} at ${plotName} answers what has been said ${heard} times — not what was said loudest.`
  }

  return { noticed, action: best.action, plotId: best.plot, durationYears, reason, utterance: pick(c, VOICE[best.action]) }
}
