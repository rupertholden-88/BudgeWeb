'use client'

import { useState, useRef } from 'react'
import { Category, TabFilter, Owner, EntryType, fmt, calcTotals } from '@/lib/models'
import { Plus, ChevronDown, ChevronUp, Check } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

function DeleteModal({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-6">
      <div className="card w-full max-w-[320px] p-6">
        <div className="text-base font-semibold mb-2">Delete?</div>
        <div className="text-sm text-muted mb-6">Remove <strong>{label}</strong>?</div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-transparent border-[1.5px] border-border rounded-lg py-2.5 cursor-pointer text-sm">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-negative text-white border-0 rounded-lg py-2.5 cursor-pointer text-sm font-semibold">Delete</button>
        </div>
      </div>
    </div>
  )
}

function ownerBorderClass(owner: Owner) {
  if (owner === 'NIAMH') return 'border-l-[3px] border-l-niamh'
  if (owner === 'RUPERT') return 'border-l-[3px] border-l-rupert'
  return 'border-l-[3px] border-l-joint'
}

function ownerTextClass(owner: Owner) {
  if (owner === 'NIAMH') return 'text-niamh'
  if (owner === 'RUPERT') return 'text-rupert'
  return 'text-joint'
}

function typeBadgeClass(type: EntryType) {
  if (type === 'INCOME') return 'bg-income-bg text-income-text'
  if (type === 'EXPENSE') return 'bg-expense-bg text-expense-text'
  return 'bg-savings-bg text-savings-text'
}

function AmountCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const start = () => { setRaw(value === 0 ? '' : String(value)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  const commit = () => { const n = parseFloat(raw.replace(/[£,]/g, '')); onChange(isNaN(n) ? 0 : n); setEditing(false) }
  if (editing) return (
    <input
      ref={inputRef}
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') commit() }}
      className="w-20 text-right text-sm border-[1.5px] border-rupert rounded-md px-1.5 py-0.5 outline-none bg-rupert-light"
      inputMode="decimal"
      autoFocus
    />
  )
  return (
    <span
      onClick={start}
      className={`cursor-text tabular-nums text-sm px-1 py-0.5 rounded min-w-[60px] inline-block text-right ${value > 0 ? 'text-ink' : 'text-muted'}`}
    >
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
  const [deleteModal, setDeleteModal] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitLabel = () => { onRenameItem(catKey, item.id, labelDraft); setEditingLabel(false) }
  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setDeleteModal(true)
    }, 600)
  }
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }
  return (
    <>
      {deleteModal && <DeleteModal label={item.label} onConfirm={() => { onRemoveItem(catKey, item.id); setDeleteModal(false) }} onCancel={() => setDeleteModal(false)} />}
      <div
        className="flex items-center gap-1.5 py-2 border-b border-border"
        onMouseDown={startLongPress} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress} onTouchEnd={cancelLongPress} onTouchCancel={cancelLongPress}
      >
        {editingLabel ? (
          <>
            <input
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
              onBlur={commitLabel}
              className="flex-1 text-[13px] border-[1.5px] border-rupert rounded-md px-1.5 py-0.5 outline-none"
              autoFocus
            />
            <button onClick={commitLabel} className="bg-ink text-white border-0 rounded-md px-1.5 py-[3px] cursor-pointer flex">
              <Check size={12} />
            </button>
          </>
        ) : (
          <span
            onClick={() => { setLabelDraft(item.label); setEditingLabel(true) }}
            className="flex-1 text-[13px] text-muted cursor-text"
          >
            {item.label}
          </span>
        )}
        <AmountCell value={item.amount} onChange={v => onUpdateAmount(catKey, item.id, v)} />
      </div>
    </>
  )
}

