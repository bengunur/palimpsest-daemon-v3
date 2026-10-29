// The square's music: a slightly drunk music box over an accordion that breathes, in 7/8.
// Generated in the browser with Web Audio — no files, no network, nothing to license.
//
// It follows the city slowly, like everything else here:
//   · building sites add a clank that grows a little louder with every year of work
//   · a finished work resolves the tune to its home chord, once, at the next bar
//   · when Frau Roth dies, the low voice that walked beneath the tune stops, for good
// Nothing here runs until the visitor has touched the page (browsers require it).

const EIGHTH = 0.34 // seconds; seven of them make a bar
const BAR = 7
const ROOT = 293.66 // D4
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
/** The drone's chord roots, two bars each, in semitones from D: i – VII – IV – i */
const PROGRESSION = [0, -2, 5, 0]

const hz = (semi: number) => ROOT * 2 ** (semi / 12)
const degree = (d: number) => DORIAN[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7)

export interface MusicWorld {
  /** 0–1: how loud the building sites are, grown year by year */
  clank: number
  /** Frau Roth's voice in the music */
  rothAlive: boolean
}

class Music {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private boxBus!: GainNode
  private clankBus!: GainNode
  private bassBus!: GainNode
  private drone: OscillatorNode[] = []
  private nextTime = 0
  private step = 0
  private phrase: number[] = []
  private seed = 11
  private volume = 0.3
  private muted = false
  private clank = 0
  private rothAlive = true
  private resolve = false

  get started() { return this.ctx !== null }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return
    if (!this.ctx) this.build()
    if (!this.muted) void this.ctx!.resume()
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    this.applyGain()
  }

  setMuted(m: boolean) {
    this.muted = m
    this.applyGain()
    if (!this.ctx) return
    // a muted square costs nothing: the clock stops, and resumes where it was
    if (m) setTimeout(() => { if (this.muted) void this.ctx?.suspend() }, 400)
    else void this.ctx.resume()
  }

  setWorld(w: MusicWorld) {
    this.clank = Math.max(0, Math.min(1, w.clank))
    if (this.ctx) this.clankBus.gain.setTargetAtTime(0.5 * this.clank, this.ctx.currentTime, 3)
    // her voice fades over seconds when she dies; a restarted city brings it back
    if (this.ctx && w.rothAlive !== this.rothAlive) this.bassBus.gain.setTargetAtTime(w.rothAlive ? 1 : 0, this.ctx.currentTime, w.rothAlive ? 1 : 4)
    this.rothAlive = w.rothAlive
  }

  /** A work was finished: come home at the next bar. */
  cadence() { this.resolve = true }

  // ── internals ───────────────────────────────────────────────────────────────

  private applyGain() {
    if (!this.ctx) return
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.5, this.ctx.currentTime, 0.15)
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  private build() {
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    this.boxBus = this.bus(0.9)
    this.clankBus = this.bus(0.5 * this.clank)
    this.bassBus = this.bus(this.rothAlive ? 1 : 0)

    // the accordion: two detuned saws through a soft filter, its bellows breathing slower than anyone
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 620
    const bellows = ctx.createGain()
    bellows.gain.value = 0.045
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.11
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 0.02
    lfo.connect(lfoDepth).connect(bellows.gain)
    lfo.start()
    for (const [semi, cents] of [[-12, -7], [-5, 6]] as const) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(semi)
      o.detune.value = cents
      o.connect(filter)
      o.start()
      this.drone.push(o)
    }
    filter.connect(bellows).connect(this.master)

    this.applyGain()
    this.nextTime = ctx.currentTime + 0.1
    window.setInterval(() => this.schedule(), 60)
  }

  private bus(gain: number) {
    const g = this.ctx!.createGain()
    g.gain.value = gain
    g.connect(this.master)
    return g
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    // after a long sleep (a hidden tab), don't play the missed notes all at once
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime)
      this.nextTime += EIGHTH * (1 + (this.rand() - 0.5) * 0.04) // a little rubato, as if wound by hand
      this.step++
    }
  }

  private playStep(step: number, t: number) {
    const bar = Math.floor(step / BAR)
    const pos = step % BAR
    const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length]

    if (pos === 0) {
      if (bar % 8 === 0) this.compose()
      for (const [i, o] of this.drone.entries()) o.frequency.setTargetAtTime(hz(chord + (i ? -5 : -12)), t, 0.4)
      if (this.resolve) {
        this.resolve = false
        for (const o of this.drone) o.frequency.setTargetAtTime(hz(o === this.drone[0] ? -12 : -5), t, 0.2)
        ;[0, 3, 7, 12].forEach((s, i) => this.pluck(hz(s), t + i * EIGHTH * 0.5, 0.16))
        return
      }
    }

    // the low walking voice on the 2+2+3 pulse
    if (pos === 0 || pos === 4) this.bass(hz(chord - 24 + (pos === 4 ? 7 : 0)), t)

    const d = this.phrase[(bar % 4) * BAR + pos]
    if (d !== undefined && d !== -99) {
      const semi = degree(d)
      if (bar % 7 === 6 && pos === 2) {
        // a wrong note, then it quietly corrects itself
        this.pluck(hz(semi + 1), t, 0.12)
        this.pluck(hz(semi), t + EIGHTH * 0.5, 0.06)
      } else {
        this.pluck(hz(semi), t, 0.11)
      }
    }

    if (this.clank > 0.01 && (pos === 3 || pos === 6) && this.rand() < 0.35 + this.clank * 0.5) this.clang(t + this.rand() * 0.05)
  }

  /** A new four-bar phrase: a walk on the scale with rests, mostly stepwise, occasionally leaping. */
  private compose() {
    const out: number[] = []
    let d = 2
    for (let i = 0; i < BAR * 4; i++) {
      if (this.rand() < 0.38) { out.push(-99); continue }
      const r = this.rand()
      d += r < 0.4 ? 1 : r < 0.8 ? -1 : r < 0.9 ? 3 : -3
      d = Math.max(-2, Math.min(9, d))
      out.push(d)
    }
    this.phrase = out
  }

  private pluck(f: number, t: number, level: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(level, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.5)
    g.connect(this.boxBus)
    const drift = (this.rand() - 0.5) * 22 // cents: the tines are slightly bent
    for (const [mult, amp] of [[1, 1], [2.01, 0.32], [4.2, 0.08]] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f * mult
      o.detune.value = drift
      const a = ctx.createGain()
      a.gain.value = amp
      o.connect(a).connect(g)
      o.start(t)
      o.stop(t + 1.6)
    }
  }

  private bass(f: number, t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.13, t + 0.08)
    g.gain.exponentialRampToValueAtTime(0.001, t + EIGHTH * 3)
    o.connect(g).connect(this.bassBus)
    o.start(t)
    o.stop(t + EIGHTH * 3 + 0.05)
  }

  /** Somewhere behind a fence, someone drops a spanner. */
  private clang(t: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.05, t)
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800 + this.rand() * 900
    bp.Q.value = 6
    bp.connect(g).connect(this.clankBus)
    for (const f of [517, 1243, 1709]) {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = f * (0.97 + this.rand() * 0.06)
      o.connect(bp)
      o.start(t)
      o.stop(t + 0.25)
    }
  }
}

export const music = new Music()
