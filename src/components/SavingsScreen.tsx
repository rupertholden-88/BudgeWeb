'use client'

import { useState } from 'react'
import { Owner, AssetType, fmt } from '@/lib/models'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

function calcMonthlyYield(assets: any[]) {
  return assets
    .filter(a => a.interestRate && a.amount > 0)
    .reduce((acc, a) => acc + (a.amount * a.interestRate) / 100 / 12, 0)
}

const ASSET_LABELS: Record<AssetType, string> = {
  CASH: 'Cash', CASH_ISA: 'Cash ISA', STOCKS_SHARES_ISA: 'S&S ISA',
  JUNIOR_ISA: 'Junior ISA', LIFETIME_ISA: 'LISA',
  SAVINGS_ACCOUNT: 'Savings Account', CRYPTO: 'Crypto', OTHER: 'Other'
}
const OWNER_COLORS: Record<Owner, string> = {
  NIAMH: 'var(--niamh)', RUPERT: 'var(--rupert)', JOINT: 'var(--joint)'
}

function AmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  if (editing) return (
    <input value={raw} onChange={e => setRaw(e.target.value)}
      onBlur={() => { onChange(parseFloat(raw.replace(/[£,]/g, '')) || 0); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(parseFloat(raw.replace(/[£,]/g, '')) || 0); setEditing(false) } }}
      style={{ width: 90, textAlign: 'right', fontSize: 14, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px', outline: 'none', background: 'var(--rupert-light)' }}
      inputMode="decimal" autoFocus />
  )
  return (
    <span onClick={() => { setRaw(value === 0 ? '' : String(value)); setEditing(true) }}
      style={{ cursor: 'text', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: value > 0 ? 'var(--ink)' : 'var(--muted)', minWidth: 80, textAlign: 'right', display: 'inline-block', padding: '2px 4px', borderRadius: 4 }}>
      {value > 0 ? fmt(value) : '—'}
    </span>
  )
}