function CategoryCard({ cat, ownerName, onUpdateAmount, onAddItem, onRemoveItem, onRenameItem, onRenameCategory, onDeleteCategory }: {
  cat: Category; ownerName: string
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
  const [deleteModal, setDeleteModal] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const total = cat.items.reduce((a, i) => a + i.amount, 0)
  const submitItem = () => { if (newItemLabel.trim()) { onAddItem(cat.key, newItemLabel.trim()); setNewItemLabel(''); setAddingItem(false) } }
  const commitName = () => { onRenameCategory(cat.key, nameDraft); setEditingName(false) }
  const startLongPress = () => {
    if (editingName) return
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50)
      setDeleteModal(true)
    }, 600)
  }
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }
  return (
    <>
      {deleteModal && <DeleteModal label={cat.label} onConfirm={() => { onDeleteCategory(cat.key); setDeleteModal(false) }} onCancel={() => setDeleteModal(false)} />}
      <div className="card fade-up mb-2 overflow-hidden">
        <div
          className={`flex items-center gap-1.5 px-3 py-2.5 ${ownerBorderClass(cat.owner)} ${open ? 'bg-card' : 'bg-surface'}`}
          onMouseDown={startLongPress} onMouseUp={cancelLongPress} onMouseLeave={cancelLongPress}
          onTouchStart={startLongPress} onTouchEnd={cancelLongPress} onTouchCancel={cancelLongPress}
        >
          {editingName ? (
            <>
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitName() }}
                onBlur={commitName}
                className="flex-1 text-sm font-semibold border-[1.5px] border-rupert rounded-md px-2 py-1 outline-none"
                autoFocus
              />
              <button
                onClick={commitName}
                onMouseDown={e => e.stopPropagation()}
                className="bg-ink text-white border-0 rounded-md px-2 py-1 cursor-pointer flex"
              >
                <Check size={14} />
              </button>
            </>
          ) : (
            <div
              className="flex-1 min-w-0"
              onClick={() => { setNameDraft(cat.label); setEditingName(true) }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="text-sm font-semibold cursor-text">
                {cat.label}
                {cat.note && <span className="ml-1.5 text-[10px] text-muted font-normal">{'— ' + cat.note}</span>}
              </div>
              <div className={`text-[11px] font-medium mt-px ${ownerTextClass(cat.owner)}`}>{ownerName}</div>
            </div>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${typeBadgeClass(cat.type)}`}>
            {cat.type === 'INCOME' ? 'Income' : cat.type === 'EXPENSE' ? 'Expense' : 'Savings'}
          </span>
          <span className="tabular-nums font-semibold text-sm min-w-[56px] text-right shrink-0">
            {total > 0 ? fmt(total) : '—'}
          </span>
          <button onClick={() => setOpen(o => !o)} className="bg-transparent border-0 cursor-pointer text-muted flex p-0.5">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {open && (
          <div className="px-3 pb-2">
            <div className="text-[10px] text-muted py-1">Tap label to rename · Long press to delete</div>
            {cat.items.map(item => (
              <ItemRow key={item.id} catKey={cat.key} item={item} onUpdateAmount={onUpdateAmount} onRemoveItem={onRemoveItem} onRenameItem={onRenameItem} />
            ))}
            {addingItem ? (
              <div className="flex gap-1.5 mt-1.5">
                <input
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitItem(); if (e.key === 'Escape') setAddingItem(false) }}
                  placeholder="Item name..."
                  autoFocus
                  className="flex-1 text-[13px] border-[1.5px] border-border rounded-md px-2 py-1 outline-none"
                />
                <button onClick={submitItem} className="bg-ink text-white border-0 rounded-md px-2.5 py-1 cursor-pointer text-xs">Add</button>
                <button onClick={() => setAddingItem(false)} className="bg-transparent border-[1.5px] border-border rounded-md px-2.5 py-1 cursor-pointer text-xs">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1 mt-1.5 bg-transparent border-0 cursor-pointer text-muted text-xs"
              >
                <Plus size={12} /> Add item
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function SummaryBar({ totals }: { totals: ReturnType<typeof calcTotals> }) {
  const items = [
    { label: 'Income',   value: totals.totalInc, cls: 'text-income-text' },
    { label: 'Expenses', value: totals.totalExp, cls: 'text-expense-text' },
    { label: 'Savings',  value: totals.totalSav, cls: 'text-savings-text' },
    { label: 'Leftover', value: totals.net,       cls: totals.net >= 0 ? 'text-positive' : 'text-negative' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {items.map(({ label, value, cls }) => (
        <div key={label} className="card px-3 py-2.5 text-center">
          <div className="text-[10px] text-muted uppercase tracking-[0.05em] mb-0.5">{label}</div>
          <div className={`text-base font-bold tabular-nums ${cls}`}>{fmt(value)}</div>
        </div>
      ))}
    </div>
  )
}

function PersonSummary({ name, inc, exp, sav, debt, hjExp, hjSav, hjDebt, colorClass, borderClass }: {
  name: string; inc: number; exp: number; sav: number; debt: number
  hjExp: number; hjSav: number; hjDebt: number
  colorClass: string; borderClass: string
}) {
  const net = inc - exp - sav - debt - hjExp - hjSav - hjDebt
  const Row = ({ label, value, cls, bold }: { label: string; value: number; cls: string; bold?: boolean }) => (
    <div className="flex justify-between text-xs">
      <span className={`${bold ? 'font-semibold' : 'font-normal'} text-muted`}>{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} tabular-nums ${cls}`}>{fmt(Math.abs(value))}</span>
    </div>
  )
  return (
    <div className={`card px-3.5 py-3 ${borderClass}`}>
      <div className={`font-semibold text-sm mb-2 ${colorClass}`}>{name}</div>
      <div className="flex flex-col gap-1">
        <Row label="Income" value={inc} cls="text-income-text" />
        <Row label="Personal exp." value={exp} cls="text-expense-text" />
        <Row label="Monthly contribution" value={hjExp + hjDebt} cls="text-expense-text" />
        <Row label="Joint savings" value={hjSav} cls="text-savings-text" />
        <Row label="Savings" value={sav} cls="text-savings-text" />
        {debt > 0 && <Row label="Personal debts" value={debt} cls="text-expense-text" />}
        <div className="border-t border-border mt-1 pt-1">
          <Row label="Leftover" value={net} cls={net >= 0 ? 'text-positive' : 'text-negative'} bold />
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
  const ownerName = (o: Owner) => o === 'NIAMH' ? data.nameNiamh || 'Person 1' : o === 'RUPERT' ? data.nameRupert || 'Person 2' : data.nameJoint || 'Joint'
  const filtered = data.categories
    .filter(c => tab === 'ALL' || c.owner === tab)
    .sort((a, b) => {
      const od = OWNER_ORDER.indexOf(a.owner) - OWNER_ORDER.indexOf(b.owner)
      if (od !== 0) return od
      return ['INCOME', 'EXPENSE', 'SAVINGS'].indexOf(a.type) - ['INCOME', 'EXPENSE', 'SAVINGS'].indexOf(b.type)
    })
  const grouped = { INCOME: filtered.filter(c => c.type === 'INCOME'), EXPENSE: filtered.filter(c => c.type === 'EXPENSE'), SAVINGS: filtered.filter(c => c.type === 'SAVINGS') }
  const submitCat = () => { if (newCatLabel.trim()) { addCategory(newCatOwner, newCatType, newCatLabel.trim()); setNewCatLabel(''); setAddingCat(false) } }
  return (
    <div className="h-full overflow-y-auto p-4">
      <SummaryBar totals={totals} />
      {tab === 'ALL' && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <PersonSummary
            name={data.nameNiamh || 'Person 1'}
            colorClass="text-niamh" borderClass="border-l-[3px] border-l-niamh"
            inc={totals.incN} exp={totals.expN} sav={totals.savN} debt={totals.debtN}
            hjExp={totals.halfJointExp} hjSav={totals.halfJointSav} hjDebt={totals.halfJointDebt}
          />
          <PersonSummary
            name={data.nameRupert || 'Person 2'}
            colorClass="text-rupert" borderClass="border-l-[3px] border-l-rupert"
            inc={totals.incR} exp={totals.expR} sav={totals.savR} debt={totals.debtR}
            hjExp={totals.halfJointExp} hjSav={totals.halfJointSav} hjDebt={totals.halfJointDebt}
          />
        </div>
      )}
      {(['INCOME', 'EXPENSE', 'SAVINGS'] as EntryType[]).map(type => grouped[type].length > 0 && (
        <div key={type}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-1.5 mt-1">
            {type === 'INCOME' ? 'Income' : type === 'EXPENSE' ? 'Expenses' : 'Savings'}
          </div>
          {grouped[type].map(cat => (
            <CategoryCard
              key={cat.key} cat={cat} ownerName={ownerName(cat.owner)}
              onUpdateAmount={updateItemAmount} onAddItem={addItem}
              onRemoveItem={removeItem} onRenameItem={renameItem}
              onRenameCategory={renameCategory} onDeleteCategory={deleteCategory}
            />
          ))}
        </div>
      ))}
      {totals.totalDebt > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted mb-1.5 mt-1">Debt Payments</div>
          {data.debts.filter(d => tab === 'ALL' || d.owner === tab).map(d => (
            <div key={d.id} className={`card fade-up mb-2 ${ownerBorderClass(d.owner)}`}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{d.label}</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {ownerName(d.owner)}{d.isZeroPercent ? ' · 0%' : d.interestRate > 0 ? ` · ${d.interestRate}%` : ''}
                    {d.currentBalance > 0 ? ` · ${fmt(d.currentBalance)} remaining` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums font-bold text-sm text-expense-text">{fmt(d.monthlyPayment)}/mo</div>
                  {d.currentBalance > 0 && d.monthlyPayment > 0 && (
                    <div className="text-[11px] text-muted">~{Math.ceil(d.currentBalance / d.monthlyPayment)} months left</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={onNavigateToDebts}
            className="flex items-center gap-1.5 mb-3 bg-transparent border-0 cursor-pointer text-muted text-xs"
          >
            + Manage debts →
          </button>
        </div>
      )}
      {addingCat ? (
        <div className="card p-3 mt-2">
          <div className="flex gap-2 flex-wrap mb-2">
            <input
              value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitCat() }}
              placeholder="Category name..."
              autoFocus
              className="flex-1 min-w-[160px] text-[13px] border-[1.5px] border-border rounded-md px-2.5 py-1.5 outline-none"
            />
            <select
              value={newCatOwner}
              onChange={e => setNewCatOwner(e.target.value as Owner)}
              className="text-[13px] border-[1.5px] border-border rounded-md px-2 py-1.5 bg-card cursor-pointer"
            >
              <option value="NIAMH">{data.nameNiamh || 'Person 1'}</option>
              <option value="RUPERT">{data.nameRupert || 'Person 2'}</option>
              <option value="JOINT">{data.nameJoint || 'Joint'}</option>
            </select>
            <select
              value={newCatType}
              onChange={e => setNewCatType(e.target.value as EntryType)}
              className="text-[13px] border-[1.5px] border-border rounded-md px-2 py-1.5 bg-card cursor-pointer"
            >
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </div>
          <div className="flex gap-1.5">
            <button onClick={submitCat} className="bg-ink text-white border-0 rounded-md px-3.5 py-1.5 cursor-pointer text-[13px]">Add</button>
            <button onClick={() => setAddingCat(false)} className="bg-transparent border-[1.5px] border-border rounded-md px-3.5 py-1.5 cursor-pointer text-[13px]">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCat(true)}
          className="flex items-center justify-center gap-1.5 mt-3 bg-transparent border-[1.5px] border-dashed border-border rounded-lg px-4 py-2 cursor-pointer text-muted text-[13px] w-full"
        >
          <Plus size={14} /> Add category
        </button>
      )}
    </div>
  )
}
