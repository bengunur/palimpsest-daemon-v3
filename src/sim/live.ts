// Live (Claude) thinking exists only on localhost. The public build never calls any API.
export const IS_LOCAL = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)

export interface LiveStatus { available: boolean; model?: string; reason?: string }

export async function probeLive(): Promise<LiveStatus> {
  if (!IS_LOCAL) return { available: false, reason: 'public page' }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    const r = await fetch('/api/health', { signal: ctrl.signal })
    clearTimeout(t)
    if (!r.ok) return { available: false, reason: `server answered ${r.status}` }
    const j = (await r.json()) as { ok: boolean; model?: string }
    return j.ok ? { available: true, model: j.model } : { available: false, reason: 'server not ready' }
  } catch {
    return { available: false, reason: 'local daemon server not running (npm run daemon)' }
  }
}
