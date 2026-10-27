import type { City } from './types.ts'

/** mulberry32, with its state stored inside the city so every year is reproducible from the seed. */
export function rand(city: City): number {
  let t = (city.rng = (city.rng + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function randInt(city: City, lo: number, hi: number): number {
  return lo + Math.floor(rand(city) * (hi - lo + 1))
}

export function pick<T>(city: City, xs: T[]): T {
  return xs[Math.floor(rand(city) * xs.length)]
}

export function uid(city: City, prefix: string): string {
  return `${prefix}${city.nextId++}`
}
