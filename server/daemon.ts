// Local-only AI endpoint for the daemon. Run with:  npm run daemon   (Node 24+ runs .ts directly)
//
// It receives a city snapshot from the browser, asks Claude Code (`claude -p`) for ONE decision
// constrained by a JSON schema, validates it with the same rules as the browser, and returns it.
// It binds to 127.0.0.1 only, never uses a shell, never exposes credentials (the CLI uses the
// machine's own login), and gives the model no tools.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { DECISION_SCHEMA, PLOT_IDS, validateDecision } from '../shared/actions.ts'
import type { PlotId, PlotState, ValidationContext } from '../shared/actions.ts'

const HOST = '127.0.0.1'
const PORT = Number(process.env.DAEMON_PORT ?? 8787)
const MODEL = process.env.DAEMON_MODEL ?? 'haiku'
const CLAUDE = process.env.CLAUDE_BIN ?? 'claude'
const TIMEOUT_MS = 60_000
const MAX_BODY = 16_384
const SYSTEM_PROMPT = readFileSync(new URL('./daemon-prompt.md', import.meta.url), 'utf8')
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

let busy = false
let cliVersion: string | null = null

function claudeArgs() {
  return [
    '-p',
    '--safe-mode',
    '--tools', '',
    '--model', MODEL,
    '--effort', 'low',
    '--output-format', 'json',
    '--no-session-persistence',
    '--json-schema', JSON.stringify(DECISION_SCHEMA),
    '--system-prompt', SYSTEM_PROMPT,
  ]
}

interface ClaudeResult { structured: unknown; model?: string; ms: number; costUsd?: number }

function runClaude(prompt: string): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    // no shell: arguments are passed as an array, so nothing in them is interpreted
    const child = spawn(CLAUDE, claudeArgs(), { cwd: tmpdir(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error(`claude timed out after ${TIMEOUT_MS / 1000}s`)) }, TIMEOUT_MS)
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code) => {
      clearTimeout(timer)
      try {
        const j = JSON.parse(out)
        if (j.is_error || code !== 0) return reject(new Error(`claude reported an error: ${j.result ?? j.subtype ?? code}`))
        if (j.structured_output === undefined) return reject(new Error('claude returned no structured_output'))
        resolve({
          structured: j.structured_output,
          model: j.modelUsage ? Object.keys(j.modelUsage)[0] : MODEL,
          ms: Date.now() - started,
          costUsd: j.total_cost_usd,
        })
      } catch {
        reject(new Error(`could not parse claude output (exit ${code}): ${(err || out).slice(0, 300)}`))
      }
    })
    child.stdin.end(prompt)
  })
}

/** Accept only a snapshot of the expected shape; derive the validation context from it. */
function readSnapshot(body: unknown): { snapshot: Record<string, unknown>; ctx: ValidationContext } | string {
  if (!body || typeof body !== 'object') return 'body must be an object'
  const snapshot = (body as { snapshot?: unknown }).snapshot as Record<string, unknown> | undefined
  if (!snapshot || typeof snapshot !== 'object') return 'missing snapshot'
  const year = snapshot.year
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 2026 || year > 2100) return 'bad year'
  const plots = snapshot.plots
  if (!Array.isArray(plots) || plots.length !== PLOT_IDS.length) return 'bad plots'
  const ctxPlots: ValidationContext['plots'] = []
  for (const p of plots as Record<string, unknown>[]) {
    if (!PLOT_IDS.includes(p?.id as PlotId) || typeof p.state !== 'string') return 'bad plot entry'
    ctxPlots.push({ id: p.id as PlotId, state: p.state as PlotState, busy: !!p.underConstruction })
  }
  const building = (snapshot.capacity as { building?: unknown } | undefined)?.building
  if (typeof building !== 'number') return 'bad capacity'
  return { snapshot, ctx: { year, plots: ctxPlots, building } }
}

function prompt(snapshot: Record<string, unknown>) {
  return [
    `It is ${snapshot.year}. Something has stirred you: ${Array.isArray(snapshot.why) ? snapshot.why.join('; ') : 'time passed'}.`,
    'This is what you perceive of Kleiner Ilmplatz (JSON):',
    JSON.stringify(snapshot),
    'Choose exactly one action from allowedActions, on one of its validPlots, with a duration between its minYears and maxYears.',
  ].join('\n\n')
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) reject(new Error('body too large')) // keep draining, answer 413
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && !LOCAL_ORIGIN.test(origin)) return send(res, 403, { ok: false, error: 'local origins only' })

  if (req.method === 'GET' && req.url === '/api/health') {
    return send(res, cliVersion ? 200 : 503, { ok: !!cliVersion, model: MODEL, cli: cliVersion, busy })
  }

  if (req.method === 'POST' && req.url === '/api/daemon/decide') {
    if (!String(req.headers['content-type']).startsWith('application/json')) return send(res, 415, { ok: false, error: 'json only' })
    if (busy) return send(res, 429, { ok: false, error: 'the daemon is already deliberating' })
    busy = true
    try {
      const parsed = readSnapshot(JSON.parse(await readBody(req)))
      if (typeof parsed === 'string') return send(res, 400, { ok: false, error: parsed })
      const result = await runClaude(prompt(parsed.snapshot))
      const v = validateDecision(result.structured, parsed.ctx)
      const raw = result.structured as Record<string, unknown>
      console.log(`[${parsed.ctx.year}] ${result.model} ${result.ms}ms → ${raw.action} @ ${raw.plotId} for ${raw.durationYears}y ${v.ok ? '✓' : `✗ ${v.errors.join('; ')}`}`)
      if (!v.ok) return send(res, 200, { ok: false, raw: result.structured, errors: v.errors, model: result.model })
      // the browser re-validates `raw` against its own state before applying anything
      return send(res, 200, { ok: true, raw: result.structured, model: result.model, ms: result.ms, notes: v.notes })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('decide failed:', msg)
      const status = msg === 'body too large' ? 413 : e instanceof SyntaxError ? 400 : 502
      return send(res, status, { ok: false, error: msg })
    } finally {
      busy = false
    }
  }

  send(res, 404, { ok: false, error: 'not found' })
})

function checkCli() {
  const child = spawn(CLAUDE, ['--version'], { shell: false, windowsHide: true })
  let out = ''
  child.stdout.on('data', (d) => { out += d })
  child.on('error', () => { console.error(`Could not run "${CLAUDE}". Install Claude Code or set CLAUDE_BIN.`) })
  child.on('close', (code) => {
    if (code === 0) { cliVersion = out.trim(); console.log(`claude CLI: ${cliVersion}`) }
  })
}

checkCli()
server.listen(PORT, HOST, () => {
  console.log(`Der Langsame is listening on http://${HOST}:${PORT} (model: ${MODEL}, local only)`)
})
