import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import { fmtDate, fmtNum, todayISO, isoOf, uid } from '../lib/format.js'
import { MEALS, NUTRIENTS, GOALS, foodRecord, waterRecord, foodTotals, foodsOf, dailyNutrition, copyFoods, weeklyNutrition, cleanNumber, validNutritionDate, nutritionCsv } from '../lib/nutrition.js'
import { MOBILE, shareExport } from '../lib/mobile.js'
import { Button, NumberField, TextField, TextArea, SelectRow } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { confirmSheet } from '../sheets.jsx'
import './Nutrition.css'

const update = fn => useStore.getState().update(fn)
const toast = msg => useUI.getState().toast(msg)
const mealText = meal => t(meal)
const localTime = () => new Date().toTimeString().slice(0, 5)
const shift = (date, n) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d) }
const saveRow = row => update(s => { s.nutritionLog = { ...s.nutritionLog, [row.id]: row } })
const removeRow = row => confirmSheet({ title: t('Delete'), message: row.name || t('Water'), confirmText: t('Delete'), danger: true,
  onConfirm: () => saveRow({ id: row.id, d: row.d, deleted: true, _ts: Date.now() }) })

function FoodEditor({ date, source, close }) {
  const S = useStore(s => s.S)
  const [draft, setDraft] = useState(() => ({ name: '', meal: 'Breakfast', quantity: 100, unit: 'g', basis: '100', nutrients: {}, notes: '', ...source, time: source?.time || localTime() }))
  const [recordDate, setRecordDate] = useState(source?.d || date)
  const set = patch => setDraft(d => ({ ...d, ...patch }))
  const templates = foodsOf(S)
  const row = foodRecord(draft, recordDate)
  const save = () => {
    if (!row) { toast(t('Enter a food name and quantity')); return }
    saveRow(row); close()
  }
  const remember = () => {
    if (!row) { toast(t('Enter a food name and quantity')); return }
    update(s => { const id = uid(); s.foodFavorites = { ...s.foodFavorites, [id]: { ...row, id, d: undefined, _ts: Date.now() } } })
    toast(t('Saved to favorites'))
  }
  return <>
    <h3>{t(source?.id ? 'Edit food' : 'Add food')}</h3>
    <p className="muted small">{t('Enter label values. Empty values stay unknown.')}</p>
    {templates.length > 0 && <SelectRow title={t('Favorites')} value="" options={templates.map(f => ({ value: f.id, label: f.name }))}
      onChange={id => { const f = templates.find(f => f.id === id); if (f) set({ ...f, id: source?.id, d: source?.d, time: draft.time, meal: draft.meal, nutrients: { ...f.nutrients } }) }} />}
    <div className="nutrition-form">
      <label>{t('Food')}<TextField value={draft.name} maxLength={180} onChange={e => set({ name: e.target.value })} /></label>
      <label>{t('Date')}<TextField type="date" value={recordDate} max={todayISO()} onChange={e => setRecordDate(e.target.value)} /></label>
      <label>{t('Meal time')}<TextField type="time" value={draft.time} onChange={e => set({ time: e.target.value })} /></label>
      <SelectRow title={t('Meal')} value={draft.meal} options={MEALS.map(m => ({ value: m, label: mealText(m) }))} onChange={meal => set({ meal })} />
      <label>{t('Quantity')}<NumberField className="field" nullable value={draft.quantity} min={0} onChange={quantity => set({ quantity })} /></label>
      <SelectRow title={t('Unit')} value={draft.unit} options={['g', 'ml', 'serving'].map(u => ({ value: u, label: u === 'serving' ? t('Serving') : u }))} onChange={unit => set({ unit, basis: unit === 'serving' ? 'serving' : '100', quantity: unit === 'serving' ? 1 : 100 })} />
      {draft.unit === 'serving' ? <p className="small muted">{t('Per serving')}</p> : <SelectRow title={t('Nutrition values')} value={draft.basis} options={[
        { value: '100', label: t('Per 100 g / ml') }, { value: 'portion', label: t('Whole portion') },
      ]} onChange={basis => set({ basis })} />}
      <div className="nutrition-grid">
        {NUTRIENTS.map(n => <label key={n.key}>{t(n.label)} ({n.unit})<NumberField className="field" nullable min={0} value={draft.nutrients?.[n.key] ?? null}
          onChange={value => set({ nutrients: { ...draft.nutrients, [n.key]: value } })} /></label>)}
      </div>
      <label>{t('Notes')}<TextArea value={draft.notes} maxLength={2000} onChange={e => set({ notes: e.target.value })} /></label>
      {row && <p className="small muted">{t('Logged portion')}: {foodTotals(row).calories == null ? '–' : fmtNum(foodTotals(row).calories) + ' kcal'} · {row.quantity} {row.unit === 'serving' ? t('Serving') : row.unit}</p>}
      <Button variant="primary" disabled={!row} onClick={save}>{t('Save')}</Button>
      <Button icon="star" disabled={!row} onClick={remember}>{t('Save to favorites')}</Button>
      <Button variant="ghost" onClick={close}>{t('Cancel')}</Button>
    </div>
  </>
}
export const foodSheet = (date, source = null) => useUI.getState().openSheet(close => <FoodEditor date={date} source={source} close={close} />)

