'use client'

import { useState, useRef } from 'react'
import { Category, TabFilter, Owner, EntryType, fmt, calcTotals } from '@/lib/models'
import { Plus, ChevronDown, ChevronUp, Check, TrendingUp, TrendingDown } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

// ─── helpers ────────────────────────────────────────────────────────────────

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
function typeSectionClass(type: EntryType) {
  if (type === 'INCOME') return 'text-income-text'
  if (type === 'EXPENSE') return 'text-expense-text'
  return 'text-savings-text'
}

// ─── delete modal ────────────────────────────────────────────────────────────

function DeleteModal({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-end justify-center p-4">
      <div className="card w-full max-w-sm p-6 mb-2">
        <div className="text-base font-semibold mb-1">Delete?</div>
        <div className="text-sm text-muted mb-5">Remove <strong>{label}</strong>?</div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-transparent border-[1.5px] border-border rounded-xl py-3 cursor-pointer text-sm font-medium">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-negative text-white border-0 rounded-xl py-3 cursor-pointer text-sm font-semibold">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── allocation bar ───────────────────────────────────────────────────────────

function AllocationBar({ inc, exp, sav }: { inc: number; exp: number; sav: number }) {
  if (inc <= 0) return null
  const expPct  = Math.min((exp / inc) * 100, 100)
  const savPct  = Math.min((sav / inc) * 100, Math.max(0, 100 - expPct))
  const leftPct = Math.max(0, 100 - expPct - savPct)
  const left    = inc - exp - sav
  return (
    <div className="my-3">
      <div className="flex h-2 rounded-full overflow-hidden gap-[2px]">
        {expPct > 0 && (
          <div className="h-full bg-expense-text transition-[width] duration-700" style={{ width: `${expPct}%` }} />
        )}
        {savPct > 0 && (
          <div className="h-full bg-savings-text transition-[width] duration-700" style={{ width: `${savPct}%` }} />
        )}
        {leftPct > 0 && (
          <div
            className={`h-full transition-[width] duration-700 ${left >= 0 ? 'bg-positive' : 'bg-negative'}`}
            style={{ width: `${leftPct}%` }}
          />
        )}
      </div>
      <div className="flex gap-3 mt-1.5 flex-wrap">
        {expPct > 0 && (
          <span className="text-[10px] text-expense-text font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-expense-text inline-block" />
            Expenses {expPct.toFixed(0)}%
          </span>
        )}
        {savPct > 0 && (
          <span className="text-[10px] text-savings-text font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-savings-text inline-block" />
            Savings {savPct.toFixed(0)}%
          </span>
        )}
        {leftPct > 0 && (
          <span className={`text-[10px] font-medium flex items-center gap-1 ${left >= 0 ? 'text-positive' : 'text-negative'}`}>
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${left >= 0 ? 'bg-positive' : 'bg-negative'}`} />
            Left {leftPct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ─── budget overview ──────────────────────────────────────────────────────────

function BudgetOverview({ totals }: { totals: ReturnType<typeof calcTotals> }) {
  const { totalInc, totalExp, totalSav, net } = totals
  const isHealthy = net >= 0

  if (totalInc === 0 && totalExp === 0) return null

  return (
    <div className="card mb-4 overflow-hidden">
      {/* top strip */}
      <div className={`h-1 w-full ${isHealthy ? 'bg-positive' : 'bg-negative'}`} />
      <div className="p-4">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-1">
          {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-muted mb-0.5">Total income</div>
            <div className="font-serif text-3xl font-bold text-ink tabular-nums leading-none">
              {fmt(totalInc)}
            </div>
          </div>
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold tabular-nums ${isHealthy ? 'bg-income-bg text-positive' : 'bg-expense-bg text-negative'}`}>
            {isHealthy ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {isHealthy ? '+' : ''}{fmt(net)} left
          </div>
        </div>

        <AllocationBar inc={totalInc} exp={totalExp} sav={totalSav} />

        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
          {[
            { label: 'Expenses', value: totalExp, cls: 'text-expense-text' },
            { label: 'Savings',  value: totalSav, cls: 'text-savings-text' },
            { label: 'Leftover', value: net,       cls: isHealthy ? 'text-positive' : 'text-negative' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="text-center">
              <div className="text-[10px] text-muted mb-0.5">{label}</div>
              <div className={`text-sm font-bold tabular-nums ${cls}`}>{fmt(value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── person card ──────────────────────────────────────────────────────────────

function PersonCard({ name, net, inc, exp, sav, debt, hjExp, hjSav, hjDebt, colorClass, borderClass }: {
  name: string; net: number; inc: number; exp: number; sav: number
  debt: number; hjExp: number; hjSav: number; hjDebt: number
  colorClass: string; borderClass: string
}) {
  const jointContrib = hjExp + hjSav + hjDebt
  const rows = [
    { label: 'Income',           value: inc,          cls: 'text-income-text' },
    { label: 'Personal expenses', value: exp + debt,  cls: 'text-expense-text' },
    { label: 'Joint account',    value: jointContrib, cls: 'text-expense-text' },
    { label: 'Savings',          value: sav,          cls: 'text-savings-text' },
  ].filter(r => r.value > 0)
  return (
    <div className={`card p-3.5 ${borderClass}`}>
      <div className={`text-[11px] font-bold uppercase tracking-[0.08em] mb-1 ${colorClass}`}>{name}</div>
      <div className={`font-serif text-2xl font-bold tabular-nums leading-none mb-3 ${net >= 0 ? 'text-ink' : 'text-negative'}`}>
        {net >= 0 ? '+' : ''}{fmt(net)}
      </div>
      <div className="space-y-1 pt-2.5 border-t border-border">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between items-center">
            <span className="text-[11px] text-muted">{r.label}</span>
            <span className={`text-[11px] font-semibold tabular-nums ${r.cls}`}>{fmt(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── section divider ──────────────────────────────────────────────────────────

function SectionDivider({ type, total }: { type: EntryType; total: number }) {
  const labels = { INCOME: 'Income', EXPENSE: 'Expenses', SAVINGS: 'Savings' }
  const cls = typeSectionClass(type)
  return (
    <div className="flex items-center gap-2 mb-2 mt-5 first:mt-0">
      <span className={`text-[11px] font-bold uppercase tracking-[0.1em] shrink-0 ${cls}`}>
        {labels[type]}
      </span>
      <div className="flex-1 h-px bg-border" />
      <span className={`text-[11px] font-bold tabular-nums shrink-0 ${cls}`}>
        {total > 0 ? fmt(total) : '—'}
      </span>
    </div>
  )
}

// ─── amount cell ──────────────────────────────────────────────────────────────

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
      className="w-20 text-right text-sm border-[1.5px] border-rupert rounded-lg px-2 py-1 outline-none bg-rupert-light font-semibold"
      inputMode="decimal"
      autoFocus
    />
  )
  return (
    <span
      onClick={start}
      className={`cursor-text tabular-nums text-sm font-semibold px-2 py-1 rounded-lg min-w-[64px] inline-block text-right transition-colors ${value > 0 ? 'text-ink' : 'text-muted/50'}`}
    >
      {value > 0 ? fmt(value) : '—'}
    </span>
  )
}

// ─── item row ────────────────────────────────────────────────────────────────

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
    longPressTimer.current = setTimeout(() => { if (navigator.vibrate) navigator.vibrate(50); setDeleteModal(true) }, 600)
  }
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }
  return (
    <>
      {deleteModal && <DeleteModal label={item.label} onConfirm={() => { onRemoveItem(catKey, item.id); setDeleteModal(false) }} onCancel={() => setDeleteModal(false)} />}
      <div
        className="flex items-center gap-2 py-2 border-b border-border last:border-0"
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
              className="flex-1 text-[13px] border-[1.5px] border-rupert rounded-lg px-2 py-1 outline-none bg-rupert-light"
              autoFocus
            />
            <button onClick={commitLabel} className="bg-ink text-white border-0 rounded-lg px-2 py-1 cursor-pointer flex items-center">
              <Check size={12} />
            </button>
          </>
        ) : (
          <span
            onClick={() => { setLabelDraft(item.label); setEditingLabel(true) }}
            className="flex-1 text-[13px] text-muted cursor-text select-none"
          >
            {item.label}
          </span>
        )}
        <AmountCell value={item.amount} onChange={v => onUpdateAmount(catKey, item.id, v)} />
      </div>
    </>
  )
}

// ─── category card ────────────────────────────────────────────────────────────

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
    longPressTimer.current = setTimeout(() => { if (navigator.vibrate) navigator.vibrate(50); setDeleteModal(true) }, 600)
  }
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }

  return (
    <>
      {deleteModal && <DeleteModal label={cat.label} onConfirm={() => { onDeleteCategory(cat.key); setDeleteModal(false) }} onCancel={() => setDeleteModal(false)} />}
      <div className={`card mb-2 overflow-hidden fade-up ${ownerBorderClass(cat.owner)}`}>

        {/* header */}
        <div
          className={`flex items-center gap-2 px-3.5 py-3 ${open ? 'bg-card' : 'bg-surface'}`}
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
                className="flex-1 text-sm font-semibold border-[1.5px] border-rupert rounded-lg px-2.5 py-1.5 outline-none bg-rupert-light"
                autoFocus
              />
              <button onClick={commitName} onMouseDown={e => e.stopPropagation()} className="bg-ink text-white border-0 rounded-lg px-2 py-1.5 cursor-pointer flex">
                <Check size={14} />
              </button>
            </>
          ) : (
            <div
              className="flex-1 min-w-0"
              onClick={() => { setNameDraft(cat.label); setEditingName(true) }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold cursor-text leading-tight">{cat.label}</span>
                {cat.note && <span className="text-[10px] text-muted hidden sm:inline">{cat.note}</span>}
              </div>
              <div className={`text-[11px] font-medium mt-0.5 ${ownerTextClass(cat.owner)}`}>{ownerName}</div>
            </div>
          )}

          <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold shrink-0 ${typeBadgeClass(cat.type)}`}>
            {cat.type === 'INCOME' ? 'Income' : cat.type === 'EXPENSE' ? 'Expense' : 'Savings'}
          </span>

          <span className={`font-bold text-sm tabular-nums shrink-0 min-w-[60px] text-right ${total > 0 ? 'text-ink' : 'text-muted/40'}`}>
            {total > 0 ? fmt(total) : '—'}
          </span>

          <button
            onClick={() => setOpen(o => !o)}
            className="bg-transparent border-0 cursor-pointer text-muted flex p-0.5 shrink-0"
          >
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* items */}
        {open && (
          <div className="px-3.5 pb-2 pt-0.5">
            <div className="text-[10px] text-muted/60 pt-1 pb-1 select-none">Tap label to rename · Long press to delete</div>
            {cat.items.map(item => (
              <ItemRow key={item.id} catKey={cat.key} item={item} onUpdateAmount={onUpdateAmount} onRemoveItem={onRemoveItem} onRenameItem={onRenameItem} />
            ))}
            {addingItem ? (
              <div className="flex gap-1.5 mt-2 pt-2 border-t border-border">
                <input
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitItem(); if (e.key === 'Escape') setAddingItem(false) }}
                  placeholder="Item name…"
                  autoFocus
                  className="flex-1 text-[13px] border-[1.5px] border-border rounded-lg px-2.5 py-1.5 outline-none"
                />
                <button onClick={submitItem} className="bg-ink text-white border-0 rounded-lg px-3 py-1.5 cursor-pointer text-xs font-medium">Add</button>
                <button onClick={() => setAddingItem(false)} className="bg-transparent border-[1.5px] border-border rounded-lg px-3 py-1.5 cursor-pointer text-xs">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 mt-1.5 pt-1.5 bg-transparent border-0 cursor-pointer text-muted/70 text-xs w-full hover:text-muted transition-colors"
              >
                <Plus size={11} /> Add item
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── main screen ──────────────────────────────────────────────────────────────

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

  const grouped = {
    INCOME:  filtered.filter(c => c.type === 'INCOME'),
    EXPENSE: filtered.filter(c => c.type === 'EXPENSE'),
    SAVINGS: filtered.filter(c => c.type === 'SAVINGS'),
  }

  const groupTotal = (type: EntryType) =>
    filtered.filter(c => c.type === type).reduce((a, c) => a + c.items.reduce((b, i) => b + i.amount, 0), 0)

  const submitCat = () => {
    if (newCatLabel.trim()) { addCategory(newCatOwner, newCatType, newCatLabel.trim()); setNewCatLabel(''); setAddingCat(false) }
  }

  return (
    <div className="h-full overflow-y-auto p-4">

      {/* overview — always visible */}
      <BudgetOverview totals={totals} />

      {/* person cards — only on ALL tab */}
      {tab === 'ALL' && (totals.incN > 0 || totals.incR > 0) && (
        <div className="grid grid-cols-2 gap-2 mb-1">
          <PersonCard
            name={data.nameNiamh || 'Person 1'}
            colorClass="text-niamh" borderClass="border-l-[3px] border-l-niamh"
            net={totals.netN} inc={totals.incN} exp={totals.expN} sav={totals.savN} debt={totals.debtN}
            hjExp={totals.halfJointExp} hjSav={totals.halfJointSav} hjDebt={totals.halfJointDebt}
          />
          <PersonCard
            name={data.nameRupert || 'Person 2'}
            colorClass="text-rupert" borderClass="border-l-[3px] border-l-rupert"
            net={totals.netR} inc={totals.incR} exp={totals.expR} sav={totals.savR} debt={totals.debtR}
            hjExp={totals.halfJointExp} hjSav={totals.halfJointSav} hjDebt={totals.halfJointDebt}
          />
        </div>
      )}

      {/* categories grouped by type */}
      {(['INCOME', 'EXPENSE', 'SAVINGS'] as EntryType[]).map(type =>
        grouped[type].length === 0 ? null : (
          <div key={type}>
            <SectionDivider type={type} total={groupTotal(type)} />
            {grouped[type].map(cat => (
              <CategoryCard
                key={cat.key} cat={cat} ownerName={ownerName(cat.owner)}
                onUpdateAmount={updateItemAmount} onAddItem={addItem}
                onRemoveItem={removeItem} onRenameItem={renameItem}
                onRenameCategory={renameCategory} onDeleteCategory={deleteCategory}
              />
            ))}
          </div>
        )
      )}

      {/* debt payments in budget view */}
      {totals.totalDebt > 0 && (() => {
        const visibleDebts = data.debts.filter(d => tab === 'ALL' || d.owner === tab)
        if (visibleDebts.length === 0) return null
        return (
          <div>
            <SectionDivider type="EXPENSE" total={visibleDebts.reduce((a, d) => a + d.monthlyPayment, 0)} />
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-expense-text -mt-1 mb-2">Debt payments</div>
            {visibleDebts.map(d => (
              <div key={d.id} className={`card mb-2 ${ownerBorderClass(d.owner)} fade-up`}>
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{d.label}</div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {ownerName(d.owner)}
                      {d.isZeroPercent ? ' · 0%' : d.interestRate > 0 ? ` · ${d.interestRate}%` : ''}
                      {d.currentBalance > 0 ? ` · ${fmt(d.currentBalance)} remaining` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm tabular-nums text-expense-text">{fmt(d.monthlyPayment)}<span className="text-[10px] text-muted font-normal">/mo</span></div>
                    {d.currentBalance > 0 && d.monthlyPayment > 0 && (
                      <div className="text-[10px] text-muted">~{Math.ceil(d.currentBalance / d.monthlyPayment)} months</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={onNavigateToDebts} className="text-[11px] text-muted bg-transparent border-0 cursor-pointer mb-2 flex items-center gap-1">
              Manage debts →
            </button>
          </div>
        )
      })()}

      {/* add category */}
      {addingCat ? (
        <div className="card p-4 mt-4">
          <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em] mb-3">New category</div>
          <div className="flex gap-2 flex-wrap mb-3">
            <input
              value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitCat() }}
              placeholder="Category name…"
              autoFocus
              className="flex-1 min-w-[150px] text-sm border-[1.5px] border-border rounded-xl px-3 py-2.5 outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            <select
              value={newCatOwner}
              onChange={e => setNewCatOwner(e.target.value as Owner)}
              className="flex-1 text-sm border-[1.5px] border-border rounded-xl px-3 py-2.5 bg-card cursor-pointer"
            >
              <option value="NIAMH">{data.nameNiamh || 'Person 1'}</option>
              <option value="RUPERT">{data.nameRupert || 'Person 2'}</option>
              <option value="JOINT">{data.nameJoint || 'Joint'}</option>
            </select>
            <select
              value={newCatType}
              onChange={e => setNewCatType(e.target.value as EntryType)}
              className="flex-1 text-sm border-[1.5px] border-border rounded-xl px-3 py-2.5 bg-card cursor-pointer"
            >
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={submitCat} className="flex-1 bg-ink text-white border-0 rounded-xl py-2.5 cursor-pointer text-sm font-semibold">Add category</button>
            <button onClick={() => setAddingCat(false)} className="px-4 bg-transparent border-[1.5px] border-border rounded-xl py-2.5 cursor-pointer text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCat(true)}
          className="flex items-center justify-center gap-2 mt-4 w-full py-3.5 border-2 border-dashed border-border rounded-xl text-muted text-sm cursor-pointer bg-transparent"
        >
          <Plus size={14} /> Add category
        </button>
      )}

    </div>
  )
}
