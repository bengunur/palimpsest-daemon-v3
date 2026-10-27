// What a person sees when they look at the square: their wish, drawn onto the real geometry.
// Visions are imagined — never physical, never permanent.
import type { PlotId, PlotState } from '../../shared/actions.ts'
import { currentWhisper, isSatisfied, workFor } from './engine.ts'
import { lastWish } from './status.ts'
import type { CharacterId, City } from './types.ts'
import { isPresent } from './world.ts'

/** Where a person imagines an "anywhere" wish. Lena and Frau Roth see the same soil differently. */
const FAVOURITE: Record<CharacterId, PlotId> = { mio: 'eastlot', lena: 'westbed', roth: 'westbed' }

export interface Vision { personId: CharacterId; plot: PlotId; state: PlotState; verb: string }

export function visionFor(c: City, id: CharacterId): Vision | null {
  const p = c.people.find((x) => x.id === id)!
  const alive = isPresent(p, c.year)
  // the dead keep their last unanswered wish, as a memory
  const w = alive ? currentWhisper(c, id) : lastWish(c, id)
  if (!w || workFor(c, w) || (!alive && isSatisfied(c, w.plot, w.wants))) return null
  const state = w.wants.find((x): x is PlotState => x !== 'tree' && x !== 'plaque')
  if (!state) return null
  return {
    personId: id,
    plot: w.plot === 'any' ? FAVOURITE[id] : w.plot,
    state,
    verb: !alive ? 'once dreamed of this' : w.kind === 'memory' ? 'remembers…' : 'imagines…',
  }
}
