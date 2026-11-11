# Palimpsest

**Der Langsame, President of Kleiner Ilmplatz**

## Author and course

- **Author:** Bengü Nur Öz
- **Studio:** Pandaemonium: Daemons for Weimar
- **Course:** M.Sc. Digital Technologies in Architecture and Design (DTAD), WiSe 2026/27
- **Chair:** Informatics in Architecture and Urbanism (InfAU), Faculty of Architecture and Urbanism, Bauhaus-Universität Weimar
- **Teaching staff:** Reinhard König, Martin Bielik, Egor Gaydukov, Egor Gavrilov, Jan Willmann, Michael Braun, Thomas Pearce
- **Exercise:** Nonsense Project, 15.10. to 29.10.2026
- **Submission date:** 11.11.2026

## Links

- **Live demo:** https://bengunur.github.io/palimpsest-daemon-v3/
- **Source repo:** https://github.com/bengunur/palimpsest-daemon-v3
- **Miro frame:** https://miro.com/app/board/uXjVHn1RS88=/?moveToWidget=3458764689890764498
- **60-second showreel:** on the Miro frame

## The task

The Nonsense Project is the two-week, individual start of the studio. I drew one theme, a strange situation in a city where things have spirits, and one constraint, a limit on the daemon I imagined for it. With a coding agent I built a prototype that shows what my daemon would do. Sensors and AI services could be faked, as long as the result was specific and believable. A daemon is not a script, so even a fake one had to decide for itself.

## Theme and constraint

- **Theme:** People experience one city as overlapping realities.
- **Constraint:** Your daemon is slow. Nothing it does takes under a year.

## The daemon

### Concept

Der Langsame is the president of Kleiner Ilmplatz, a small invented Weimar square, and it has held office since 1871. It has three citizens. Mio, seven, wants a playground. Lena, a student, wants a quiet garden. Frau Roth, seventy-one, wants the old garden back. Each lives in a different version of the same square. The president listens to all of them, promises nothing and decides alone. Its office can only handle two projects at once and one decision a year, so many requests are met with "My hands are full." When it does act, a garden takes six to ten years. The constraint is the satire: a sincere, well-meaning government that is always busy and always late. By the opening ceremony the child is a teenager, the student a mother, and the voter who asked may no longer be alive to see it.

### Perceive, think, act

- **It perceives:** Like a president who never meets the citizens, it does not see people. It hears "whispers": needs, memories and dreams tied to places, with how often and when each was heard. It cannot see people, their faces or their ages. It only knows what they repeat.
- **It thinks:** It wants to be useful and loved, but it distrusts urgency. It values memory most and believes a need is real only once it has been heard twice: "Once is weather; twice is climate." It thinks only when something meaningful happens, then chooses one action, or waits: "I am listening. Listening takes a year, at least."
- **It acts:** It plants gardens and trees, builds courtyards and play edges, sets fading memories in bronze, or waits. Every action takes 1 to 10 years and shows as a fenced building site with a progress sign. When two works are already in the ground, it refuses a third: "My hands are full. I will not start a third thing."
- **Real or faked:** Real: the simulation, the one-year rule (enforced by one validator and tested across 25 seeds), aging and feelings, and on localhost Claude Haiku actually deciding through `claude -p`. Faked: the whispers are scripted speech rather than sensors, and the public page uses a seeded simulated daemon in place of Claude.

## One visitor

Lena is 24, has three chapters left, and has never written to a politician. Every morning she crosses Kleiner Ilmplatz to the library and asks, half out loud, for somewhere quiet to read outside. Nothing happens. She asks again the next week, and this time it counts: "Once is weather; twice is climate." A fence goes up on the old car park with an official-looking sign: garden, ready in 2033. Lena laughs at the date. She will have graduated long before. The site is loud, so she takes the long way round. When she also carries Mio's wish for a playground to the president, the answer comes back: "My hands are full. I will not start a third thing." In 2030 she throws her graduation cap on the steps, and the site is still mud. One spring, pushing a pram, she finds the fence gone: benches, beds, young trees. The promise was kept. It just arrived for someone she used to be. She sits down, amused and slightly insulted, and feels represented for the first time.

## How to use it

1. Open the live demo. You see an isometric square in 2026 with three people: Mio (the child), Lena (the student) and Frau Roth (the elderly one). The badge says SIMULATED (LIVE · haiku when run locally).
2. Click a person. The camera moves in, a bubble shows their age, feeling and wish, and a translucent vision of the wish appears on the square.
3. Click **Tell the daemon**. A card shows what it noticed, what it decided, why, and start → completion. A fenced building site appears.
4. Press **+1 year** (space) or **⏭ until it's finished**. Everyone ages while the site grows. When it finishes, people react as who they are now.

**Tips:** Click people again after years pass, because their wishes change. Keep going for decades to meet Frau Roth's empty bench. Use ◐ to see every past layer of the square and ☰ for the daemon's thoughts. Turn on the sound (♪) for a chill experience :D

## Technical implementation

