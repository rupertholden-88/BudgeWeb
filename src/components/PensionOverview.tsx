'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { fmt, Owner } from '@/lib/models'
import { Point, Trend } from './PortfolioCarousel'
import { Sheet } from './BudgetScreen'

type PensionPot = { assetId: string; historyNames: string[]; earlierNames: string[]; key: string; label: string; owner: Owner; ownerLabel: string; color: string }

function BalanceChange({ value }: { value: number | null }) {
  return <span className={`block text-caption mt-1 mb-0 num ${value == null || value === 0 ? 'text-muted' : value > 0 ? 'text-positive' : 'text-negative'}`}>
    {value == null ? 'No previous-month balance to compare' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${fmt(Math.abs(value))} balance change vs last month`}
  </span>
}

export default function PensionOverview({ points, pots, total, change, onHistoryNames }: { points: Point[]; pots: PensionPot[]; total: number; change: number | null; onHistoryNames: (pot: PensionPot, names: string[]) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const latest = points[points.length - 1]
  const previous = points[points.length - 2]
  const difference = (pot: PensionPot) => {
    const current = latest?.[pot.key], before = previous?.[pot.key]
    return typeof current === 'number' && typeof before === 'number' ? current - before : null
  }
  const opened = pots.find(p => p.key === selected)
  const owners = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).filter(owner => pots.some(p => p.owner === owner))
  return <section className="card p-4 sm:p-5 mb-4" aria-label="Pension overview">
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="text-caption font-semibold uppercase tracking-label text-muted m-0">Combined pensions</h3>
      <span className="text-caption text-muted">{latest?.month}</span>
    </div>
    <div className="text-[34px] leading-tight font-semibold tracking-tight num">{fmt(total)}</div>
    <BalanceChange value={change} />
    <div className="mt-3"><Trend points={points} seriesKey="total" label="Combined pension value" color="var(--positive)" /></div>
    <p className="text-caption text-muted mt-2 mb-5">Focused £ scale. Gaps mean no recorded balance.</p>
    <div className="border-t border-line pt-4">
      <h3 className="text-[18px] font-semibold m-0">Your pension pots</h3>
      <p className="text-caption text-muted mt-1 mb-4">Each trend uses its own £ scale. Tap a pot for details.</p>
      {owners.map(owner => <div key={owner} className="mb-4 last:mb-0">
        <h4 className="text-label text-muted font-medium mt-0 mb-2">{pots.find(p => p.owner === owner)!.ownerLabel}</h4>
        <div className="space-y-3">{pots.filter(p => p.owner === owner).map(pot => {
          const balance = latest?.[pot.key]
          return <div key={pot.key} className="rounded-2xl border border-line p-3">
            <button className="w-full text-left cursor-pointer min-h-[44px]" onClick={() => setSelected(pot.key)} aria-label={`View ${pot.label}, ${pot.ownerLabel}`}>
              <span className="flex items-start gap-2 justify-between">
                <span className="text-[15px] font-medium min-w-0 break-words">{pot.label}</span>
                <span className="flex items-center gap-1 shrink-0"><span className="num font-semibold text-[15px]">{typeof balance === 'number' ? fmt(balance) : '—'}</span><ChevronRight size={16} className="text-muted" /></span>
              </span>
              <BalanceChange value={difference(pot)} />
            </button>
            <Trend points={points} seriesKey={pot.key} label={`${pot.label}, ${pot.ownerLabel}`} color={pot.color} compact />
          </div>
        })}</div>
      </div>)}
    </div>
    <p className="text-caption text-muted mt-4 mb-0">Balance changes include your contributions, employer payments and investment movements.</p>
    {opened && <Sheet title={`${opened.label} · ${opened.ownerLabel}`} onClose={() => setSelected(null)}>
      <h2 className="text-[24px] font-semibold m-0 mt-2">{opened.label}</h2>
      <p className="text-label text-muted mt-1 mb-4">{opened.ownerLabel}</p>
      <div className="text-[30px] font-semibold num">{typeof latest?.[opened.key] === 'number' ? fmt(latest[opened.key] as number) : 'No current balance recorded'}</div>
      <BalanceChange value={difference(opened)} />
      {opened.earlierNames.length > 0 && <div className="my-4 border border-line rounded-xl p-3">
        <h3 className="text-label font-semibold mt-0 mb-1">Earlier names for this pension</h3>
        <p className="text-caption text-muted mt-0 mb-2">Link a previous name to join its history. Select only names for this same pot.</p>
        {opened.earlierNames.map(name => <label key={name} className="flex items-center gap-3 min-h-[44px] text-label cursor-pointer">
          <input type="checkbox" checked={opened.historyNames.includes(name)} onChange={e => onHistoryNames(opened, e.target.checked ? [...opened.historyNames, name] : opened.historyNames.filter(n => n !== name))} />{name}
        </label>)}
      </div>}
      <Trend points={points} seriesKey={opened.key} label={opened.label} color={opened.color} />
      <p className="text-caption text-muted mt-2 mb-4">Focused £ scale. Gaps mean no recorded balance.</p>
      <table className="w-full text-label num"><caption className="text-left font-semibold pb-2">Recorded balances</caption><thead><tr className="text-muted text-left"><th className="font-medium py-2">Month</th><th className="font-medium py-2 text-right">Balance</th></tr></thead><tbody>{[...points].reverse().map(point => <tr key={point.month} className="border-t border-line"><th className="text-left py-2 font-normal">{point.month}</th><td className="text-right py-2">{typeof point[opened.key] === 'number' ? fmt(point[opened.key] as number) : 'Not recorded'}</td></tr>)}</tbody></table>
    </Sheet>}
  </section>
}
