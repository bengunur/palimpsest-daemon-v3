// A character's status, read only from the simulation — never hard-coded.
import { currentWhisper, workFor } from './engine.ts'
import type { CharacterId, City, Reaction, Whisper } from './types.ts'
import { ageOf, isPresent, stageOf } from './world.ts'

const STAGE_LABEL: Record<string, string> = {
  child: 'Child', teenager: 'Teenager', student: 'Student', adult: 'Adult',
  graduate: 'Graduated', parent: 'Parent', resident: 'Resident', frail: 'Frail',
}

export interface Status {
  age: number
  label: string
  memorial: boolean
  /** "1955–2041" once someone has died */
  years?: string
}

export function statusOf(c: City, id: CharacterId): Status {
  const p = c.people.find((x) => x.id === id)!
  if (!isPresent(p, c.year)) {
    return { age: ageOf(p, p.diedYear!), label: 'In memory', memorial: true, years: `${p.born}–${p.diedYear}` }
  }
  const w = currentWhisper(c, id)
  return { age: ageOf(p, c.year), label: workFor(c, w) ? 'Waiting' : STAGE_LABEL[stageOf(p, c.year).stage] ?? stageOf(p, c.year).stage, memorial: false }
}

/** The most recent reaction that still feels current (within four years). */
export function latestReaction(c: City, id: CharacterId): Reaction | undefined {
  return [...c.reactions].reverse().find((r) => r.personId === id && c.year - r.year <= 4)
}

/** For the dead: the last thing they wished for. */
export function lastWish(c: City, id: CharacterId): Whisper | undefined {
  return [...c.whispers].reverse().find((w) => w.personId === id)
}