- **Frontend:** React 19, TypeScript and Vite, isometric SVG and CSS generated in code, Web Audio for live-generated music.
- **Hosting:** GitHub Pages (static, free, deployed on every push by GitHub Actions). The live Claude bridge runs only on localhost because it uses the machine's own Claude login.
- **Data sources and APIs:** None on the public page. On localhost, a small Node server (127.0.0.1:8787) calls Claude Code.
- **Models while it runs:**
  - Public page: none (seeded simulated daemon).
  - Localhost: Claude Haiku through `claude -p` with no tools, safe mode and a strict JSON schema. Every decision is validated twice and labelled LIVE or SIMULATED.
- **Notable libraries:** React, Vitest (tests). No other runtime dependencies.
- **Run locally** (Node 24+, Claude Code installed and logged in):

```bash
npm install
npm run daemon   # terminal 1: local Claude bridge
npm run dev      # terminal 2: open http://127.0.0.1:5173
```

## Working with AI

- **Coding agents used:** Claude Code, model Claude Opus 5.5 (for building). Claude Haiku is the daemon's brain at runtime.
- **Key prompts** (the ones that really moved the project):
  1. "Imagine a daemon which we tell our wishes about a city, but nothing it does takes under one year. What kind of process can we do with this?"
  2. "Three different people must experience the same city differently. Their perspectives, reactions and experiences should be distinct and our president daemon should decide on its own."
  3. "I want the daemon to represent a political leader whose decisions take so long to become reality that people's lives change before anything is accomplished. By the time the leader finally acts, the child has grown up, the student has graduated, and the elderly woman has passed away. I want to emphasize how political delays can make even well-intentioned decisions arrive too late for the people who needed them."

### Reflection

The idea that unlocked everything was reading the daemon as the square's president: sincere, busy and always late. Once I wrote the constraint as non-negotiable, the agent turned it into one validator and tests, so the slowness became the structure of the joke rather than a timer. Reviewing the live page myself and asking for clickable characters turned a text dashboard into a game. The agent went sideways when it explained instead of showing, and it got stuck when the usage limit cut off the v2 build. Asking it to inspect git status and continue without restarting saved the work. Next time I would make the political satire explicit in the interface from day one, sketch the interactions on paper first, and write smaller prompts.

## Credits, assets, licenses

- **Fonts:** Fraunces, IBM Plex Mono, Caveat (Google Fonts, SIL Open Font License 1.1)
- **Data:** None. Kleiner Ilmplatz and its three people are fictional. (But the president is made with someone in mind :D)
- **Images and sounds:** The city, the products and all other visuals were generated in code (SVG/CSS) by Claude Code. Music is generated live in code with Web Audio. No external image or sound files.
- **Third-party code:** React (MIT), Vite (MIT), Vitest (MIT), TypeScript (Apache-2.0)
- **This repo:** code under MIT; text and concept under CC BY 4.0.

---

## More detail

### Three people, one square, slow feelings

Clicking someone moves the camera in (1.6×) and opens their bubble. It's a **speech bubble** when they have something to say, and a dashed **thought cloud** when they're only thinking about the square. Each bubble names their current feeling, says it in their own voice, and ends with a **mood strip**: one small face for each of the last eight years.

- **Emotions**: *calm, happy, surprised, confused, frustrated, tired, bored*. Each has its own face (eyes, brows, mouth), body language (a bounce, a stamp, a sag, a sway, a tilt, a jump) and a small floating symbol. Everyone blinks, out of step with each other. All of this switches off with the system's *reduce motion* setting.
- **One project, three realities.** [`src/sim/feelings.ts`](src/sim/feelings.ts) reads each work through each life: the person's age and stage, their *taste*, and their current wish. A playground under construction makes child Mio hopeful, student Lena frustrated by the noise, and leaves Frau Roth unmoved. As teenagers, the same Mio would roll their eyes at it.
- **Slow, like the daemon.** A decision is invisible in the year it's made, and telling a wish changes what someone *says*, never yet how they *feel*. From the next year, feelings drift with each year of building: hope → impatience → giving up, at each person's own patience. Children have none; Frau Roth has had practice. A finished work is a surprise or a disappointment, then turns into habit over the next years (*"I sit in the garden on Tuesdays now"*, *"I walk the long way round"*).
- Feelings are **derived from the city and never feed back into it**. They use no randomness, so seeds, the daemon's decisions and the one-year rule are unchanged. All dialogue is scripted. No feeling ever calls an AI.

#### Music

A slightly drunk music box over a breathing accordion, in 7/8. It's generated live with Web Audio, so there are no files and no network requests. It starts at the first click on the page (browsers require this), at 30% volume, and the **♪** button and slider in the top bar control it (remembered per browser). The music follows the city slowly. Building sites add a clank that grows with every year of work. A finished work resolves the tune once to its home chord. When Frau Roth dies, the low voice that walked beneath the tune stops for good.

### The daemon in detail

