# PALIMPSEST — The City That Is Always Too Late

*A design-research prototype for Bauhaus-Universität Weimar.*

One small public square, **Kleiner Ilmplatz** (a fictional, Weimar-inspired square), is shared by three people who see it as different, overlapping realities. **Mio** (7, yellow raincoat) wants a playground. **Lena** (24, blue backpack) wants a quiet study garden. **Frau Roth** (71, brown coat and cane) wants the old garden back.

An invisible urban daemon, **Der Langsame** ("the Slow One"), listens to the square, remembers it, and decides on its own how to change it. **Nothing it does takes under a year.** By the time a decision becomes stone and soil, the person who asked for it has often graduated, moved away or died. Over time the square becomes a palimpsest of delayed answers to past realities.

**Public demo:** https://bengunur.github.io/palimpsest-daemon-v3/ (simulated daemon; see [Live daemon](#live-daemon-local-only))

*Version 3 of [palimpsest-daemon](https://github.com/bengunur/palimpsest-daemon): the same city and daemon, now with feelings, faces, a focus camera and music (see [Three people, one square, slow feelings](#three-people-one-square-slow-feelings)).*

---

## How to play

**Click a person. Hear a wish. Watch the city answer years too late.**

1. **Discover a wish.** Click Mio, Lena or Frau Roth. A speech bubble shows their age, their current wish, and a translucent *vision* of that wish drawn onto the real square. The vision is imagined, not built.
2. **Tell the daemon.** You carry the wish to the daemon, but you can't dictate what it does. It may build the wish, choose a compromise that serves several people, preserve a fading memory, or wait. A card shows what it **noticed**, what it **decided**, **why**, and **start → completion**.
3. **Wait years.** Use **+1 year** (or `space`), or **⏭ until it's finished**, which plays every year one at a time. A fenced building site with a progress sign grows on the square. Meanwhile lives move on:
   - Mio grows taller every year, from a raincoat to a hoodie and headphones.
   - Lena graduates in 2030 (cap toss), starts work, then has a baby.
   - Frau Roth stoops lower and moves more slowly.
4. **See the consequence.** When the work is finished, the people react according to who they are *now*. *"I don't play here anymore. I wish it had been here when I was little."*
5. **Discover what changed.** Click them again: new age, new wish.

Frau Roth's life ends through an aging system (a seeded mortality chance from age 80), never because a project finished. She fades gently under the linden, and her empty bench, hat and a candle remain. Her garden wish stays in the daemon's memory.

**◐** lifts every historical layer of the square like tracing paper. **☰ The daemon's thoughts** opens the full decision history.

## Three people, one square, slow feelings

Clicking someone moves the camera in (1.6×) and opens their bubble. It's a **speech bubble** when they have something to say, and a dashed **thought cloud** when they're only thinking about the square. Each bubble names their current feeling, says it in their own voice, and ends with a **mood strip**: one small face for each of the last eight years.

- **Emotions**: *calm, happy, surprised, confused, frustrated, tired, bored*. Each has its own face (eyes, brows, mouth), body language (a bounce, a stamp, a sag, a sway, a tilt, a jump) and a small floating symbol. Everyone blinks, out of step with each other. All of this switches off with the system's *reduce motion* setting.
- **One project, three realities.** [`src/sim/feelings.ts`](src/sim/feelings.ts) reads each work through each life: the person's age and stage, their *taste*, and their current wish. A playground under construction makes child Mio hopeful, student Lena frustrated by the noise, and leaves Frau Roth unmoved. As teenagers, the same Mio would roll their eyes at it.
- **Slow, like the daemon.** A decision is invisible in the year it's made, and telling a wish changes what someone *says*, never yet how they *feel*. From the next year, feelings drift with each year of building: hope → impatience → giving up, at each person's own patience. Children have none; Frau Roth has had practice. A finished work is a surprise or a disappointment, then turns into habit over the next years (*"I sit in the garden on Tuesdays now"*, *"I walk the long way round"*).
- Feelings are **derived from the city and never feed back into it**. They use no randomness, so seeds, the daemon's decisions and the one-year rule are unchanged. All dialogue is scripted. No feeling ever calls an AI.

### Music

A slightly drunk music box over a breathing accordion, in 7/8. It's generated live with Web Audio, so there are no files and no network requests. It starts at the first click on the page (browsers require this), at 30% volume, and the **♪** button and slider in the top bar control it (remembered per browser). The music follows the city slowly. Building sites add a clank that grows with every year of work. A finished work resolves the tune once to its home chord. When Frau Roth dies, the low voice that walked beneath the tune stops for good.

## The daemon

- **Character.** It is sincere, stubborn and extremely slow, and it believes that long memory outweighs short-term satisfaction. Its core belief: *a need is real only once it has been heard repeatedly. Once is weather; twice is climate.*
- **Perception.** It does not see people. It perceives *whispers* (needs, memories and dreams attached to plots), each with how often it has been heard, when it was first and last heard, and from which reality it came. It also sees each plot's state and history, and its own unfinished works.
- **Motives.** It weighs **memory 0.40 · use 0.25 · play 0.20 · stillness 0.15**. The weights drift: when its works arrive too late for the people who asked, it comes to trust memory more and usefulness less.
- **Contradictions.** It dislikes erasing anything, yet everything it builds becomes a layer it then protects. Forgetting is the only thing that hurries it: when someone who remembers falls silent, it rushes, slowly, to set the memory in bronze. It cannot un-make things, so requests like "bring back the car park" are answered with years of waiting.
- **Limits.** It tends at most 2 works at once and makes at most one decision per year. It thinks only when something meaningful happens: a wish is told, a work finishes, someone dies, or four quiet years pass with something unanswered. A told wish counts as heard twice, so it is louder, but it is not binding.

### Allowed actions

| action | effect | years |
|---|---|---|
| `plant_garden` | stone → garden | 6–10 |
| `establish_shared_courtyard` | tables, benches, pergola | 5–8 |
| `add_play_space` | play space; on a garden, a play *edge* that keeps the garden | 5–9 |
| `preserve_trace` | sets a memory into bronze, so it survives the people who held it | 1–3 |
| `plant_tree` | a sapling now; shade after ~8 years | 1–2 |
| `wait` | listen. Even this takes at least a year. | 1–4 |

### How the one-year minimum is enforced

1. Every action in [`shared/actions.ts`](shared/actions.ts) has a hard `minYears ≥ 1`.
2. `validateDecision()` is the single gatekeeper for **every** decision, simulated or AI. It rejects unknown actions, incompatible or busy plots and over-capacity requests, and clamps the duration to the action's range. If the brain asks for less, the ledger says so: *"The daemon asked for 0 years. The city does not permit this. Corrected to 6."*
3. `startYear` is always the city's current year and `completionYear = startYear + duration`. Neither can come from the brain.
4. Only `advanceYear()` changes the physical city, and only when `year ≥ completionYear`. Between those years the plot shows fences, earthworks and a translucent future.
5. Unit tests (`npm test`) check all of this across 25 seeds.

## Live daemon (local only)

*This section covers AI in Design, Homework 2.*

On localhost, the daemon's decisions are made by **Claude**, through Claude Code in print mode, via a small local server:

```
Browser (localhost:5173) ── POST /api/daemon/decide ──▶ Vite proxy ──▶ server/daemon.ts (127.0.0.1:8787)
                                                                         │ checks snapshot shape, size, origin
                                                                         │ spawn (no shell): claude -p … < prompt
                                                                         ▼
   claude -p --safe-mode --tools "" --model haiku --effort low --output-format json
            --no-session-persistence --json-schema <DecisionSchema> --system-prompt <daemon-prompt.md>
                                                                         │ structured_output → validateDecision()
Browser ◀────────────── { raw decision, model } ─────────────────────────┘
   re-validates against its own state → applies → ledger entry badged "LIVE · claude-haiku-…"
```

- **Snapshot** ([`src/sim/snapshot.ts`](src/sim/snapshot.ts)): about 3 KB of JSON containing the year, why the daemon was stirred, plots with state and history, works in progress, the top 8 open whispers with heard-counts, its last 4 decisions, its weights, and **the allowed actions with their valid plots and min/max years**.
- **Output schema** (`DECISION_SCHEMA`): `{ noticed, action (enum), plotId (enum), durationYears (integer), reason, utterance }`. The model can only choose; it cannot execute anything. Its text is rendered as text, never as code.
- **System prompt** ([`server/daemon-prompt.md`](server/daemon-prompt.md)): the daemon's motives, perception, limits and voice.
- **Validated twice**: on the server against the snapshot, and in the browser against the real city state. If Claude proposes something invalid, the city records a **refusal** and the simulated policy stands in, labelled `SIMULATED · fallback`. If the server is unreachable or times out, the fallback is labelled the same way, with the reason.
- **Safety**: the server binds to `127.0.0.1` and rejects non-local `Origin`s and non-JSON bodies. Bodies are capped at 16 KB, requests run one at a time with a 60 s timeout, and the model has no tools (`--tools ""`) and no customizations (`--safe-mode`). **No API keys exist in this project**: the CLI uses the local machine's own Claude login, and nothing secret is in the repo.

### Run it locally

Requires **Node 24+** (the server is TypeScript run directly by Node) and **Claude Code** installed and logged in (`claude --version`). Tested with Claude Code 2.1.311.

```bash
npm install
npm run daemon     # terminal 1: the local Claude bridge on 127.0.0.1:8787
npm run dev        # terminal 2: open http://127.0.0.1:5173
```

The header shows **LIVE · haiku** when the bridge is found. You can switch back to the simulated daemon at any time. Environment overrides: `DAEMON_MODEL`, `DAEMON_PORT`, `CLAUDE_BIN`.

### Simulated vs. real AI

| | where | label |
|---|---|---|
| **Live daemon**: Claude decides | localhost with `npm run daemon` | `LIVE · claude-…` (green) |
| **Simulated daemon**: a deterministic, seeded utility policy ([`src/sim/policy.ts`](src/sim/policy.ts)) that scores whispers with the daemon's weights | public site, the demo, or no local server | `SIMULATED` |
| **Fallback**: the simulated policy standing in for an unreachable or refused Claude | localhost | `SIMULATED · fallback` |

The public GitHub Pages build never calls any API. Live mode is attempted only when the page's hostname is `localhost`, `127.0.0.1` or `[::1]`.

## Demo run (≈60 s, play it yourself)

1. **2026.** Click **Mio** (yellow, by the fountain). *"I wish there was a playground here!"* A yellow, translucent playground shimmers over the car park: imagined, not built.
2. **Tell the daemon.** The card shows what it noticed, what it decided, why, and **2026 → 2033/34**. A fenced site with a progress sign appears on the square.
3. **⏭ until it's finished.** Year by year, Mio grows from a raincoat into a hoodie with headphones. Lena tosses her cap (2030). Frau Roth stoops lower.
4. **Completion.** The site becomes a playground. Mio, now a teenager: *"I don't play here anymore. I wish it had been here when I was little."*
5. **Click Mio again.** 15, a teenager, with a new wish: *"Somewhere to sit with friends at night."*

For the AI in Design recording, run the same loop locally with `npm run daemon`. In testing, Claude (haiku) heard Mio's told wish and chose its own compromise: a 6-year garden on the West Bed with *"a play edge can follow"*. The simulated policy did not choose that, which shows the decisions are Claude's own.

## Project structure

```
shared/actions.ts        the daemon's vocabulary, JSON schema, validateDecision() — used by browser AND server
src/sim/                 engine (years, works, whispers, life events, reactions), world (plots, the three characters),
                         feelings (emotions, perspective lines, mood history),
                         policy (simulated daemon), visions, snapshot (for Claude), daemon (live/sim), tests
src/components/          Scene (isometric SVG), Character (age-driven SVG people), Art, Hud (bubble, decision card,
                         year pill, drawer), Ledger, render smoke test
src/audio/music.ts       the generated soundtrack (Web Audio)
server/daemon.ts         local-only Claude bridge;  server/daemon-prompt.md  the daemon's system prompt
```

React 19 + Vite + TypeScript, with hand-drawn SVG and CSS. There are no other runtime dependencies.

```bash
npm test          # one-year rule, validator, aging, delayed completion, evolving wishes, agency, feelings, render
npm run build     # production build (GITHUB_PAGES=1 for the Pages base path)
```

## Course mapping

- **Nonsense Project.** Theme: *people experience one city as overlapping realities*. Three characters project their own imagined realities as translucent visions onto the same physical plots. Constraint: *the daemon is slow; nothing it does takes under a year*. This is enforced in the validator, the engine and the tests, and made visible by building sites with progress signs, characters visibly aging during the wait, and reactions shaped by who each person has become.
- **AI in Design, HW2.** The local `claude -p` endpoint uses the required flags and a strict JSON schema, with a system prompt defining motives, perception, limits and personality. Every decision is validated twice, the model thinks only on meaningful events, its reasoning is shown on a decision card and in the history drawer, and simulated decisions are clearly labelled.
