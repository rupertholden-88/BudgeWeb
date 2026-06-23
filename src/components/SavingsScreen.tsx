'use client'

import { useState, useEffect, useRef } from 'react'
import { Owner, AssetType, fmt } from '@/lib/models'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const ASSET_LABELS: Record<AssetType, string> = {
  CASH: 'Cash', CASH_ISA: 'Cash ISA', STOCKS_SHARES_ISA: 'S&S ISA',
  JUNIOR_ISA: 'Junior ISA', LIFETIME_ISA: 'LISA',
  SAVINGS_ACCOUNT: 'Savings Account', CRYPTO: 'Crypto', OTHER: 'Other',
  PENSION: 'Pension',
}
const ASSET_COLORS: Record<AssetType, string> = {
  CASH: '#6BAF92', CASH_ISA: '#5B9BD5', STOCKS_SHARES_ISA: '#4472C4',
  JUNIOR_ISA: '#70AD47', LIFETIME_ISA: '#255E91', SAVINGS_ACCOUNT: '#8BAFD4',
  CRYPTO: '#F4A460', OTHER: '#A9A9A9', PENSION: '#7B5EA7',
}
const REGULAR_ASSET_TYPES: AssetType[] = ['CASH', 'CASH_ISA', 'STOCKS_SHARES_ISA', 'JUNIOR_ISA', 'LIFETIME_ISA', 'SAVINGS_ACCOUNT', 'CRYPTO', 'OTHER']
const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
}

function formatMonth(dateStr: string) {
  const parts = dateStr.slice(0, 7).split('-')
  return `${MONTH_LABELS[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`
}

function fmtK(n: number) {
  if (Math.abs(n) >= 1000) return `£${(n / 1000).toFixed(1)}k`
  return fmt(n)
}

function ownerBorderClass(owner: Owner) {
  if (owner === 'NIAMH') return 'border-l-[3px] border-l-niamh'
  if (owner === 'RUPERT') return 'border-l-[3px] border-l-rupert'
  return 'border-l-[3px] border-l-joint'
}