- **Character.** It is sincere, stubborn and extremely slow, and it believes that long memory outweighs short-term satisfaction. Its core belief: *a need is real only once it has been heard repeatedly. Once is weather; twice is climate.*
- **Perception.** It does not see people. It perceives *whispers* (needs, memories and dreams attached to plots), each with how often it has been heard, when it was first and last heard, and from which reality it came. It also sees each plot's state and history, and its own unfinished works.
- **Motives.** It weighs **memory 0.40 · use 0.25 · play 0.20 · stillness 0.15**. The weights drift: when its works arrive too late for the people who asked, it comes to trust memory more and usefulness less.
- **Contradictions.** It dislikes erasing anything, yet everything it builds becomes a layer it then protects. Forgetting is the only thing that hurries it: when someone who remembers falls silent, it rushes, slowly, to set the memory in bronze. It cannot un-make things, so requests like "bring back the car park" are answered with years of waiting.
- **Limits.** It tends at most 2 works at once and makes at most one decision per year. It thinks only when something meaningful happens: a wish is told, a work finishes, someone dies, or four quiet years pass with something unanswered. A told wish counts as heard twice, so it is louder, but it is not binding.

#### Allowed actions

| action | effect | years |
|---|---|---|
| `plant_garden` | stone → garden | 6–10 |
| `establish_shared_courtyard` | tables, benches, pergola | 5–8 |
| `add_play_space` | play space; on a garden, a play *edge* that keeps the garden | 5–9 |
| `preserve_trace` | sets a memory into bronze, so it survives the people who held it | 1–3 |
| `plant_tree` | a sapling now; shade after ~8 years | 1–2 |
| `wait` | listen. Even this takes at least a year. | 1–4 |

#### How the one-year minimum is enforced

1. Every action in [`shared/actions.ts`](shared/actions.ts) has a hard `minYears ≥ 1`.
2. `validateDecision()` is the single gatekeeper for **every** decision, simulated or AI. It rejects unknown actions, incompatible or busy plots and over-capacity requests, and clamps the duration to the action's range. If the brain asks for less, the ledger says so: *"The daemon asked for 0 years. The city does not permit this. Corrected to 6."*
3. `startYear` is always the city's current year and `completionYear = startYear + duration`. Neither can come from the brain.
4. Only `advanceYear()` changes the physical city, and only when `year ≥ completionYear`. Between those years the plot shows fences, earthworks and a translucent future.
5. Unit tests (`npm test`) check all of this across 25 seeds.

### Live daemon (local only)

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

#### Simulated vs. real AI

| | where | label |
|---|---|---|
| **Live daemon**: Claude decides | localhost with `npm run daemon` | `LIVE · claude-…` (green) |
| **Simulated daemon**: a deterministic, seeded utility policy ([`src/sim/policy.ts`](src/sim/policy.ts)) that scores whispers with the daemon's weights | public site, the demo, or no local server | `SIMULATED` |
| **Fallback**: the simulated policy standing in for an unreachable or refused Claude | localhost | `SIMULATED · fallback` |

The public GitHub Pages build never calls any API. Live mode is attempted only when the page's hostname is `localhost`, `127.0.0.1` or `[::1]`.

### Demo run (≈60 s, play it yourself)

1. **2026.** Click **Mio** (yellow, by the fountain). *"I wish there was a playground here!"* A yellow, translucent playground shimmers over the car park: imagined, not built.
2. **Tell the daemon.** The card shows what it noticed, what it decided, why, and **2026 → 2033/34**. A fenced site with a progress sign appears on the square.
3. **⏭ until it's finished.** Year by year, Mio grows from a raincoat into a hoodie with headphones. Lena tosses her cap (2030). Frau Roth stoops lower.
4. **Completion.** The site becomes a playground. Mio, now a teenager: *"I don't play here anymore. I wish it had been here when I was little."*
5. **Click Mio again.** 15, a teenager, with a new wish: *"Somewhere to sit with friends at night."*

For the AI in Design recording, run the same loop locally with `npm run daemon`. In testing, Claude (haiku) heard Mio's told wish and chose its own compromise: a 6-year garden on the West Bed with *"a play edge can follow"*. The simulated policy did not choose that, which shows the decisions are Claude's own.

### Project structure

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

React 19 + Vite + TypeScript. All visuals are SVG and CSS written in code. There are no other runtime dependencies.

```bash
npm test          # one-year rule, validator, aging, delayed completion, evolving wishes, agency, feelings, render
npm run build     # production build (GITHUB_PAGES=1 for the Pages base path)
```

### Course mapping

- **Nonsense Project.** Theme: *people experience one city as overlapping realities*. Three characters project their own imagined realities as translucent visions onto the same physical plots. Constraint: *the daemon is slow; nothing it does takes under a year*. This is enforced in the validator, the engine and the tests, and made visible by building sites with progress signs, characters visibly aging during the wait, and reactions shaped by who each person has become.
- **AI in Design, HW2.** The local `claude -p` endpoint uses the required flags and a strict JSON schema, with a system prompt defining motives, perception, limits and personality. Every decision is validated twice, the model thinks only on meaningful events, its reasoning is shown on a decision card and in the history drawer, and simulated decisions are clearly labelled.
