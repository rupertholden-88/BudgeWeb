'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Category, LineItem, TabFilter, Owner, EntryType, Debt, Property, fmt, daysUntil, isInsuranceItem,
  debtPayoff, isMortgage, propertySummaries, nextPayday, energySwitchReminders, householdCostSplit,
  OneOff, monthKey, PayPeriod, BudgetData, paydayFor, periodFor, upcomingRenewals,
} from '@/lib/models'
import { needsAttention } from '@/lib/attention'
import { Plus, ChevronRight, ChevronDown, AlertTriangle, ArrowUp, ArrowDown, X, Check, CalendarClock } from 'lucide-react'
import { ConfirmDelete, NumberInput, inputClass, useModal, RenewalBar } from './ui'

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
export interface TopUp { id: string; label: string; each: number; done: boolean }

function Hero({ label, value, suffix, negative, headNote, pair, segments, legendEnd, topUps, onTopUp, note, secondary }: {
  label: string; value: number; suffix?: string; negative?: boolean
  /** One line straight under the headline figure, e.g. why it's higher than usual. */
  headNote?: React.ReactNode
  /** Joint one-offs due before payday: an extra transfer to make now. */
  topUps?: TopUp[]; onTopUp?: (id: string, done: boolean) => void
  /** Two side-by-side figures under the headline (each person's share). */
  pair?: { owner: Owner; label: string; value: number }[]
  segments: Segment[]
  /** Right-hand legend entry with no bar colour, e.g. "Total £3,349". */
  legendEnd?: { label: string; value: React.ReactNode }
  note?: { owner?: Owner; text: React.ReactNode }
  secondary?: { label: string; value: number; negative?: boolean; sub: React.ReactNode; delta?: number | null; caption?: React.ReactNode }
}) {
  const shown = segments.filter(s => s.value > 0)
  const delta = secondary?.delta
  return (
    <section className="panel hero p-5 mt-3.5" aria-label={label}>
      <div className="text-label font-medium text-muted">{label}</div>
      <div className={`figure mt-2 flex items-baseline flex-wrap gap-x-2 text-[44px] leading-none font-bold tracking-[-0.02em] ${negative ? 'text-neg' : 'text-ink'}`}>
        <Money value={value} />
        {suffix && <span className="text-[17px] font-medium tracking-normal text-muted">{suffix}</span>}
      </div>
      {headNote && <div className="text-label text-muted mt-2">{headNote}</div>}
      {pair && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {pair.map(p => (
            <div key={p.owner} className="min-w-0">
              <div className="flex items-center gap-1.5 text-label text-muted truncate"><OwnerDot owner={p.owner} label={p.label} />{p.label}</div>
              <div className="figure text-[28px] leading-8 font-semibold tracking-[-0.01em] mt-1"><Money value={p.value} /></div>
            </div>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <>
          <div className="flex h-1.5 gap-[2px] rounded-[3px] overflow-hidden mt-4" aria-hidden="true">
            {shown.map(s => <div key={s.label} className="h-full" style={{ flexGrow: s.value, background: s.color }} />)}
          </div>
          <div className={`flex gap-2 mt-2.5 num ${shown.length + (legendEnd ? 1 : 0) > 4 ? 'justify-between' : '[&>*]:flex-1'}`}>
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
      {topUps && topUps.length > 0 && topUps.map(t => (
        <div key={t.id} className="flex items-center gap-3 mt-3.5 pt-3 border-t border-line">
          {t.done
            ? <Check size={16} className="text-pos shrink-0" aria-hidden="true" />
            : <span className="w-2 h-2 rounded-full shrink-0 bg-warn" aria-hidden="true" />}
          <span className={`flex-1 min-w-0 text-label ${t.done ? 'text-muted' : 'text-ink'}`}>
            {t.done ? 'Topped up' : <>Top up <b className="font-semibold num">{fmt(t.each)}</b> each</>} for {t.label}
          </span>
          <button
            onClick={() => onTopUp?.(t.id, !t.done)}
            className={`shrink-0 min-h-[44px] -my-2 px-3.5 rounded-xl text-label font-semibold cursor-pointer ${t.done ? 'text-muted underline underline-offset-2' : 'bg-ink text-on-ink'}`}
          >
            {t.done ? 'Undo' : 'Done'}
          </button>
        </div>
      ))}
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
            <div className={`figure text-[28px] leading-none font-semibold tracking-[-0.01em] mt-1.5 ${secondary.negative ? 'text-neg' : 'text-ink'}`}><Money value={secondary.value} /></div>
            <div className="text-caption text-muted mt-1.5">{secondary.sub}</div>
            {secondary.caption && <div className="text-caption text-muted">{secondary.caption}</div>}
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

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useModal(ref, onClose)
  // Portalled to <body> so it sits above the tab bar, outside the screen's stacking context.
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-end sm:items-center justify-center sm:p-6" style={{ background: 'var(--scrim)' }} onClick={onClose}>
      {/* A bottom sheet on phones; a centred dialog on tablets and desktop. */}
      <div
        ref={ref} tabIndex={-1}
        role="dialog" aria-modal="true" aria-label={title}
        className="sheet-enter outline-none w-full max-w-[480px] sm:max-w-[520px] max-h-[88dvh] sm:max-h-[85dvh] overflow-y-auto bg-bg rounded-t-[22px] sm:rounded-[22px] px-5 sm:px-6 pt-2 sm:pt-3 pb-[calc(24px+env(safe-area-inset-bottom))] sm:pb-6 sm:shadow-[0_24px_60px_-20px_rgba(0,0,0,.45)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-line-2 mx-auto mb-1 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between min-h-[44px]">
          <span className="text-label text-muted truncate">{title}</span>
          <button onClick={onClose} aria-label="Close" className="w-[44px] h-[44px] -mr-3 grid place-items-center text-muted cursor-pointer"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function SheetRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="py-2.5 border-t border-line">
      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <span className="text-[15px] text-ink">{label}</span>
        <div className="w-[180px] shrink-0 flex justify-end">{children}</div>
      </div>
      {hint && <p className="text-caption text-muted mt-1 mb-0 leading-snug">{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`hit-44 w-[51px] h-[31px] rounded-full relative cursor-pointer ${checked ? 'bg-ink' : 'bg-fill-2'}`}
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

function ItemSheet({ cat, item, properties, budget, ownerName, focus, onClose, onOpenInsurance }: {
  cat: Category; item: LineItem; properties: Property[]; budget: BudgetHook
  ownerName: (o: Owner) => string; focus: 'amount' | 'date'; onClose: () => void; onOpenInsurance?: (itemId: string) => void
}) {
  const { updateItemAmount, renameItem, removeItem, updateItemRenewal, toggleItemAutoRenew, toggleItemShared, updateItemInsurance, updateItemProperty } = budget
  const [label, setLabel] = useState(item.label)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isExpense = cat.type === 'EXPENSE'
  const isInsurance = isExpense && (isInsuranceItem(item.label) || !!budget.data.policyDetails?.[item.id])
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
        className="title-input w-full bg-transparent outline-none border-0 p-0 min-h-[44px] text-ink"
      />
      <label className="amount-field mt-2 mb-3">
        <span className="cur-big" aria-hidden="true">£</span>
        <NumberInput
          value={item.amount || undefined}
          onChange={v => updateItemAmount(cat.key, item.id, v ?? 0)}
          ariaLabel={`Amount per month for ${item.label}`}
          className="amount-input num"
        />
        <span className="suffix">a month</span>
      </label>
      {focus === 'amount' && <AutoFocus selector='input[aria-label^="Amount per month"]' />}

      {canMarkShared && (
        <SheetRow label="For the household" hint="Counts towards your share of household costs — e.g. a mortgage only you pay.">
          <Toggle checked={!!item.sharedContribution} onChange={() => toggleItemShared(cat.key, item.id)} label="For the household" />
        </SheetRow>
      )}

      {isExpense && properties.length > 0 && (
        <SheetRow label="Home">
          <select value={item.propertyId ?? ''} onChange={e => updateItemProperty(cat.key, item.id, e.target.value)} className={`${inputClass} w-full`} aria-label="Home">
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
            className={`${inputClass} w-full ${days != null && days < 0 ? 'text-neg' : ''}`}
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

      {isInsurance && onOpenInsurance && (
        <button onClick={() => { onClose(); onOpenInsurance(item.id) }} className="w-full flex items-center justify-between gap-3 min-h-[52px] py-2.5 border-t border-line text-left cursor-pointer">
          <span>
            <span className="block text-[15px] text-ink">{budget.data.policyDetails?.[item.id] ? 'Linked to a policy' : 'Policy details'}</span>
            <span className="block text-caption text-muted">Cover, excess and documents on Insurance</span>
          </span>
          <span className="flex items-center gap-1 text-[15px] font-semibold text-ink">Open <ChevronRight size={16} aria-hidden="true" /></span>
        </button>
      )}
      {isInsurance && (
        <SheetRow label="Provider">
          <input value={item.insuranceProvider ?? ''} placeholder="e.g. Aviva" onChange={e => updateItemInsurance(cat.key, item.id, { provider: e.target.value })} className={`${inputClass} w-full`} aria-label="Provider" />
        </SheetRow>
      )}
      {isInsurance && (
        <SheetRow label="Cover (£)">
          <NumberInput value={item.insuranceCoverAmount} onChange={v => updateItemInsurance(cat.key, item.id, { coverAmount: v })} ariaLabel="Cover amount in pounds" className={`${inputClass} w-full text-right`} />
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

// ─── one-off costs ────────────────────────────────────────────────────────────

const monthName = (key: string, withYear = false) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' })
}
const shiftKey = (key: string, by: number) => {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + by, 1))
}
const dayMonth = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** Savings pots that hold this month's balances, for "pay it from savings". */
function savingsPots(data: BudgetData) {
  const month = new Date().toISOString().slice(0, 7)
  return data.savingsHistory
    .filter(snap => snap.date.slice(0, 7) === month && Array.isArray(snap.assets))
    .flatMap(snap => snap.assets.filter(a => a.type !== 'PENSION').map(a => ({ owner: snap.owner, label: a.label, amount: a.amount })))
}

type OneOffDraft = Omit<OneOff, 'id'> & { id?: string }
type Due = 'now' | 'next' | 'later'

function OneOffSheet({ initial, budget, properties, ownerName, onClose }: {
  initial: OneOffDraft; budget: BudgetHook; properties: Property[]
  ownerName: (o: Owner) => string; onClose: () => void
}) {
  const { data, addOneOff, updateOneOff, deleteOneOff, setOneOffDone } = budget
  const isNew = !initial.id
  const [d, setD] = useState<OneOffDraft>(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // New costs are a draft until "Add to budget"; existing ones save as you go.
  const set = (fields: Partial<OneOff>) => {
    setD(x => ({ ...x, ...fields }))
    if (!isNew) updateOneOff(initial.id!, fields)
  }
  const pots = savingsPots(data)
  const period = periodFor(data, d.owner)
  const potKey = (x?: { owner: Owner; label: string }) => x ? `${x.owner}|${x.label}` : ''
  const due: Due = d.month === period.key ? 'now' : d.month === period.nextKey ? 'next' : 'later'
  const setDue = (v: Due) => set(
    v === 'now' ? { month: period.key, topUp: true }
    : v === 'next' ? { month: period.nextKey, topUp: undefined }
    : { month: shiftKey(period.nextKey, 1), topUp: undefined },
  )
  const setFromSavings = (on: boolean) => set(on
    ? { fromSavings: true, savingsFrom: d.savingsFrom ?? (pots.find(p => p.owner === d.owner) ?? pots[0]) ?? undefined }
    : { fromSavings: undefined, savingsFrom: undefined })
  const dueBy = new Date(period.next); dueBy.setDate(dueBy.getDate() - 1)
  const dueLabels: Record<Due, string> = period.byPayday
    ? { now: 'Before payday', next: 'After payday', later: 'Later' }
    : { now: 'This month', next: 'Next month', later: 'Later' }
  const amount = d.amount || 0
  const who = ownerName(d.owner)
  const payHint = d.fromSavings
    ? d.savingsFrom
      ? <>Won’t change the budget. When you mark it paid, {fmt(amount)} comes off {d.savingsFrom.label}.</>
      : 'Won’t change the budget. Add your savings on Wealth and it can come off the right pot when it’s paid.'
    : d.owner === 'JOINT'
      ? due === 'now' ? `You each top up ${fmt(amount / 2)}.` : `Adds ${fmt(amount / 2)} each to that transfer.`
      : `${who} has ${fmt(amount)} less to spend ${due === 'now' ? 'before payday' : 'that month'}.`
  const canDone = !isNew && (d.fromSavings || (d.owner === 'JOINT' && d.topUp))

  return (
    <Sheet title={isNew ? 'Add a one-off cost' : 'One-off cost'} onClose={onClose}>
      {confirmDelete && (
        <ConfirmDelete
          label={d.label || 'this cost'}
          detail="Takes it out of the budget. You can’t undo this."
          onConfirm={() => { if (initial.id) deleteOneOff(initial.id); setConfirmDelete(false); onClose() }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <label className="amount-field mt-2 mb-1">
        <span className="cur-big" aria-hidden="true">£</span>
        <NumberInput
          value={d.amount || undefined}
          onChange={v => set({ amount: v ?? 0 })}
          ariaLabel="One-off amount"
          className="amount-input num"
        />
        <span className="suffix">once</span>
      </label>
      {isNew && <AutoFocus selector='input[aria-label="One-off amount"]' />}
      <input
        value={d.label}
        onChange={e => setD(x => ({ ...x, label: e.target.value }))}
        onBlur={() => { if (!isNew && d.label.trim() && d.label !== initial.label) updateOneOff(initial.id!, { label: d.label.trim() }) }}
        aria-label="What it’s for"
        placeholder="What’s it for? e.g. Palmer Maintenance"
        className="title-input w-full bg-transparent outline-none border-0 p-0 min-h-[44px] mt-2 text-ink placeholder:text-faint placeholder:font-normal"
      />

      <div className="py-2.5 border-t border-line">
        <div className="text-[15px] text-ink mb-2">Who pays</div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} role="group" aria-label="Who pays">
          {(['JOINT', 'NIAMH', 'RUPERT'] as const).map(o => (
            <button key={o} aria-pressed={d.owner === o} onClick={() => {
              // Keep the same "when" against the new payer's payday.
              const p = periodFor(data, o)
              set({ owner: o, month: due === 'now' ? p.key : due === 'next' ? p.nextKey : d.month })
            }}>
              <OwnerDot owner={o} label={ownerName(o)} /><span className="lbl">{ownerName(o)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="py-2.5 border-t border-line">
        <div className="text-[15px] text-ink mb-2">When’s it due?</div>
        <div className="seg" style={{ gridTemplateColumns: '1.3fr 1.2fr .75fr' }} role="group" aria-label="When it’s due">
          {(['now', 'next', 'later'] as const).map(v => (
            <button key={v} aria-pressed={due === v} onClick={() => setDue(v)}><span className="lbl">{dueLabels[v]}</span></button>
          ))}
        </div>
        {due === 'later' ? (
          <div className="flex items-center justify-between gap-3 mt-2.5">
            <span className="text-label text-muted">{period.byPayday ? 'From the payday in' : 'Month'}</span>
            <input
              type="month" value={d.month} min={shiftKey(period.nextKey, 1)}
              onChange={e => { if (e.target.value) set({ month: e.target.value, topUp: undefined }) }}
              aria-label="Month" className={inputClass}
            />
          </div>
        ) : (
          <p className="text-caption text-muted mt-1.5 mb-0">
            {due === 'now'
              ? period.byPayday ? `Due by ${dayMonth(dueBy)}.` : `Due in ${monthName(period.key)}.`
              : period.byPayday ? `Paid from the ${dayMonth(period.next)} payday.` : `Due in ${monthName(period.nextKey)}.`}
          </p>
        )}
      </div>

      <div className="py-2.5 border-t border-line">
        <div className="text-[15px] text-ink mb-2">Pay it from</div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="group" aria-label="Pay it from">
          <button aria-pressed={!d.fromSavings} onClick={() => setFromSavings(false)}><span className="lbl">{due === 'now' ? 'This month’s money' : 'That month’s money'}</span></button>
          <button aria-pressed={!!d.fromSavings} onClick={() => setFromSavings(true)}><span className="lbl">Savings</span></button>
        </div>
        {d.fromSavings && pots.length > 0 && (
          <select
            value={potKey(d.savingsFrom)}
            onChange={e => { const [owner, ...rest] = e.target.value.split('|'); set({ savingsFrom: { owner: owner as Owner, label: rest.join('|') } }) }}
            aria-label="Which savings" className={`${inputClass} w-full mt-2.5`}
          >
            {pots.map(p => <option key={potKey(p)} value={potKey(p)}>{p.label} · {ownerName(p.owner)} · {fmt(p.amount)}</option>)}
          </select>
        )}
        <p className="text-caption text-muted mt-1.5 mb-0">{payHint}</p>
      </div>

      {properties.length > 0 && (
        <SheetRow label="Home">
          <select value={d.propertyId ?? ''} onChange={e => set({ propertyId: e.target.value || undefined })} className={`${inputClass} w-full`} aria-label="Home">
            <option value="">Not tied to a home</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </SheetRow>
      )}

      {isNew ? (
        <button
          disabled={amount <= 0}
          onClick={() => { addOneOff({ ...d, label: d.label.trim() || 'One-off cost' }); onClose() }}
          className="w-full mt-3 bg-ink text-on-ink rounded-xl min-h-[52px] text-[16px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          Add to budget
        </button>
      ) : (
        <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
          <button onClick={() => setConfirmDelete(true)} className="min-h-[44px] text-[15px] font-medium text-ink-2 underline underline-offset-2 cursor-pointer">Remove</button>
          {canDone && (
            <button
              onClick={() => { setOneOffDone(initial.id!, !d.done); setD(x => ({ ...x, done: !x.done || undefined })) }}
              className={`min-h-[44px] px-4 rounded-xl text-[15px] font-semibold cursor-pointer ${d.done ? 'bg-fill text-ink' : 'bg-ink text-on-ink'}`}
            >
              {d.done ? (d.fromSavings ? 'Paid · undo' : 'Topped up · undo') : d.fromSavings ? 'Mark as paid' : 'Mark as topped up'}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** This pay period's one-offs, with what's coming up later underneath. */
function OneOffGroup({ now, upcoming, period, ownerName, onOpen, onAdd }: {
  now: OneOff[]; upcoming: OneOff[]; period: PayPeriod; ownerName: (o: Owner) => string; onOpen: (id: string) => void; onAdd: () => void
}) {
  const [open, setOpen] = useState(false)
  const counted = now.filter(o => !o.fromSavings).reduce((a, o) => a + o.amount, 0)
  const owners = new Set(now.map(o => o.owner))
  const owner: Owner = owners.size === 1 ? now[0].owner : 'JOINT'
  const when = (key: string) => period.byPayday ? `${monthName(key, key.slice(0, 4) !== period.key.slice(0, 4))} payday` : monthName(key, key.slice(0, 4) !== period.key.slice(0, 4))
  const next = upcoming[0]
  const sub = now.length > 0
    ? `${period.byPayday ? 'Due before payday' : 'This month'} · ${now.map(o => o.label).slice(0, 2).join(', ')}`
    : next ? `Next: ${next.label}, ${when(next.month)}` : ''
  const row = (o: OneOff, whenText?: string) => {
    const status = [whenText, o.fromSavings ? (o.done ? 'Paid from savings' : 'From savings') : null, !o.fromSavings && o.done ? 'Topped up' : null].filter(Boolean).join(' · ')
    return (
      <button key={o.id} onClick={() => onOpen(o.id)} className="w-full flex items-center gap-3 pl-5 min-h-[52px] py-2 text-left border-t border-line cursor-pointer">
        <OwnerDot owner={o.owner} label={ownerName(o.owner)} />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] text-ink truncate">{o.label}</span>
          {status && <span className="block text-caption text-muted truncate">{status}</span>}
        </span>
        <span className={`text-[15px] ${o.amount > 0 ? 'text-ink' : 'text-faint'}`}>{o.amount > 0 ? <Money value={o.amount} /> : '—'}</span>
        <ChevronRight size={16} className="text-faint shrink-0" aria-hidden="true" />
      </button>
    )
  }
  return (
    <div className="border-t border-line">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-3 min-h-[64px] py-2.5 text-left cursor-pointer">
        <OwnerDot owner={owner} />
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-medium text-ink truncate">One-offs</span>
          <span className="block text-label text-muted truncate">{sub}</span>
        </span>
        <span className={`text-[17px] font-semibold ${counted > 0 ? 'text-ink' : 'text-faint'}`}>{counted > 0 ? <Money value={counted} /> : '—'}</span>
        {chevron(open)}
      </button>
      {open && (
        <div className="pb-2">
          {now.map(o => row(o))}
          {upcoming.length > 0 && (
            <div className="pl-5 pt-3 pb-1 border-t border-line text-caption font-semibold uppercase tracking-label text-muted">Coming up</div>
          )}
          {upcoming.map(o => row(o, when(o.month)))}
          <button onClick={onAdd} className="w-full flex items-center gap-2 pl-5 min-h-[48px] text-label text-ink-2 cursor-pointer border-t border-line">
            <Plus size={16} aria-hidden="true" /> Add another
          </button>
        </div>
      )}
    </div>
  )
}

// ─── main screen ──────────────────────────────────────────────────────────────

const OWNER_ORDER: Owner[] = ['JOINT', 'NIAMH', 'RUPERT']

export default function BudgetScreen({ budget, tab, onTabChange, onNavigateToDebts, onOpenInsurance, onOpenRenewals }: {
  budget: BudgetHook; tab: TabFilter; onTabChange: (t: TabFilter) => void; onNavigateToDebts: () => void; onOpenInsurance?: (itemId: string) => void
  onOpenRenewals?: () => void
}) {
  const { data, totals, addCategory, savedAt, user, updateItemRenewal } = budget
  const [addingCat, setAddingCat] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatOwner, setNewCatOwner] = useState<Owner>('JOINT')
  const [newCatType, setNewCatType] = useState<EntryType>('EXPENSE')
  const [sheet, setSheet] = useState<{ catKey: string; itemId: string; focus: 'amount' | 'date' } | null>(null)
  const [oneOffSheet, setOneOffSheet] = useState<OneOffDraft | null>(null)

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
  const pdN = paydayFor(data, 'NIAMH'), pdR = paydayFor(data, 'RUPERT')
  const inDays = (d: number) => d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
  const timing = (() => {
    const one = (pd: number | undefined) => {
      const pay = nextPayday(pd)
      if (!pay || !pd) return null
      // Name the day when a weekend or bank holiday has moved it earlier.
      const moved = pay.date.getDate() !== Math.min(pd, new Date(pay.date.getFullYear(), pay.date.getMonth() + 1, 0).getDate())
      const when = moved ? ` (${pay.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })})` : ''
      return pay.days === 0 ? 'Payday today' : `${pay.days} ${pay.days === 1 ? 'day' : 'days'} to payday${when}`
    }
    const mine = ownerTab === 'NIAMH' ? one(pdN) : ownerTab === 'RUPERT' ? one(pdR) : null
    if (mine) return mine
    if (pdN && pdR && pdN !== pdR) {
      const n = nextPayday(pdN)!, r = nextPayday(pdR)!
      return `${ownerName('NIAMH')} paid ${inDays(n.days)}, ${ownerName('RUPERT')} ${inDays(r.days)}`
    }
    const shared = one(pdN ?? pdR)
    if (shared) return shared
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
    return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in ${now.toLocaleDateString('en-GB', { month: 'long' })}`
  })()
  // Two paydays already fill the line, so the save time is left off then.
  const twoPaydays = !ownerTab && !!pdN && !!pdR && pdN !== pdR
  const asOf = savedAt && !twoPaydays ? ` · as of ${new Date(savedAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}` : ''

  // Renewals due within 60 days, shown as one line that opens the Renewals tab.
  const comingUp = useMemo(() => upcomingRenewals(data).filter(r => r.days >= 0 && r.days <= 60), [data])

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

  const period = periodFor(data, 'JOINT')
  const keyFor = (o: OneOff) => periodFor(data, o.owner).key
  const oneOffsShown = (data.oneOffs ?? [])
    .filter(o => propertyId ? o.propertyId === propertyId : !ownerTab || o.owner === ownerTab)
    .filter(o => o.month >= keyFor(o))
    .sort((a, b) => a.month.localeCompare(b.month))
  const oneOffsNow = oneOffsShown.filter(o => o.month === keyFor(o))
  const oneOffsLater = oneOffsShown.filter(o => o.month > keyFor(o))
  const oneOffTotal = oneOffsNow.filter(o => !o.fromSavings).reduce((a, o) => a + o.amount, 0)
  const openOneOff = (id: string) => {
    const o = (data.oneOffs ?? []).find(x => x.id === id)
    if (o) setOneOffSheet(o)
  }
  const addOneOff = () => {
    // Whoever owns the home in view pays by default (Rupert for Mulberry Cottage), else the tab, else joint.
    const owner: Owner = propertySummary?.property.owner ?? ownerTab ?? 'JOINT'
    setOneOffSheet({ label: '', amount: 0, owner, month: periodFor(data, owner).key, topUp: true, propertyId: propertyId ?? undefined })
  }

  const spendGroups = byType('EXPENSE')
  const saveGroups = byType('SAVINGS')
  const incomeGroups = byType('INCOME')
  const spendTotal = sum(spendGroups) + debtTotal + oneOffTotal
  const spendGroupCount = spendGroups.length + (mortgages.length > 0 ? 1 : 0) + (otherDebts.length > 0 ? 1 : 0) + (oneOffsShown.length > 0 ? 1 : 0)

  const openCat = sheet ? data.categories.find(c => c.key === sheet.catKey) : null
  const openItem = openCat?.items.find(i => i.id === sheet?.itemId) ?? null
  const openItemSheet = (c: Category, i: LineItem) => setSheet({ catKey: c.key, itemId: i.id, focus: 'amount' })

  const submitCat = () => {
    if (newCatLabel.trim()) { addCategory(newCatOwner, newCatType, newCatLabel.trim()); setNewCatLabel(''); setAddingCat(false) }
  }

  // The joint account transfer: what each person moves in so the joint pot is covered.
  // Joint one-offs due before payday are a separate top-up, since this period's
  // transfer has already gone in; ones planned into a transfer raise it.
  const jointPot = totals.expJoint + totals.savJoint + totals.debtJoint
  const transferPot = jointPot - totals.oneOffTopUpJoint
  const jointEach = transferPot / 2
  const plannedJoint = totals.oneOffJoint - totals.oneOffTopUpJoint
  const split = householdCostSplit(data, totals)
  const jointSegments: Segment[] = [
    { label: 'Bills', value: totals.expJoint - totals.oneOffJoint, color: 'var(--chart-1)' },
    { label: 'Debts', value: totals.debtJoint, color: 'var(--chart-2)' },
    { label: 'Saving', value: totals.savJoint, color: 'var(--chart-3)' },
    { label: 'One-off', value: plannedJoint, color: 'var(--chart-4)' },
  ]
  const periodOneOffs = (data.oneOffs ?? []).filter(o => o.month === keyFor(o) && !o.fromSavings && o.amount > 0)
  const topUps: TopUp[] = periodOneOffs.filter(o => o.owner === 'JOINT' && o.topUp)
    .map(o => ({ id: o.id, label: o.label, each: o.amount / 2, done: !!o.done }))
  const plannedNames = periodOneOffs.filter(o => o.owner === 'JOINT' && !o.topUp).map(o => o.label)
  const headNote = plannedJoint > 0
    ? <>Usually <span className="num">{fmt((transferPot - plannedJoint) / 2)}</span>, plus <span className="num">{fmt(plannedJoint / 2)}</span> for {plannedNames.slice(0, 2).join(' and ')}</>
    : undefined
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
    // Compare like with like: one-offs would make an ordinary month look overspent.
    delta: lastMonthLeft != null ? budget.regularTotals.net - lastMonthLeft : null,
    caption: totals.oneOff > 0 ? <>Includes <span className="num">{fmt(totals.oneOff)}</span> of one-offs</> : undefined,
  }

  // ── hero for the current filter
  const hero = (() => {
    if (propertySummary) {
      const s = propertySummary
      return <Hero
        label={`${s.property.label} costs`} value={s.monthlyTotal} suffix="a month"
        segments={[{ label: 'Mortgage', value: s.mortgagePayment, color: 'var(--chart-1)' }, { label: 'Running costs', value: s.runningCosts, color: 'var(--chart-2)' }]}
        note={{ text: s.property.estimatedValue > 0
          ? <>Equity <b className="text-ink font-semibold num">{fmt(s.equity)}</b>{s.ltvPct != null && s.mortgageBalance > 0 ? ` · ${s.ltvPct.toFixed(0)}% loan-to-value` : ''}</>
          : 'Add its value on Wealth to see equity' }}
      />
    }
    if (ownerTab === 'JOINT') {
      return <Hero
        label="Into the joint account" value={transferPot} suffix={plannedJoint > 0 ? 'this month' : 'a month'}
        pair={[{ owner: 'NIAMH', label: `${ownerName('NIAMH')} puts in`, value: jointEach }, { owner: 'RUPERT', label: `${ownerName('RUPERT')} puts in`, value: jointEach }]}
        segments={jointSegments} legendEnd={{ label: 'Split', value: '50/50' }}
        topUps={topUps} onTopUp={budget.setOneOffDone}
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
          { label: 'To joint', value: jointPot / 2, color: 'var(--chart-1)' },
          { label: 'Own & saving', value: own + save, color: 'var(--chart-3)' },
          { label: 'Free', value: Math.max(0, left), color: 'var(--chart-2)' },
        ]}
        note={direct > 0 ? { owner: ownerTab, text: <>Includes <b className="text-ink font-semibold num">{fmt(direct)}</b> of household costs paid directly</> } : undefined}
        secondary={{ label: 'Take-home', value: inc, sub: 'after tax, each month' }}
      />
    }
    if (jointPot <= 0) {
      return <Hero
        label={leftToSpend.label} value={leftToSpend.value} negative={leftToSpend.negative}
        segments={[{ label: 'Spending', value: totals.totalExp, color: 'var(--chart-1)' }, { label: 'Saving', value: totals.totalSav, color: 'var(--chart-3)' }, { label: 'Free', value: Math.max(0, totals.net), color: 'var(--chart-2)' }]}
        secondary={{ label: 'Take-home', value: totals.totalInc, sub: 'after bills and saving', delta: leftToSpend.delta }}
      />
    }
    return <Hero
      label="Into the joint account this month" value={jointEach} suffix="each" headNote={headNote}
      segments={jointSegments} legendEnd={{ label: 'Total', value: fmt(transferPot) }}
      topUps={topUps} onTopUp={budget.setOneOffDone}
      note={directNote}
      secondary={leftToSpend}
    />
  })()

  const isEmpty = totals.totalInc === 0 && totals.totalExp === 0 && totals.totalSav === 0

  return (
    <div className="h-full overflow-y-auto px-5 pb-[calc(32px+env(safe-area-inset-bottom))]">
      {oneOffSheet && (
        <OneOffSheet
          key={oneOffSheet.id ?? 'new'} initial={oneOffSheet} budget={budget}
          properties={properties} ownerName={ownerName} onClose={() => setOneOffSheet(null)}
        />
      )}
      {openCat && openItem && sheet && (
        <ItemSheet cat={openCat} item={openItem} properties={properties} budget={budget} ownerName={ownerName} focus={sheet.focus} onClose={() => setSheet(null)} onOpenInsurance={onOpenInsurance} />
      )}

      {/* Two columns on wide screens: the month's summary stays put on the left while the groups scroll. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10 lg:items-start">
      <div className="lg:sticky lg:top-0 lg:pb-8">
      {/* greeting + homes */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <h1 className="text-[24px] leading-[30px] font-semibold tracking-[-0.02em] m-0 truncate min-w-0">{greeting}</h1>
        {properties.length > 0 && (
          <label className="relative shrink-0">
            <span className="sr-only">Show homes</span>
            <select
              value={propertyId ?? ''}
              onChange={e => onTabChange(e.target.value ? (`property:${e.target.value}` as TabFilter) : 'ALL')}
              className={`appearance-none min-h-[44px] rounded-xl pl-3.5 pr-9 text-[16px] font-medium cursor-pointer border-0 ${propertyId ? 'bg-ink text-on-ink' : 'bg-fill text-ink'}`}
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

      {!propertyId && comingUp.length > 0 && onOpenRenewals && (
        <button onClick={onOpenRenewals} className="panel w-full mt-4 px-4 py-3 flex items-center gap-3 text-left cursor-pointer">
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-warn-tint text-warn"><CalendarClock size={19} aria-hidden="true" /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-ink">{comingUp.length} renewing in the next 60 days</span>
            <span className="block text-label text-muted truncate">{comingUp.slice(0, 2).map(r => `${r.label} · ${r.days === 0 ? 'today' : `${r.days} ${r.days === 1 ? 'day' : 'days'}`}`).join(', ')}</span>
            <RenewalBar days={comingUp[0].days} />
          </span>
          <ChevronRight size={18} className="text-faint shrink-0" aria-hidden="true" />
        </button>
      )}

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

      {!isEmpty && (
        <button onClick={addOneOff} className="w-full flex items-center gap-3 min-h-[52px] mt-3 border-b border-line text-left cursor-pointer">
          <Plus size={18} className="text-ink-2 shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium text-ink">Add a big one-off cost</span>
            <span className="block text-caption text-muted">Repairs, annual bills, deposits</span>
          </span>
        </button>
      )}

      </div>
      <div className="min-w-0 lg:pt-1 lg:[&>div:first-child]:mt-0">
      {/* spending */}
      <SectionHead title="Spending" meta={<>{spendGroupCount} {spendGroupCount === 1 ? 'group' : 'groups'} · <b className="text-ink font-semibold"><Money value={spendTotal} /></b></>} />
      {oneOffsNow.length > 0 && (
        <OneOffGroup now={oneOffsNow} upcoming={oneOffsLater} period={period} ownerName={ownerName} onOpen={openOneOff} onAdd={addOneOff} />
      )}
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
      {oneOffsNow.length === 0 && oneOffsLater.length > 0 && (
        <OneOffGroup now={oneOffsNow} upcoming={oneOffsLater} period={period} ownerName={ownerName} onOpen={openOneOff} onAdd={addOneOff} />
      )}
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
      </div>
    </div>
  )
}
