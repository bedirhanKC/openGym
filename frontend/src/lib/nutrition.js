import { isoOf, uid } from './format.js'

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
export const NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
]
export const GOALS = [...NUTRIENTS.slice(0, 5), { key: 'water', label: 'Water', unit: 'ml' }]
const map = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}
export function validNutritionDate(date, today = isoOf(new Date())) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && isoOf(new Date(date + 'T12:00:00')) === date && date <= today
}
export function cleanNumber(value) {
  if (value === '' || value == null) return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : null
}
export function foodRecord(draft, date, now = Date.now()) {
  if (!validNutritionDate(date, isoOf(new Date(now)))) return null
  const name = String(draft?.name || '').trim().slice(0, 180)
  const quantity = cleanNumber(draft?.quantity)
  if (!name || !(quantity > 0)) return null
  const unit = ['g', 'ml', 'serving'].includes(draft.unit) ? draft.unit : 'serving'
  const basis = unit === 'serving' ? 'serving' : draft.basis === '100' ? '100' : 'portion'
  return {
    id: draft.id || uid(), d: date, kind: 'food', name, quantity, unit, basis,
    meal: MEALS.includes(draft.meal) ? draft.meal : 'Snack',
    time: /^\d{2}:\d{2}$/.test(draft.time || '') && draft.time < '24:00' && Number(draft.time.slice(3)) < 60 ? draft.time : '12:00',
    nutrients: Object.fromEntries(NUTRIENTS.map(({ key }) => [key, cleanNumber(draft.nutrients?.[key])])),
    notes: String(draft.notes || '').trim().slice(0, 2000), _ts: now,
  }
}
export function waterRecord(quantity, date, now = Date.now()) {
  const n = cleanNumber(quantity)
  return n > 0 && validNutritionDate(date, isoOf(new Date(now)))
    ? { id: uid(), d: date, kind: 'water', quantity: n, time: new Date(now).toTimeString().slice(0, 5), _ts: now } : null
}
export const recordsOf = S => Object.values(map(S?.nutritionLog)).filter(r => r && !r.deleted && typeof r.id === 'string' && validNutritionDate(r.d))
export const foodsOf = S => Object.values(map(S?.foodFavorites)).filter(r => r && !r.deleted && r.name)
export const dayRecords = (S, date) => recordsOf(S).filter(r => r.d === date).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')) || a._ts - b._ts)
export function foodTotals(record) {
  const factor = record?.basis === '100' ? (cleanNumber(record.quantity) || 0) / 100 : record?.basis === 'serving' ? (cleanNumber(record.quantity) || 0) : 1
  return Object.fromEntries(NUTRIENTS.map(({ key }) => {
    const n = cleanNumber(record?.nutrients?.[key])
    return [key, n == null ? null : Math.round(n * factor * 100) / 100]
  }))
}
export function dailyNutrition(S, date) {
  const rows = dayRecords(S, date)
  const totals = { ...Object.fromEntries(NUTRIENTS.map(({ key }) => [key, 0])), water: 0 }
  const missing = Object.fromEntries(NUTRIENTS.map(({ key }) => [key, 0]))
  for (const r of rows) {
    if (r.kind === 'water') { totals.water += cleanNumber(r.quantity) || 0; continue }
    if (r.kind !== 'food') continue
    const n = foodTotals(r)
    for (const { key } of NUTRIENTS) {
      if (n[key] == null) missing[key]++
      else totals[key] += n[key]
    }
  }
  return { rows, totals, missing, foods: rows.filter(r => r.kind === 'food').length }
}
export function copyFoods(S, from, to, meal = null, now = Date.now()) {
  if (!validNutritionDate(to, isoOf(new Date(now)))) return []
  return dayRecords(S, from).filter(r => r.kind === 'food' && (!meal || r.meal === meal))
    .map(r => ({ ...r, id: uid(), d: to, _ts: now, nutrients: { ...r.nutrients } }))
}
export function weeklyNutrition(S, end) {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end + 'T12:00:00'); d.setDate(d.getDate() - i)
    const date = isoOf(d); result.push({ date, ...dailyNutrition(S, date) })
  }
  const logged = result.filter(d => d.foods > 0)
  const known = logged.filter(d => d.foods > d.missing.calories)
  return { days: result, logged: logged.length, incomplete: logged.some(d => d.missing.calories > 0), calories: known.length ? known.reduce((n, d) => n + d.totals.calories, 0) / known.length : null }
}
export function nutritionCsv(S) {
  const quote = v => {
    const s = String(v ?? '')
    return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"'
  }
  const header = ['Date', 'Time', 'Meal', 'Food', 'Quantity', 'Unit', ...NUTRIENTS.map(n => n.label), 'Water (ml)', 'Notes']
  const rows = recordsOf(S).sort((a, b) => a.d.localeCompare(b.d)).map(r => {
    const totals = foodTotals(r)
    return [r.d, r.time, r.meal, r.name, r.quantity, r.unit, ...NUTRIENTS.map(n => r.kind === 'food' ? totals[n.key] : ''), r.kind === 'water' ? r.quantity : '', r.notes]
  })
  return [header, ...rows].map(row => row.map(quote).join(',')).join('\r\n')
}