function AssetRow({ asset, owner, today, updateAsset, deleteAsset }: {
  asset: { id: string; label: string; amount: number; type: AssetType; interestRate?: number; institution?: string }
  owner: Owner
  today: string
  updateAsset: BudgetHook['updateAsset']
  deleteAsset: BudgetHook['deleteAsset']
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(asset.label)
  const [editingType, setEditingType] = useState(false)

  const commitLabel = () => {
    if (labelDraft.trim()) {
      updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, asset.institution)
    }
    setEditingLabel(false)
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
        {editingLabel ? (
          <>
            <input value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, asset.institution); setEditingLabel(false) } }}
              onBlur={() => { updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, asset.institution); setEditingLabel(false) }}
              style={{ flex: 1, fontSize: 13, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px', outline: 'none' }}
              autoFocus />
            <button onClick={commitLabel} style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', display: 'flex' }}>
              <Check size={12} />
            </button>
          </>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{asset.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                {ASSET_LABELS[asset.type] ?? asset.type}
                {asset.institution ? ` · ${asset.institution}` : ''}
                {asset.interestRate && asset.amount > 0 ? (
                  <span style={{ color: 'var(--positive)', fontWeight: 600, marginLeft: 4 }}>
                    {` · £${((asset.amount * asset.interestRate) / 100 / 12).toFixed(0)}/mo`}
                    {` (${asset.interestRate}% = £${((asset.amount * asset.interestRate) / 100).toFixed(0)}/yr)`}
                  </span>
                ) : asset.interestRate ? <span style={{ color: 'var(--muted)' }}>{` · ${asset.interestRate}%`}</span> : null}
              </div>
            </div>
            <button onClick={() => { setLabelDraft(asset.label); setEditingLabel(true) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', display: 'flex', padding: 2 }}>
              <Pencil size={11} />
            </button>
          </>
        )}
        <AmountInput value={asset.amount || 0} onChange={v => updateAsset(owner, today, asset.id, v, asset.interestRate, asset.institution)} />
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 10, padding: '2px 4px' }}>
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={() => deleteAsset(owner, today, asset.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', display: 'flex', padding: 2 }}>
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '0 0 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</label>
            <select value={asset.type}
              onChange={e => updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, asset.institution)}
              style={{ fontSize: 12, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 6px', background: 'var(--card)' }}>
              {Object.entries(ASSET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate %</label>
            <input type="number" value={asset.interestRate || ''}
              onChange={e => updateAsset(owner, today, asset.id, asset.amount, parseFloat(e.target.value) || undefined, asset.institution)}
              placeholder="0"
              style={{ width: 70, fontSize: 12, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 6px', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Institution</label>
            <input value={asset.institution || ''}
              onChange={e => updateAsset(owner, today, asset.id, asset.amount, asset.interestRate, e.target.value)}
              placeholder="e.g. Monzo"
              style={{ width: 110, fontSize: 12, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 6px', outline: 'none' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function OwnerPanel({ owner, name, budget, addAsset, updateAsset, deleteAsset }: {
  owner: Owner; name: string; budget: BudgetHook['data']
  addAsset: BudgetHook['addAsset']
  updateAsset: BudgetHook['updateAsset']
  deleteAsset: BudgetHook['deleteAsset']
}) {
  const today = new Date().toISOString().slice(0, 7)
  const snap = budget.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
  const assets = Array.isArray(snap?.assets) ? snap!.assets : []
  const total = assets.reduce((a, i) => a + (i.amount || 0), 0)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<AssetType>('SAVINGS_ACCOUNT')

  const submit = () => {
    if (newLabel.trim()) { addAsset(owner, today, newType, newLabel.trim()); setNewLabel(''); setAdding(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${OWNER_COLORS[owner]}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
        <span style={{ fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums', color: total > 0 ? 'var(--positive)' : 'var(--muted)' }}>{fmt(total)}</span>
      </div>
      <div style={{ padding: '4px 12px 8px' }}>
        {assets.map(asset => (
          <AssetRow key={asset.id} asset={asset as any} owner={owner} today={today} updateAsset={updateAsset} deleteAsset={deleteAsset} />
        ))}
        {adding ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="Account name..." autoFocus
              style={{ flex: 1, minWidth: 120, fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', outline: 'none' }} />
            <select value={newType} onChange={e => setNewType(e.target.value as AssetType)}
              style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--card)', cursor: 'pointer' }}>
              {Object.entries(ASSET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={submit} style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}>Add</button>
            <button onClick={() => setAdding(false)} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}>
            <Plus size={12} /> Add asset
          </button>
        )}
      </div>
    </div>
  )
}

export default function SavingsScreen({ budget }: { budget: BudgetHook }) {
  const { data, addAsset, updateAsset, deleteAsset, addItem } = budget
  const today = new Date().toISOString().slice(0, 7)
  const totalAll = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    const assets = Array.isArray(snap?.assets) ? snap!.assets : []
    return acc + assets.reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Assets</h2>
        <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: totalAll > 0 ? 'var(--positive)' : 'var(--muted)' }}>
          Total: {fmt(totalAll)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
        {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
      </div>
      <OwnerPanel owner="NIAMH"  name={data.nameNiamh  || 'Person 1'} budget={data} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
      <OwnerPanel owner="RUPERT" name={data.nameRupert || 'Person 2'} budget={data} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
      <OwnerPanel owner="JOINT"  name={data.nameJoint  || 'Joint'}    budget={data} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />

      {/* Interest yield summary */}
      {(() => {
        const allAssets = data.savingsHistory
          .filter(s => s.date.slice(0, 7) === today)
          .flatMap(s => Array.isArray(s.assets) ? s.assets : [])
          .filter(a => a.interestRate && a.amount > 0)

        if (allAssets.length === 0) return null

        const totalMonthly = allAssets.reduce((acc, a) => acc + (a.amount * a.interestRate) / 100 / 12, 0)
        const totalAnnual = totalMonthly * 12

        const byOwner = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).map(owner => {
          const ownerAssets = data.savingsHistory
            .find(s => s.owner === owner && s.date.slice(0, 7) === today)
          const assets = Array.isArray(ownerAssets?.assets) ? ownerAssets!.assets.filter((a: any) => a.interestRate && a.amount > 0) : []
          const monthly = assets.reduce((acc: number, a: any) => acc + (a.amount * a.interestRate) / 100 / 12, 0)
          return { owner, monthly, assets }
        }).filter(o => o.monthly > 0)

        return (
          <div className="card" style={{ padding: 16, marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Interest Income</div>
            {byOwner.map(({ owner, monthly }) => (
              <div key={owner} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>{owner === 'NIAMH' ? data.nameNiamh : owner === 'RUPERT' ? data.nameRupert : data.nameJoint}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--positive)' }}>
                  {fmt(monthly)}/mo · {fmt(monthly * 12)}/yr
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, padding: '8px 0 12px', color: 'var(--positive)' }}>
              <span>Total</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(totalMonthly)}/mo · {fmt(totalAnnual)}/yr</span>
            </div>
            <button
              onClick={() => {
                if (!confirm('This will replace any existing interest income items in your budget. Continue?')) return
                byOwner.forEach(({ owner, monthly, assets }) => {
                  const catKey = owner === 'NIAMH' ? 'inc_n' : owner === 'RUPERT' ? 'inc_r' : 'inc_joint'
                  assets.forEach((a: any) => {
                    addItem(catKey, `Interest - ${a.label}`)
                  })
                })
              }}
              style={{ width: '100%', background: 'var(--positive)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              Sync interest to budget income
            </button>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0', textAlign: 'center' }}>
              Remove manual interest entries from Budget first
            </p>
          </div>
        )
      })()}
    </div>
  )
}
