'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Category, LineItem, TabFilter, Owner, EntryType, Debt, Property, fmt, daysUntil, isInsuranceItem,
  debtPayoff, isMortgage, propertySummaries, nextPayday, energySwitchReminders, householdCostSplit,
} from '@/lib/models'
import { needsAttention } from '@/lib/attention'
import { Plus, ChevronRight, ChevronDown, AlertTriangle, ArrowUp, ArrowDown, X } from 'lucide-react'
import { ConfirmDelete, NumberInput, inputClass } from './ui'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

// ─── small pieces ─────────────────────────────────────────────────────────────

export function OwnerDot({ owner, label }: { owner: Owner; label?: string }) {
  const cls = owner === 'NIAMH' ? 'dot-niamh' : owner === 'RUPERT' ? 'dot-rupert' : 'dot-joint'
  return <span className={`dot ${cls}`} role="img" aria-label={label ?? (owner === 'JOINT' ? 'Joint' : owner === 'NIAMH' ? 'Person 1' : 'Person 2')} />
}

/** A money figure with a smaller, quieter £ — read out as one number. */
export function Money({ value }: { value: number }) {
  const text = fmt(Math.abs(value)).replace('£', '')
  return (
    <span className="num" aria-label={`${value < 0 ? 'minus ' : ''}${fmt(Math.abs(value))}`}>
      <span aria-hidden="true">{value < 0 ? '−' : ''}<span className="cur">£</span>{text}</span>
    </span>
  )
}

function SectionHead({ title, meta }: { title: string; meta: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mt-8 mb-1 gap-3">
      <h2 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] m-0">{title}</h2>
      <span className="text-label text-muted num text-right">{meta}</span>
    </div>
  )
}

