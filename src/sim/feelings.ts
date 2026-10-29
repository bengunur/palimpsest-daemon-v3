// How each person feels about the square this year — derived only from the simulation, never stored as
// cause. Three lives read the same works differently: by age, by stage, by what they still want.
// Deterministic: no RNG is consumed, so feelings can never change what the daemon or the city does.
//
// The daemon's influence is slow here too. A decision made this year is invisible to everyone until
// next year (fences go up in spring); feelings then drift year by year while a work is being built.
import type { PlotId } from '../../shared/actions.ts'
import { buildingWorks, currentWhisper, wantProduced } from './engine.ts'
import { GROUND_LABEL } from './interpret.ts'
import type { CharacterId, City, Mood, Person, Want, Work } from './types.ts'
import { ageOf, isPresent, stageOf } from './world.ts'

export type Emotion = 'calm' | 'happy' | 'surprised' | 'confused' | 'frustrated' | 'tired' | 'bored'

export const EMOTIONS: Emotion[] = ['calm', 'happy', 'surprised', 'confused', 'frustrated', 'tired', 'bored']

export interface Feeling {
  emotion: Emotion
  line: string
  /** speech: said aloud, about something that happened; thought: their private view of the square */
  kind: 'speech' | 'thought'
}

export const EMOTION_GLYPH: Record<Emotion, string> = {
  calm: '', happy: '♪', surprised: '!', confused: '?', frustrated: '#', tired: 'z', bored: '…',
}

export const EMOTION_LABEL: Record<Emotion, string> = {
  calm: 'calm', happy: 'happy', surprised: 'surprised', confused: 'confused', frustrated: 'frustrated', tired: 'tired', bored: 'bored',
}

// ── taste: what each life-stage makes of a finished result ───────────────────
// +1 likes it, -1 it gets in their way, 0 does not care. The same garden is joy, an obstacle and wallpaper.

type Taste = Partial<Record<Want, 1 | -1>>
const TASTE: Record<string, Taste> = {
  'mio:child': { play: 1, garden_play: 1, garden: -1, courtyard: -1 },
  'mio:teenager': { courtyard: 1, play: -1, garden_play: -1, garden: -1 },
  'mio:student': { garden: 1, courtyard: 1, garden_play: 1 },
  'mio:adult': { plaque: 1, tree: 1 },
  'lena:student': { garden: 1, tree: 1, play: -1, garden_play: -1 },
  'lena:graduate': { courtyard: 1, tree: 1, play: -1 },
  'lena:parent': { play: 1, garden_play: 1, garden: -1, courtyard: -1 },
  'roth:resident': { garden: 1, garden_play: 1, tree: 1, plaque: 1, courtyard: -1 },
  'roth:frail': { courtyard: 1, garden: 1, tree: 1, plaque: 1, play: -1 },
}

/** How many years each of them can wait hopefully before hope curdles. Children have no patience; Frau Roth has had practice. */
function patience(p: Person, year: number) {
  const stage = stageOf(p, year).stage
  if (p.id === 'mio') return stage === 'child' || stage === 'teenager' ? 1 : stage === 'student' ? 2 : 3
  if (p.id === 'lena') return 2
  return 3
}

export function tasteFor(p: Person, year: number, want: Want | null): -1 | 0 | 1 {
  if (!want) return 0
  return TASTE[`${p.id}:${stageOf(p, year).stage}`]?.[want] ?? 0
}

// ── lines ─────────────────────────────────────────────────────────────────────
// {thing} is what is being built, {n} a number of years. Picked deterministically by year.

