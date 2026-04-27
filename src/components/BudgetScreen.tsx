'use client'

import { useState, useRef } from 'react'
import { Category, TabFilter, Owner, EntryType, fmt, calcTotals } from '@/lib/models'
import { Plus, ChevronDown, ChevronUp, Trash2, Pencil, Check } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

function ownerColor(owner: Owner) {
  if (owner === 'NIAMH') return 'var(--niamh)'
  if (owner === 'RUPERT') return 'var(--rupert)'
  return 'var(--joint)'
}

function typeColor(type: EntryType) {
  if (type === 'INCOME') return { bg: 'var(--income-bg)', text: 'var(--income-text)' }
  if (type === 'EXPENSE') return { bg: 'var(--expense-bg)', text: 'var(--expense-text)' }
  return { bg: 'var(--savings-bg)', text: 'var(--savings-text)' }
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
      style={{ width: 80, textAlign: 'right', fontSize: 14, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px', outline: 'none', background: 'var(--rupert-light)' }}
      inputMode="decimal" autoFocus />
  )
  return (
    <span onClick={start} style={{ cursor: 'text', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: value > 0 ? 'var(--ink)' : 'var(--muted)', padding: '2px 4px', borderRadius: 4, minWidth: 60, display: 'inline-block', textAlign: 'right' }}>
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
  const commitLabel = () => { onRenameItem(catKey, item.id, labelDraft); setEditingLabel(false) }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      {editingLabel ? (
        <>
          <input value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
            onBlur={commitLabel}
            style={{ flex: 1, fontSize: 13, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px', outline: 'none' }}
            autoFocus />
          <button onClick={commitLabel} style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', display: 'flex' }}>
            <Check size={12} />
          </button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{item.label}</span>
          <button onClick={() => { setLabelDraft(item.label); setEditingLabel(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', display: 'flex', padding: 2 }}>
            <Pencil size={11} />
          </button>
        </>
      )}
      <AmountCell value={item.amount} onChange={v => onUpdateAmount(catKey, item.id, v)} />
      <button onClick={() => onRemoveItem(catKey, item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', display: 'flex', padding: 2 }}>
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function CategoryCard({ cat, ownerName, onUpdateAmount, onAddItem, onRemoveItem, onRenameItem, onRenameCategory, onDeleteCategory }: {
  cat: Category
  ownerName: string
  onUpdateAmount: (catKey: string, itemId: string, v: number) => void
  onAddItem: (catKey: string, label: string) => void
  onRemoveItem: (catKey: string, itemId: string) => void
  onRenameItem: (catKey: string, itemId: string, label: string) => void
  onRenameCategory: (catKey: string, label: string) => void
  onDeleteCategory: (catKey: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(cat.label)
  const total = cat.items.reduce((a, i) => a + i.amount, 0)
  const { bg, text } = typeColor(cat.type)
  const color = ownerColor(cat.owner)
  const submitItem = () => {
    if (newItemLabel.trim()) { onAddItem(cat.key, newItemLabel.trim()); setNewItemLabel(''); setAddingItem(false) }
  }
  const commitName = () => { onRenameCategory(cat.key, nameDraft); setEditingName(false) }

  return (
    <div className="card fade-up" style={{ marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderLeft: '3px solid ' + color, background: open ? 'var(--card)' : 'var(--surface)' }}>
        {editingName ? (
          <>
            <input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitName() }}
              style={{ flex: 1, fontSize: 14, fontWeight: 600, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '4px 8px', outline: 'none' }} autoFocus />
            <button onClick={commitName} style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex' }}>
              <Check size={14} />
            </button>
          </>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {cat.label}
                {cat.note && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>{'— ' + cat.note}</span>}
              </div>
              <div style={{ fontSize: 11, color: color, fontWeight: 500, marginTop: 1 }}>{ownerName}</div>
            </div>
            <button onClick={() => { setNameDraft(cat.label); setEditingName(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 2 }}>
              <Pencil size={13} />
            </button>
            <button onClick={() => { if (confirm('Delete this category?')) onDeleteCategory(cat.key) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FECACA', display: 'flex', padding: 2 }}>
              <Trash2 size={13} />
            </button>
          </>
        )}
        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: bg, color: text, fontWeight: 600, flexShrink: 0 }}>
          {cat.type === 'INCOME' ? 'Income' : cat.type === 'EXPENSE' ? 'Expense' : 'Savings'}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 14, minWidth: 56, textAlign: 'right', flexShrink: 0 }}>
          {total > 0 ? fmt(total) : '—'}
        </span>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 2 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {open && (
        <div style={{ padding: '0 12px 8px' }}>
          {cat.items.map(item => (
            <ItemRow key={item.id} catKey={cat.key} item={item} onUpdateAmount={onUpdateAmount} onRemoveItem={onRemoveItem} onRenameItem={onRenameItem} />
          ))}
          {addingItem ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitItem(); if (e.key === 'Escape') setAddingItem(false) }}
                placeholder="Item name..." autoFocus
                style={{ flex: 1, fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', outline: 'none' }} />
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
  )
}

function SummaryBar({ totals }: { totals: ReturnType<typeof calcTotals> }) {
  const items = [
    { label: 'Income', value: totals.totalInc, color: 'var(--income-text)' },
    { label: 'Expenses', value: totals.totalExp, color: 'var(--expense-text)' },
    { label: 'Savings', value: totals.totalSav, color: 'var(--savings-text)' },
    { label: 'Net', value: totals.net, color: totals.net >= 0 ? 'var(--positive)' : 'var(--negative)' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{fmt(value)}</div>
        </div>
      ))}
    </div>
  )
}

function PersonSummary({ name, inc, exp, sav, debt, hjExp, hjSav, hjDebt, color }: { name: string; inc: number; exp: number; sav: number; debt: number; hjExp: number; hjSav: number; hjDebt: number; color: string }) {
  const net = inc - exp - sav - debt - hjExp - hjSav - hjDebt
  const Row = ({ label, value, c, bold }: { label: string; value: number; c: string; bold?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--muted)', fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ color: c, fontWeight: bold ? 700 : 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.abs(value))}</span>
    </div>
  )
  return (
    <div className="card" style={{ padding: '12px 14px', borderLeft: '3px solid ' + color }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color }}>{name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row label="Income" value={inc} c="var(--income-text)" />
        <Row label="Personal exp." value={exp} c="var(--expense-text)" />
        <Row label="Half joint exp." value={hjExp} c="var(--expense-text)" />
        <Row label="Half joint sav." value={hjSav} c="var(--savings-text)" />
        <Row label="Savings" value={sav} c="var(--savings-text)" />
        {debt > 0 && <Row label="Personal debts" value={debt} c="var(--expense-text)" />}
        {hjDebt > 0 && <Row label="½ Joint debts" value={hjDebt} c="var(--expense-text)" />}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
          <Row label="Net" value={net} c={net >= 0 ? 'var(--positive)' : 'var(--negative)'} bold />
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
          <PersonSummary name={data.nameNiamh} color="var(--niamh)" inc={totals.incN} exp={totals.expN} sav={totals.savN} debt={totals.debtN} hjExp={totals.halfJointExp} hjSav={totals.halfJointSav} hjDebt={totals.halfJointDebt} />
          <PersonSummary name={data.nameRupert} color="var(--rupert)" inc={totals.incR} exp={totals.expR} sav={totals.savR} debt={totals.debtR} hjExp={totals.halfJointExp} hjSav={totals.halfJointSav} hjDebt={totals.halfJointDebt} />
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
      {/* Debt payments — read only summary linking to Debts tab */}
      {totals.totalDebt > 0 && (tab === 'ALL' || tab === 'RUPERT' || tab === 'NIAMH' || tab === 'JOINT') && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6, marginTop: 4 }}>
            Debt Payments
          </div>
          {data.debts
            .filter(d => tab === 'ALL' || d.owner === tab)
            .map(d => (
              <div key={d.id} className="card fade-up" style={{ marginBottom: 8, borderLeft: '3px solid ' + (d.owner === 'NIAMH' ? 'var(--niamh)' : d.owner === 'RUPERT' ? 'var(--rupert)' : 'var(--joint)') }}>
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
              style={{ flex: 1, minWidth: 160, fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 10px', outline: 'none' }} />
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
