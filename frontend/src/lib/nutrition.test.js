import { describe, expect, it } from 'vitest'
import { cleanNumber, foodRecord, waterRecord, foodTotals, dailyNutrition, copyFoods, weeklyNutrition, validNutritionDate, nutritionCsv } from './nutrition.js'
import { mergeStates, stampChange, resetIdsOf } from './sync-merge.js'
import { convertStateUnit } from './units.js'

const now = new Date(2026, 9, 13, 15).getTime()
const food = patch => foodRecord({ name: 'Yogurt', quantity: 150, unit: 'g', basis: '100', meal: 'Breakfast', nutrients: { calories: 60, protein: 4 }, ...patch }, '2026-10-13', now)
const state = rows => ({ unit: 'kg', workouts: [], bodyweight: [], nutritionLog: Object.fromEntries(rows.map(r => [r.id, r])) })

describe('food diary calculations', () => {
  it('scales label values by grams without turning unknown values into zero', () => {
    const r = food()
    expect(foodTotals(r)).toMatchObject({ calories: 90, protein: 6, carbs: null })
    expect(foodTotals(food({ unit: 'serving', quantity: 2 }))).toMatchObject({ calories: 120, protein: 8 })
    expect(foodTotals(food({ basis: 'portion' }))).toMatchObject({ calories: 60, protein: 4 })
  })
  it('rejects invalid dates, future days, blank names and nonpositive quantities', () => {
    for (const date of ['2026-02-30', '2026-10-14', 'bad']) expect(foodRecord({ name: 'Food', quantity: 1 }, date, now)).toBeNull()
    expect(validNutritionDate('2024-02-29', '2026-10-13')).toBe(true)
    expect(food({ name: '   ' })).toBeNull()
    expect(food({ quantity: 0 })).toBeNull()
    expect(food({ quantity: Infinity })).toBeNull()
    for (const v of [NaN, -1, Infinity, 'wrong']) expect(cleanNumber(v)).toBeNull()
    expect(cleanNumber('1,5')).toBe(1.5)
  })
  it('totals foods and water separately and tracks missing calories', () => {
    const rows = [food(), food({ name: 'Unlabelled meal', nutrients: {} }), waterRecord(250, '2026-10-13', now)]
    const d = dailyNutrition(state(rows), '2026-10-13')
    expect(d.totals).toMatchObject({ calories: 90, protein: 6, water: 250 })
    expect(d.missing.calories).toBe(1)
    expect(d.foods).toBe(2)
  })
  it('copies meals with new ids, preserves the source and never copies drinking twice', () => {
    const old = { ...food(), d: '2026-10-12' }
    const S = state([old, waterRecord(250, '2026-10-12', now)])
    const rows = copyFoods(S, old.d, '2026-10-13', 'Breakfast', now)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).not.toBe(old.id)
    expect(rows[0].d).toBe('2026-10-13')
    rows[0].nutrients.protein = 9
    expect(old.nutrients.protein).toBe(4)
    expect(copyFoods(S, old.d, '2026-10-14', null, now)).toEqual([])
  })
  it('counts zero-calorie logged days but leaves unlogged days out of the average', () => {
    const a = { ...food(), d: '2026-10-12' }, b = food({ nutrients: { calories: 0 } })
    const w = weeklyNutrition(state([a, b]), '2026-10-13')
    expect(w.days).toHaveLength(7)
    expect(w.logged).toBe(2)
    expect(w.calories).toBe(45)
    const unknown = weeklyNutrition(state([food({ nutrients: {} })]), '2026-10-13')
    expect(unknown.logged).toBe(1)
    expect(unknown.calories).toBeNull()
  })
  it('exports commas, quotes, notes and formula-looking names safely', () => {
    const csv = nutritionCsv(state([food({ name: '=SUM(A1)', notes: 'a,"b"\nline' })]))
    expect(csv).toContain('"\'=SUM(A1)"')
    expect(csv).toContain('"a,""b""\nline"')
  })
})

describe('nutrition persistence, sync and resets', () => {
  it('preserves different devices’ meals and does not resurrect a deleted meal', () => {
    const a = food(), b = food({ name: 'Oats' })
    const A = { ...state([a]), _ts: 10 }, B = { ...state([b]), _ts: 20 }
    expect(dailyNutrition(mergeStates(A, B), a.d).foods).toBe(2)
    const gone = { ...A, nutritionLog: { [a.id]: { id: a.id, d: a.d, deleted: true, _ts: now + 1 } } }
    expect(dailyNutrition(mergeStates(gone, A), a.d).foods).toBe(0)
  })
  it('stamps a later edit after observed timestamps even with a lagging clock', () => {
    const S = state([food()]); S._ts = now
    const next = JSON.parse(JSON.stringify(S)); next.nutritionLog[Object.keys(next.nutritionLog)[0]]._ts = 1
    const at = stampChange(S, next, 2)
    expect(at).toBeGreaterThan(now)
    expect(Object.values(next.nutritionLog)[0]._ts).toBe(at)
  })
  it('includes meals in reset identities and preserves grams when lifting units change', () => {
    const S = state([food()]); S.foodFavorites = { f: { id: 'f', name: 'Yogurt', _ts: now } }
    expect(resetIdsOf(S).nutritionLog).toEqual(Object.keys(S.nutritionLog))
    expect(convertStateUnit(S, 'lb').nutritionLog).toEqual(S.nutritionLog)
    const restored = JSON.parse(JSON.stringify(S))
    expect(dailyNutrition(restored, '2026-10-13').totals.calories).toBe(90)
  })
})