type Lines = Partial<Record<CharacterId, string[]>> & { all?: string[] }
const L: Record<string, Lines> = {
  told: {
    mio: ['I told it. Nothing happened. Is it broken?', 'I told the square my wish. The square did not answer.'],
    lena: ['I told it. No reply, no receipt.', 'Submitted. Awaiting response, presumably for years.'],
    roth: ['I told it. It will take its time. It always has.', 'Spoken. Now we wait, as in ’62.'],
  },
  own_hope: {
    mio: ['There’s a fence! Is that my {thing}?', 'I looked through the fence. Mud. Good mud, I think.'],
    lena: ['A fence went up. {n} years, the sign says. I’ll be done by then.', 'They started. I’ve written the date down.'],
    roth: ['Fences on the square. Somebody listened.', 'They are digging. The soil remembers what it was.'],
  },
  own_impatient: {
    mio: ['Still mud. It’s been {n} years. That’s forever.', 'Is it a playground yet? It’s been {n} years.'],
    lena: ['{n} years of fences. I could have written two theses.', 'Still building. My deadline was years ago.'],
    roth: ['{n} years of digging. My mother did it in a spring.', 'Still fenced. I am not getting younger.'],
  },
  own_resigned: {
    mio: ['I’ve stopped looking at the fence.', 'Whatever. It will be done when it’s done.'],
    lena: ['I don’t check the sign anymore.', 'At this point it’s for someone else.'],
    roth: ['I may not see it. That is all right. Someone will.', 'Slowly, slowly. Like everything here.'],
  },
  outgrown: {
    mio: ['They’re still building my {thing}. I’m {age}.', 'That {thing} was for a kid I used to be.'],
    lena: ['Still building the {thing} I asked for. I needed it back then.', 'That was a wish for a different life.'],
    roth: ['They are still making my {thing}. My knees have other plans.', 'I asked for that a long time ago.'],
  },
  ignored: {
    mio: ['I asked for a playground. They’re building… something else?', 'Did it hear me wrong?'],
    lena: ['I asked for one thing. It started another.', 'Interesting prioritisation.'],
    roth: ['I asked for my garden. It has its own ideas.', 'It heard me. It chose differently. Hm.'],
  },
  site_like: {
    mio: ['Someone’s making a {thing}! Not for me, but still.', 'Ooh. A {thing}. Can I help dig?'],
    lena: ['A {thing}, eventually. I could live with that.', 'Not my wish, but I’ll take it.'],
    roth: ['They are making a {thing}. How kind of someone.', 'A {thing}. That will be nice. Eventually.'],
  },
  site_dislike: {
    mio: ['A {thing}? Boring. And it’s taking up the good bit.', 'They fenced off the good bit for a {thing}.'],
    lena: ['Drilling, every morning, for a {thing}.', 'I can’t think with that noise. A {thing}, apparently.'],
    roth: ['A {thing}. Where the garden should be.', 'Builders again. For a {thing}, of all things.'],
  },
  site_meh: {
    mio: ['Grown-ups are building a {thing}. Whatever.', 'Fences. Again.'],
    lena: ['Some {thing} or other. I walk around it.', 'There’s a site on my way to work. That’s all.'],
    roth: ['Builders. In my day they finished things.', 'Something about a {thing}. I don’t follow.'],
  },
  habit_like: {
    mio: ['I go to the {thing} every day after school.', 'The {thing} is ours now.'],
    lena: ['I sit in the {thing} on Tuesdays now.', 'The {thing} is part of my week now.'],
    roth: ['I visit the {thing} every morning.', 'The {thing} feels like it was always there.'],
  },
  habit_dislike: {
    mio: ['I walk the long way round the {thing}.', 'The {thing} isn’t for people like me.'],
    lena: ['I eat lunch elsewhere since the {thing}.', 'I’ve found another route.'],
    roth: ['I don’t go near the {thing}. Too much.', 'I take the other side of the square now.'],
  },
  habit_meh: {
    mio: ['The {thing}’s just there now.', 'Nobody remembers it was a car park.'],
    lena: ['I barely notice the {thing} anymore.', 'The {thing}. Fine.'],
    roth: ['Another layer. The square has so many.', 'It’s fine. It’s just not mine.'],
  },
  completed_meh: {
    mio: ['Oh. They finished a {thing}. Okay.', 'A {thing}. Cool, I guess.'],
    lena: ['A {thing} opened. I have a meeting.', 'Oh, that’s finished.'],
    roth: ['They finished it. Good for them.', 'Another thing on the square.'],
  },
  storm: {
    mio: ['The big tree fell over! The whole thing!', 'The linden fell. I heard it at night.'],
    lena: ['The linden came down in the storm. That was my shade.', 'The old tree. Just gone.'],
    roth: ['The linden. We danced under it. It is gone.', 'A hundred and seventy years, and one summer storm.'],
  },
  grief: {
    mio: ['Frau Roth’s bench is empty.', 'She used to wave at me.'],
    lena: ['Frau Roth died. The bench looks wrong now.', 'I never asked her about the garden.'],
  },
  waiting_long: {
    mio: ['I keep asking. Nobody builds anything.', 'Is anyone even listening?'],
    lena: ['Same wish, {n} years running.', 'I’ve been asking for {n} years.'],
    roth: ['{n} years I’ve said it. The square is patient. So am I.', 'I have asked for {n} years. I will ask again.'],
  },
}

