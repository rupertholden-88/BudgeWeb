'use client'

import { useState, useRef } from 'react'
import { TabFilter, Owner, EntryType, fmt } from '@/lib/models'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

function ownerLightColor(owner: Owner) {
  if (owner === 'NIAMH') return 'var(--niamh-light)'
  if (owner === 'RUPERT') return 'var(--rupert-light)'
  return 'var(--joint-light)'
}

function typeColor(type: EntryType) {
  if (type === 'INCOME') return { bg: 'var(--income-bg)', text: 'var(--income-text)' }
  if (type === 'EXPENSE') return { bg: 'var(--expense-bg)', text: 'var(--expense-text)' }
  return { bg: 'var(--savings-bg)', text: 'var(--savings-text)' }
}

function DeleteModal({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: '16px 16px 0 0', padding: '20px 20px 32px', width: '100%', maxWidth: 480 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Delete "{label}"?</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>This can't be undone.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onConfirm} style={{ background: 'var(--expense-text)', color: 'white', border: 'none', borderRadius: 10, padding: 14, cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>Delete</button>
          <button onClick={onCancel} style={{ background: 'var(--surface)', color: 'var(--ink)', border: 'none', borderRadius: 10, padding: 14, cursor: 'pointer', fontSize: 15 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function AmountCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const start = () => { setRaw(value === 0 ? '' : String(value)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  const commit = () => { const n = parseFloat(raw.replace(/[£,]/g, '')); onChange(isNaN(n) ? 0 : n); setEditing(false) }
  if (editing) return (
    <input ref={inputRef} value={raw} onChange={e => setRaw(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') commit() }}
      style={{ width: 80, textAlign: 'right', fontSize: 14, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px', background: 'var(--rupert-light)' }}
      inputMode="decimal" autoFocus />
  )
  return (
    <span onClick={start} role="button" tabIndex={0}
      onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') start() }}
      style={{ cursor: 'text', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: value > 0 ? 'var(--ink)' : 'var(--muted)', padding: '2px 4px', borderRadius: 4, minWidth: 60, display: 'inline-block', textAlign: 'right' }}>
      {value > 0 ? fmt(value) : '—'}
    </span>
  )
}

function ItemRow({ catKey, item, onUpdateAmount, onRemoveItem, onRenameItem }: {
  catKey: string
  item: { id: string; label: string; amount: number }
  onUpdateAmount: (catKey: string, itemId: string, v: number) => void
  onRemoveItem: (catKey: string, itemId: string) => void
  onRenameItem: (catKey: string, itemId: string, label: string) => void
}) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(item.label)
  const [pendingDelete, setPendingDelete] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitLabel = () => { onRenameItem(catKey, item.id, labelDraft); setEditingLabel(false) }

  const startPress = () => {
    if (editingLabel) return
    pressTimer.current = setTimeout(() => {
      navigator.vibrate?.(60)
      setPendingDelete(true)
    }, 600)
  }
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  return (
    <div style={{ display: 'contents' }}>
      {pendingDelete && (
        <DeleteModal
          label={item.label}
          onConfirm={() => { onRemoveItem(catKey, item.id); setPendingDelete(false) }}
          onCancel={() => setPendingDelete(false)}
        />
      )}
      <div
        onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress} onTouchCancel={cancelPress}
        onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
        {editingLabel ? (
          <input value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
            onBlur={commitLabel}
            onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
            style={{ flex: 1, fontSize: 13, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px' }}
            autoFocus />
        ) : (
          <span onClick={() => { setLabelDraft(item.label); setEditingLabel(true) }}
            onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setLabelDraft(item.label); setEditingLabel(true) } }}
            style={{ flex: 1, fontSize: 13, color: 'var(--muted)', cursor: 'text', padding: '2px 4px', borderRadius: 4 }}>
            {item.label}
          </span>
        )}
        <AmountCell value={item.amount} onChange={v => onUpdateAmount(catKey, item.id, v)} />
      </div>
    </div>
  )
}

function CategoryCard(props: any) {
  const { cat, ownerName, onUpdateAmount, onAddItem, onRemoveItem, onRenameItem, onRenameCategory, onDeleteCategory } = props
  const [open, setOpen] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(cat.label)
  const [pendingDelete, setPendingDelete] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const total = cat.items.reduce((a: number, i: any) => a + i.amount, 0)
  const { text } = typeColor(cat.type)

  const submitItem = () => {
    if (newItemLabel.trim()) { onAddItem(cat.key, newItemLabel.trim()); setNewItemLabel(''); setAddingItem(false) }
  }
  const commitName = () => { onRenameCategory(cat.key, nameDraft); setEditingName(false) }

  const startPress = () => {
    if (editingName) return
    pressTimer.current = setTimeout(() => {
      navigator.vibrate?.(60)
      setPendingDelete(true)
    }, 600)
  }
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  return (
    <div>
      {pendingDelete && (
        <DeleteModal
          label={cat.label}
          onConfirm={() => { onDeleteCategory(cat.key); setPendingDelete(false) }}
          onCancel={() => setPendingDelete(false)}
        />
      )}
      <div className="card fade-up" style={{ marginBottom: 8, overflow: 'hidden' }}
        onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress} onTouchCancel={cancelPress}
        onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: ownerLightColor(cat.owner) }}>
          {editingName ? (
            <input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitName() }}
              onBlur={commitName}
              onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
              style={{ flex: 1, fontSize: 14, fontWeight: 600, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '4px 8px' }} autoFocus />
          ) : (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div onClick={() => { setNameDraft(cat.label); setEditingName(true) }}
                onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setNameDraft(cat.label); setEditingName(true) } }}
                style={{ fontSize: 14, fontWeight: 600, cursor: 'text', padding: '2px 4px', borderRadius: 4 }}>
                {cat.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginTop: 1 }}>{ownerName}</div>
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: text }}>{fmt(total)}</div>
          <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? 'Collapse category' : 'Expand category'}
            onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 6, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {open && (
          <div style={{ padding: '0 12px 8px' }}>
            {cat.items.map((item: any) => (
              <ItemRow key={item.id} catKey={cat.key} item={item} onUpdateAmount={onUpdateAmount} onRemoveItem={onRemoveItem} onRenameItem={onRenameItem} />
            ))}
            {addingItem ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitItem(); if (e.key === 'Escape') setAddingItem(false) }}
                  placeholder="Item name..." autoFocus
                  style={{ flex: 1, fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px' }} />
                <button onClick={submitItem} style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Add</button>
                <button onClick={() => setAddingItem(false)} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAddingItem(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}>
                <Plus size={12} /> Add item
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryBar({ totals }: { totals: any }) {
  const items = [
    { label: 'Income',   value: totals.totalInc, color: 'var(--income-text)' },
    { label: 'Expenses', value: totals.totalExp, color: 'var(--expense-text)' },
    { label: 'Savings',  value: totals.totalSav, color: 'var(--savings-text)' },
    { label: 'Leftover', value: totals.net,      color: totals.net >= 0 ? 'var(--positive)' : 'var(--negative)' },
  ]
  return (
    <div className="summary-grid">
      {items.map(({ label, value, color }) => (
        <div key={label} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{fmt(value)}</div>
        </div>
      ))}
    </div>
  )
}

function PersonSummary({ name, inc, exp, sav, debt, hjExp, hjSav, hjDebt, lightColor }: {
  name: string; inc: number; exp: number; sav: number; debt: number
  hjExp: number; hjSav: number; hjDebt: number; lightColor: string
}) {
  const net = inc - exp - sav - debt - hjExp - hjSav - hjDebt
  const Row = ({ label, value, c, bold }: { label: string; value: number; c: string; bold?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--muted)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ color: c, fontWeight: bold ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.abs(value))}</span>
    </div>
  )
  return (
    <div className="card" style={{ padding: '12px 14px', background: lightColor }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: 'var(--ink)' }}>{name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row label="Income" value={inc} c="var(--income-text)" />
        <Row label="Personal exp." value={exp} c="var(--expense-text)" />
        <Row label="Monthly contribution" value={hjExp + hjDebt} c="var(--expense-text)" />
        <Row label="Joint savings" value={hjSav} c="var(--savings-text)" />
        <Row label="Savings" value={sav} c="var(--savings-text)" />
        {debt > 0 && <Row label="Personal debts" value={debt} c="var(--expense-text)" />}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
          <Row label="Leftover" value={net} c={net >= 0 ? 'var(--positive)' : 'var(--negative)'} bold />
        </div>
      </div>
    </div>
  )
}

const OWNER_ORDER: Owner[] = ['NIAMH', 'RUPERT', 'JOINT']

export default function BudgetScreen({ budget, tab, onNavigateToDebts }: { budget: BudgetHook; tab: TabFilter; onNavigateToDebts: () => void }) {
  const { data, totals, updateItemAmount, addItem, removeItem, renameItem, renameCategory, deleteCategory, addCategory } = budget
  const [addingCat, setAddingCat] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatOwner, setNewCatOwner] = useState<Owner>('JOINT')
  const [newCatType, setNewCatType] = useState<EntryType>('EXPENSE')

  const ownerName = (o: Owner) => o === 'NIAMH' ? data.nameNiamh : o === 'RUPERT' ? data.nameRupert : data.nameJoint

  const filtered = data.categories
    .filter(c => tab === 'ALL' || c.owner === tab)
    .sort((a, b) => {
      const ownerDiff = OWNER_ORDER.indexOf(a.owner) - OWNER_ORDER.indexOf(b.owner)
      if (ownerDiff !== 0) return ownerDiff
      const typeOrder = ['INCOME', 'EXPENSE', 'SAVINGS']
      return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
    })

  const grouped = {
    INCOME: filtered.filter(c => c.type === 'INCOME'),
    EXPENSE: filtered.filter(c => c.type === 'EXPENSE'),
    SAVINGS: filtered.filter(c => c.type === 'SAVINGS'),
  }

  const submitCat = () => {
    if (newCatLabel.trim()) { addCategory(newCatOwner, newCatType, newCatLabel.trim()); setNewCatLabel(''); setAddingCat(false) }
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <SummaryBar totals={totals} />
      {tab === 'ALL' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <PersonSummary name={data.nameNiamh} lightColor="var(--niamh-light)" inc={totals.incN} exp={totals.expN} sav={totals.savN} debt={totals.debtN} hjExp={totals.halfJointExp} hjSav={totals.halfJointSav} hjDebt={totals.halfJointDebt} />
          <PersonSummary name={data.nameRupert} lightColor="var(--rupert-light)" inc={totals.incR} exp={totals.expR} sav={totals.savR} debt={totals.debtR} hjExp={totals.halfJointExp} hjSav={totals.halfJointSav} hjDebt={totals.halfJointDebt} />
        </div>
      )}
      {(['INCOME', 'EXPENSE', 'SAVINGS'] as EntryType[]).map(type => grouped[type].length > 0 && (
        <div key={type}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6, marginTop: 4 }}>
            {type === 'INCOME' ? 'Income' : type === 'EXPENSE' ? 'Expenses' : 'Savings'}
          </div>
          {grouped[type].map(cat => (
            <CategoryCard key={cat.key} cat={cat} ownerName={ownerName(cat.owner)} onUpdateAmount={updateItemAmount} onAddItem={addItem} onRemoveItem={removeItem} onRenameItem={renameItem} onRenameCategory={renameCategory} onDeleteCategory={deleteCategory} />
          ))}
        </div>
      ))}
      {totals.totalDebt > 0 && (tab === 'ALL' || tab === 'RUPERT' || tab === 'NIAMH' || tab === 'JOINT') && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6, marginTop: 4 }}>
            Debt Payments
          </div>
          {data.debts
            .filter(d => tab === 'ALL' || d.owner === tab)
            .map(d => (
              <div key={d.id} className="card fade-up" style={{ marginBottom: 8, background: ownerLightColor(d.owner) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{d.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {d.owner === 'NIAMH' ? data.nameNiamh : d.owner === 'RUPERT' ? data.nameRupert : data.nameJoint}
                      {d.isZeroPercent ? ' · 0%' : d.interestRate > 0 ? ` · ${d.interestRate}%` : ''}
                      {d.currentBalance > 0 ? ` · ${fmt(d.currentBalance)} remaining` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14, color: 'var(--expense-text)' }}>{fmt(d.monthlyPayment)}/mo</div>
                    {d.currentBalance > 0 && d.monthlyPayment > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>~{Math.ceil(d.currentBalance / d.monthlyPayment)} months left</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          }
          <button onClick={onNavigateToDebts} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12 }}>
            + Manage debts →
          </button>
        </div>
      )}

      {addingCat ? (
        <div className="card" style={{ padding: 12, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitCat() }}
              placeholder="Category name..." autoFocus
              style={{ flex: 1, minWidth: 160, fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 10px' }} />
            <select value={newCatOwner} onChange={e => setNewCatOwner(e.target.value as Owner)} style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 8px', background: 'var(--card)', cursor: 'pointer' }}>
              <option value="NIAMH">{data.nameNiamh}</option>
              <option value="RUPERT">{data.nameRupert}</option>
              <option value="JOINT">{data.nameJoint}</option>
            </select>
            <select value={newCatType} onChange={e => setNewCatType(e.target.value as EntryType)} style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 8px', background: 'var(--card)', cursor: 'pointer' }}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={submitCat} style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>Add</button>
            <button onClick={() => setAddingCat(false)} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingCat(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'none', border: '1.5px dashed var(--border)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> Add category
        </button>
      )}
    </div>
  )
}
