'use client'

import { useState, useEffect } from 'react'
import { Owner, Asset, AssetType, fmt, netWorth, monthlyInterest, annualInterest, blendedAer, isCapped } from '@/lib/models'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { StatCard, ConfirmDelete, AmountCell, TapToEdit, ExpandButton, DeleteAction, Field, inputClass, useLongPress, ownerBorderClass } from './ui'
import PropertiesSection from './PropertiesSection'
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

function AssetRow({ asset, owner, today, updateAsset, updateAssetFields, deleteAsset, lockType }: {
  asset: Asset
  owner: Owner; today: string
  updateAsset: BudgetHook['updateAsset']
  updateAssetFields: BudgetHook['updateAssetFields']
  deleteAsset: BudgetHook['deleteAsset']
  lockType?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [showCap, setShowCap] = useState(isCapped(asset))
  const longPress = useLongPress(() => setDeleteModal(true))

  return (
    <>
      {deleteModal && (
        <ConfirmDelete
          label={asset.label}
          detail="Removes it from this month's snapshot. Earlier months keep their figures."
          onConfirm={() => { deleteAsset(owner, today, asset.id); setDeleteModal(false) }}
          onCancel={() => setDeleteModal(false)}
        />
      )}
      <div className="border-b border-border last:border-0" {...longPress}>
        <div className="flex items-center gap-1.5 py-1.5 min-h-[44px]">
          <div className="flex-1 min-w-0">
            <TapToEdit
              value={asset.label}
              onSave={v => updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, asset.institution, v)}
              className="text-body font-medium block"
            />
            <div className="text-caption text-muted mt-px">
              {ASSET_LABELS[asset.type] ?? asset.type}
              {asset.institution ? ` · ${asset.institution}` : ''}
              {annualInterest(asset) > 0 ? (
                <span className="text-positive font-semibold ml-1">
                  {` · £${monthlyInterest(asset).toFixed(0)}/mo (${isCapped(asset) && asset.amount > (asset.rateCap ?? 0) ? `${blendedAer(asset).toFixed(2)}% combined` : `${asset.interestRate}% AER`} = £${annualInterest(asset).toFixed(0)}/yr)`}
                </span>
              ) : asset.interestRate ? <span>{` · ${asset.interestRate}%`}</span> : null}
              {isCapped(asset) && asset.amount > (asset.rateCap ?? 0) && (
                <span className="block text-expense-text">
                  Over the £{(asset.rateCap ?? 0).toLocaleString('en-GB')} cap — new money here earns {asset.rateAboveCap || 0}%
                </span>
              )}
            </div>
          </div>
          <AmountCell value={asset.amount || 0} onChange={v => updateAsset(owner, today, asset.id, v, asset.interestRate, asset.institution)} />
          <ExpandButton expanded={expanded} onClick={() => setExpanded(e => !e)} label={expanded ? `Collapse ${asset.label}` : `Details for ${asset.label}`} />
        </div>
        {expanded && (
          <div className="pb-2 flex flex-wrap gap-2">
            {!lockType && (
              <div className="flex flex-col gap-0.5">
                <label className="text-caption text-muted uppercase tracking-label">Type</label>
                <select
                  value={asset.type}
                  onChange={e => updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, asset.institution, undefined, e.target.value as AssetType)}
                  className="text-xs border-[1.5px] border-border rounded-lg px-1.5 py-1 bg-card"
                >
                  {Object.entries(ASSET_LABELS).filter(([k]) => k !== 'PENSION').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <label className="text-caption text-muted uppercase tracking-label">{showCap ? 'Rate % (to cap)' : 'Rate %'}</label>
              <input
                type="number"
                value={asset.interestRate || ''}
                placeholder="0"
                onChange={e => updateAsset(owner, today, asset.id, asset.amount, parseFloat(e.target.value) || undefined, asset.institution)}
                className="w-[70px] text-xs border-[1.5px] border-border rounded-lg px-1.5 py-1 outline-none"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-caption text-muted uppercase tracking-label">Institution</label>
              <input
                value={asset.institution || ''}
                placeholder="e.g. Monzo"
                onChange={e => updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, e.target.value)}
                className="w-[110px] text-xs border-[1.5px] border-border rounded-lg px-1.5 py-1 outline-none"
              />
            </div>
            {asset.type !== 'PENSION' && (
              <div className="w-full">
                <label className="flex items-start gap-2 cursor-pointer min-h-[32px]">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 shrink-0"
                    checked={showCap}
                    onChange={e => {
                      setShowCap(e.target.checked)
                      if (!e.target.checked) updateAssetFields(owner, today, asset.id, { rateCap: undefined, rateAboveCap: undefined })
                    }}
                  />
                  <span className="text-xs leading-snug">
                    Rate only applies up to a limit
                    <span className="block text-caption text-muted mt-0.5">For regular savers and capped accounts, e.g. 5.25% on the first £5,000 then 1%.</span>
                  </span>
                </label>
                {showCap && (
                  <div className="flex gap-2 flex-wrap mt-1.5">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-caption text-muted uppercase tracking-label">Up to £</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={asset.rateCap ?? ''}
                        placeholder="5000"
                        onChange={e => updateAssetFields(owner, today, asset.id, { rateCap: parseFloat(e.target.value) || undefined })}
                        className="w-[90px] text-xs border-[1.5px] border-border rounded-lg px-1.5 py-1 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-caption text-muted uppercase tracking-label">Then %</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={asset.rateAboveCap ?? ''}
                        placeholder="0"
                        onChange={e => updateAssetFields(owner, today, asset.id, { rateAboveCap: parseFloat(e.target.value) || undefined })}
                        className="w-[70px] text-xs border-[1.5px] border-border rounded-lg px-1.5 py-1 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {asset.type === 'PENSION' && (
              <>
                <div className="flex flex-col gap-0.5">
                  <label className="text-caption text-muted uppercase tracking-label">You £/mo</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={asset.monthlyContribution ?? ''}
                    placeholder="0"
                    onChange={e => updateAssetFields(owner, today, asset.id, { monthlyContribution: parseFloat(e.target.value) || undefined })}
                    className="w-[80px] text-xs border-[1.5px] border-border rounded-lg px-1.5 py-1 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-caption text-muted uppercase tracking-label">Employer £/mo</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={asset.employerContribution ?? ''}
                    placeholder="0"
                    onChange={e => updateAssetFields(owner, today, asset.id, { employerContribution: parseFloat(e.target.value) || undefined })}
                    className="w-[80px] text-xs border-[1.5px] border-border rounded-lg px-1.5 py-1 outline-none"
                  />
                </div>
                <p className="text-caption text-muted w-full m-0 leading-snug">
                  For the health check only — workplace pensions usually come out before your
                  take-home pay, so these aren&apos;t added to your budget as outgoings.
                </p>
              </>
            )}
            <div className="w-full pt-1 border-t border-border">
              <DeleteAction label={asset.type === 'PENSION' ? 'Delete pension' : 'Delete asset'} onClick={() => setDeleteModal(true)} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function OwnerPanel({ owner, name, budget, addAsset, updateAsset, updateAssetFields, deleteAsset, today }: {
  owner: Owner; name: string; budget: BudgetHook['data']; today: string
  addAsset: BudgetHook['addAsset']
  updateAsset: BudgetHook['updateAsset']
  updateAssetFields: BudgetHook['updateAssetFields']
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
          <AssetRow key={asset.id} asset={asset as any} owner={owner} today={today} updateAsset={updateAsset} updateAssetFields={updateAssetFields} deleteAsset={deleteAsset} />
        ))}
        {adding ? (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="Account name..."
              autoFocus
              className="flex-1 min-w-[120px] text-body border-[1.5px] border-border rounded-lg px-2 py-1 outline-none"
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as AssetType)}
              className="text-body border-[1.5px] border-border rounded-lg px-2 py-1 bg-card cursor-pointer"
            >
              {REGULAR_ASSET_TYPES.map(t => <option key={t} value={t}>{ASSET_LABELS[t]}</option>)}
            </select>
            <button onClick={submit} className="bg-ink text-on-ink border-0 rounded-lg px-3 py-1 cursor-pointer text-body">Add</button>
            <button onClick={() => setAdding(false)} className="bg-transparent border-[1.5px] border-border rounded-lg px-3 py-1 cursor-pointer text-body">Cancel</button>
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

function PensionOwnerPanel({ owner, name, budget, addAsset, updateAsset, updateAssetFields, deleteAsset, today }: {
  owner: Owner; name: string; budget: BudgetHook['data']; today: string
  addAsset: BudgetHook['addAsset']
  updateAsset: BudgetHook['updateAsset']
  updateAssetFields: BudgetHook['updateAssetFields']
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
          <AssetRow key={asset.id} asset={asset as any} owner={owner} today={today} updateAsset={updateAsset} updateAssetFields={updateAssetFields} deleteAsset={deleteAsset} lockType />
        ))}
        {adding ? (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="e.g. Workplace Pension"
              autoFocus
              className="flex-1 min-w-[120px] text-body border-[1.5px] border-border rounded-lg px-2 py-1 outline-none"
            />
            <button onClick={submit} className="bg-pension text-on-ink border-0 rounded-lg px-3 py-1 cursor-pointer text-body">Add</button>
            <button onClick={() => setAdding(false)} className="bg-transparent border-[1.5px] border-border rounded-lg px-3 py-1 cursor-pointer text-body">Cancel</button>
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
  const { data, addAsset, updateAsset, updateAssetFields, deleteAsset, resyncInterest, copyForwardAssets, moveAssetsToLastMonth } = budget
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

  const pensionContributions = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    const pensions = (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type === 'PENSION')
    const own = pensions.reduce((a, i: any) => a + (i.monthlyContribution || 0), 0)
    const employer = pensions.reduce((a, i: any) => a + (i.employerContribution || 0), 0)
    return { own: acc.own + own, employer: acc.employer + employer, total: acc.total + own + employer }
  }, { own: 0, employer: 0, total: 0 })

  const lastMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })()
  const totalLastMonth = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === lastMonth)
    return acc + (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type !== 'PENSION').reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)

  // Everything owned minus everything owed — property values in, all debt out.
  const worth = netWorth(data, today)
  const monthDiff = totalLastMonth > 0 ? totalAll - totalLastMonth : null
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
    const assets = (Array.isArray(snap?.assets) ? snap!.assets : []).filter(a => a.type !== 'PENSION' && monthlyInterest(a) > 0)
    const monthly = assets.reduce((acc, a) => acc + monthlyInterest(a), 0)
    return { owner, monthly, assets }
  }).filter(o => o.monthly > 0)
  const totalMonthly = byOwner.reduce((a, o) => a + o.monthly, 0)

  return (
    <div className="h-full overflow-y-auto p-4">

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatCard
          label="Savings"
          value={fmtK(totalAll)}
          sub={monthDiff !== null ? `${monthDiff >= 0 ? '+' : ''}${fmtK(monthDiff)} vs last mo` : undefined}
          intent={totalAll > 0 ? 'positive' : 'neutral'}
        />
        <StatCard label="Pensions" value={fmtK(totalPensions)} intent={totalPensions > 0 ? 'positive' : 'neutral'} />
        <StatCard
          label="Property"
          value={worth.property > 0 ? fmtK(worth.property) : '—'}
          sub={worth.property > 0 ? 'estimated value' : 'add below'}
          intent="neutral"
        />
        <StatCard
          label="Net worth"
          value={fmtK(worth.total)}
          sub={worth.debts > 0 ? `after ${fmtK(worth.debts)} owed` : undefined}
          intent={worth.total > 0 ? 'positive' : worth.total < 0 ? 'negative' : 'neutral'}
        />
      </div>

      {/* Portfolio chart */}
      {(totalAll > 0 || activeTypes.length > 0) && (
        <div className="card p-4 mb-4">
          <div className="flex justify-between items-baseline mb-3">
            <div className="text-xs font-semibold text-muted uppercase tracking-label">Portfolio</div>
            {monthDiff !== null && (
              <div className={`flex items-center gap-1 text-label font-semibold tabular-nums ${monthDiff >= 0 ? 'text-positive' : 'text-negative'}`}>
                {monthDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {monthDiff >= 0 ? '+' : ''}{fmtK(monthDiff)}
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
                    <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0 inline-block" style={{ background: ASSET_COLORS[type] }} />
                      {ASSET_LABELS[type]}
                    </span>
                    <span className="text-xs tabular-nums text-muted">
                      {fmt(value)} <span className="text-caption">{pct.toFixed(0)}%</span>
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
        <div className="text-label text-muted">
          {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · tap to edit · open a row to delete
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              const prev = new Date(); prev.setMonth(prev.getMonth() - 1)
              const label = prev.toLocaleDateString('en-GB', { month: 'long' })
              if (confirm(`Save current figures as ${label} and clear this month?`)) moveAssetsToLastMonth()
            }}
            className="text-label bg-transparent text-negative border-[1.5px] border-negative rounded-lg px-2 py-[3px] cursor-pointer"
          >
            These are last month's figures
          </button>
          {hasPreviousData && (
            <button
              onClick={copyForwardAssets}
              className="text-label bg-transparent text-muted border-[1.5px] border-border rounded-lg px-2 py-[3px] cursor-pointer"
            >
              Reset to last month
            </button>
          )}
        </div>
      </div>

      {/* Owner panels */}
      <OwnerPanel owner="NIAMH"  name={n1} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} updateAssetFields={updateAssetFields} deleteAsset={deleteAsset} />
      <OwnerPanel owner="RUPERT" name={n2} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} updateAssetFields={updateAssetFields} deleteAsset={deleteAsset} />
      <OwnerPanel owner="JOINT"  name={n3} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} updateAssetFields={updateAssetFields} deleteAsset={deleteAsset} />

      {/* Interest income */}
      {byOwner.length > 0 && (
        <div className="card p-4 mt-1">
          <div className="text-xs font-semibold text-muted uppercase tracking-label mb-3">Interest Income</div>
          {byOwner.map(({ owner, monthly }) => (
            <div key={owner} className="flex justify-between text-body py-1 border-b border-border">
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
            className="w-full bg-positive text-on-ink border-0 rounded-lg px-4 py-2.5 cursor-pointer text-body font-semibold"
          >
            Re-sync interest to budget income
          </button>
          <p className="text-label text-muted mt-2 mb-0 text-center">
            Automatically removes old interest items and recreates with current values
          </p>
        </div>
      )}

      <PropertiesSection budget={budget} />

      {/* Pensions section */}
      <div className="mt-6 pt-6 border-t-2 border-pension-light">
        <div className="flex justify-between items-baseline mb-1">
          <h2 className="font-serif text-xl m-0 text-pension">Pensions</h2>
          <div className={`text-lg font-bold tabular-nums ${totalPensions > 0 ? 'text-pension' : 'text-muted'}`}>
            {fmt(totalPensions)}
          </div>
        </div>
        {pensionContributions.total > 0 && (
          <div className="text-label text-muted mb-4 text-right">
            {fmt(pensionContributions.total)}/mo going in
            {pensionContributions.employer > 0 && ` · ${fmt(pensionContributions.employer)} from employers`}
            {' · '}{fmt(pensionContributions.total * 12)}/yr
          </div>
        )}
        {pensionContributions.total === 0 && <div className="mb-4" />}

        {pensionOwnerKeys.length > 0 && (
          <div className="card p-4 mb-4 border-l-[3px] border-l-pension">
            <div className="text-xs font-semibold text-muted uppercase tracking-label mb-3">Pension Growth Over Time</div>

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
                      <span className="text-xs font-medium text-ink flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: color }} />
                        {key}
                      </span>
                      <span className="text-xs tabular-nums text-muted">
                        {fmt(value)} <span className="text-caption">{pct.toFixed(0)}%</span>
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

        <PensionOwnerPanel owner="NIAMH"  name={n1} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} updateAssetFields={updateAssetFields} deleteAsset={deleteAsset} />
        <PensionOwnerPanel owner="RUPERT" name={n2} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} updateAssetFields={updateAssetFields} deleteAsset={deleteAsset} />
        <PensionOwnerPanel owner="JOINT"  name={n3} budget={data} today={today} addAsset={addAsset} updateAsset={updateAsset} updateAssetFields={updateAssetFields} deleteAsset={deleteAsset} />
      </div>
    </div>
  )
}