const MILESTONE: Record<string, [Emotion, Partial<Record<CharacterId, string>>]> = {
  '🎓': ['happy', { lena: 'Done! I’m done! No more chapters!' }],
  '💼': ['tired', { lena: 'First job. I’m always tired now.' }],
  '🍼': ['tired', { lena: 'A baby. I have not slept since.' }],
  '🎒': ['bored', { mio: 'Secondary school. Homework. Ugh.' }],
  '🎧': ['bored', { mio: 'This square is for kids.' }],
  '📚': ['happy', { mio: 'University! I’m out of here. Mostly.' }],
  '🏠': ['calm', { mio: 'I stayed. Funny. I always wanted to leave.' }],
  '🎂': ['happy', { roth: 'Another birthday. The linden and I keep counting.' }],
  '🦯': ['tired', { roth: 'Slower now. The square got bigger.' }],
}

const MOOD_EMOTION: Record<Mood, Emotion> = { delighted: 'happy', surprised: 'surprised', bittersweet: 'tired', mixed: 'confused', disrupted: 'frustrated' }

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function line(c: City, p: Person, key: string, vars: Record<string, string | number> = {}): string {
  const set = L[key]?.[p.id] ?? L[key]?.all ?? [stageOf(p, c.year).idle]
  const tpl = set[hash(`${p.id}:${key}:${c.year}`) % set.length]
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

function thingOf(c: City, w: Work): string {
  if (w.action === 'plant_tree') return 'tree'
  if (w.action === 'preserve_trace') return 'bronze plaque'
  const target = wantProduced(w.action, c.plots[w.plot as PlotId])
  return target && target in GROUND_LABEL ? GROUND_LABEL[target as keyof typeof GROUND_LABEL] : 'thing'
}

function finishedThing(c: City, w: Work): string {
  if (w.action === 'plant_tree') return 'tree'
  if (w.action === 'preserve_trace') return 'bronze plaque'
  return GROUND_LABEL[c.plots[w.plot as PlotId].state]
}

/** What a finished work made true, read from the plot as it is now. */
function producedNow(c: City, w: Work): Want | null {
  if (w.plot === 'none') return null
  if (w.action === 'plant_tree') return 'tree'
  if (w.action === 'preserve_trace') return 'plaque'
  return c.plots[w.plot].state
}

/**
 * How one person feels about the square this year. The order of the checks is the order of what
 * weighs on a person: what just happened > their own wish under construction > someone else's site >
 * what the square has become > the plain weather of a life stage.
 */
export function feelingOf(c: City, id: CharacterId): Feeling | null {
  const p = c.people.find((x) => x.id === id)!
  if (!isPresent(p, c.year)) return null
  const f = appraise(c, p)
  // Telling a wish this year changes what they say, never yet how they feel.
  if (c.toldYear[id] === c.year && f.kind === 'thought') return { ...f, line: line(c, p, 'told') }
  return f
}

function appraise(c: City, p: Person): Feeling {
  const id = p.id
  const age = ageOf(p, c.year)
  const stage = stageOf(p, c.year)
  const speech = (emotion: Emotion, text: string): Feeling => ({ emotion, line: text, kind: 'speech' })
  const thought = (emotion: Emotion, text: string): Feeling => ({ emotion, line: text, kind: 'thought' })

  // 1. this year's events, said aloud
  const reaction = c.reactions.find((r) => r.personId === id && r.year === c.year)
  if (reaction) return speech(MOOD_EMOTION[reaction.mood], reaction.line)
  const fell = c.plots.linden.layers.some((l) => l.year === c.year && l.state === 'stump')
  if (fell) return speech(id === 'roth' ? 'tired' : 'surprised', line(c, p, 'storm'))
  const roth = c.people.find((x) => x.id === 'roth')!
  if (id !== 'roth' && roth.diedYear !== undefined && c.year >= roth.diedYear && c.year - roth.diedYear <= 1) {
    return speech('tired', line(c, p, 'grief'))
  }
  const ms = c.milestones.find((m) => m.personId === id && m.year === c.year && !m.death)
  if (ms && MILESTONE[ms.icon]?.[1][id]) return speech(MILESTONE[ms.icon][0], MILESTONE[ms.icon][1][id]!)

  // Works begun this year are not yet visible to anyone: the daemon's answers arrive late, always.
  const visible = buildingWorks(c).filter((w) => w.startYear < c.year)

  // 2. their own current wish, under construction
  const wish = currentWhisper(c, id)
  const own = visible.find((w) => wish && w.forWhispers.includes(wish.id))
  if (own) {
    const n = c.year - own.startYear
    const vars = { thing: thingOf(c, own), n: own.completionYear - own.startYear }
    const pat = patience(p, c.year)
    if (n <= pat) return thought('happy', line(c, p, 'own_hope', vars))
    if (n <= pat + 3) return thought('frustrated', line(c, p, 'own_impatient', { ...vars, n }))
    return thought('tired', line(c, p, 'own_resigned', vars))
  }

  // 3. a work still answering a wish they have outgrown
  const mine = new Set(c.whispers.filter((w) => w.personId === id && w.key !== stage.wish?.key).map((w) => w.id))
  const outgrown = visible.find((w) => w.forWhispers.some((x) => mine.has(x)))
  if (outgrown) {
    const vars = { thing: thingOf(c, outgrown), age }
    return thought(id === 'mio' && stage.stage === 'teenager' ? 'bored' : 'confused', line(c, p, 'outgrown', vars))
  }

  // 4. they told a wish in an earlier year; the daemon started something else (felt for a few years)
  const told = c.tells.filter((t) => t.personId === id && t.year < c.year).at(-1)?.year
  if (wish && told !== undefined && c.year - told <= 3) {
    const elsewhere = visible.some((w) => w.startYear >= told && !w.forWhispers.includes(wish.id))
    if (elsewhere) return thought('confused', line(c, p, 'ignored'))
  }

  // 5. someone else's building site, seen through this life
  const sites = visible
    .map((w) => ({ w, t: tasteFor(p, c.year, wantProduced(w.action, c.plots[w.plot as PlotId])) }))
    .sort((a, b) => Math.abs(b.t) - Math.abs(a.t))
  if (sites.length) {
    const { w, t } = sites[0]
    const vars = { thing: thingOf(c, w) }
    if (t > 0) return thought('happy', line(c, p, 'site_like', vars))
    if (t < 0) return thought('frustrated', line(c, p, 'site_dislike', vars))
    return thought(id === 'mio' ? 'bored' : 'calm', line(c, p, 'site_meh', vars))
  }

  // 6. what was finished recently, slowly turning into habit
  const done = [...c.works].reverse().find((w) => w.status === 'done' && w.action !== 'wait' && c.year - w.completionYear <= 4)
  if (done) {
    const since = c.year - done.completionYear
    const t = tasteFor(p, c.year, producedNow(c, done))
    const vars = { thing: finishedThing(c, done) }
    if (since === 0) return speech(t > 0 ? 'surprised' : t < 0 ? 'frustrated' : 'bored', line(c, p, t > 0 ? 'site_like' : t < 0 ? 'site_dislike' : 'completed_meh', vars))
    if (t > 0) return thought(since <= 2 ? 'happy' : 'calm', line(c, p, 'habit_like', vars))
    if (t < 0) return thought(since <= 2 ? 'frustrated' : 'bored', line(c, p, 'habit_dislike', vars))
    return thought('bored', line(c, p, 'habit_meh', vars))
  }

  return baseline(c, p)
}

/** The plain weather of a life stage, and how long an unanswered wish has been said. */
function baseline(c: City, p: Person): Feeling {
  const stage = stageOf(p, c.year)
  const wish = currentWhisper(c, p.id)
  if (wish && c.year - wish.firstHeard >= 5) {
    return { emotion: p.id === 'mio' ? 'frustrated' : 'tired', line: line(c, p, 'waiting_long', { n: c.year - wish.firstHeard }), kind: 'thought' }
  }
  const emotion: Emotion =
    stage.stage === 'teenager' ? 'bored'
      : stage.stage === 'frail' || stage.stage === 'parent' ? 'tired'
        : 'calm'
  return { emotion, line: stage.idle, kind: 'thought' }
}

/** The recorded emotions of the last `years` years, oldest first; null where they were not (yet, or any more) on the square. */
export function moodHistory(c: City, id: CharacterId, years = 8): { year: number; emotion: Emotion | null }[] {
  const out: { year: number; emotion: Emotion | null }[] = []
  for (let y = c.year - years + 1; y <= c.year; y++) {
    const rec = c.moods.find((m) => m.year === y && m.personId === id)
    out.push({ year: y, emotion: rec ? rec.emotion : null })
  }
  return out
}

/** Called once per year by the engine, after the year has happened and before the daemon thinks. */
export function recordFeelings(c: City) {
  for (const p of c.people) {
    const f = feelingOf(c, p.id)
    if (f) c.moods.push({ year: c.year, personId: p.id, emotion: f.emotion })
  }
}
