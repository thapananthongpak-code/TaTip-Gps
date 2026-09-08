import { describe, expect, it } from 'vitest'
import { computeProgress } from '../src/utils/navigation'
import type { Route } from '../src/types'

const a = { lat: 0, lng: 0 }
const b = { lat: 0, lng: 0.001 }
const c = { lat: 0.001, lng: 0.001 }
export const route: Route = {
  id: 'walking',
  origin: a,
  destination: { id: 'end', name: 'End', address: '', location: c },
  distance: 222,
  duration: 180,
  geometry: [a, b, c],
  steps: [
    { id: '0', maneuver: 'depart', location: a, distance: 111, duration: 90, geometry: [a, b] },
    { id: '1', maneuver: 'left', location: b, distance: 111, duration: 90, geometry: [b, c] },
    { id: '2', maneuver: 'arrive', location: c, distance: 0, duration: 0, geometry: [c] },
  ],
}
describe('walking progression', () => {
  it('keeps the turn pending at 15m, 7m and at the turn itself', () => {
    for (const lng of [0.000865, 0.000937, 0.001]) {
      expect(computeProgress(route, { lat: 0, lng }, 0).nextStep.maneuver).toBe('left')
    }
  })
  it('advances after walking onto the outgoing segment', () => {
    expect(computeProgress(route, { lat: 0.00012, lng: 0.001 }, 0).stepIndex).toBe(1)
  })
  it('does not declare arrival across a wall near the destination before the route is complete', () => {
    expect(computeProgress(route, c, 0).hasArrived).toBe(false)
  })
  it('recognizes the route endpoint, even if the building centroid is elsewhere', () => {
    const distant = {
      ...route,
      destination: { ...route.destination, location: { lat: 0.002, lng: 0.002 } },
    }
    const result = computeProgress(distant, c, 1)
    expect(result.hasArrived).toBe(true)
    expect(result.distanceToDestination).toBeGreaterThan(100)
  })
  it('rejects empty route steps rather than crashing later on undefined coordinates', () => {
    expect(() => computeProgress({ ...route, steps: [] }, a, 0)).toThrow()
  })
  it('measures distance along a curved path rather than through a building', () => {
    const end = { lat: 0.00005, lng: 0 }
    const curved = {
      ...route,
      destination: { ...route.destination, location: end },
      geometry: [a, b, c, end],
      steps: [
        { ...route.steps[0], geometry: [a, b, c, end] },
        { ...route.steps[2], location: end, geometry: [end] },
      ],
    }
    const progress = computeProgress(curved, a, 0)
    expect(progress.distanceToNextManeuver).toBeGreaterThan(300)
    expect(progress.hasArrived).toBe(false)
  })
})