function GoalsEditor({ close }) {
  const S = useStore(s => s.S)
  const [goals, setGoals] = useState(S.nutritionGoals || {})
  return <><h3>{t('Nutrition goals')}</h3><div className="nutrition-form">
    {GOALS.map(n => <label key={n.key}>{t(n.label)} ({n.unit})<NumberField className="field" nullable min={0} value={goals[n.key] ?? null}
      onChange={v => setGoals(g => ({ ...g, [n.key]: v }))} /></label>)}
    <Button variant="primary" onClick={() => { update(s => { s.nutritionGoals = Object.fromEntries(GOALS.map(n => [n.key, cleanNumber(goals[n.key])])) }); close() }}>{t('Save')}</Button>
    <Button variant="ghost" onClick={close}>{t('Cancel')}</Button>
  </div></>
}
const goalsSheet = () => useUI.getState().openSheet(close => <GoalsEditor close={close} />)

function NutritionTotals({ date, compact = false }) {
  const S = useStore(s => s.S)
  const { totals, missing, foods } = dailyNutrition(S, date)
  const goals = S.nutritionGoals || {}
  const visible = compact ? [GOALS[0], GOALS[1], GOALS.at(-1)] : GOALS
  return <div className="nutrition-grid" style={compact ? { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } : undefined}>
    {visible.map(n => <div key={n.key} className="nutrition-stat">
      <div className="muted small">{t(n.label)}</div>
      <strong>{foods > 0 && missing[n.key] === foods ? '–' : fmtNum(totals[n.key]) + (missing[n.key] > 0 ? '+' : '')}</strong> <span className="dim small">{n.unit}</span>
      {goals[n.key] > 0 && <><div className="nutrition-track"><i style={{ width: Math.min(100, totals[n.key] / goals[n.key] * 100) + '%' }} /></div>
        <div className="dim small">{fmtNum(goals[n.key])} {n.unit}</div></>}
    </div>)}
    {!compact && foods > 0 && Object.values(missing).some(n => n > 0) && <p className="small muted nutrition-wide">{t('Totals include known values only.')}</p>}
  </div>
}
export function NutritionHome() {
  const nav = useNavigate()
  return <div className="card">
    <div className="row between"><h2>{t('Food diary')}</h2><Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/nutrition')}>{t('Log')}</Button></div>
    <NutritionTotals date={todayISO()} compact />
  </div>
}

function DiaryCalendar({ date, onSelect }) {
  const S = useStore(s => s.S)
  const [month, setMonth] = useState(date.slice(0, 7))
  useEffect(() => { setMonth(date.slice(0, 7)) }, [date])
  const start = new Date(month + '-01T12:00:00')
  const offset = (start.getDay() + 6) % 7
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const move = n => { const d = new Date(month + '-01T12:00:00'); d.setMonth(d.getMonth() + n); setMonth(isoOf(d).slice(0, 7)) }
  return <details className="card nutrition-calendar"><summary>{t('History')}</summary>
    <div className="row between"><Button size="sm" onClick={() => move(-1)} icon="chevronLeft" aria-label={t('Previous month')} />
      <b>{start.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })}</b><Button size="sm" onClick={() => move(1)} icon="chevronRight" aria-label={t('Next month')} /></div>
    <div className="nutrition-calendar-grid">
      {[1, 2, 3, 4, 5, 6, 0].map(d => <span className="small dim" key={d}>{new Date(2026, 9, 4 + d).toLocaleDateString(dateLocale(), { weekday: 'short' })}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={'blank' + i} />)}
      {Array.from({ length: days }, (_, i) => {
        const iso = month + '-' + String(i + 1).padStart(2, '0'); const logged = dailyNutrition(S, iso).rows.length > 0 || !!S.nutritionDays?.[iso]?.note || !!S.nutritionDays?.[iso]?.hunger
        return <button key={iso} className={(iso === date ? 'selected ' : '') + (logged ? 'logged' : '')} disabled={iso > todayISO()}
          aria-label={fmtDate(iso, true) + (logged ? ' · ' + t('Food diary') : '')} aria-pressed={iso === date} onClick={() => onSelect(iso)}>{i + 1}{logged && <i />}</button>
      })}
    </div>
  </details>
}

