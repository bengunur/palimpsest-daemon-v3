# PALIMPSEST — The City That Is Always Too Late

*A design-research prototype for Bauhaus-Universität Weimar.*

One small public square, **Kleiner Ilmplatz** (a fictional, Weimar-inspired square), is lived in by people who experience it as different, overlapping realities. A resident remembers a lost garden, a student needs somewhere quiet to read, and a child sees a volcano where there is a fountain.

An invisible urban daemon, **Der Langsame** ("the Slow One"), listens to the square, remembers it, and decides on its own how to change it. **Nothing it does takes under a year.** By the time a decision becomes stone and soil, the person who asked for it has often graduated, moved away or died. Over time the square becomes a palimpsest of delayed answers to past realities.

**Public demo:** https://bengunur.github.io/palimpsest-daemon/ (simulated daemon; see [Live daemon](#live-daemon-local-only))

---

## How to play (2 minutes)

| | |
|---|---|
| **Lenses** (keys `1`–`5`) | The *same* square read five ways. **Ground** shows only the physical square. **Memory** (the Resident) shows former states as sepia ghosts, plus what the old remember. **Present** (the Student) shows usefulness: shade, seats, heat. **Possibility** (the Child) shows what every surface could be. **Palimpsest** lifts every historical layer at once, like sheets of tracing paper. |
| **Hover / click a plot** | The inspector shows how the current lens reads the plot, its layer history, and the whispers attached to it. |
| **Carry a whisper** | Your one act of participation: once per year you can repeat a whisper to the daemon so it counts as heard once more. You cannot build anything. |
| **+1 year** (`space`) | Time moves forward one discrete year. Advancing time lets you *observe the future*; it never makes the daemon faster. |
| **until something finishes** | Plays years forward until a work is completed. |
| **▶ 45-second demo** | A self-running scenario (seed 7, simulated daemon). |
| **new city / restart** | Each seed varies when people arrive and leave, so the daemon's timing collides with different lives. |

The **ledger** on the right records every decision: what the daemon **noticed**, what it **decided**, **why**, the **start year**, the **completion year** and its **duration**, plus one line in its own voice. Completions note who is still there to see the result; when nobody is left, they are stamped **TOO LATE**. The **timeline** at the bottom shows every work as a bar from start to completion, so slowness is always on screen.

## The daemon

- **Character.** It is sincere, stubborn and extremely slow, and it believes that long memory outweighs short-term satisfaction. Its core belief: *a need is real only once it has been heard repeatedly. Once is weather; twice is climate.*
- **Perception.** It does not see people. It perceives *whispers* (needs, memories and dreams attached to plots), each with how often it has been heard, when it was first and last heard, and from which reality it came. It also sees each plot's state and history, and its own unfinished works.
- **Motives.** It weighs **memory 0.40 · use 0.25 · play 0.20 · stillness 0.15**. The weights drift: when its works arrive too late for the people who asked, it comes to trust memory more and usefulness less.
- **Contradictions.** It dislikes erasing anything, yet everything it builds becomes a layer it then protects. Forgetting is the only thing that hurries it: when someone who remembers falls silent, it rushes, slowly, to set the memory in bronze. It cannot un-make things, so requests like "bring back the car park" are answered with years of waiting.
- **Limits.** It tends at most 2 works at once and makes at most one decision per year. It thinks only when something meaningful happens: a new whisper, a work finishing, someone leaving, a carried whisper, or four quiet years.

### Allowed actions

| action | effect | years |
|---|---|---|
| `plant_garden` | stone → garden | 4–8 |
| `establish_shared_courtyard` | tables, benches, pergola | 3–6 |
| `add_play_space` | play space; on a garden, a play *edge* that keeps the garden | 2–4 |
| `preserve_trace` | sets a memory into bronze, so it survives the people who held it | 1–3 |
| `plant_tree` | a sapling now; shade after ~8 years | 1–2 |
| `wait` | listen. Even this takes at least a year. | 1–4 |

### How the one-year minimum is enforced

1. Every action in [`shared/actions.ts`](shared/actions.ts) has a hard `minYears ≥ 1`.
2. `validateDecision()` is the single gatekeeper for **every** decision, simulated or AI. It rejects unknown actions, incompatible or busy plots and over-capacity requests, and clamps the duration to the action's range. If the brain asks for less, the ledger says so: *"The daemon asked for 0 years. The city does not permit this. Corrected to 4."*
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

## Demo scenario (≈45 s, `▶ 45-second demo`)

1. **2026, Ground.** The bare square. *"A daemon is listening. Nothing it does takes under a year."*
2. **Lens sweep.** In *Memory*, the sepia ghost of the 1902 garden, paved over in 1979, and Frau Roth: *"My mother grew beans here."* In *Present*, Lena (24): *"Nowhere quiet to read."* In *Possibility*, Mio (7): *"The fountain is a volcano."*
3. **The daemon decides.** It **noticed** that a memory and a need point at the same soil. It **decided** to plant a garden on the West Bed, **because** "two realities ask for the same soil". The work runs **2026 → 2033 (7 years)**, and a bar appears on the timeline.
4. **Years tick.** Fence, earthworks and a translucent garden appear. 2029: *Lena graduated and moved to Leipzig.* 2031: a family arrives, and the child asks for a playground.
5. **2033: the garden opens.** Lena is gone; Frau Roth is still here. The Memory lens now shows the 1979 paving as the ghost under the new garden, and the Possibility lens reads it as a jungle.
6. **Fast-forward to 2058, Palimpsest lens.** Every layer of every plot is lifted at once: *"Everything it built was for someone who had already left. That is what a city is."*

For the AI in Design recording, run the same square locally with `npm run daemon`. Live entries appear with green **LIVE** badges and Claude's own reasoning. In testing, haiku chose to *wait* in 2026 ("once is weather"), unlike the simulated policy, which shows the decisions are its own.

## Project structure

```
shared/actions.ts        the daemon's vocabulary, JSON schema, validateDecision() — used by browser AND server
src/sim/                 engine (years, works, whispers), world (plots, cast), policy (simulated daemon),
                         interpret (lenses), snapshot (for Claude), daemon (live/sim orchestration), tests
src/components/          Scene (isometric SVG), Art (plot drawings), Ledger, Timeline, Inspector
server/daemon.ts         local-only Claude bridge;  server/daemon-prompt.md  the daemon's system prompt
```

React 19 + Vite + TypeScript, with hand-drawn SVG and CSS. There are no other runtime dependencies.

```bash
npm test          # one-year rule, validator, determinism
npm run build     # production build (GITHUB_PAGES=1 for the Pages base path)
```

## Course mapping

- **Nonsense Project.** Theme: *people experience one city as overlapping realities*. The same plot geometry is read by five lenses. Constraint: *the daemon is slow; nothing it does takes under a year*. This is enforced in the validator, the engine and the tests, and made visible by construction stages, the Gantt timeline and TOO LATE completions.
- **AI in Design, HW2.** The local `claude -p` endpoint uses the required flags and a strict JSON schema, with a system prompt defining motives, perception, limits and personality. Every decision is validated twice, the model thinks only on meaningful events, its reasoning is shown in the ledger, and simulated decisions are clearly labelled.