function StatCard({ label, value, sub, intent }: {
  label: string; value: string; sub?: string
  intent?: 'positive' | 'negative' | 'neutral'
}) {
  const valueClass = intent === 'positive' ? 'text-positive' : intent === 'negative' ? 'text-negative' : 'text-ink'
  return (
    <div className="card p-3 flex-1 min-w-0">
      <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.06em] mb-1 truncate">{label}</div>
      <div className={`text-lg font-bold tabular-nums leading-none ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-1 leading-tight">{sub}</div>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const filtered = payload.filter((p: any) => (p.value ?? 0) > 0)
  if (!filtered.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
      <div className="font-semibold text-ink mb-1.5">{label}</div>
      {filtered.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span className="text-muted">{p.name}</span>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function AllocationBar({ segments }: { segments: { color: string; pct: number }[] }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-[2px] mb-3">
      {segments.filter(s => s.pct > 0.5).map((s, i) => (
        <div key={i} className="h-full" style={{ width: `${s.pct}%`, background: s.color, minWidth: 4 }} />
      ))}
    </div>
  )
}

function TapToEdit({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => { onSave(draft); setEditing(false) }
  if (editing) return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }}
      className={`text-[inherit] font-[inherit] border-[1.5px] border-rupert rounded-md px-1.5 py-0.5 outline-none bg-rupert-light ${className ?? ''}`}
      autoFocus
    />
  )
  return (
    <span onClick={() => { setDraft(value); setEditing(true) }} className={`cursor-text ${className ?? ''}`}>
      {value}
    </span>
  )
}

function TapToEditAmount({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const commit = () => { onChange(parseFloat(raw.replace(/[£,]/g, '')) || 0); setEditing(false) }
  if (editing) return (
    <input
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }}
      className="w-[90px] text-right text-sm border-[1.5px] border-rupert rounded-md px-1.5 py-0.5 outline-none bg-rupert-light"
      inputMode="decimal"
      autoFocus
    />
  )
  return (
    <span
      onClick={() => { setRaw(value === 0 ? '' : String(value)); setEditing(true) }}
      className={`cursor-text tabular-nums text-sm min-w-[80px] text-right inline-block px-1 py-0.5 rounded ${value > 0 ? 'text-ink' : 'text-muted'}`}
    >
      {value > 0 ? fmt(value) : '—'}
    </span>
  )
}

function DeleteModal({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-6">
      <div className="card w-full max-w-[320px] p-6">
        <div className="text-base font-semibold mb-2">Delete asset?</div>
        <div className="text-sm text-muted mb-6">
          Remove <strong>{label}</strong> from this month's snapshot?
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-transparent border-[1.5px] border-border rounded-lg py-2.5 cursor-pointer text-sm">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-negative text-white border-0 rounded-lg py-2.5 cursor-pointer text-sm font-semibold">Delete</button>
        </div>
      </div>
    </div>
  )
}

function AssetRow({ asset, owner, today, updateAsset, deleteAsset, lockType }: {
  asset: { id: string; label: string; amount: number; type: AssetType; interestRate?: number; institution?: string }
  owner: Owner; today: string
  updateAsset: BudgetHook['updateAsset']
  deleteAsset: BudgetHook['deleteAsset']
  lockType?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setDeleteModal(true)
    }, 600)
  }
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  return (
    <>
      {deleteModal && (
        <DeleteModal
          label={asset.label}
          onConfirm={() => { deleteAsset(owner, today, asset.id); setDeleteModal(false) }}
          onCancel={() => setDeleteModal(false)}
        />
      )}
      <div
        className="border-b border-border"
        onMouseDown={startLongPress} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress} onTouchEnd={cancelLongPress} onTouchCancel={cancelLongPress}
      >
        <div className="flex items-center gap-1.5 py-2">
          <div className="flex-1 min-w-0">
            <TapToEdit
              value={asset.label}
              onSave={v => updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, asset.institution, v)}
              className="text-[13px] font-medium block"
            />
            <div className="text-[10px] text-muted mt-px">
              {ASSET_LABELS[asset.type] ?? asset.type}
              {asset.institution ? ` · ${asset.institution}` : ''}
              {asset.interestRate && asset.amount > 0 ? (
                <span className="text-positive font-semibold ml-1">
                  {` · £${((asset.amount * asset.interestRate) / 100 / 12).toFixed(0)}/mo (${asset.interestRate}% = £${((asset.amount * asset.interestRate) / 100).toFixed(0)}/yr)`}
                </span>
              ) : asset.interestRate ? <span>{` · ${asset.interestRate}%`}</span> : null}
            </div>
          </div>
          <TapToEditAmount value={asset.amount || 0} onChange={v => updateAsset(owner, today, asset.id, v, asset.interestRate, asset.institution)} />
          <button
            onClick={() => setExpanded(e => !e)}
            className="bg-transparent border-0 cursor-pointer text-muted text-[10px] px-1 py-0.5"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
        {expanded && (
          <div className="pb-2 flex flex-wrap gap-2">
            {!lockType && (
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted uppercase tracking-[0.05em]">Type</label>
                <select
                  value={asset.type}
                  onChange={e => updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, asset.institution, undefined, e.target.value as AssetType)}
                  className="text-xs border-[1.5px] border-border rounded-md px-1.5 py-1 bg-card"
                >
                  {Object.entries(ASSET_LABELS).filter(([k]) => k !== 'PENSION').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted uppercase tracking-[0.05em]">Rate %</label>
              <input
                type="number"
                value={asset.interestRate || ''}
                placeholder="0"
                onChange={e => updateAsset(owner, today, asset.id, asset.amount, parseFloat(e.target.value) || undefined, asset.institution)}
                className="w-[70px] text-xs border-[1.5px] border-border rounded-md px-1.5 py-1 outline-none"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted uppercase tracking-[0.05em]">Institution</label>
              <input
                value={asset.institution || ''}
                placeholder="e.g. Monzo"
                onChange={e => updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, e.target.value)}
                className="w-[110px] text-xs border-[1.5px] border-border rounded-md px-1.5 py-1 outline-none"
              />
            </div>
            <div className="text-[10px] text-muted w-full mt-1">💡 Long press the row to delete</div>
          </div>
        )}
      </div>
    </>
  )
}

function OwnerPanel({ owner, name, budget, addAsset, updateAsset, deleteAsset, today }: {
  owner: Owner; name: string; budget: BudgetHook['data']; today: string
  addAsset: BudgetHook['addAsset']
  updateAsset: BudgetHook['updateAsset']
  deleteAsset: BudgetHook['deleteAsset']
}) {
  const snap = budget.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
  const assets = (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type !== 'PENSION')
  const total = assets.reduce((a, i) => a + (i.amount || 0), 0)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<AssetType>('SAVINGS_ACCOUNT')
  const submit = () => { if (newLabel.trim()) { addAsset(owner, today, newType, newLabel.trim()); setNewLabel(''); setAdding(false) } }

  return (
    <div className={`card mb-3 ${ownerBorderClass(owner)}`}>
      <div className="flex justify-between items-center px-3 py-2.5 border-b border-border">
        <span className="font-semibold text-sm">{name}</span>
        <span className={`font-bold text-base tabular-nums ${total > 0 ? 'text-positive' : 'text-muted'}`}>{fmt(total)}</span>
      </div>
      <div className="px-3 pt-1 pb-2">
        {assets.map(asset => (
          <AssetRow key={asset.id} asset={asset as any} owner={owner} today={today} updateAsset={updateAsset} deleteAsset={deleteAsset} />
        ))}
        {adding ? (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="Account name..."
              autoFocus
              className="flex-1 min-w-[120px] text-[13px] border-[1.5px] border-border rounded-md px-2 py-1 outline-none"
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as AssetType)}
              className="text-[13px] border-[1.5px] border-border rounded-md px-2 py-1 bg-card cursor-pointer"
            >
              {REGULAR_ASSET_TYPES.map(t => <option key={t} value={t}>{ASSET_LABELS[t]}</option>)}
            </select>
            <button onClick={submit} className="bg-ink text-white border-0 rounded-md px-3 py-1 cursor-pointer text-[13px]">Add</button>
            <button onClick={() => setAdding(false)} className="bg-transparent border-[1.5px] border-border rounded-md px-3 py-1 cursor-pointer text-[13px]">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 mt-2 bg-transparent border-0 cursor-pointer text-muted text-xs">
            <Plus size={12} /> Add asset
          </button>
        )}
      </div>
    </div>
  )
}

function PensionOwnerPanel({ owner, name, budget, addAsset, updateAsset, deleteAsset, today }: {
  owner: Owner; name: string; budget: BudgetHook['data']; today: string
  addAsset: BudgetHook['addAsset']
  updateAsset: BudgetHook['updateAsset']
  deleteAsset: BudgetHook['deleteAsset']
}) {
  const snap = budget.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
  const assets = (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type === 'PENSION')
  const total = assets.reduce((a, i) => a + (i.amount || 0), 0)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const submit = () => { if (newLabel.trim()) { addAsset(owner, today, 'PENSION', newLabel.trim()); setNewLabel(''); setAdding(false) } }

  return (
    <div className="card mb-3 border-l-[3px] border-l-pension">
      <div className="flex justify-between items-center px-3 py-2.5 border-b border-border">
        <span className="font-semibold text-sm">{name}</span>
        <span className={`font-bold text-base tabular-nums ${total > 0 ? 'text-pension' : 'text-muted'}`}>{fmt(total)}</span>
      </div>
      <div className="px-3 pt-1 pb-2">
        {assets.map(asset => (
          <AssetRow key={asset.id} asset={asset as any} owner={owner} today={today} updateAsset={updateAsset} deleteAsset={deleteAsset} lockType />
        ))}
        {adding ? (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="e.g. Workplace Pension"
              autoFocus
              className="flex-1 min-w-[120px] text-[13px] border-[1.5px] border-border rounded-md px-2 py-1 outline-none"
            />
            <button onClick={submit} className="bg-pension text-white border-0 rounded-md px-3 py-1 cursor-pointer text-[13px]">Add</button>
            <button onClick={() => setAdding(false)} className="bg-transparent border-[1.5px] border-border rounded-md px-3 py-1 cursor-pointer text-[13px]">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 mt-2 bg-transparent border-0 cursor-pointer text-muted text-xs">
            <Plus size={12} /> Add pension
          </button>
        )}
      </div>
    </div>
  )
}

export default function SavingsScreen({ budget }: { budget: BudgetHook }) {
  const { data, addAsset, updateAsset, deleteAsset, resyncInterest, copyForwardAssets, moveAssetsToLastMonth } = budget
  const today = new Date().toISOString().slice(0, 7)

  const n1 = data.nameNiamh || 'Person 1'
  const n2 = data.nameRupert || 'Person 2'
  const n3 = data.nameJoint || 'Joint'

  const totalAll = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    return acc + (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type !== 'PENSION').reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)

  const totalPensions = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    return acc + (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type === 'PENSION').reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)

  const lastMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })()
  const totalLastMonth = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === lastMonth)
    return acc + (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type !== 'PENSION').reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)
  const totalPensionsLastMonth = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === lastMonth)
    return acc + (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type === 'PENSION').reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)

  const monthDiff = totalLastMonth > 0 ? totalAll - totalLastMonth : null
  const netWorthDiff = (totalLastMonth > 0 || totalPensionsLastMonth > 0)
    ? (totalAll + totalPensions) - (totalLastMonth + totalPensionsLastMonth)
    : null

  const currentMonthHasData = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).some(owner => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    return Array.isArray(snap?.assets) && snap!.assets.length > 0
  })
  const hasPreviousData = data.savingsHistory.some(s => s.date.slice(0, 7) < today)

  useEffect(() => {
    if (!currentMonthHasData && hasPreviousData) copyForwardAssets()
  }, []) // eslint-disable-line

  const months = Array.from(new Set(data.savingsHistory.map(s => s.date.slice(0, 7)))).sort()
  if (!months.includes(today)) months.push(today)
  const hasHistory = months.length > 1

  // Asset chart data (stacked by type)
  const chartData = months.map(month => {
    const allAssets = data.savingsHistory
      .filter(s => s.date.slice(0, 7) === month)
      .flatMap(s => Array.isArray(s.assets) ? s.assets : [])
      .filter((a: any) => a.type !== 'PENSION')
    const row: any = { month: formatMonth(month) }
    REGULAR_ASSET_TYPES.forEach(type => {
      row[ASSET_LABELS[type]] = allAssets.filter((a: any) => a.type === type).reduce((sum: number, a: any) => sum + (a.amount || 0), 0)
    })
    return row
  })
  const activeTypes = REGULAR_ASSET_TYPES.filter(type => chartData.some(row => (row[ASSET_LABELS[type]] || 0) > 0))

  // Pension chart data (stacked by owner)
  const pensionChartData = months.map(month => {
    const row: any = { month: formatMonth(month) }
    ;(['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).forEach(owner => {
      const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === month)
      const pension = (Array.isArray(snap?.assets) ? snap!.assets : [])
        .filter((a: any) => a.type === 'PENSION')
        .reduce((sum: number, a: any) => sum + (a.amount || 0), 0)
      const ownerName = owner === 'NIAMH' ? n1 : owner === 'RUPERT' ? n2 : n3
      row[ownerName] = pension
    })
    return row
  })
  const pensionOwnerKeys = [n1, n2, n3].filter(name => pensionChartData.some(r => (r[name] || 0) > 0))

  // Current allocation
  const currentRow = chartData[chartData.length - 1] ?? {}
  const allocationSegments = activeTypes.map(type => ({
    color: ASSET_COLORS[type],
    pct: totalAll > 0 ? ((currentRow[ASSET_LABELS[type]] || 0) / totalAll) * 100 : 0,
  }))

  // Current pension allocation
  const currentPensionRow = pensionChartData[pensionChartData.length - 1] ?? {}
  const pensionAllocationSegments = pensionOwnerKeys.map(key => ({
    color: key === n1 ? 'var(--niamh)' : key === n2 ? 'var(--rupert)' : 'var(--joint)',
    pct: totalPensions > 0 ? ((currentPensionRow[key] || 0) / totalPensions) * 100 : 0,
  }))

  // Interest income
  const byOwner = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).map(owner => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    const assets = (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.interestRate && a.amount > 0 && a.type !== 'PENSION')
    const monthly = assets.reduce((acc: number, a: any) => acc + (a.amount * (a.interestRate || 0)) / 100 / 12, 0)
    return { owner, monthly, assets }
  }).filter(o => o.monthly > 0)
  const totalMonthly = byOwner.reduce((a, o) => a + o.monthly, 0)

  return (
    <div className="h-full overflow-y-auto p-4">

      {/* Summary stat cards */}
      <div className="flex gap-2 mb-4">
        <StatCard
          label="Assets"
          value={fmtK(totalAll)}
          sub={monthDiff !== null ? `${monthDiff >= 0 ? '+' : ''}${fmtK(monthDiff)} vs last mo` : undefined}
          intent={totalAll > 0 ? 'positive' : 'neutral'}
        />
        <StatCard
          label="Pensions"
          value={fmtK(totalPensions)}
          intent={totalPensions > 0 ? 'positive' : 'neutral'}
        />
        <StatCard
          label="Net Worth"
          value={fmtK(totalAll + totalPensions)}
          sub={netWorthDiff !== null ? `${netWorthDiff >= 0 ? '+' : ''}${fmtK(netWorthDiff)} vs last mo` : undefined}
          intent={totalAll + totalPensions > 0 ? 'positive' : 'neutral'}
        />
      </div>

      {/* Portfolio chart */}
      {(totalAll > 0 || activeTypes.length > 0) && (
        <div className="card p-4 mb-4">
          <div className="flex justify-between items-baseline mb-3">
            <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em]">Portfolio</div>
            {netWorthDiff !== null && (
              <div className={`flex items-center gap-1 text-[11px] font-semibold tabular-nums ${netWorthDiff >= 0 ? 'text-positive' : 'text-negative'}`}>
                {netWorthDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {netWorthDiff >= 0 ? '+' : ''}{fmtK(netWorthDiff)}
              </div>
            )}
          </div>

          <AllocationBar segments={allocationSegments} />

          {hasHistory && (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} />
                {activeTypes.map(type => (
                  <Area
                    key={type}
                    type="monotone"
                    dataKey={ASSET_LABELS[type]}
                    name={ASSET_LABELS[type]}
                    stackId="a"
                    stroke={ASSET_COLORS[type]}
                    fill={ASSET_COLORS[type]}
                    fillOpacity={0.8}
                    strokeWidth={0}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Allocation breakdown */}
          <div className="mt-3 space-y-2">
            {activeTypes.map(type => {
              const value = currentRow[ASSET_LABELS[type]] || 0
              const pct = totalAll > 0 ? (value / totalAll) * 100 : 0
              if (value === 0) return null
              return (
                <div key={type}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0 inline-block" style={{ background: ASSET_COLORS[type] }} />
                      {ASSET_LABELS[type]}
                    </span>
                    <span className="text-xs tabular-nums text-muted">
                      {fmt(value)} <span className="text-[10px]">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-[6px] bg-surface rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(pct, 0.5)}%`, background: ASSET_COLORS[type] }} />
                  </div>
                </div>
              )
            })}
            <div className="flex justify-between text-xs pt-2 mt-1 border-t border-border">
              <span className="text-muted font-medium">Total assets</span>
              <span className="tabular-nums font-bold text-positive">{fmt(totalAll)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit controls */}
      <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
        <div className="text-[11px] text-muted">
          {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · tap to edit · long press to delete
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              const prev = new Date(); prev.setMonth(prev.getMonth() - 1)
              const label = prev.toLocaleDateString('en-GB', { month: 'long' })
              if (confirm(`Save current figures as ${label} and clear this month?`)) moveAssetsToLastMonth()
            }}
            className="text-[11px] bg-transparent text-negative border-[1.5px] border-negative/40 rounded-md px-2 py-[3px] cursor-pointer"
          >
            These are last month's figures
          </button>
          {hasPreviousData && (
            <button
              onClick={copyForwardAssets}
              className="text-[11px] bg-transparent text-muted border-[1.5px] border-border rounded-md px-2 py-[3px] cursor-pointer"
            >
              Reset to last month
            </button>
          )}
        </div>
      </div>

      {/* Owner panels */}
      <OwnerPanel owner="NIAMH"  name={n1} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
      <OwnerPanel owner="RUPERT" name={n2} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
      <OwnerPanel owner="JOINT"  name={n3} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />

      {/* Interest income */}
      {byOwner.length > 0 && (
        <div className="card p-4 mt-1">
          <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em] mb-3">Interest Income</div>
          {byOwner.map(({ owner, monthly }) => (
            <div key={owner} className="flex justify-between text-[13px] py-1 border-b border-border">
              <span className="text-muted">{owner === 'NIAMH' ? n1 : owner === 'RUPERT' ? n2 : n3}</span>
              <span className="tabular-nums font-semibold text-positive">
                {fmt(monthly)}/mo · {fmt(monthly * 12)}/yr
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold py-2 pb-3 text-positive">
            <span>Total</span>
            <span className="tabular-nums">{fmt(totalMonthly)}/mo · {fmt(totalMonthly * 12)}/yr</span>
          </div>
          <button
            onClick={() => resyncInterest(byOwner.map(({ owner, assets }) => ({ owner, assets })))}
            className="w-full bg-positive text-white border-0 rounded-lg px-4 py-2.5 cursor-pointer text-[13px] font-semibold"
          >
            Re-sync interest to budget income
          </button>
          <p className="text-[11px] text-muted mt-2 mb-0 text-center">
            Automatically removes old interest items and recreates with current values
          </p>
        </div>
      )}

      {/* Pensions section */}
      <div className="mt-6 pt-6 border-t-2 border-pension-light">
        <div className="flex justify-between items-baseline mb-4">
          <h2 className="font-serif text-xl m-0 text-pension">Pensions</h2>
          <div className={`text-lg font-bold tabular-nums ${totalPensions > 0 ? 'text-pension' : 'text-muted'}`}>
            {fmt(totalPensions)}
          </div>
        </div>

        {pensionOwnerKeys.length > 0 && (
          <div className="card p-4 mb-4 border-l-[3px] border-l-pension">
            <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em] mb-3">Pension Growth Over Time</div>

            <AllocationBar segments={pensionAllocationSegments} />

            {hasHistory && (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={pensionChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip />} />
                  {pensionOwnerKeys.map(key => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stackId="p"
                      stroke={key === n1 ? 'var(--niamh)' : key === n2 ? 'var(--rupert)' : 'var(--joint)'}
                      fill={key === n1 ? 'var(--niamh)' : key === n2 ? 'var(--rupert)' : 'var(--joint)'}
                      fillOpacity={0.8}
                      strokeWidth={0}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Per-owner breakdown */}
            <div className="mt-3 space-y-2">
              {pensionOwnerKeys.map(key => {
                const value = currentPensionRow[key] || 0
                const pct = totalPensions > 0 ? (value / totalPensions) * 100 : 0
                const color = key === n1 ? 'var(--niamh)' : key === n2 ? 'var(--rupert)' : 'var(--joint)'
                if (value === 0) return null
                return (
                  <div key={key}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: color }} />
                        {key}
                      </span>
                      <span className="text-xs tabular-nums text-muted">
                        {fmt(value)} <span className="text-[10px]">{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-[6px] bg-surface rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(pct, 0.5)}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
              <div className="flex justify-between text-xs pt-2 mt-1 border-t border-border">
                <span className="text-muted font-medium">Total pensions</span>
                <span className="tabular-nums font-bold text-pension">{fmt(totalPensions)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-[11px] text-muted mb-3">
          Tap to edit values · Long press to delete
        </div>

        <PensionOwnerPanel owner="NIAMH"  name={n1} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
        <PensionOwnerPanel owner="RUPERT" name={n2} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
        <PensionOwnerPanel owner="JOINT"  name={n3} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
      </div>
    </div>
  )
}