const plusYear = (d: string) => {
  const date = new Date(d)
  date.setFullYear(date.getFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

// ─── hero ─────────────────────────────────────────────────────────────────────

interface Segment { label: string; value: number; color: string }

/**
 * The top card: one headline figure, a bar showing what it's made of, an
 * optional note, and an optional quieter second figure underneath.
 */
function Hero({ label, value, suffix, negative, pair, segments, legendEnd, note, secondary }: {
  label: string; value: number; suffix?: string; negative?: boolean
  /** Two side-by-side figures under the headline (each person's share). */
  pair?: { owner: Owner; label: string; value: number }[]
  segments: Segment[]
  /** Right-hand legend entry with no bar colour, e.g. "Total £3,349". */
  legendEnd?: { label: string; value: React.ReactNode }
  note?: { owner?: Owner; text: React.ReactNode }
  secondary?: { label: string; value: number; negative?: boolean; sub: React.ReactNode; delta?: number | null }
}) {
  const shown = segments.filter(s => s.value > 0)
  const delta = secondary?.delta
  return (
    <section className="panel p-5 mt-3.5" aria-label={label}>
      <div className="text-label font-medium text-muted">{label}</div>
      <div className={`figure mt-2 flex items-baseline flex-wrap gap-x-2 text-[44px] leading-none font-bold tracking-[-0.035em] ${negative ? 'text-neg' : 'text-ink'}`}>
        <Money value={value} />
        {suffix && <span className="text-[17px] font-medium tracking-normal text-muted">{suffix}</span>}
      </div>
      {pair && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {pair.map(p => (
            <div key={p.owner} className="min-w-0">
              <div className="flex items-center gap-1.5 text-label text-muted truncate"><OwnerDot owner={p.owner} label={p.label} />{p.label}</div>
              <div className="figure text-[28px] leading-8 font-bold tracking-[-0.03em] mt-1"><Money value={p.value} /></div>
            </div>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <>
          <div className="flex h-1.5 gap-[2px] rounded-[3px] overflow-hidden mt-4" aria-hidden="true">
            {shown.map(s => <div key={s.label} className="h-full" style={{ flexGrow: s.value, background: s.color }} />)}
          </div>
          <div className="grid gap-2 mt-2.5 num" style={{ gridTemplateColumns: `repeat(${shown.length + (legendEnd ? 1 : 0)}, minmax(0, 1fr))` }}>
            {[...shown.map(s => ({ key: s.label, label: s.label, color: s.color as string | undefined, value: fmt(s.value) as React.ReactNode })),
              ...(legendEnd ? [{ key: '_end', label: legendEnd.label, color: undefined, value: legendEnd.value }] : [])]
              .map((e, i, all) => {
                const last = i === all.length - 1 && all.length > 1
                return (
                  <div key={e.key} className={`min-w-0 ${last ? 'text-right' : ''}`}>
                    <div className={`flex items-center gap-1.5 text-caption text-muted truncate ${last ? 'justify-end' : ''}`}>
                      {e.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} aria-hidden="true" />}{e.label}
                    </div>
                    <div className="text-[15px] font-semibold text-ink mt-0.5">{e.value}</div>
                  </div>
                )
              })}
          </div>
        </>
      )}
      {note && (
        <div className="flex items-center gap-2 mt-3.5 pt-3 border-t border-line text-label text-muted">
          {note.owner && <OwnerDot owner={note.owner} />}
          <span className="min-w-0">{note.text}</span>
        </div>
      )}
      {secondary && (
        <div className="flex items-end justify-between gap-3 mt-4 pt-4 border-t border-line">
          <div className="min-w-0">
            <div className="text-label font-medium text-muted">{secondary.label}</div>
            <div className={`figure text-[28px] leading-none font-bold tracking-[-0.03em] mt-1.5 ${secondary.negative ? 'text-neg' : 'text-ink'}`}><Money value={secondary.value} /></div>
            <div className="text-caption text-muted mt-1.5">{secondary.sub}</div>
          </div>
          {delta != null && Math.abs(delta) >= 1 && (
            <div className="text-caption text-muted text-right shrink-0">
              <span className={`inline-flex items-center gap-0.5 font-semibold num ${delta > 0 ? 'text-pos' : 'text-warn'}`}>
                {delta > 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}{fmt(Math.abs(delta))}
              </span>
              <br />{delta > 0 ? 'more' : 'less'} than last month
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── lapsed renewal banner ────────────────────────────────────────────────────

function LapsedBanner({ title, meta, onOpen, onRenewed, onUpdateDate }: {
  title: string; meta: string; onOpen: () => void; onRenewed: () => void; onUpdateDate: () => void
}) {
  const divider = 'border-[color-mix(in_srgb,var(--neg)_18%,transparent)]'
  return (
    <section className="mt-4 rounded-[18px] bg-neg-tint overflow-hidden" aria-label={title}>
      <button onClick={onOpen} className="w-full flex items-center gap-3 px-4 py-3 min-h-[60px] text-left cursor-pointer">
        <AlertTriangle size={20} className="text-neg shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold text-ink">{title}</span>
          <span className="block text-label text-ink-2 truncate">{meta}</span>
        </span>
        <ChevronRight size={18} className="text-ink-2 shrink-0" aria-hidden="true" />
      </button>
      <div className={`grid grid-cols-2 border-t ${divider}`}>
        <button onClick={onRenewed} className="min-h-[48px] text-[15px] font-semibold text-ink cursor-pointer">Renewed</button>
        <button onClick={onUpdateDate} className={`min-h-[48px] text-[15px] font-semibold text-ink cursor-pointer border-l ${divider}`}>Update date</button>
      </div>
    </section>
  )
}

// ─── item sheet ───────────────────────────────────────────────────────────────

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // Portalled to <body> so it sits above the tab bar, outside the screen's stacking context.
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end justify-center" style={{ background: 'var(--scrim)' }} onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="sheet-enter w-full max-w-[480px] max-h-[88dvh] overflow-y-auto bg-bg rounded-t-[22px] px-5 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-line-2 mx-auto mb-1" aria-hidden="true" />
        <div className="flex items-center justify-between min-h-[44px]">
          <span className="text-label text-muted truncate">{title}</span>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-3 grid place-items-center text-muted cursor-pointer"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function SheetRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="py-2.5 border-t border-line">
      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <span className="text-[15px] text-ink">{label}</span>
        <div className="shrink-0">{children}</div>
      </div>
      {hint && <p className="text-caption text-muted mt-1 mb-0 leading-snug">{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`w-[51px] h-[31px] rounded-full relative cursor-pointer ${checked ? 'bg-ink' : 'bg-fill-2'}`}
    >
      <span className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-panel shadow" style={{ left: checked ? 22 : 2 }} />
    </button>
  )
}

function AutoFocus({ selector }: { selector: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(selector)
      el?.focus()
      if (el && el.type !== 'date') el.select?.()
    }, 200)
    return () => clearTimeout(t)
  }, [selector])
  return null
}

function ItemSheet({ cat, item, properties, budget, ownerName, focus, onClose }: {
  cat: Category; item: LineItem; properties: Property[]; budget: BudgetHook
  ownerName: (o: Owner) => string; focus: 'amount' | 'date'; onClose: () => void
}) {
  const { updateItemAmount, renameItem, removeItem, updateItemRenewal, toggleItemAutoRenew, toggleItemShared, updateItemInsurance, updateItemProperty } = budget
  const [label, setLabel] = useState(item.label)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isExpense = cat.type === 'EXPENSE'
  const isInsurance = isExpense && isInsuranceItem(item.label)
  const canMarkShared = isExpense && cat.owner !== 'JOINT'
  const days = item.renewalDate ? daysUntil(item.renewalDate) : null

  return (
    <Sheet title={`${cat.label} · ${ownerName(cat.owner)}`} onClose={onClose}>
      {confirmDelete && (
        <ConfirmDelete
          label={item.label}
          detail={`Removes it from this budget${item.renewalDate ? ' along with its renewal reminder' : ''}. This can't be undone.`}
          onConfirm={() => { removeItem(cat.key, item.id); setConfirmDelete(false); onClose() }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => { if (label.trim() && label !== item.label) renameItem(cat.key, item.id, label) }}
        aria-label="Name"
        className="w-full bg-transparent text-[22px] font-semibold tracking-[-0.02em] outline-none border-0 p-0 min-h-[44px] text-ink"
      />
      <label className="flex items-baseline gap-1 mt-1 mb-3">
        <span className="text-[34px] font-semibold text-muted" aria-hidden="true">£</span>
        <NumberInput
          value={item.amount || undefined}
          onChange={v => updateItemAmount(cat.key, item.id, v ?? 0)}
          ariaLabel={`Amount per month for ${item.label}`}
          className="flex-1 min-w-0 bg-transparent text-[34px] font-semibold tracking-[-0.03em] num outline-none border-0 px-1 rounded-lg text-ink"
        />
        <span className="text-[17px] text-muted shrink-0">/mo</span>
      </label>
      {focus === 'amount' && <AutoFocus selector='input[aria-label^="Amount per month"]' />}

      {canMarkShared && (
        <SheetRow label="For the household" hint="Counts towards your share of household costs — e.g. a mortgage only you pay.">
          <Toggle checked={!!item.sharedContribution} onChange={() => toggleItemShared(cat.key, item.id)} label="For the household" />
        </SheetRow>
      )}

      {isExpense && properties.length > 0 && (
        <SheetRow label="Home">
          <select value={item.propertyId ?? ''} onChange={e => updateItemProperty(cat.key, item.id, e.target.value)} className={`${inputClass} max-w-[190px]`} aria-label="Home">
            <option value="">Not tied to a home</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </SheetRow>
      )}

      {isExpense && (
        <SheetRow
          label={isInsurance ? 'Renews / cover ends' : 'Renews / contract ends'}
          hint={days != null && days < 0 ? <span className="text-neg font-medium">This date has passed — set next year’s date once renewed.</span> : undefined}
        >
          <input
            type="date"
            value={item.renewalDate ?? ''}
            onChange={e => updateItemRenewal(cat.key, item.id, e.target.value)}
            aria-label="Renewal date"
            className={`${inputClass} ${days != null && days < 0 ? 'text-neg' : ''}`}
          />
          {focus === 'date' && <AutoFocus selector='input[aria-label="Renewal date"]' />}
        </SheetRow>
      )}

      {isExpense && item.renewalDate && (
        <SheetRow
          label="Auto-renews"
          hint={item.autoRenews ? 'The date is when the price may jump, not when it ends.' : isInsurance ? 'Off: cover lapses on this date unless you renew it.' : 'Off: it ends on this date unless you renew it.'}
        >
          <Toggle checked={!!item.autoRenews} onChange={() => toggleItemAutoRenew(cat.key, item.id)} label="Auto-renews" />
        </SheetRow>
      )}

      {isInsurance && (
        <SheetRow label="Provider">
          <input value={item.insuranceProvider ?? ''} placeholder="e.g. Aviva" onChange={e => updateItemInsurance(cat.key, item.id, { provider: e.target.value })} className={`${inputClass} w-[160px]`} aria-label="Provider" />
        </SheetRow>
      )}
      {isInsurance && (
        <SheetRow label="Cover (£)">
          <NumberInput value={item.insuranceCoverAmount} onChange={v => updateItemInsurance(cat.key, item.id, { coverAmount: v })} ariaLabel="Cover amount in pounds" className={`${inputClass} w-[160px] text-right`} />
        </SheetRow>
      )}

      <div className="pt-2 border-t border-line">
        <button onClick={() => setConfirmDelete(true)} className="min-h-[44px] text-[15px] font-medium text-ink-2 underline underline-offset-2 cursor-pointer">Delete item</button>
      </div>
    </Sheet>
  )
}

// ─── groups ───────────────────────────────────────────────────────────────────

const chevron = (open: boolean) => open
  ? <ChevronDown size={18} className="text-faint shrink-0" aria-hidden="true" />
  : <ChevronRight size={18} className="text-faint shrink-0" aria-hidden="true" />

function ItemRow({ item, onOpen }: { item: LineItem; onOpen: () => void }) {
  const days = item.renewalDate ? daysUntil(item.renewalDate) : null
  const flag = days == null ? null
    : days < 0 ? { text: 'Lapsed', cls: 'text-neg' }
    : days <= 30 && !item.autoRenews ? { text: `Renews in ${days} ${days === 1 ? 'day' : 'days'}`, cls: 'text-warn' }
    : null
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 pl-5 min-h-[52px] py-2 text-left border-t border-line cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] text-ink truncate">{item.label}</span>
        {(flag || item.sharedContribution) && (
          <span className="block text-caption text-muted truncate">
            {flag && <span className={`font-medium ${flag.cls}`}>{flag.text}</span>}
            {flag && item.sharedContribution && ' · '}
            {item.sharedContribution && 'For the household'}
          </span>
        )}
      </span>
      <span className={`text-[15px] ${item.amount > 0 ? 'text-ink' : 'text-faint'}`}>{item.amount > 0 ? <Money value={item.amount} /> : '—'}</span>
      <ChevronRight size={16} className="text-faint shrink-0" aria-hidden="true" />
    </button>
  )
}

function GroupMeta({ items, extraFlag }: { items: LineItem[]; extraFlag?: string | null }) {
  const lapsed = items.filter(i => i.renewalDate && daysUntil(i.renewalDate) < 0).length
  const soon = items.filter(i => { if (!i.renewalDate) return false; const d = daysUntil(i.renewalDate); return d >= 0 && d <= 30 && !i.autoRenews }).length
  const names = items.filter(i => i.amount > 0).slice(0, 3).map(i => i.label).join(', ')
  return (
    <span className="block text-label text-muted truncate">
      {lapsed > 0 && <span className="text-neg font-medium">{lapsed} lapsed · </span>}
      {lapsed === 0 && soon > 0 && <span className="text-warn font-medium">{soon} renewing soon · </span>}
      {extraFlag && <span className="text-warn font-medium">{extraFlag} · </span>}
      {items.length} {items.length === 1 ? 'item' : 'items'}{names ? ` · ${names}` : ''}
    </span>
  )
}

function CategoryGroup({ cat, items, ownerName, budget, onOpenItem, extraFlag, allowEdit }: {
  cat: Category; items: LineItem[]; ownerName: (o: Owner) => string; budget: BudgetHook
  onOpenItem: (cat: Category, item: LineItem) => void; extraFlag?: string | null; allowEdit: boolean
}) {
  const { addItem, renameCategory, deleteCategory } = budget
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(cat.label)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const total = items.reduce((a, i) => a + i.amount, 0)
  const submit = () => { if (newLabel.trim()) { addItem(cat.key, newLabel.trim()); setNewLabel(''); setAdding(false) } }

  return (
    <div className="border-t border-line">
      {confirmDelete && (
        <ConfirmDelete
          label={cat.label}
          detail={cat.items.length > 0 ? `This also deletes its ${cat.items.length} ${cat.items.length === 1 ? 'item' : 'items'}. It can't be undone.` : undefined}
          onConfirm={() => { deleteCategory(cat.key); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-3 min-h-[64px] py-2.5 text-left cursor-pointer">
        <OwnerDot owner={cat.owner} label={ownerName(cat.owner)} />
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-medium text-ink truncate">
            {cat.label}{cat.owner !== 'JOINT' && <span className="text-muted font-normal"> · {ownerName(cat.owner)}</span>}
          </span>
          <GroupMeta items={items} extraFlag={extraFlag} />
        </span>
        <span className={`text-[17px] font-semibold ${total > 0 ? 'text-ink' : 'text-faint'}`}>{total > 0 ? <Money value={total} /> : '—'}</span>
        {chevron(open)}
      </button>
      {open && (
        <div className="pb-2">
          {items.map(item => <ItemRow key={item.id} item={item} onOpen={() => onOpenItem(cat, item)} />)}
          {allowEdit && (
            adding ? (
              <div className="flex gap-2 pl-5 pt-2 border-t border-line">
                <input
                  value={newLabel} onChange={e => setNewLabel(e.target.value)} autoFocus placeholder="Item name"
                  onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false) }}
                  className={`${inputClass} flex-1 min-w-0`} aria-label="New item name"
                />
                <button onClick={submit} className="bg-ink text-on-ink rounded-xl px-4 min-h-[44px] text-[15px] font-semibold cursor-pointer">Add</button>
              </div>
            ) : renaming ? (
              <div className="flex gap-2 pl-5 pt-2 border-t border-line">
                <input
                  value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus aria-label="Group name"
                  onKeyDown={e => { if (e.key === 'Enter') { renameCategory(cat.key, nameDraft); setRenaming(false) } if (e.key === 'Escape') setRenaming(false) }}
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <button onClick={() => { renameCategory(cat.key, nameDraft); setRenaming(false) }} className="bg-ink text-on-ink rounded-xl px-4 min-h-[44px] text-[15px] font-semibold cursor-pointer">Save</button>
              </div>
            ) : (
              <div className="flex items-center justify-between pl-5 border-t border-line">
                <button onClick={() => setAdding(true)} className="flex items-center gap-2 min-h-[48px] text-[15px] text-ink-2 cursor-pointer"><Plus size={16} aria-hidden="true" /> Add item</button>
                <span className="flex gap-4">
                  <button onClick={() => { setNameDraft(cat.label); setRenaming(true) }} className="min-h-[48px] text-label text-muted cursor-pointer">Rename</button>
                  <button onClick={() => setConfirmDelete(true)} className="min-h-[48px] text-label text-muted cursor-pointer">Delete group</button>
                </span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

function DebtGroup({ title, debts, sub, onOpen }: { title: string; debts: Debt[]; sub: string; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const total = debts.reduce((a, d) => a + d.monthlyPayment, 0)
  const owners = new Set(debts.map(d => d.owner))
  const owner: Owner = owners.size === 1 ? debts[0].owner : 'JOINT'
  return (
    <div className="border-t border-line">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-3 min-h-[64px] py-2.5 text-left cursor-pointer">
        <OwnerDot owner={owner} />
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-medium text-ink truncate">{title}</span>
          <span className="block text-label text-muted truncate">{sub}</span>
        </span>
        <span className="text-[17px] font-semibold"><Money value={total} /></span>
        {chevron(open)}
      </button>
      {open && (
        <div className="pb-2">
          {debts.map(d => {
            const months = d.currentBalance > 0 ? debtPayoff(d).months : null
            return (
              <button key={d.id} onClick={onOpen} className="w-full flex items-center gap-3 pl-5 min-h-[52px] py-2 text-left border-t border-line cursor-pointer">
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] text-ink truncate">{d.label}</span>
                  <span className="block text-caption text-muted truncate">
                    {d.isZeroPercent ? '0%' : `${d.interestRate}%`} · {fmt(d.currentBalance)} left
                    {d.currentBalance > 0 && d.monthlyPayment > 0 && (months == null
                      ? <span className="text-neg font-medium"> · doesn’t cover interest</span>
                      : ` · ~${months} months`)}
                  </span>
                </span>
                <span className="text-[15px]"><Money value={d.monthlyPayment} /></span>
                <ChevronRight size={16} className="text-faint shrink-0" aria-hidden="true" />
              </button>
            )
          })}
          <button onClick={onOpen} className="pl-5 min-h-[44px] text-label text-muted cursor-pointer border-t border-line w-full text-left">Manage on Wealth →</button>
        </div>
      )}
    </div>
  )
}

// ─── main screen ──────────────────────────────────────────────────────────────

const OWNER_ORDER: Owner[] = ['JOINT', 'NIAMH', 'RUPERT']

export default function BudgetScreen({ budget, tab, onTabChange, onNavigateToDebts }: {
  budget: BudgetHook; tab: TabFilter; onTabChange: (t: TabFilter) => void; onNavigateToDebts: () => void
}) {
  const { data, totals, addCategory, savedAt, user, updateItemRenewal } = budget
  const [addingCat, setAddingCat] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatOwner, setNewCatOwner] = useState<Owner>('JOINT')
  const [newCatType, setNewCatType] = useState<EntryType>('EXPENSE')
  const [sheet, setSheet] = useState<{ catKey: string; itemId: string; focus: 'amount' | 'date' } | null>(null)

  const properties = data.properties ?? []
  const propertyId = tab.startsWith('property:') ? tab.slice('property:'.length) : null
  const propertySummary = propertyId ? propertySummaries(data).find(s => s.property.id === propertyId) ?? null : null
  const ownerTab: Owner | null = tab === 'NIAMH' || tab === 'RUPERT' || tab === 'JOINT' ? tab : null
  const ownerName = (o: Owner) => o === 'NIAMH' ? data.nameNiamh || 'Person 1' : o === 'RUPERT' ? data.nameRupert || 'Person 2' : data.nameJoint || 'Joint'

  // Greeting: match the signed-in Google name to one of the two people.
  const first = (user?.displayName ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const me = first && first === data.nameRupert?.toLowerCase() ? data.nameRupert : first && first === data.nameNiamh?.toLowerCase() ? data.nameNiamh : null
  const now = new Date()
  const hour = now.getHours()
  const greeting = `${hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'}${me ? `, ${me}` : ''}`
  const pay = nextPayday(data.payday)
  // Name the day when a weekend or bank holiday has moved it earlier.
  const moved = pay && pay.date.getDate() !== Math.min(data.payday!, new Date(pay.date.getFullYear(), pay.date.getMonth() + 1, 0).getDate())
  const payWhen = moved ? ` (${pay.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })})` : ''
  const payday = pay?.days ?? null
  const daysLeftInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
  const timing = payday != null
    ? payday === 0 ? 'Payday today' : `${payday} ${payday === 1 ? 'day' : 'days'} to payday${payWhen}`
    : `${daysLeftInMonth} ${daysLeftInMonth === 1 ? 'day' : 'days'} left in ${now.toLocaleDateString('en-GB', { month: 'long' })}`
  const asOf = savedAt ? ` · as of ${new Date(savedAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}` : ''

  // Lapsed renewals pinned above everything.
  const lapsed = useMemo(() => needsAttention(data).filter(a => a.action.type === 'renewal' && a.severity === 'bad'), [data])

  // Compared with last month's snapshot, when there is one.
  const lastMonthLeft = (() => {
    const key = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7)
    const snap = (data.spendHistory ?? []).find(s => s.date === key)
    return snap ? snap.totalInc - snap.totalExp - snap.totalSav : null
  })()

  const switchFlags = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of energySwitchReminders(data)) {
      if (r.status !== 'ended') map.set(r.propertyId, r.status === 'open' ? `Fee-free switch · ${r.daysToEnd} days` : `Exit fees end in ${r.daysToFree} days`)
    }
    return map
  }, [data])

  const visible = data.categories
    .filter(c => propertyId ? true : !ownerTab || c.owner === ownerTab)
    .map(c => ({ cat: c, items: propertyId ? c.items.filter(i => i.propertyId === propertyId) : c.items }))
    .filter(v => !propertyId || v.items.length > 0)
    .sort((a, b) => OWNER_ORDER.indexOf(a.cat.owner) - OWNER_ORDER.indexOf(b.cat.owner))
  const byType = (t: EntryType) => visible.filter(v => v.cat.type === t)
  const sum = (vs: typeof visible) => vs.reduce((a, v) => a + v.items.reduce((b, i) => b + i.amount, 0), 0)
  const itemCount = (vs: typeof visible) => vs.reduce((a, v) => a + v.items.length, 0)

  const visibleDebts = data.debts.filter(d => propertyId ? d.propertyId === propertyId : !ownerTab || d.owner === ownerTab)
  const mortgages = visibleDebts.filter(isMortgage)
  const otherDebts = visibleDebts.filter(d => !isMortgage(d))
  const debtTotal = visibleDebts.reduce((a, d) => a + d.monthlyPayment, 0)

  const spendGroups = byType('EXPENSE')
  const saveGroups = byType('SAVINGS')
  const incomeGroups = byType('INCOME')
  const spendTotal = sum(spendGroups) + debtTotal
  const spendGroupCount = spendGroups.length + (mortgages.length > 0 ? 1 : 0) + (otherDebts.length > 0 ? 1 : 0)

  const openCat = sheet ? data.categories.find(c => c.key === sheet.catKey) : null
  const openItem = openCat?.items.find(i => i.id === sheet?.itemId) ?? null
  const openItemSheet = (c: Category, i: LineItem) => setSheet({ catKey: c.key, itemId: i.id, focus: 'amount' })

  const submitCat = () => {
    if (newCatLabel.trim()) { addCategory(newCatOwner, newCatType, newCatLabel.trim()); setNewCatLabel(''); setAddingCat(false) }
  }

  // The joint account transfer: what each person moves in so the joint pot is covered.
  const jointPot = totals.expJoint + totals.savJoint + totals.debtJoint
  const jointEach = jointPot / 2
  const split = householdCostSplit(data, totals)
  const jointSegments: Segment[] = [
    { label: 'Bills', value: totals.expJoint, color: 'var(--ink)' },
    { label: 'Debts', value: totals.debtJoint, color: 'var(--spend)' },
    { label: 'Saving', value: totals.savJoint, color: 'var(--save)' },
  ]
  // Household costs one person pays straight from their own account.
  const directOwner: Owner | undefined = split.sharedByR > 0 && split.sharedByN === 0 ? 'RUPERT' : split.sharedByN > 0 && split.sharedByR === 0 ? 'NIAMH' : undefined
  const directNote = split.sharedByN > 0 || split.sharedByR > 0 ? {
    owner: directOwner,
    text: <>
      {split.sharedByN > 0 && <>{ownerName('NIAMH')} also pays <b className="text-ink font-semibold num">{fmt(split.sharedByN)}</b></>}
      {split.sharedByN > 0 && split.sharedByR > 0 && ' and '}
      {split.sharedByR > 0 && <>{ownerName('RUPERT')} also pays <b className="text-ink font-semibold num">{fmt(split.sharedByR)}</b></>}
      {' '}directly
    </>,
  } : undefined
  const leftToSpend = {
    label: totals.net < 0 ? 'Over budget by' : 'Left to spend', value: Math.abs(totals.net), negative: totals.net < 0,
    sub: <>of <span className="num">{fmt(totals.totalInc)}</span> take-home</>,
    delta: lastMonthLeft != null ? totals.net - lastMonthLeft : null,
  }

  // ── hero for the current filter
  const hero = (() => {
    if (propertySummary) {
      const s = propertySummary
      return <Hero
        label={`${s.property.label} costs`} value={s.monthlyTotal} suffix="a month"
        segments={[{ label: 'Mortgage', value: s.mortgagePayment, color: 'var(--ink)' }, { label: 'Running costs', value: s.runningCosts, color: 'var(--spend)' }]}
        note={{ text: s.property.estimatedValue > 0
          ? <>Equity <b className="text-ink font-semibold num">{fmt(s.equity)}</b>{s.ltvPct != null && s.mortgageBalance > 0 ? ` · ${s.ltvPct.toFixed(0)}% loan-to-value` : ''}</>
          : 'Add its value on Wealth to see equity' }}
      />
    }
    if (ownerTab === 'JOINT') {
      return <Hero
        label="Into the joint account" value={jointPot} suffix="a month"
        pair={[{ owner: 'NIAMH', label: `${ownerName('NIAMH')} puts in`, value: jointEach }, { owner: 'RUPERT', label: `${ownerName('RUPERT')} puts in`, value: jointEach }]}
        segments={jointSegments} legendEnd={{ label: 'Split', value: '50/50' }}
      />
    }
    if (ownerTab) {
      const n = ownerTab === 'NIAMH'
      const inc = n ? totals.incN : totals.incR
      const own = n ? totals.expN + totals.debtN : totals.expR + totals.debtR
      const save = n ? totals.savN : totals.savR
      const left = n ? totals.netN : totals.netR
      const direct = n ? split.sharedByN : split.sharedByR
      return <Hero
        label={left < 0 ? `${ownerName(ownerTab)} is over by` : `${ownerName(ownerTab)}’s spending money`} value={Math.abs(left)} negative={left < 0} suffix="this month"
        segments={[
          { label: 'To joint', value: jointEach, color: 'var(--ink)' },
          { label: 'Own & saving', value: own + save, color: 'var(--save)' },
          { label: 'Free', value: Math.max(0, left), color: 'var(--spend)' },
        ]}
        note={direct > 0 ? { owner: ownerTab, text: <>Includes <b className="text-ink font-semibold num">{fmt(direct)}</b> of household costs paid directly</> } : undefined}
        secondary={{ label: 'Take-home', value: inc, sub: 'after tax, each month' }}
      />
    }
    if (jointPot <= 0) {
      return <Hero
        label={leftToSpend.label} value={leftToSpend.value} negative={leftToSpend.negative}
        segments={[{ label: 'Spending', value: totals.totalExp, color: 'var(--ink)' }, { label: 'Saving', value: totals.totalSav, color: 'var(--save)' }, { label: 'Free', value: Math.max(0, totals.net), color: 'var(--spend)' }]}
        secondary={{ label: 'Take-home', value: totals.totalInc, sub: 'after bills and saving', delta: leftToSpend.delta }}
      />
    }
    return <Hero
      label="Into the joint account this month" value={jointEach} suffix="each"
      segments={jointSegments} legendEnd={{ label: 'Total', value: fmt(jointPot) }}
      note={directNote}
      secondary={leftToSpend}
    />
  })()

  const isEmpty = totals.totalInc === 0 && totals.totalExp === 0 && totals.totalSav === 0

  return (
    <div className="h-full overflow-y-auto px-5 pb-[calc(32px+env(safe-area-inset-bottom))]">
      {openCat && openItem && sheet && (
        <ItemSheet cat={openCat} item={openItem} properties={properties} budget={budget} ownerName={ownerName} focus={sheet.focus} onClose={() => setSheet(null)} />
      )}

      {/* greeting + homes */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <h1 className="text-[24px] leading-[30px] font-semibold tracking-[-0.02em] m-0 truncate min-w-0">{greeting}</h1>
        {properties.length > 0 && (
          <label className="relative shrink-0">
            <span className="sr-only">Show homes</span>
            <select
              value={propertyId ?? ''}
              onChange={e => onTabChange(e.target.value ? (`property:${e.target.value}` as TabFilter) : 'ALL')}
              className={`appearance-none min-h-[44px] rounded-xl pl-3.5 pr-9 text-[15px] font-medium cursor-pointer border-0 ${propertyId ? 'bg-ink text-on-ink' : 'bg-fill text-ink'}`}
            >
              <option value="">{properties.length === 2 ? 'Both homes' : 'All homes'}</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${propertyId ? 'text-on-ink' : 'text-ink-2'}`} aria-hidden="true" />
          </label>
        )}
      </div>
      <p className="text-[15px] text-muted m-0 mt-0.5 num">{timing}{asOf}</p>

      {/* owner filter */}
      <div className="seg mt-4" style={{ gridTemplateColumns: '.75fr 1.3fr 1.3fr 1fr' }} role="group" aria-label="Show money for">
        {(['ALL', 'NIAMH', 'RUPERT', 'JOINT'] as const).map(t => {
          const name = t === 'ALL' ? 'All' : ownerName(t)
          return (
            <button key={t} aria-pressed={!propertyId && tab === t} onClick={() => onTabChange(t)} aria-label={name} title={name}>
              {t !== 'ALL' && <OwnerDot owner={t} label={name} />}
              <span className="lbl">{name}</span>
            </button>
          )
        })}
      </div>

      {/* lapsed renewals */}
      {!propertyId && lapsed.map(a => {
        if (a.action.type !== 'renewal') return null
        const { catKey, itemId } = a.action
        const cat = data.categories.find(c => c.key === catKey)
        const item = cat?.items.find(i => i.id === itemId)
        if (!cat || !item?.renewalDate) return null
        const ago = -daysUntil(item.renewalDate)
        return (
          <LapsedBanner
            key={a.id}
            title={`${item.label} ${isInsuranceItem(item.label) ? 'lapsed' : 'ended'} ${ago === 0 ? 'today' : `${ago} ${ago === 1 ? 'day' : 'days'} ago`}`}
            meta={a.meta}
            onOpen={() => setSheet({ catKey, itemId, focus: 'amount' })}
            onRenewed={() => { updateItemRenewal(catKey, itemId, plusYear(item.renewalDate!)); setSheet({ catKey, itemId, focus: 'amount' }) }}
            onUpdateDate={() => setSheet({ catKey, itemId, focus: 'date' })}
          />
        )
      })}

      {isEmpty && !propertyId ? (
        <section className="panel p-5 mt-4">
          <h2 className="text-[19px] font-semibold m-0">Let’s set up your month</h2>
          <p className="text-[15px] text-ink-2 mt-1 mb-3">Three quick steps and Budge shows what each of you puts into the joint account, and what’s left.</p>
          <ol className="m-0 pl-5 space-y-1.5 text-[15px] text-ink">
            <li>Add take-home pay under <b>Coming in</b></li>
            <li>Add the shared bills under <b>Spending</b>, as Joint</li>
            <li>Add savings and homes on <b>Wealth</b></li>
          </ol>
        </section>
      ) : hero}

      {/* spending */}
      <SectionHead title="Spending" meta={<>{spendGroupCount} {spendGroupCount === 1 ? 'group' : 'groups'} · <b className="text-ink font-semibold"><Money value={spendTotal} /></b></>} />
      {mortgages.length > 0 && (
        <DebtGroup
          title="Home loans" debts={mortgages} onOpen={onNavigateToDebts}
          sub={`${mortgages.length} ${mortgages.length === 1 ? 'mortgage' : 'mortgages'}${properties.length > 1 && mortgages.length > 1 ? ' · both homes' : ''}`}
        />
      )}
      {spendGroups.map(({ cat, items }) => {
        const prop = items.map(i => i.propertyId).find(id => id && switchFlags.has(id))
        return (
          <CategoryGroup
            key={cat.key} cat={cat} items={items} ownerName={ownerName} budget={budget}
            onOpenItem={openItemSheet} extraFlag={prop ? switchFlags.get(prop) : null} allowEdit={!propertyId}
          />
        )
      })}
      {otherDebts.length > 0 && (
        <DebtGroup
          title="Debt repayments" debts={otherDebts} onOpen={onNavigateToDebts}
          sub={`${otherDebts.length} ${otherDebts.length === 1 ? 'debt' : 'debts'} · ${otherDebts.map(d => d.label).slice(0, 3).join(', ')}`}
        />
      )}
      {!propertyId && (
        addingCat ? (
          <div className="border-t border-line py-3 space-y-2">
            <input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitCat() }} autoFocus placeholder="Group name, e.g. Childcare" className={`${inputClass} w-full`} aria-label="New group name" />
            <div className="flex gap-2">
              <select value={newCatOwner} onChange={e => setNewCatOwner(e.target.value as Owner)} aria-label="Whose" className={`${inputClass} flex-1`}>
                <option value="JOINT">{ownerName('JOINT')}</option>
                <option value="NIAMH">{ownerName('NIAMH')}</option>
                <option value="RUPERT">{ownerName('RUPERT')}</option>
              </select>
              <select value={newCatType} onChange={e => setNewCatType(e.target.value as EntryType)} aria-label="Type" className={`${inputClass} flex-1`}>
                <option value="EXPENSE">Spending</option>
                <option value="SAVINGS">Saving</option>
                <option value="INCOME">Coming in</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={submitCat} className="flex-1 bg-ink text-on-ink rounded-xl min-h-[48px] text-[15px] font-semibold cursor-pointer">Add group</button>
              <button onClick={() => setAddingCat(false)} className="px-5 bg-fill rounded-xl min-h-[48px] text-[15px] cursor-pointer">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingCat(true)} className="w-full flex items-center gap-3 min-h-[52px] border-t border-line text-[15px] text-ink-2 cursor-pointer">
            <Plus size={18} aria-hidden="true" /> Add a group
          </button>
        )
      )}
      {propertyId && spendGroups.length === 0 && visibleDebts.length === 0 && (
        <p className="text-[15px] text-muted mt-3">
          Nothing linked to this home yet. Open any bill and choose it under <b className="text-ink">Home</b>, and link its mortgage on Wealth.
        </p>
      )}

      {/* saving */}
      {saveGroups.length > 0 && (
        <>
          <SectionHead title="Saving" meta={<>{itemCount(saveGroups)} items · <b className="text-ink font-semibold"><Money value={sum(saveGroups)} /></b></>} />
          {saveGroups.map(({ cat, items }) => (
            <CategoryGroup key={cat.key} cat={cat} items={items} ownerName={ownerName} budget={budget} allowEdit={!propertyId} onOpenItem={openItemSheet} />
          ))}
          <div className="border-t border-line" />
        </>
      )}

      {/* coming in */}
      {incomeGroups.length > 0 && (
        <>
          <SectionHead title="Coming in" meta={<>{itemCount(incomeGroups)} items · <b className="text-ink font-semibold"><Money value={sum(incomeGroups)} /></b></>} />
          {incomeGroups.map(({ cat, items }) => (
            <CategoryGroup key={cat.key} cat={cat} items={items} ownerName={ownerName} budget={budget} allowEdit={!propertyId} onOpenItem={openItemSheet} />
          ))}
          <div className="border-t border-line" />
        </>
      )}
    </div>
  )
}