function DayNote({ date }) {
  const S = useStore(s => s.S)
  const source = S.nutritionDays?.[date] || {}
  const [note, setNote] = useState(source.note || '')
  const [hunger, setHunger] = useState(source.hunger ?? null)
  return <details className="card"><summary>{t('Day note')}</summary><div className="nutrition-form">
    <label>{t('Hunger (1–5)')}<NumberField className="field" nullable decimal={false} min={1} max={5} value={hunger} onChange={setHunger} /></label>
    <TextArea aria-label={t('Day note')} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} />
    <Button onClick={() => { update(s => { s.nutritionDays = { ...s.nutritionDays, [date]: { note: note.trim(), hunger: hunger >= 1 && hunger <= 5 ? hunger : null, _ts: Date.now() } } }); toast(t('Saved')) }}>{t('Save')}</Button>
  </div></details>
}

export default function Nutrition() {
  const S = useStore(s => s.S)
  const nav = useNavigate()
  const [date, setDate] = useState(todayISO())
  const [water, setWater] = useState(250)
  const { rows } = dailyNutrition(S, date)
  const week = weeklyNutrition(S, date)
  const select = d => { if (validNutritionDate(d)) setDate(d) }
  const addWater = ml => { const row = waterRecord(ml, date); if (row) saveRow(row) }
  const copy = (from, meal = null) => {
    const dest = from === date ? todayISO() : date
    const copied = copyFoods(S, from, dest, meal)
    if (!copied.length) { toast(t('No food records')); return }
    confirmSheet({ title: t('Copy meals'), message: fmtDate(from, true) + ' → ' + fmtDate(dest, true), confirmText: t('Copy'),
      onConfirm: () => { update(s => { s.nutritionLog = { ...s.nutritionLog, ...Object.fromEntries(copied.map(r => [r.id, r])) } }); setDate(dest) } })
  }
  const exportCsv = async () => {
    const csv = '\uFEFF' + nutritionCsv(S); const name = 'opengym-food-diary-' + todayISO() + '.csv'
    if (MOBILE) { try { await shareExport(csv, name) } catch { /* sharing dismissed */ }; return }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
  }
  return <div className="narrow nutrition-page">
    <div className="hdr"><button className="iconbtn" aria-label={t('Home')} onClick={() => nav('/home')}><Icon name="chevronLeft" /></button>
      <div className="grow"><h1>{t('Food diary')}</h1></div><button className="iconbtn" aria-label={t('Nutrition goals')} onClick={goalsSheet}><Icon name="target" /></button></div>
    <div className="row nutrition-date"><Button icon="chevronLeft" aria-label={t('Previous day')} onClick={() => select(shift(date, -1))} />
      <TextField type="date" aria-label={t('Date')} value={date} max={todayISO()} onChange={e => select(e.target.value)} />
      <Button icon="chevronRight" aria-label={t('Next day')} disabled={date === todayISO()} onClick={() => select(shift(date, 1))} /></div>
    {date !== todayISO() && <Button size="sm" variant="ghost" onClick={() => setDate(todayISO())}>{t('Today')}</Button>}
    <div className="card"><NutritionTotals date={date} /></div>
    <div className="row nutrition-actions"><Button variant="primary" icon="plus" onClick={() => foodSheet(date)}>{t('Add food')}</Button>
      <Button icon="copy" onClick={() => copy(shift(date, -1))}>{t('Copy previous day')}</Button></div>
    {MEALS.map(meal => {
      const foods = rows.filter(r => r.kind === 'food' && r.meal === meal)
      return <section className="card" key={meal}><div className="row between"><h2>{mealText(meal)}</h2>
        <Button size="sm" variant="ghost" icon="plus" aria-label={t('Add food') + ' · ' + mealText(meal)} onClick={() => foodSheet(date, { meal })} /></div>
        {foods.length ? foods.map(r => {
          const n = foodTotals(r)
          return <div className="nutrition-food" key={r.id}>
            <div className="grow"><b>{r.name}</b><div className="small dim">{r.time} · {fmtNum(r.quantity)} {r.unit === 'serving' ? t('Serving') : r.unit}</div>
              <div className="small">{n.calories == null ? t('Unknown calories') : fmtNum(n.calories) + ' kcal'} · {t('Protein')} {n.protein == null ? '–' : fmtNum(n.protein) + ' g'} · {t('Carbohydrates')} {n.carbs == null ? '–' : fmtNum(n.carbs) + ' g'} · {t('Fat')} {n.fat == null ? '–' : fmtNum(n.fat) + ' g'}</div>
              {r.notes && <p className="small dim nutrition-note">{r.notes}</p>}</div>
            <div className="nutrition-row-actions"><button className="iconbtn" aria-label={t('Edit') + ' · ' + r.name} onClick={() => foodSheet(date, r)}><Icon name="pencil" /></button>
              <button className="iconbtn" aria-label={t('Copy') + ' · ' + r.name} onClick={() => foodSheet(date, { ...r, id: undefined, time: localTime() })}><Icon name="copy" /></button>
              <button className="iconbtn" aria-label={t('Delete') + ' · ' + r.name} onClick={() => removeRow(r)}><Icon name="trash" /></button></div>
          </div>
        }) : <div className="small dim">{t('No food records')}</div>}
        {foods.length > 0 && date !== todayISO() && <Button size="sm" variant="ghost" onClick={() => copy(date, meal)}>{t('Copy to today')}</Button>}
      </section>
    })}
    <section className="card"><h2>{t('Water')}</h2><div className="row nutrition-actions">{[250, 500].map(ml => <Button key={ml} onClick={() => addWater(ml)}>+{ml} ml</Button>)}</div>
      <div className="row nutrition-actions"><NumberField className="field" aria-label={t('Water') + ' (ml)'} nullable min={0} value={water} onChange={setWater} /><Button onClick={() => addWater(water)}>{t('Log')}</Button></div>
      {rows.filter(r => r.kind === 'water').map(r => <div className="row between" key={r.id}><span className="small">{r.time} · {fmtNum(r.quantity)} ml</span><button className="iconbtn" aria-label={t('Delete') + ' · ' + r.quantity + ' ml'} onClick={() => removeRow(r)}><Icon name="trash" /></button></div>)}</section>
    <DayNote key={date} date={date} />
    <DiaryCalendar date={date} onSelect={select} />
    <details className="card"><summary>{t('Last 7 days')}</summary><div className="nutrition-week">
      {week.days.map(d => <button key={d.date} onClick={() => select(d.date)}><span>{fmtDate(d.date)}</span><b>{d.foods ? fmtNum(d.totals.calories) + (d.missing.calories ? '+' : '') + ' kcal' : '–'}</b></button>)}
      <p className="small muted">{t('Logged days')}: {week.logged} / 7 · {t('Average')}: {week.calories == null ? '–' : fmtNum(week.calories) + (week.incomplete ? '+' : '') + ' kcal'}</p>
    </div></details>
    <details className="card"><summary>{t('Favorites')}</summary>{foodsOf(S).map(f => <div className="row between" key={f.id}>
      <Button variant="ghost" onClick={() => foodSheet(date, { ...f, id: undefined, d: date, time: localTime() })}>{f.name}</Button>
      <button className="iconbtn" aria-label={t('Delete') + ' · ' + f.name} onClick={() => update(s => { s.foodFavorites = { ...s.foodFavorites, [f.id]: { id: f.id, deleted: true, _ts: Date.now() } } })}><Icon name="trash" /></button></div>)}</details>
    <Button icon="share" onClick={exportCsv}>{t('Export food diary (CSV)')}</Button>
  </div>
}
