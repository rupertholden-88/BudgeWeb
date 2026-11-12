'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmt } from '@/lib/models'

type Point = { month: string; total: number | null; [key: string]: string | number | null }
type Series = { key: string; color: string; label?: string }

function axisMoney(value: number) {
  return Math.abs(value) >= 1000 ? `£${Number((value / 1000).toFixed(1))}k` : `£${Math.round(value)}`
}

function focusedDomain([min, max]: [number, number]): [number, number] {
  const pad = Math.max((max - min) * 0.2, Math.abs(max) * 0.01, 1)
  return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
}

function ValueTooltip({ active, payload, label }: any) {
  const value = payload?.[0]?.value
  if (!active || value == null) return null
  return <div className="rounded-xl border border-line bg-panel px-3 py-2 shadow-lg text-label">
    <div className="text-muted">{label}</div><div className="font-semibold num text-ink">{fmt(value)}</div>
  </div>
}

function Trend({ points, seriesKey, color, compact = false, label }: { points: Point[]; seriesKey: string; color: string; compact?: boolean; label?: string }) {
  const gradient = useId().replace(/:/g, '')
  const values = points.filter(p => typeof p[seriesKey] === 'number')
  if (!values.length) return <p className="text-label text-muted py-6">No balances recorded yet.</p>
  return <>
    <div aria-hidden="true" className="w-full min-w-0" style={{ height: compact ? 126 : 224 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} accessibilityLayer={false}>
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.2} /><stop offset="100%" stopColor={color} stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} minTickGap={24} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <YAxis width={54} axisLine={false} tickLine={false} tickCount={compact ? 3 : 5} domain={focusedDomain} tickFormatter={axisMoney} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <Tooltip content={<ValueTooltip />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
          <Area type="linear" dataKey={seriesKey} stroke={color} strokeWidth={2.5} fill={`url(#${gradient})`} connectNulls={false} dot={{ r: 3, fill: 'var(--panel)', strokeWidth: 2 }} activeDot={{ r: 5, stroke: 'var(--panel)', strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <table className="sr-only"><caption>{label ?? (seriesKey === 'total' ? 'Total portfolio value' : seriesKey)} by month</caption><tbody>{points.map(p => <tr key={p.month}><th>{p.month}</th><td>{typeof p[seriesKey] === 'number' ? fmt(p[seriesKey] as number) : 'Not recorded'}</td></tr>)}</tbody></table>
    {values.length === 1 && <p className="text-caption text-muted mt-1">One month recorded. Your trend will build as you save more balances.</p>}
  </>
}

export default function PortfolioCarousel({ points, series, total, change, pension = false, pensionSeries = [] }: { points: Point[]; series: Series[]; total: number; change: number | null; pension?: boolean; pensionSeries?: Series[] }) {
  const title = pension ? 'Pensions' : 'Portfolio'
  const breakdown = pension ? 'By person' : 'By asset'
  const labels = ['Total value', breakdown, ...(pension && pensionSeries.length ? ['By pension'] : [])]
  const count = labels.length
  const [slide, setSlide] = useState(0)
  const [height, setHeight] = useState<number>()
  const first = useRef<HTMLDivElement>(null)
  const second = useRef<HTMLDivElement>(null)
  const third = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const id = useId()
  useEffect(() => {
    const panel = slide === 0 ? first.current : slide === 1 ? second.current : third.current
    if (!panel) return
    const observer = new ResizeObserver(() => setHeight(panel.getBoundingClientRect().height))
    observer.observe(panel)
    setHeight(panel.getBoundingClientRect().height)
    return () => observer.disconnect()
  }, [slide])
  const latest = points[points.length - 1]
  return <section className="card p-4 sm:p-5 mb-4 portfolio-carousel" aria-label={`${title} charts`} aria-roledescription="carousel"
    onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); setSlide(current => Math.max(0, Math.min(count - 1, current + (e.key === 'ArrowRight' ? 1 : -1)))) } }}
    onTouchStart={e => { e.stopPropagation(); touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
    onTouchMove={e => e.stopPropagation()}
    onTouchCancel={e => { e.stopPropagation(); touch.current = null }}
    onTouchEnd={e => { e.stopPropagation(); const start = touch.current; touch.current = null; if (!start) return; const dx = e.changedTouches[0].clientX - start.x; const dy = e.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) setSlide(current => Math.max(0, Math.min(count - 1, current + (dx < 0 ? 1 : -1)))) }}>
    <div className="flex items-center justify-between gap-3 mb-4">
      <span className="text-caption font-semibold uppercase tracking-label text-muted">{title}</span>
      <span className="text-caption text-muted num" aria-live="polite">{slide + 1} / {count} · {labels[slide]}</span>
    </div>
    <div className="seg mb-4" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }} role="group" aria-label={`${title} view`}>
      {labels.map((label, i) => <button key={label} aria-pressed={slide === i} aria-controls={`${id}-${i}`} onClick={() => setSlide(i)}><span className="lbl">{label}</span></button>)}
    </div>
    <div className="portfolio-viewport" style={{ height }}>
      <div className="portfolio-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
        <div ref={first} id={`${id}-0`} role="group" aria-roledescription="slide" aria-label={`1 of ${count}: Total value`} aria-hidden={slide !== 0} className={`portfolio-slide ${slide === 0 ? 'is-active' : ''}`}>
          <div className="text-[34px] leading-tight font-semibold tracking-tight num">{fmt(total)}</div>
          <p className={`text-label mt-1 mb-3 ${change == null || change === 0 ? 'text-muted' : change > 0 ? 'text-positive' : 'text-negative'}`}>
            {change == null ? 'No previous-month balance to compare' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${fmt(Math.abs(change))} vs last month`}
          </p>
          <Trend points={points} seriesKey="total" label={`Total ${title.toLowerCase()} value`} color="var(--positive)" />
          <p className="text-caption text-muted mt-2 mb-4">Focused £ scale to show smaller changes. Gaps mean no recorded balance.</p>
          <div className="border-t border-line pt-3 space-y-2">
            {series.filter(s => typeof latest?.[s.key] === 'number' && Number(latest[s.key]) > 0).map(s => <div key={s.key} className="flex items-center justify-between gap-2 text-label"><span className="flex items-center gap-2 text-muted"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label ?? s.key}</span><span className="num font-medium">{fmt(latest[s.key] as number)}</span></div>)}
          </div>
        </div>
        <div ref={second} id={`${id}-1`} role="group" aria-roledescription="slide" aria-label={`2 of ${count}: ${breakdown}`} aria-hidden={slide !== 1} className={`portfolio-slide ${slide === 1 ? 'is-active' : ''}`}>
          <h3 className="text-[22px] font-semibold mt-0 mb-1">A closer look</h3>
          <p className="text-caption text-muted mt-0 mb-4">{pension ? 'Each person has their own £ scale.' : 'Each asset type has its own £ scale.'}</p>
          <div className="space-y-3">{series.map(s => <div key={s.key} className="rounded-2xl border border-line px-2 pt-3 pb-1">
            <div className="flex justify-between gap-2 items-center px-2 mb-1 text-label"><span className="flex gap-2 items-center font-medium"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label ?? s.key}</span><span className="font-semibold num">{typeof latest?.[s.key] === 'number' ? fmt(latest[s.key] as number) : '—'}</span></div>
            <Trend points={points} seriesKey={s.key} label={s.label} color={s.color} compact />
          </div>)}</div>
        </div>
        {count === 3 && <div ref={third} id={`${id}-2`} role="group" aria-roledescription="slide" aria-label="3 of 3: By pension" aria-hidden={slide !== 2} className={`portfolio-slide ${slide === 2 ? 'is-active' : ''}`}>
          <h3 className="text-[22px] font-semibold mt-0 mb-1">Your pension pots</h3>
          <p className="text-caption text-muted mt-0 mb-4">Each pension has its own £ scale.</p>
          <div className="space-y-3">{pensionSeries.map(s => {
            const current = latest?.[s.key]
            const previous = points[points.length - 2]?.[s.key]
            const difference = typeof current === 'number' && typeof previous === 'number' ? current - previous : null
            return <div key={s.key} className="rounded-2xl border border-line px-2 pt-3 pb-1">
              <div className="flex justify-between gap-2 items-start px-2 mb-1 text-label"><span className="font-medium min-w-0">{s.label ?? s.key}</span><span className="font-semibold num shrink-0">{typeof current === 'number' ? fmt(current) : '—'}</span></div>
              <p className={`text-caption px-2 mt-0 mb-1 ${difference == null || difference === 0 ? 'text-muted' : difference > 0 ? 'text-positive' : 'text-negative'}`}>{difference == null ? 'No previous-month balance to compare' : `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${fmt(Math.abs(difference))} vs last month`}</p>
              <Trend points={points} seriesKey={s.key} label={s.label} color={s.color} compact />
            </div>
          })}</div>
        </div>}
      </div>
    </div>
    <div className="flex justify-between items-center mt-3 border-t border-line pt-2">
      <button aria-label={`Previous ${title.toLowerCase()} slide`} disabled={slide === 0} onClick={() => setSlide(current => Math.max(0, current - 1))} className="min-h-[44px] min-w-[44px] grid place-items-center rounded-full disabled:opacity-25 text-muted"><ChevronLeft size={18} /></button>
      <span className="text-caption text-muted">{slide < count - 1 ? `Swipe for ${labels[slide + 1].toLowerCase()}` : 'Swipe back for the overview'}</span>
      <button aria-label={`Next ${title.toLowerCase()} slide`} disabled={slide === count - 1} onClick={() => setSlide(current => Math.min(count - 1, current + 1))} className="min-h-[44px] min-w-[44px] grid place-items-center rounded-full disabled:opacity-25 text-muted"><ChevronRight size={18} /></button>
    </div>
    <p className="text-caption text-muted mb-0 mt-1">{pension ? 'Balance changes include your contributions, employer payments and investment movements.' : 'Balance changes include deposits and withdrawals. Pensions shown separately below.'}</p>
  </section>
}
