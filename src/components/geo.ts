import type { PlotId } from '../../shared/actions.ts'

// A gentle dimetric projection. Plan units: the square is 600 × 420.
export function P(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * 0.88, (x + y) * 0.46 - z]
}

export type V3 = [number, number, number?]
export const pts = (vs: V3[]) => vs.map(([x, y, z]) => P(x, y, z ?? 0).map((n) => n.toFixed(1)).join(',')).join(' ')

export interface Rect { x: number; y: number; w: number; d: number }

export const RECTS: Record<PlotId, Rect> = {
  westbed: { x: 0, y: 0, w: 180, d: 220 },
  arcade: { x: 200, y: 0, w: 400, d: 80 },
  linden: { x: 0, y: 240, w: 180, d: 180 },
  fountain: { x: 220, y: 120, w: 180, d: 180 },
  steps: { x: 430, y: 110, w: 170, d: 170 },
  eastlot: { x: 220, y: 320, w: 380, d: 100 },
}

export const SQUARE: Rect = { x: 0, y: 0, w: 600, d: 420 }

export const center = (r: Rect): [number, number] => [r.x + r.w / 2, r.y + r.d / 2]
export const depth = (r: Rect) => r.x + r.w / 2 + r.y + r.d / 2

export function rectPts(r: Rect, z = 0, inset = 0) {
  return pts([
    [r.x + inset, r.y + inset, z], [r.x + r.w - inset, r.y + inset, z],
    [r.x + r.w - inset, r.y + r.d - inset, z], [r.x + inset, r.y + r.d - inset, z],
  ])
}

export function boxFaces(x: number, y: number, w: number, d: number, h: number, z0 = 0) {
  const z1 = z0 + h
  return {
    top: pts([[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]]),
    s: pts([[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x, y + d, z1]]),
    e: pts([[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x + w, y, z1]]),
  }
}

export function ring(cx: number, cy: number, r: number, z = 0, n = 32): V3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as V3
  })
}

/** the visible side of a cylinder: front half of the bottom ring and back along the top */
export function cylinderSide(cx: number, cy: number, r: number, z0: number, z1: number) {
  const front: V3[] = []
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 4 + (i / 16) * Math.PI
    front.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0])
  }
  const top = front.map(([x, y]) => [x, y, z1] as V3).reverse()
  return pts([...front, ...top])
}

export function wrap(text: string, width = 30): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width && line) { lines.push(line); line = w } else line = (line + ' ' + w).trim()
  }
  if (line) lines.push(line)
  return lines
}
