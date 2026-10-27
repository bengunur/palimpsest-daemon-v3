import type { PlotState } from '../../shared/actions.ts'

export const GROUND_LABEL: Record<PlotState, string> = {
  paved: 'cobbled forecourt', parking: 'car park', fountain: 'fountain', steps: 'the broad steps',
  arcade: 'arcade', old_tree: 'old linden', stump: 'linden stump', garden: 'garden', courtyard: 'shared courtyard',
  play: 'playground', garden_play: 'garden with a play edge', ruin: 'unfinished work',
}
