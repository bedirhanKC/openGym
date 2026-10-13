import { describe, expect, it } from 'vitest'
import { buildStarterPlan } from './starter.js'
import { EXIDX } from './exercises.js'

describe('home V-shape starter', () => {
  it('offers three nonconsecutive editable sessions with rep-range progression', () => {
    const plan = buildStarterPlan('vshape-home')
    expect(plan.schedule.map(s => s.day)).toEqual([1, 3, 5])
    expect(plan.routines.map(r => r.prog)).toEqual(['double', 'double', 'double'])
    for (const r of plan.routines) for (const e of r.ex) {
      expect(EXIDX[e.id]).toBeTruthy()
      expect(e.repsMin).toBeGreaterThan(0)
      expect(e.reps).toBeGreaterThan(e.repsMin)
      expect(e.weight).toBe(0)
      expect(/incline|pull-up|chin-up|cable|machine/i.test(EXIDX[e.id].n)).toBe(false)
      expect(['dumbbell', 'ez barbell', 'body weight']).toContain(EXIDX[e.id].eq)
    }
  })
  it('keeps shoulders and back emphasized without removing legs', () => {
    const plan = buildStarterPlan('vshape-home')
    const count = id => plan.routines.flatMap(r => r.ex).filter(e => e.id === id).reduce((n, e) => n + e.sets, 0)
    expect(count('0334')).toBe(9)
    expect(count('1344') + count('0293')).toBe(9)
    for (const r of plan.routines) expect(r.ex.some(e => EXIDX[e.id].bp === 'upper legs')).toBe(true)
  })
  it('retains rep ranges and rest when equipment fitting substitutes an exercise', () => {
    const plan = buildStarterPlan('vshape-home', ['dumbbell'])
    for (const r of plan.routines) for (const e of r.ex) {
      expect(e.repsMin).toBeGreaterThan(0)
      expect(e.restSec).toBeGreaterThan(0)
      expect(EXIDX[e.id].eq).not.toBe('ez barbell')
    }
  })
})
