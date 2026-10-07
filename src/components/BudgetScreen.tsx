'use client'

import { useState } from 'react'
import { Category, LineItem, TabFilter, Owner, EntryType, Property, fmt, calcTotals, daysUntil, isInsuranceItem, debtPayoff, propertySummaries } from '@/lib/models'
import { Plus, Check, TrendingUp, TrendingDown, SlidersHorizontal, Home } from 'lucide-react'
import { AmountCell, ConfirmDelete, ExpandButton, PanelSection, DeleteAction, Field, NumberInput, inputClass, useLongPress, ownerBorderClass, ownerTextClass } from './ui'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

function typeSectionClass(type: EntryType) {
  if (type === 'INCOME') return 'text-income-text'
  if (type === 'EXPENSE') return 'text-expense-text'
  return 'text-savings-text'
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
        {expPct > 0 && <div className="h-full bg-expense-text transition-[width] duration-700" style={{ width: `${expPct}%` }} />}
        {savPct > 0 && <div className="h-full bg-savings-text transition-[width] duration-700" style={{ width: `${savPct}%` }} />}
        {leftPct > 0 && (
          <div className={`h-full transition-[width] duration-700 ${left >= 0 ? 'bg-positive' : 'bg-negative'}`} style={{ width: `${leftPct}%` }} />
        )}
      </div>
      <div className="flex gap-3 mt-1.5 flex-wrap">
        {expPct > 0 && (
          <span className="text-caption text-expense-text font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-expense-text inline-block" /> Expenses {expPct.toFixed(0)}%
          </span>
        )}
        {savPct > 0 && (
          <span className="text-caption text-savings-text font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-savings-text inline-block" /> Savings {savPct.toFixed(0)}%
          </span>
        )}
        {leftPct > 0 && (
          <span className={`text-caption font-medium flex items-center gap-1 ${left >= 0 ? 'text-positive' : 'text-negative'}`}>
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${left >= 0 ? 'bg-positive' : 'bg-negative'}`} /> Left {leftPct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ─── budget overview ──────────────────────────────────────────────────────────

function BudgetOverview({ heading, inc: totalInc, exp: totalExp, sav: totalSav, net, note }: {
  heading: string; inc: number; exp: number; sav: number; net: number; note?: string
}) {
  const isHealthy = net >= 0
  if (totalInc === 0 && totalExp === 0) return null

  return (
    <div className="card mb-4 overflow-hidden">
      <div className={`h-1 w-full ${isHealthy ? 'bg-positive' : 'bg-negative'}`} />
      <div className="p-4">
        <div className="section-label text-caption mb-1">{heading}</div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-label text-muted mb-0.5">Total income</div>
            <div className="font-serif text-3xl font-bold text-ink tabular-nums leading-none">{fmt(totalInc)}</div>
          </div>
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold tabular-nums ${isHealthy ? 'bg-income-bg text-positive' : 'bg-expense-bg text-negative'}`}>
            {isHealthy ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {isHealthy ? '+' : ''}{fmt(net)} left
          </div>
        </div>
        <AllocationBar inc={totalInc} exp={totalExp} sav={totalSav} />
        {note && <p className="text-caption text-muted mt-2 mb-0 leading-snug">{note}</p>}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
          {[
            { label: 'Expenses', value: totalExp, cls: 'text-expense-text' },
            { label: 'Savings',  value: totalSav, cls: 'text-savings-text' },
            { label: 'Leftover', value: net,       cls: isHealthy ? 'text-positive' : 'text-negative' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="text-center">
              <div className="text-caption text-muted mb-0.5">{label}</div>
              <div className={`text-sm font-bold tabular-nums ${cls}`}>{fmt(value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── joint pot (joint filter) ─────────────────────────────────────────────────

function JointOverview({ name, exp, sav, debt }: { name: string; exp: number; sav: number; debt: number }) {
  const total = exp + sav + debt
  if (total === 0) return null
  return (
    <div className="card mb-4 overflow-hidden border-l-[3px] border-l-joint">
      <div className="p-4">
        <div className="section-label text-caption mb-1">{name} · {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-label text-muted mb-0.5">Paid from the joint pot</div>
            <div className="font-serif text-3xl font-bold text-ink tabular-nums leading-none">{fmt(total)}<span className="text-sm text-muted font-sans font-normal">/mo</span></div>
          </div>
          <div className="text-right">
            <div className="text-label text-muted mb-0.5">Each of you</div>
            <div className="font-serif text-xl font-bold tabular-nums leading-none">{fmt(total / 2)}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
          {[
            { label: 'Expenses', value: exp, cls: 'text-expense-text' },
            { label: 'Debts', value: debt, cls: 'text-expense-text' },
            { label: 'Savings', value: sav, cls: 'text-savings-text' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="text-center">
              <div className="text-caption text-muted mb-0.5">{label}</div>
              <div className={`text-sm font-bold tabular-nums ${value > 0 ? cls : 'text-muted'}`}>{value > 0 ? fmt(value) : '—'}</div>
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
    { label: 'Income',            value: inc,          cls: 'text-income-text' },
    { label: 'Personal expenses', value: exp + debt,   cls: 'text-expense-text' },
    { label: 'Joint account',     value: jointContrib, cls: 'text-expense-text' },
    { label: 'Savings',           value: sav,          cls: 'text-savings-text' },
  ].filter(r => r.value > 0)
  return (
    <div className={`card p-3.5 ${borderClass}`}>
      <div className={`text-label font-bold uppercase tracking-label mb-1 ${colorClass}`}>{name}</div>
      <div className={`font-serif text-2xl font-bold tabular-nums leading-none ${net >= 0 ? 'text-ink' : 'text-negative'}`}>
        {net >= 0 ? '+' : ''}{fmt(net)}
      </div>
      <div className="text-caption text-muted mt-0.5 mb-3">left this month</div>
      <div className="space-y-1 pt-2.5 border-t border-border">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between items-center gap-1">
            <span className="text-label text-muted">{r.label}</span>
            <span className={`text-label font-semibold tabular-nums ${r.cls}`}>{fmt(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── property rollup (property filter) ────────────────────────────────────────

function PropertyRollup({ summary }: { summary: ReturnType<typeof propertySummaries>[number] }) {
  const { property, monthlyTotal, mortgagePayment, runningCosts, equity, ltvPct, mortgageBalance } = summary
  return (
    <div className="card mb-4 p-4">
      <div className="flex items-center gap-1.5 section-label text-caption mb-1">
        <Home size={12} /> {property.isMainResidence ? 'Main residence' : property.isLet ? 'Let property' : 'Second property'}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-label text-muted mb-0.5">{property.label} costs</div>
          <div className="font-serif text-3xl font-bold tabular-nums leading-none">{fmt(monthlyTotal)}<span className="text-sm text-muted font-sans font-normal">/mo</span></div>
        </div>
        {property.estimatedValue > 0 && (
          <div className="text-right">
            <div className="text-label text-muted mb-0.5">Equity</div>
            <div className={`font-serif text-xl font-bold tabular-nums leading-none ${equity >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(equity)}</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border text-center">
        <div><div className="text-caption text-muted mb-0.5">Mortgage</div><div className="text-sm font-bold tabular-nums">{fmt(mortgagePayment)}</div></div>
        <div><div className="text-caption text-muted mb-0.5">Running costs</div><div className="text-sm font-bold tabular-nums">{fmt(runningCosts)}</div></div>
        <div><div className="text-caption text-muted mb-0.5">LTV</div><div className="text-sm font-bold tabular-nums">{ltvPct != null && mortgageBalance > 0 ? `${ltvPct.toFixed(0)}%` : '—'}</div></div>
      </div>
      {summary.items.length === 0 && summary.debts.length === 0 && (
        <p className="text-label text-muted mt-3 mb-0 leading-snug">
          Nothing linked yet. Open any expense&apos;s options (<SlidersHorizontal size={10} className="inline" />) and pick this property, and link its mortgage on the Debts tab.
        </p>
      )}
    </div>
  )
}

// ─── section divider ──────────────────────────────────────────────────────────

function SectionDivider({ type, total }: { type: EntryType; total: number }) {
  const labels = { INCOME: 'Income', EXPENSE: 'Expenses', SAVINGS: 'Savings' }
  const cls = typeSectionClass(type)
  return (
    <div className="flex items-center gap-2 mb-2 mt-5 first:mt-0">
      <span className={`text-label font-bold uppercase tracking-label shrink-0 ${cls}`}>{labels[type]}</span>
      <div className="flex-1 h-px bg-border" />
      <span className={`text-label font-bold tabular-nums shrink-0 ${cls}`}>{total > 0 ? fmt(total) : '—'}</span>
    </div>
  )
}

// ─── item row ────────────────────────────────────────────────────────────────

function RenewalPill({ days }: { days: number }) {
  const passed = days < 0
  const text = passed ? 'Renewal date passed'
    : days === 0 ? 'Renews today'
    : days === 1 ? 'Renews tomorrow'
    : days <= 60 ? `Renews in ${days} days`
    : null
  if (!text) return null
  return <span className={`pill ${passed ? 'pill-bad' : days <= 30 ? 'pill-warn' : ''}`}>{text}</span>
}

function ItemRow({ cat, item, properties, budget }: {
  cat: Category; item: LineItem; properties: Property[]; budget: BudgetHook
}) {
  const { updateItemAmount, removeItem, renameItem, updateItemRenewal, toggleItemAutoRenew, toggleItemShared, updateItemInsurance, updateItemProperty } = budget
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(item.label)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const longPress = useLongPress(() => setConfirmDelete(true), editingLabel)
  const commitLabel = () => { renameItem(cat.key, item.id, labelDraft); setEditingLabel(false) }

  const isExpense = cat.type === 'EXPENSE'
  // Joint costs are already shared, so the household flag only applies to an
  // expense sitting in one person's own column.
  const canMarkShared = isExpense && cat.owner !== 'JOINT'
  const isInsurance = isExpense && isInsuranceItem(item.label)
  const days = item.renewalDate ? daysUntil(item.renewalDate) : null
  const property = properties.find(p => p.id === item.propertyId)
  const hasFlags = !!(item.renewalDate || item.sharedContribution || property)

  return (
    <>
      {confirmDelete && (
        <ConfirmDelete label={item.label} onConfirm={() => { removeItem(cat.key, item.id); setConfirmDelete(false) }} onCancel={() => setConfirmDelete(false)} />
      )}
      <div className="border-b border-border last:border-0">
        <div className="flex items-center gap-2 py-1.5 min-h-[44px]" {...longPress}>
          {editingLabel ? (
            <>
              <input
                value={labelDraft}
                onChange={e => setLabelDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
                onBlur={commitLabel}
                // min-w-0 or the input refuses to shrink below its intrinsic
                // width and pushes the options button off the row.
                className="flex-1 min-w-0 text-body border-[1.5px] border-accent rounded-lg px-2 py-1.5 outline-none bg-accent-light"
                autoFocus
              />
              <button onClick={commitLabel} aria-label="Save name" className="bg-ink text-on-ink border-0 rounded-lg w-9 h-9 cursor-pointer flex items-center justify-center shrink-0">
                <Check size={14} />
              </button>
            </>
          ) : (
            <div className="flex-1 min-w-0">
              <span onClick={() => { setLabelDraft(item.label); setEditingLabel(true) }} className="text-body text-ink cursor-text select-none block break-words">
                {item.label}
              </span>
              {(hasFlags || item.insuranceProvider) && (
                <span className="flex items-center gap-1 flex-wrap mt-0.5">
                  {days != null && <RenewalPill days={days} />}
                  {item.renewalDate && item.autoRenews && <span className="pill">Auto-renews</span>}
                  {item.sharedContribution && <span className="pill pill-joint">Household cost</span>}
                  {property && <span className="pill pill-accent"><Home size={9} /> {property.label}</span>}
                  {item.insuranceProvider && <span className="pill">{item.insuranceProvider}</span>}
                </span>
              )}
            </div>
          )}
          <AmountCell value={item.amount} onChange={v => updateItemAmount(cat.key, item.id, v)} />
          <ExpandButton
            expanded={expanded}
            onClick={() => setExpanded(e => !e)}
            label={`Options for ${item.label}`}
            active={hasFlags && !expanded}
            icon={<SlidersHorizontal size={15} />}
          />
        </div>

        {expanded && (
          <div className="pb-2 pl-0.5">
            {canMarkShared && (
              <PanelSection title="Who it's for">
                <label className="flex items-start gap-2 cursor-pointer min-h-[32px]">
                  <input type="checkbox" checked={!!item.sharedContribution} onChange={() => toggleItemShared(cat.key, item.id)} className="mt-0.5 shrink-0 w-4 h-4" />
                  <span className="text-xs text-ink leading-snug">
                    I pay this, but it&apos;s for the household
                    <span className="block text-caption text-muted mt-0.5">Counts towards your share of household costs on Fair Share — e.g. a mortgage only you pay.</span>
                  </span>
                </label>
              </PanelSection>
            )}

            {isExpense && properties.length > 0 && (
              <PanelSection title="Property">
                <select
                  value={item.propertyId ?? ''}
                  onChange={e => updateItemProperty(cat.key, item.id, e.target.value)}
                  className={`${inputClass} w-full`}
                >
                  <option value="">Not tied to a property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </PanelSection>
            )}

            {isExpense && (
              <PanelSection title={isInsurance ? 'Renewal / policy end' : 'Renewal / contract end'}>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={item.renewalDate ?? ''}
                    onChange={e => updateItemRenewal(cat.key, item.id, e.target.value)}
                    aria-label="Renewal date"
                    className={inputClass}
                  />
                  {item.renewalDate && (
                    <button onClick={() => updateItemRenewal(cat.key, item.id, '')} className="text-xs text-muted bg-transparent border-0 cursor-pointer underline min-h-[36px] px-1">
                      Clear
                    </button>
                  )}
                </div>
                {item.renewalDate && (
                  <label className="flex items-start gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={!!item.autoRenews} onChange={() => toggleItemAutoRenew(cat.key, item.id)} className="mt-0.5 shrink-0 w-4 h-4" />
                    <span className="text-xs text-ink leading-snug">
                      Auto-renews
                      <span className="block text-caption text-muted mt-0.5">
                        {item.autoRenews
                          ? 'This date is when the price may jump, not when cover ends.'
                          : isInsurance
                            ? "Unticked: cover lapses on this date unless you renew it yourself."
                            : "Unticked: it ends on this date unless you renew it yourself."}
                      </span>
                    </span>
                  </label>
                )}
              </PanelSection>
            )}

            {isInsurance && (
              <PanelSection title="Policy">
                <div className="flex gap-2 flex-wrap">
                  <Field label="Provider">
                    <input
                      value={item.insuranceProvider ?? ''}
                      placeholder="e.g. Aviva"
                      onChange={e => updateItemInsurance(cat.key, item.id, { provider: e.target.value })}
                      className={`${inputClass} w-[130px]`}
                    />
                  </Field>
                  <Field label="Cover £">
                    <NumberInput
                      value={item.insuranceCoverAmount}
                      onChange={v => updateItemInsurance(cat.key, item.id, { coverAmount: v })}
                      className={`${inputClass} w-[110px]`}
                    />
                  </Field>
                </div>
              </PanelSection>
            )}

            <div className="pt-1 border-t border-border">
              <DeleteAction label="Delete item" onClick={() => setConfirmDelete(true)} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat, items, ownerName, properties, budget, allowAdd }: {
  cat: Category; items: LineItem[]; ownerName: string; properties: Property[]; budget: BudgetHook; allowAdd: boolean
}) {
  const { addItem, renameCategory, deleteCategory } = budget
  const [open, setOpen] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(cat.label)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const longPress = useLongPress(() => setConfirmDelete(true), editingName)
  const total = items.reduce((a, i) => a + i.amount, 0)
  const submitItem = () => { if (newItemLabel.trim()) { addItem(cat.key, newItemLabel.trim()); setNewItemLabel(''); setAddingItem(false) } }
  const commitName = () => { renameCategory(cat.key, nameDraft); setEditingName(false) }

  return (
    <>
      {confirmDelete && (
        <ConfirmDelete
          label={cat.label}
          detail={cat.items.length > 0 ? `This also deletes its ${cat.items.length} ${cat.items.length === 1 ? 'item' : 'items'}. It can't be undone.` : undefined}
          onConfirm={() => { deleteCategory(cat.key); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className={`card mb-2 overflow-hidden fade-up ${ownerBorderClass(cat.owner)}`}>
        <div className={`flex items-center gap-2 px-3.5 py-2.5 ${open ? 'bg-card' : 'bg-surface'}`} {...longPress}>
          {editingName ? (
            <>
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitName() }}
                onBlur={commitName}
                className="flex-1 min-w-0 text-sm font-semibold border-[1.5px] border-accent rounded-lg px-2.5 py-1.5 outline-none bg-accent-light"
                autoFocus
              />
              <button onClick={commitName} onMouseDown={e => e.stopPropagation()} aria-label="Save name" className="bg-ink text-on-ink border-0 rounded-lg w-9 h-9 cursor-pointer flex items-center justify-center shrink-0">
                <Check size={14} />
              </button>
            </>
          ) : (
            <div className="flex-1 min-w-0" onClick={() => { setNameDraft(cat.label); setEditingName(true) }} onMouseDown={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold cursor-text leading-tight">{cat.label}</span>
                {cat.note && <span className="text-caption text-muted hidden sm:inline">{cat.note}</span>}
              </div>
              <div className={`text-label font-medium mt-0.5 ${ownerTextClass(cat.owner)}`}>{ownerName}</div>
            </div>
          )}
          <span className={`font-bold text-sm tabular-nums shrink-0 min-w-[60px] text-right ${total > 0 ? 'text-ink' : 'text-muted opacity-60'}`}>
            {total > 0 ? fmt(total) : '—'}
          </span>
          <ExpandButton expanded={open} onClick={() => setOpen(o => !o)} label={open ? `Collapse ${cat.label}` : `Expand ${cat.label}`} />
        </div>

        {open && (
          <div className="px-3.5 pb-1.5">
            {items.map(item => (
              <ItemRow key={item.id} cat={cat} item={item} properties={properties} budget={budget} />
            ))}
            {allowAdd && (addingItem ? (
              <div className="flex gap-1.5 mt-2 pt-2 border-t border-border">
                <input
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitItem(); if (e.key === 'Escape') setAddingItem(false) }}
                  placeholder="Item name…"
                  autoFocus
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <button onClick={submitItem} className="bg-ink text-on-ink border-0 rounded-lg px-3 cursor-pointer text-xs font-medium min-h-[36px]">Add</button>
                <button onClick={() => setAddingItem(false)} aria-label="Cancel" className="bg-transparent border-[1.5px] border-border rounded-lg px-3 cursor-pointer text-xs min-h-[36px]">✕</button>
              </div>
            ) : (
              <div className="flex items-center justify-between mt-0.5">
                <button onClick={() => setAddingItem(true)} className="flex items-center gap-1.5 bg-transparent border-0 cursor-pointer text-muted text-xs min-h-[40px] px-0">
                  <Plus size={12} /> Add item
                </button>
                <button onClick={() => setConfirmDelete(true)} className="bg-transparent border-0 cursor-pointer text-muted text-caption min-h-[40px] px-0">
                  Delete category
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── main screen ──────────────────────────────────────────────────────────────

const OWNER_ORDER: Owner[] = ['NIAMH', 'RUPERT', 'JOINT']

export default function BudgetScreen({ budget, tab, onNavigateToDebts }: { budget: BudgetHook; tab: TabFilter; onNavigateToDebts: () => void }) {
  const { data, totals, addCategory } = budget
  const [addingCat, setAddingCat] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatOwner, setNewCatOwner] = useState<Owner>('JOINT')
  const [newCatType, setNewCatType] = useState<EntryType>('EXPENSE')

  const properties = data.properties ?? []
  const monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const propertyId = tab.startsWith('property:') ? tab.slice('property:'.length) : null
  const propertySummary = propertyId ? propertySummaries(data).find(s => s.property.id === propertyId) ?? null : null

  const ownerName = (o: Owner) => o === 'NIAMH' ? data.nameNiamh || 'Person 1' : o === 'RUPERT' ? data.nameRupert || 'Person 2' : data.nameJoint || 'Joint'

  const visible = data.categories
    .filter(c => propertyId ? true : tab === 'ALL' || c.owner === tab)
    .map(c => ({ cat: c, items: propertyId ? c.items.filter(i => i.propertyId === propertyId) : c.items }))
    .filter(v => !propertyId || v.items.length > 0)
    .sort((a, b) => {
      const od = OWNER_ORDER.indexOf(a.cat.owner) - OWNER_ORDER.indexOf(b.cat.owner)
      if (od !== 0) return od
      return ['INCOME', 'EXPENSE', 'SAVINGS'].indexOf(a.cat.type) - ['INCOME', 'EXPENSE', 'SAVINGS'].indexOf(b.cat.type)
    })

  const groupTotal = (type: EntryType) =>
    visible.filter(v => v.cat.type === type).reduce((a, v) => a + v.items.reduce((b, i) => b + i.amount, 0), 0)

  const visibleDebts = data.debts.filter(d => propertyId ? d.propertyId === propertyId : tab === 'ALL' || d.owner === tab)

  const submitCat = () => {
    if (newCatLabel.trim()) { addCategory(newCatOwner, newCatType, newCatLabel.trim()); setNewCatLabel(''); setAddingCat(false) }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {propertySummary ? <PropertyRollup summary={propertySummary} />
        : tab === 'JOINT' ? <JointOverview name={ownerName('JOINT')} exp={totals.expJoint} sav={totals.savJoint} debt={totals.debtJoint} />
        : tab === 'NIAMH' || tab === 'RUPERT' ? (() => {
            // A person's own month: their income, their own spending, and their half of the joint pot.
            const n = tab === 'NIAMH'
            const halfJoint = totals.halfJointExp + totals.halfJointDebt
            return (
              <BudgetOverview
                heading={`${ownerName(tab)} · ${monthLabel}`}
                inc={n ? totals.incN : totals.incR}
                exp={(n ? totals.expN + totals.debtN : totals.expR + totals.debtR) + halfJoint}
                sav={(n ? totals.savN : totals.savR) + totals.halfJointSav}
                net={n ? totals.netN : totals.netR}
                note={`Includes half of the joint pot (${fmt(halfJoint + totals.halfJointSav)}).`}
              />
            )
          })()
        : <BudgetOverview heading={monthLabel} inc={totals.totalInc} exp={totals.totalExp} sav={totals.totalSav} net={totals.net} />}

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

      {(['INCOME', 'EXPENSE', 'SAVINGS'] as EntryType[]).map(type => {
        const group = visible.filter(v => v.cat.type === type)
        if (group.length === 0) return null
        return (
          <div key={type}>
            <SectionDivider type={type} total={groupTotal(type)} />
            {group.map(({ cat, items }) => (
              <CategoryCard
                key={cat.key} cat={cat} items={items} ownerName={ownerName(cat.owner)}
                properties={properties} budget={budget}
                // Adding under a property filter would create an untagged item
                // that then vanishes from view — confusing, so don't offer it.
                allowAdd={!propertyId}
              />
            ))}
          </div>
        )
      })}

      {visibleDebts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 mt-5">
            <span className="text-label font-bold uppercase tracking-label shrink-0 text-expense-text">Debt payments</span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-label font-bold tabular-nums shrink-0 text-expense-text">
              {fmt(visibleDebts.reduce((a, d) => a + d.monthlyPayment, 0))}
            </span>
          </div>
          {visibleDebts.map(d => {
            const months = d.currentBalance > 0 ? debtPayoff(d).months : null
            const property = properties.find(p => p.id === d.propertyId)
            return (
              <div key={d.id} className={`card mb-2 ${ownerBorderClass(d.owner)} fade-up`}>
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{d.label}</div>
                    <div className="text-label text-muted mt-0.5">
                      {ownerName(d.owner)}
                      {d.isZeroPercent ? ' · 0%' : d.interestRate > 0 ? ` · ${d.interestRate}%` : ''}
                      {d.currentBalance > 0 ? ` · ${fmt(d.currentBalance)} remaining` : ''}
                    </div>
                    {(property || d.sharedContribution) && (
                      <span className="flex gap-1 flex-wrap mt-1">
                        {d.sharedContribution && <span className="pill pill-joint">Household cost</span>}
                        {property && <span className="pill pill-accent"><Home size={9} /> {property.label}</span>}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm tabular-nums text-expense-text">{fmt(d.monthlyPayment)}<span className="text-caption text-muted font-normal">/mo</span></div>
                    {d.currentBalance > 0 && d.monthlyPayment > 0 && (
                      <div className={`text-caption ${months == null ? 'text-negative font-semibold' : 'text-muted'}`}>
                        {months == null ? "Doesn't cover interest" : `~${months} months`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <button onClick={onNavigateToDebts} className="text-label text-muted bg-transparent border-0 cursor-pointer mb-2 flex items-center gap-1 min-h-[36px] px-0">
            Manage debts →
          </button>
        </div>
      )}

      {!propertyId && (addingCat ? (
        <div className="card p-4 mt-4">
          <div className="section-label mb-3">New category</div>
          <input
            value={newCatLabel}
            onChange={e => setNewCatLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitCat() }}
            placeholder="Category name…"
            autoFocus
            className={`${inputClass} w-full mb-3`}
          />
          <div className="flex gap-2 flex-wrap mb-3">
            <select value={newCatOwner} onChange={e => setNewCatOwner(e.target.value as Owner)} aria-label="Owner" className={`${inputClass} flex-1 cursor-pointer`}>
              <option value="NIAMH">{data.nameNiamh || 'Person 1'}</option>
              <option value="RUPERT">{data.nameRupert || 'Person 2'}</option>
              <option value="JOINT">{data.nameJoint || 'Joint'}</option>
            </select>
            <select value={newCatType} onChange={e => setNewCatType(e.target.value as EntryType)} aria-label="Type" className={`${inputClass} flex-1 cursor-pointer`}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={submitCat} className="flex-1 bg-ink text-on-ink border-0 rounded-xl py-3 cursor-pointer text-sm font-semibold">Add category</button>
            <button onClick={() => setAddingCat(false)} className="px-4 bg-transparent border-[1.5px] border-border rounded-xl py-3 cursor-pointer text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCat(true)}
          className="flex items-center justify-center gap-2 mt-4 w-full py-3.5 border-2 border-dashed border-border rounded-xl text-muted text-sm cursor-pointer bg-transparent"
        >
          <Plus size={14} /> Add category
        </button>
      ))}

      <p className="text-caption text-muted text-center mt-5 mb-1 select-none">
        Tap a name or amount to edit · <SlidersHorizontal size={9} className="inline -mt-px" /> for options and delete
      </p>
    </div>
  )
}
