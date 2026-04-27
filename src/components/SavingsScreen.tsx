'use client'

import { useState } from 'react'
import { Owner, AssetType, fmt } from '@/lib/models'
import { Plus, Trash2 } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const ASSET_LABELS: Record<AssetType, string> = { CASH: 'Cash', CASH_ISA: 'Cash ISA', STOCKS_SHARES_ISA: 'S&S ISA', JUNIOR_ISA: 'Junior ISA', LIFETIME_ISA: 'LISA', SAVINGS_ACCOUNT: 'Savings Account', CRYPTO: 'Crypto', OTHER: 'Other' }
const OWNER_COLORS: Record<Owner, string> = { NIAMH: 'var(--niamh)', RUPERT: 'var(--rupert)', JOINT: 'var(--joint)' }

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

function OwnerPanel({ owner, name, budget, addAsset, updateAsset, deleteAsset }: { owner: Owner; name: string; budget: BudgetHook['data']; addAsset: BudgetHook['addAsset']; updateAsset: BudgetHook['updateAsset']; deleteAsset: BudgetHook['deleteAsset'] }) {
  const today = new Date().toISOString().slice(0, 7)
  const snap = budget.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
  const assets = snap?.assets ?? []
  const total = assets.reduce((a, i) => a + i.amount, 0)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<AssetType>('SAVINGS_ACCOUNT')

  const submit = () => { if (newLabel.trim()) { addAsset(owner, today, newType, newLabel.trim()); setNewLabel(''); setAdding(false) } }

  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${OWNER_COLORS[owner]}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
        <span style={{ fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums', color: total > 0 ? 'var(--positive)' : 'var(--muted)' }}>{fmt(total)}</span>
      </div>
      <div style={{ padding: '4px 12px 8px' }}>
        {assets.map(asset => (
          <div key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontSize: 13 }}>{asset.label}</span>
            <span style={{ fontSize: 10, background: 'var(--surface)', padding: '2px 6px', borderRadius: 4, color: 'var(--muted)' }}>{ASSET_LABELS[asset.type]}</span>
            <AmountInput value={asset.amount} onChange={v => updateAsset(owner, today, asset.id, v)} />
            <button onClick={() => deleteAsset(owner, today, asset.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', display: 'flex', padding: 2 }}><Trash2 size={12} /></button>
          </div>
        ))}
        {adding ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="Account name…" autoFocus
              style={{ flex: 1, minWidth: 120, fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', outline: 'none' }} />
            <select value={newType} onChange={e => setNewType(e.target.value as AssetType)} style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--card)', cursor: 'pointer' }}>
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
  const { data, addAsset, updateAsset, deleteAsset } = budget
  const today = new Date().toISOString().slice(0, 7)
  const totalAll = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    return acc + (snap?.assets.reduce((a, i) => a + i.amount, 0) ?? 0)
  }, 0)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Assets</h2>
        <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: totalAll > 0 ? 'var(--positive)' : 'var(--muted)' }}>Total: {fmt(totalAll)}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
        {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
      </div>
      <OwnerPanel owner="NIAMH"  name={data.nameNiamh}  budget={data} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
      <OwnerPanel owner="RUPERT" name={data.nameRupert} budget={data} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
      <OwnerPanel owner="JOINT"  name={data.nameJoint}  budget={data} addAsset={addAsset} updateAsset={updateAsset} deleteAsset={deleteAsset} />
    </div>
  )
}
