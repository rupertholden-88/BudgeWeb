'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Home, Trees, CarFront, UsersRound, Shield, ShieldCheck, ShieldAlert, ShieldPlus,
  CalendarClock, Check, Clock, AlertTriangle, FileText, FileUp, X, Repeat, CircleCheck, CircleDashed, Loader2, Camera,
} from 'lucide-react'
import { Owner, fmt, PolicyDetails } from '@/lib/models'
import {
  insurancePolicies, insuranceGaps, assetOf, statusOf, KIND_LABELS, ALL_KINDS, HOME_KINDS, PEOPLE_KINDS,
  type Policy, type PolicyStatus, type InsuranceGap, type InsuranceKind,
} from '@/lib/insurance'
import { readToPolicy, fixRenewalDates, matchRead, fieldProblem, type ReadPolicy, type ReadResult, type ReadFile, type ReadField, type FieldKey } from '@/lib/insuranceRead'
import { useApiKey } from '@/hooks/useApiKey'
import { Sheet, SheetRow, Toggle, OwnerDot } from './BudgetScreen'
import { ConfirmDelete, NumberInput, inputClass } from './ui'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const USD_TO_GBP = 0.79
const MAX_UPLOAD_BYTES = 4_000_000 // keeps the request under the server's body limit
const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const plusYear = (d?: string) => {
  const base = d ? new Date(d) : new Date()
  base.setFullYear(base.getFullYear() + 1)
  return base.toISOString().slice(0, 10)
}
const normReg = (r?: string) => (r ?? '').replace(/\s+/g, '').toUpperCase()
/** Pounds and pence, for prices where rounding to the pound would mislead (£49.40, not £49). */
const fmt2 = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

// ─── small visual pieces ──────────────────────────────────────────────────────

type TileKind = 'home' | 'cottage' | 'car' | 'people' | 'other' | 'gap'
const TILE_HUE: Record<TileKind, string> = {
  home: 'var(--save)', cottage: 'var(--score-2)', car: 'var(--pension)', people: 'var(--niamh)', other: 'var(--chart-1)', gap: 'var(--line-2)',
}
const TILE_ICON: Record<TileKind, typeof Home> = { home: Home, cottage: Trees, car: CarFront, people: UsersRound, other: Shield, gap: ShieldPlus }

function Tile({ kind, status, size = 48 }: { kind: TileKind; status?: PolicyStatus | 'gap'; size?: number }) {
  const Icon = TILE_ICON[kind]
  const hue = TILE_HUE[kind]
  const bg = kind === 'people'
    ? 'linear-gradient(135deg, color-mix(in srgb, var(--niamh) 18%, var(--panel)) 50%, color-mix(in srgb, var(--rupert) 18%, var(--panel)) 50%)'
    : kind === 'gap' ? 'var(--panel)' : `color-mix(in srgb, ${hue} 16%, var(--panel))`
  const badge = status === 'covered' ? { bg: 'var(--pos)', Icon: Check }
    : status === 'soon' ? { bg: 'var(--warn)', Icon: Clock }
    : status === 'lapsed' ? { bg: 'var(--neg)', Icon: AlertTriangle }
    : status === 'gap' ? { bg: 'var(--fill-2)', Icon: Plus }
    : null
  return (
    <span
      className="relative grid place-items-center shrink-0"
      style={{
        width: size, height: size, borderRadius: size * 0.29, background: bg,
        boxShadow: kind === 'gap' ? 'none' : `inset 0 0 0 1px color-mix(in srgb, ${hue} 20%, transparent)`,
        border: kind === 'gap' ? '1.5px dashed var(--line-2)' : undefined,
        color: kind === 'people' ? 'var(--ink-2)' : kind === 'gap' ? 'var(--muted)' : `color-mix(in srgb, ${hue} 74%, var(--ink))`,
      }}
      aria-hidden="true"
    >
      <Icon size={size * 0.46} strokeWidth={1.9} />
      {badge && (
        <span className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full grid place-items-center" style={{ background: badge.bg, boxShadow: '0 0 0 2.5px var(--panel)', color: status === 'gap' ? 'var(--ink-2)' : 'var(--on-ink)' }}>
          <badge.Icon size={11} strokeWidth={3} />
        </span>
      )}
    </span>
  )
}

const STATUS_PILL: Record<PolicyStatus | 'gap', { text: string; cls: string; Icon: typeof Shield }> = {
  covered: { text: 'Covered', cls: 'pill-good', Icon: ShieldCheck },
  soon: { text: 'Renews soon', cls: 'pill-warn', Icon: CalendarClock },
  lapsed: { text: 'Lapsed', cls: 'pill-bad', Icon: ShieldAlert },
  undated: { text: 'No renewal date', cls: '', Icon: Shield },
  gap: { text: 'Not covered', cls: '', Icon: ShieldPlus },
}

function StatusPill({ status }: { status: PolicyStatus | 'gap' }) {
  const s = STATUS_PILL[status]
  return <span className={`pill ${s.cls} shrink-0`}><s.Icon size={12} aria-hidden="true" />{s.text}</span>
}

/** How far through the policy year we are, counting down to renewal. */
function YearBar({ p }: { p: Policy }) {
  if (p.yearProgress == null) return null
  const color = p.status === 'lapsed' ? 'var(--neg)' : p.status === 'soon' ? 'var(--warn)' : 'var(--pos)'
  return (
    <span className="flex-1 min-w-[48px] h-1.5 rounded-full bg-fill relative overflow-hidden" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(4, p.yearProgress * 100)}%`, background: color }} />
    </span>
  )
}

function Plate({ reg }: { reg: string }) {
  return <span className="inline-flex items-center h-[22px] px-1.5 rounded-[5px] border-[1.5px] border-ink-2 text-caption font-bold tracking-[0.08em] text-ink">{reg}</span>
}

function Chip({ children, off }: { children: React.ReactNode; off?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-caption font-medium ${off ? 'border border-line-2 text-muted' : 'chip-soft text-ink-2'}`}>
      {off ? <span aria-hidden="true">–</span> : <Check size={12} aria-hidden="true" />}{children}
    </span>
  )
}

function renewText(p: Policy) {
  if (p.coverTo) return `Cover to ${new Date(p.coverTo).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
  if (!p.renewalDate) return 'Add the renewal date'
  if (p.days! < 0) return `Ended ${fmtDay(p.renewalDate)} · ${-p.days!} ${p.days === -1 ? 'day' : 'days'} ago`
  if (p.days === 0) return 'Renews today'
  return `Renews ${fmtDay(p.renewalDate)} · ${p.days} ${p.days === 1 ? 'day' : 'days'}`
}

/** A few words for what a policy covers, from its details. */
function coverChips(p: Policy): { label: string; off?: boolean }[] {
  const d = p.details
  const chips: { label: string; off?: boolean }[] = []
  for (const c of d.covers ?? []) chips.push({ label: c })
  if (!d.covers?.length) {
    if (p.kind === 'home') chips.push({ label: 'Buildings' }, { label: 'Contents' })
    else if (p.kind !== 'other' && p.kind !== 'car') chips.push({ label: KIND_LABELS[p.kind] })
  }
  if (d.home?.unoccupiedDays) chips.push({ label: `Empty up to ${d.home.unoccupiedDays} days` })
  if (d.car?.coverLevel) chips.push({ label: d.car.coverLevel.replace(/^./, c => c.toUpperCase()) })
  if (d.car?.ncdYears != null) chips.push({ label: `${d.car.ncdYears} yrs no-claims${d.car.ncdProtected ? ', protected' : ''}` })
  if (d.life?.sumAssured) chips.push({ label: `${fmt(d.life.sumAssured)} ${d.life.coverType ?? ''}`.trim() })
  for (const x of d.excluded ?? []) chips.push({ label: x, off: true })
  const seen = new Set<string>()
  return chips.filter(c => { const k = c.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 6)
}

// ─── policy row and asset card ────────────────────────────────────────────────

function PolicyRow({ p, showTitle, onOpen, ownerName }: { p: Policy; showTitle: boolean; onOpen: () => void; ownerName: (o: Owner) => string }) {
  const chips = coverChips(p)
  const insurerLine = [KIND_LABELS[p.kind] !== p.label ? KIND_LABELS[p.kind] : null, p.provider].filter(Boolean).join(' · ')
  return (
    <div className="border-t border-line first:border-t-0">
      <button onClick={onOpen} className="w-full text-left px-4 pt-3 pb-3 cursor-pointer min-h-[56px]">
        <span className="flex items-start gap-3">
          <span className="flex-1 min-w-0">
            {showTitle && <span className="block text-[15px] font-semibold text-ink truncate">{p.label}</span>}
            <span className="block text-label text-muted truncate">{insurerLine || 'Add the insurer'} · {ownerName(p.owner)} pays</span>
          </span>
          <span className="text-right shrink-0">
            <span className="block text-[16px] font-semibold tabular-nums">{p.monthly > 0 ? `${fmt(p.monthly)}/mo` : '—'}</span>
            {p.yearly > 0 && <span className="block text-caption text-muted tabular-nums">{fmt(p.yearly)}/yr</span>}
          </span>
          <ChevronRight size={16} className="text-faint shrink-0 mt-1" aria-hidden="true" />
        </span>
        {chips.length > 0 && (
          <span className="flex flex-wrap gap-1.5 mt-2">{chips.map(c => <Chip key={c.label} off={c.off}>{c.label}</Chip>)}</span>
        )}
        <span className="flex items-center gap-2.5 mt-2.5">
          <StatusPill status={p.status} />
          <YearBar p={p} />
          <span className={`text-caption shrink-0 tabular-nums ${p.status === 'lapsed' ? 'text-neg font-semibold' : 'text-muted'}`}>{renewText(p)}</span>
        </span>
      </button>
      {p.status === 'soon' && !p.autoRenews && p.renewalDate && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-warn-tint text-label text-warn font-medium">
          <Repeat size={14} aria-hidden="true" /> Won&apos;t auto-renew. Get quotes before {fmtDay(p.renewalDate)}.
        </div>
      )}
    </div>
  )
}

function GapBlock({ g, onAdd, bodyOnly }: { g: InsuranceGap; onAdd: () => void; bodyOnly?: boolean }) {
  return (
    <button onClick={onAdd} className="w-full text-left flex items-start gap-3 px-4 py-3 border-t border-dashed border-line-2 first:border-t-0 cursor-pointer min-h-[56px]">
      <span className="flex-1 min-w-0">
        {!bodyOnly && <span className="block text-[15px] font-semibold text-ink">{g.title}</span>}
        <span className={`block leading-snug ${bodyOnly ? 'text-[15px] text-ink-2' : 'text-label text-muted'}`}>{g.body}</span>
      </span>
      {g.severity === 'gap'
        ? <span className="flex items-center gap-1 text-label font-semibold text-ink shrink-0 min-h-[32px]"><Plus size={14} aria-hidden="true" /> Add</span>
        : <span className="pill shrink-0">Worth a look</span>}
    </button>
  )
}

function AssetCard({ tile, title, titleExtra, sub, subAction, policies, gaps, onOpen, onAddGap, ownerName, gapBodyOnly }: {
  tile: TileKind; title: string; titleExtra?: React.ReactNode; sub?: string; subAction?: React.ReactNode
  policies: Policy[]; gaps: InsuranceGap[]; onOpen: (p: Policy) => void; onAddGap: (g: InsuranceGap) => void
  ownerName: (o: Owner) => string; gapBodyOnly?: boolean
}) {
  const worst: PolicyStatus | 'gap' = policies.some(p => p.status === 'lapsed') ? 'lapsed'
    : policies.some(p => p.status === 'soon') ? 'soon'
    : policies.length === 0 ? 'gap'
    : policies.every(p => p.status === 'undated') ? 'undated' : 'covered'
  const monthly = policies.reduce((a, p) => a + p.monthly, 0)
  const yearly = policies.reduce((a, p) => a + p.yearly, 0)
  return (
    <section className="rounded-[18px] bg-panel border border-line overflow-hidden" aria-label={title}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Tile kind={policies.length === 0 ? 'gap' : tile} status={worst === 'undated' ? undefined : worst} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[17px] font-semibold text-ink">{title}</span>
            {titleExtra}
          </div>
          {(sub || subAction) && (
            <div className="flex items-center gap-x-2 flex-wrap text-label text-muted">
              {sub && <span>{sub}</span>}
              {subAction}
            </div>
          )}
        </div>
        {policies.length > 1 && (
          <div className="text-right shrink-0">
            <div className="text-[16px] font-semibold tabular-nums">{fmt(monthly)}/mo</div>
            <div className="text-caption text-muted tabular-nums">{fmt(yearly)}/yr</div>
          </div>
        )}
      </div>
      <div className="border-t border-line">
        {policies.map(p => <PolicyRow key={p.id} p={p} showTitle={policies.length > 1 || p.label !== title} onOpen={() => onOpen(p)} ownerName={ownerName} />)}
        {gaps.map(g => <GapBlock key={g.id} g={g} onAdd={() => onAddGap(g)} bodyOnly={gapBodyOnly} />)}
      </div>
    </section>
  )
}

// ─── policy sheet: view, edit, add, mark renewed ──────────────────────────────

/**
 * A name for a home from its address: a house name if it has one
 * ("Mulberry Cottage"), otherwise the area after the street ("Bickley").
 */
function townFrom(address?: string): string {
  const parts = (address ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const street = /\d|\b(road|rd|lane|street|st|avenue|ave|close|drive|way|gardens?|crescent|place|grove|hill|park|terrace|court|mews)\b/i
  const postcode = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
  return parts.find(s => !street.test(s) && !postcode.test(s)) ?? ''
}

/**
 * Choose which home a policy is for, or add one on the spot. Homes otherwise
 * live on Wealth, which is a long way round when a document names a new one.
 */
function HomePicker({ value, onChange, budget, suggestion, owner }: {
  value: string; onChange: (id: string) => void; budget: BudgetHook; suggestion?: string; owner: Owner
}) {
  const props = budget.data.properties ?? []
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState(suggestion ?? '')
  const [main, setMain] = useState(false)
  const add = () => {
    const id = budget.addProperty(name, owner, main)
    if (id) { onChange(id); setAdding(false) }
  }
  if (adding || props.length === 0) return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus={adding} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
        aria-label="New home's name" placeholder="Name the home, e.g. Bickley" className={`${inputClass} w-full`}
      />
      {props.length > 0 && (
        <label className="flex items-center gap-2.5 min-h-[44px] text-[15px] cursor-pointer">
          <input type="checkbox" checked={main} onChange={e => setMain(e.target.checked)} className="w-5 h-5 accent-[var(--ink)]" />
          It&apos;s our main home
        </label>
      )}
      <div className="flex gap-2">
        <button onClick={add} disabled={!name.trim()} className="flex-1 bg-ink text-on-ink rounded-xl min-h-[44px] text-[15px] font-semibold cursor-pointer disabled:opacity-40">Add home</button>
        {props.length > 0 && <button onClick={() => setAdding(false)} className="px-4 bg-fill rounded-xl min-h-[44px] text-[15px] cursor-pointer">Cancel</button>}
      </div>
      <span className="text-caption text-muted">Add its value and mortgage on Wealth later.</span>
    </div>
  )
  return (
    <select
      value={value}
      onChange={e => { if (e.target.value === '__new') { setName(suggestion ?? ''); setAdding(true) } else onChange(e.target.value) }}
      aria-label="Home" className={`${inputClass} w-full`}
    >
      <option value="">Choose a home</option>
      {props.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      <option value="__new">+ Add a home…</option>
    </select>
  )
}

/** A labelled field in the policy sheet's two-column grid. */
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 min-w-0 ${full ? 'col-span-2' : ''}`}>
      <span className="text-caption text-muted uppercase tracking-label">{label}</span>{children}
    </label>
  )
}

type SheetMode = { type: 'edit'; id: string } | { type: 'renew'; id: string } | { type: 'new'; kind?: InsuranceKind; propertyId?: string }

function PolicySheet({ mode, budget, onClose, onUpload, ownerName }: {
  mode: SheetMode; budget: BudgetHook; onClose: () => void; onUpload: (policyId: string) => void; ownerName: (o: Owner) => string
}) {
  const { data, savePolicy, removePolicy } = budget
  const existing = mode.type !== 'new' ? insurancePolicies(data).find(p => p.id === mode.id) ?? null : null
  const props = data.properties ?? []
  const [kind, setKind] = useState<InsuranceKind>(existing?.kind ?? (mode.type === 'new' ? mode.kind ?? 'home' : 'other'))
  const [label, setLabel] = useState(existing?.label ?? '')
  const [owner, setOwner] = useState<Owner>(existing?.owner ?? (mode.type === 'new' && mode.propertyId ? props.find(p => p.id === mode.propertyId)?.owner ?? 'JOINT' : 'JOINT'))
  const [monthly, setMonthly] = useState<number | undefined>(existing?.monthly || undefined)
  const [provider, setProvider] = useState(existing?.provider ?? '')
  const [renewalDate, setRenewalDate] = useState(mode.type === 'renew' ? plusYear(existing?.renewalDate) : existing?.renewalDate ?? '')
  const [autoRenews, setAutoRenews] = useState(existing?.autoRenews ?? false)
  const [propertyId, setPropertyId] = useState(existing?.propertyId ?? (mode.type === 'new' ? mode.propertyId ?? '' : ''))
  const [d, setD] = useState<PolicyDetails>(existing?.details ?? {})
  const [coversText, setCoversText] = useState((existing?.details.covers ?? []).join(', '))
  const [ownerTouched, setOwnerTouched] = useState(!!existing)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const priceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode.type === 'renew') setTimeout(() => priceRef.current?.querySelector('input')?.focus(), 250)
  }, [mode.type])

  const isHome = HOME_KINDS.includes(kind)
  const isCar = kind === 'car'
  const isPeople = PEOPLE_KINDS.includes(kind)
  const home = d.home ?? {}, car = d.car ?? {}, life = d.life ?? {}
  const setHome = (f: Partial<NonNullable<PolicyDetails['home']>>) => setD(x => ({ ...x, home: { ...x.home, ...f } }))
  const setCar = (f: Partial<NonNullable<PolicyDetails['car']>>) => setD(x => ({ ...x, car: { ...x.car, ...f } }))
  const setLife = (f: Partial<NonNullable<PolicyDetails['life']>>) => setD(x => ({ ...x, life: { ...x.life, ...f } }))
  const prop = props.find(p => p.id === propertyId)
  const secondHome = prop && !prop.isMainResidence && props.length > 1
  const days = renewalDate ? Math.round((new Date(renewalDate).getTime() - Date.now()) / 864e5) : null
  const status = statusOf(days)

  const save = () => {
    const homeWord: Partial<Record<InsuranceKind, string>> = { buildings: 'buildings', contents: 'contents', emergency: 'home emergency', landlord: 'landlord', home: 'home' }
    const plain = /insurance|cover|protection/i.test(KIND_LABELS[kind]) ? KIND_LABELS[kind] : `${KIND_LABELS[kind]} insurance`
    const defaultLabel = isCar ? (car.makeModel ? `${car.makeModel} insurance` : 'Car insurance')
      : isHome && prop ? `${prop.label} ${homeWord[kind] ?? 'home'} insurance`
      : plain
    savePolicy({
      itemId: existing?.id, owner, label: label.trim() || defaultLabel, monthly: monthly ?? 0,
      provider, renewalDate, autoRenews, propertyId: isHome ? propertyId || null : null,
      details: {
        ...d, kind,
        covers: coversText.split(',').map(s => s.trim()).filter(Boolean),
        // A changed monthly price is the new price; a yearly figure from an old document would be stale.
        premiumAnnual: existing && monthly != null && monthly !== existing.monthly ? undefined : d.premiumAnnual,
        // A renewal starts where the last policy year ended.
        startDate: mode.type === 'renew' && existing?.renewalDate ? existing.renewalDate : d.startDate,
        lastYearAnnual: mode.type === 'renew' && existing ? existing.yearly : d.lastYearAnnual,
      },
      replaceDetails: true,
    })
    onClose()
  }

  const title = mode.type === 'new' ? 'Add a policy' : mode.type === 'renew' ? 'Mark renewed' : 'Policy'
  const field = 'grid grid-cols-2 gap-3 py-3 border-t border-line'
  const num = (v: number | undefined, on: (v: number | undefined) => void, aria: string, ph = '') =>
    <NumberInput value={v} onChange={on} ariaLabel={aria} placeholder={ph} className={`${inputClass} w-full`} />
  const text = (v: string | undefined, on: (v: string) => void, aria: string, ph = '') =>
    <input value={v ?? ''} onChange={e => on(e.target.value)} aria-label={aria} placeholder={ph} className={`${inputClass} w-full`} />

  return (
    <Sheet title={title} onClose={onClose}>
      {confirmRemove && existing && (
        <ConfirmDelete
          label={existing.label}
          title={`Stop tracking ${existing.label}?`}
          confirmLabel="Remove policy"
          detail="Removes the policy and its bill from the budget. Use this for a sold car or a cancelled policy. You can't undo this."
          onConfirm={() => { removePolicy(existing.id); setConfirmRemove(false); onClose() }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {mode.type === 'renew' && (
        <p className="text-label text-muted mt-1 mb-2">Check the new end date and price. The lapsed warning clears when you save.</p>
      )}
      <input
        value={label} onChange={e => setLabel(e.target.value)} aria-label="Policy name"
        placeholder={isCar ? 'e.g. Ford Fiesta insurance' : isHome ? 'e.g. Laurel Gardens home insurance' : 'Policy name'}
        className="title-input w-full bg-transparent outline-none border-0 p-0 min-h-[44px] mt-1 text-ink placeholder:text-faint placeholder:font-normal"
      />
      <div ref={priceRef}>
        <label className="amount-field mt-2 mb-1">
          <span className="cur-big" aria-hidden="true">£</span>
          <NumberInput value={monthly} onChange={setMonthly} ariaLabel="Price per month" className="amount-input num" />
          <span className="suffix">a month</span>
        </label>
      </div>
      <p className="text-caption text-muted mt-1 mb-2 num">
        {monthly ? `${fmt(monthly * 12)} a year` : 'Goes into the budget as a monthly bill.'}
        {existing?.details.lastYearAnnual ? ` · last year ${fmt(existing.details.lastYearAnnual)}` : ''}
      </p>

      <div className="py-3 border-t border-line">
        <div className="text-[15px] text-ink mb-2">Who pays</div>
        <div className="seg" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} role="group" aria-label="Who pays">
          {(['JOINT', 'NIAMH', 'RUPERT'] as const).map(o => (
            <button key={o} aria-pressed={owner === o} onClick={() => { setOwner(o); setOwnerTouched(true) }}><OwnerDot owner={o} label={ownerName(o)} /><span className="lbl">{ownerName(o)}</span></button>
          ))}
        </div>
      </div>

      <div className={field}>
        <F label="Type">
          <select value={kind} onChange={e => setKind(e.target.value as InsuranceKind)} aria-label="Type" className={`${inputClass} w-full`}>
            {ALL_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </F>
        <F label="Insurer">{text(provider, setProvider, 'Insurer', 'e.g. Aviva')}</F>
        {isHome && (
          <F label="Home" full>
            <HomePicker
              value={propertyId} budget={budget} owner={owner}
              onChange={id => {
                setPropertyId(id)
                // Whoever owns the home usually pays for its cover.
                const home = (budget.data.properties ?? []).find(p => p.id === id)
                if (home && !ownerTouched) setOwner(home.owner)
              }}
            />
          </F>
        )}
        <F label="Policy number">{text(d.policyNumber, v => setD(x => ({ ...x, policyNumber: v || undefined })), 'Policy number')}</F>
        <F label="Cover started">
          <input type="date" value={d.startDate ?? ''} onChange={e => setD(x => ({ ...x, startDate: e.target.value || undefined }))} aria-label="Cover started" className={`${inputClass} w-full`} />
        </F>
        <F label="Renews / ends" full>
          <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} aria-label="Renewal date" className={`${inputClass} w-full ${status === 'lapsed' ? 'text-neg' : ''}`} />
        </F>
      </div>
      <SheetRow label="Auto-renews" hint={autoRenews ? 'The price usually changes at renewal, so check the new one.' : 'Off: cover ends on the renewal date unless you renew.'}>
        <Toggle checked={autoRenews} onChange={setAutoRenews} label="Auto-renews" />
      </SheetRow>

      {isHome && (
        <div className={field}>
          <div className="col-span-2 text-[15px] font-semibold text-ink">What&apos;s covered</div>
          <F label="Buildings £">{num(home.buildingsSum, v => setHome({ buildingsSum: v }), 'Buildings sum insured', home.buildingsUnlimited ? 'Unlimited' : '')}</F>
          <F label="Contents £">{num(home.contentsSum, v => setHome({ contentsSum: v }), 'Contents sum insured', home.contentsUnlimited ? 'Unlimited' : '')}</F>
          <F label="Compulsory excess £">{num(home.excessCompulsory, v => setHome({ excessCompulsory: v }), 'Compulsory excess')}</F>
          <F label="Voluntary excess £">{num(home.excessVoluntary, v => setHome({ excessVoluntary: v }), 'Voluntary excess')}</F>
          <F label="Empty up to (days)">{num(home.unoccupiedDays, v => setHome({ unoccupiedDays: v }), 'Days the home can be empty')}</F>
          <F label="Accidental damage">
            <select value={home.accidentalDamage ?? ''} onChange={e => setHome({ accidentalDamage: e.target.value || undefined })} aria-label="Accidental damage" className={`${inputClass} w-full`}>
              <option value="">Not known</option><option value="none">None</option><option value="buildings">Buildings</option><option value="contents">Contents</option><option value="both">Both</option>
            </select>
          </F>
        </div>
      )}
      {isHome && secondHome && (
        <SheetRow label="Insurer knows it's a second home">
          <Toggle checked={!!home.secondHomeDeclared} onChange={v => setHome({ secondHomeDeclared: v || undefined })} label="Insurer knows it's a second home" />
        </SheetRow>
      )}

      {isCar && (
        <div className={field}>
          <div className="col-span-2 text-[15px] font-semibold text-ink">The car</div>
          <F label="Registration">{text(car.reg, v => setCar({ reg: v.toUpperCase() || undefined }), 'Registration', 'AB21 CDE')}</F>
          <F label="Make and model">{text(car.makeModel, v => setCar({ makeModel: v || undefined }), 'Make and model', 'e.g. Ford Fiesta')}</F>
          <F label="Cover" full>
            <select value={car.coverLevel ?? ''} onChange={e => setCar({ coverLevel: e.target.value || undefined })} aria-label="Cover level" className={`${inputClass} w-full`}>
              <option value="">Not known</option><option value="comprehensive">Comprehensive</option><option value="third party, fire and theft">Third party, fire and theft</option><option value="third party only">Third party only</option>
            </select>
          </F>
          <F label="Drivers" full>{text(car.namedDrivers, v => setCar({ namedDrivers: v || undefined }), 'Drivers', 'e.g. Niamh (main), Rupert')}</F>
          <F label="No-claims years">{num(car.ncdYears, v => setCar({ ncdYears: v }), 'No-claims years')}</F>
          <F label="Breakdown">
            <select value={car.breakdown ?? ''} onChange={e => setCar({ breakdown: e.target.value || undefined })} aria-label="Breakdown cover" className={`${inputClass} w-full`}>
              <option value="">Not known</option><option value="none">None</option><option value="roadside">Roadside</option><option value="at home">At home</option><option value="national">National</option><option value="european">European</option>
            </select>
          </F>
          <F label="Compulsory excess £">{num(car.excessCompulsory, v => setCar({ excessCompulsory: v }), 'Compulsory excess')}</F>
          <F label="Voluntary excess £">{num(car.excessVoluntary, v => setCar({ excessVoluntary: v }), 'Voluntary excess')}</F>
        </div>
      )}
      {isCar && (
        <SheetRow label="No-claims protected">
          <Toggle checked={!!car.ncdProtected} onChange={v => setCar({ ncdProtected: v || undefined })} label="No-claims protected" />
        </SheetRow>
      )}

      {isPeople && (
        <div className={field}>
          <div className="col-span-2 text-[15px] font-semibold text-ink">Who&apos;s covered</div>
          <F label="Lives covered" full>{text(life.livesCovered, v => setLife({ livesCovered: v || undefined }), 'Lives covered', 'e.g. Niamh and Rupert')}</F>
          <F label={kind === 'income' ? 'Benefit £/mo' : 'Pays out £'}>{num(life.sumAssured, v => setLife({ sumAssured: v }), 'Cover amount')}</F>
          <F label="Cover ends">
            <input type="date" value={life.termEnd ?? ''} onChange={e => setLife({ termEnd: e.target.value || undefined })} aria-label="Cover ends" className={`${inputClass} w-full`} />
          </F>
        </div>
      )}
      {kind === 'life' && (
        <SheetRow label="Written in trust">
          <Toggle checked={!!life.inTrust} onChange={v => setLife({ inTrust: v })} label="Written in trust" />
        </SheetRow>
      )}

      <div className={field}>
        <F label="Also covers" full>
          <input
            value={coversText} onChange={e => setCoversText(e.target.value)}
            aria-label="Also covers" placeholder="e.g. Accidental damage, Home emergency" className={`${inputClass} w-full`}
          />
        </F>
      </div>

      {existing && (d.readFrom?.length ?? 0) > 0 && (
        <div className="py-3 border-t border-line">
          <div className="text-[15px] font-semibold text-ink mb-1.5">Read from</div>
          {d.readFrom!.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-label text-muted min-h-[28px]"><FileText size={14} aria-hidden="true" />{r.name} · read {fmtDay(r.readAt)}</div>
          ))}
          <p className="text-caption text-muted mt-1 mb-0">The documents themselves aren&apos;t kept.</p>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-3 border-t border-line">
        <button onClick={save} className="w-full bg-ink text-on-ink rounded-xl min-h-[52px] text-[16px] font-semibold cursor-pointer">
          {mode.type === 'new' ? 'Add policy' : mode.type === 'renew' ? 'Save renewal' : 'Save'}
        </button>
        {existing && (
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => onUpload(existing.id)} className="flex items-center gap-2 min-h-[44px] text-[15px] font-medium text-ink-2 cursor-pointer">
              <FileUp size={16} aria-hidden="true" /> Upload new documents
            </button>
            <button onClick={() => setConfirmRemove(true)} className="min-h-[44px] text-[15px] font-medium text-ink-2 underline underline-offset-2 cursor-pointer">No longer needed</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ─── upload and fill ──────────────────────────────────────────────────────────

const FIELD_LABELS: Partial<Record<FieldKey, string>> = {
  insurer: 'Insurer', policyNumber: 'Policy number', policyholders: 'Policyholders', startDate: 'Cover starts', endDate: 'Renews / ends',
  premiumAnnual: 'Price a year', premiumMonthly: 'Price a month', paymentFrequency: 'Paying', autoRenews: 'Auto-renews',
  address: 'Address', postcode: 'Postcode', buildingsSum: 'Buildings cover', contentsSum: 'Contents cover', accidentalDamage: 'Accidental damage',
  unoccupiedDays: 'Can be empty for', excessCompulsory: 'Compulsory excess', excessVoluntary: 'Voluntary excess', escapeOfWaterExcess: 'Escape of water excess',
  homeEmergency: 'Home emergency', legalExpenses: 'Legal expenses', secondHomeDeclared: 'Second home declared',
  reg: 'Registration', makeModel: 'Car', coverLevel: 'Cover', mainDriver: 'Main driver', namedDrivers: 'Drivers', ncdYears: 'No-claims years',
  ncdProtected: 'No-claims protected', breakdown: 'Breakdown', courtesyCar: 'Courtesy car',
  livesCovered: 'Lives covered', sumAssured: 'Pays out', termEnd: 'Cover ends', coverType: 'Cover type', inTrust: 'In trust',
  covers: 'Covers', exclusions: 'Not covered',
}
/** One found detail: shown as read, tap to correct it. Unclear readings say so. */
function ReviewField({ f, value, onChange, problem }: { f: ReadField; value: string; onChange: (v: string) => void; problem?: string | null }) {
  const [editing, setEditing] = useState(false)
  const low = f.confidence === 'low'
  const label = FIELD_LABELS[f.key] ?? f.key
  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-line min-h-[60px]">
      {low
        ? <AlertTriangle size={18} className="text-warn shrink-0" aria-hidden="true" />
        : <CircleCheck size={18} className="text-pos shrink-0" aria-hidden="true" />}
      <span className="flex-1 min-w-0">
        <span className="block text-caption text-muted">{label}{low && <span className="text-warn font-semibold"> · Check this</span>}</span>
        {editing || problem ? (
          <input
            autoFocus={editing} value={value} onChange={e => onChange(e.target.value)} onBlur={() => setEditing(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditing(false) }}
            aria-label={label} aria-invalid={!!problem} aria-describedby={problem ? `err-${f.key}` : undefined}
            className={`${inputClass} w-full mt-1 ${problem ? 'border-neg' : ''}`}
          />
        ) : (
          <button onClick={() => setEditing(true)} aria-label={`${label}: ${showValue({ ...f, value })}${low ? ', check this' : ''}. Tap to change`} className="block w-full text-left text-[16px] font-medium text-ink min-h-[28px] cursor-text">
            {showValue({ ...f, value })}
          </button>
        )}
        {problem && <span id={`err-${f.key}`} className="block text-caption text-neg mt-1">{problem}</span>}
      </span>
      {f.source && <span className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md border border-line-2 text-caption text-muted"><FileText size={11} aria-hidden="true" />{f.source}</span>}
    </div>
  )
}

const MONEY_KEYS: FieldKey[] = ['premiumAnnual', 'premiumMonthly', 'buildingsSum', 'contentsSum', 'excessCompulsory', 'excessVoluntary', 'escapeOfWaterExcess', 'sumAssured']
const DATE_KEYS: FieldKey[] = ['startDate', 'endDate', 'termEnd']
/** Worth saying when the documents don't mention them. */
const EXPECTED: Partial<Record<InsuranceKind, FieldKey[]>> = {
  car: ['breakdown', 'ncdYears', 'excessCompulsory'],
  home: ['buildingsSum', 'contentsSum', 'unoccupiedDays', 'excessCompulsory'],
  buildings: ['buildingsSum', 'unoccupiedDays', 'excessCompulsory'],
  contents: ['contentsSum', 'excessCompulsory'],
  life: ['sumAssured', 'termEnd', 'inTrust'],
}

function showValue(f: ReadField): string {
  if (MONEY_KEYS.includes(f.key)) return /unlimited/i.test(f.value) ? 'Unlimited' : (() => { const n = parseFloat(f.value.replace(/[£,]/g, '')); return Number.isFinite(n) ? `£${n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : f.value })()
  if (DATE_KEYS.includes(f.key) && /^\d{4}-\d{2}-\d{2}$/.test(f.value)) return fmtDate(f.value)
  if (f.key === 'unoccupiedDays') return `${f.value} days`
  if (/^(yes|no)$/i.test(f.value)) return f.value.toLowerCase() === 'yes' ? 'Yes' : 'No'
  return f.value.replace(/^./, c => c.toUpperCase())
}

/** Shrink photos so several fit in one request; PDFs go as they are. */
async function toReadFile(file: File): Promise<ReadFile> {
  const asBase64 = (blob: Blob) => new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
  if (file.type === 'application/pdf') return { name: file.name, mediaType: 'application/pdf', data: await asBase64(file) }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', 0.85))
    return { name: file.name, mediaType: 'image/jpeg', data: await asBase64(blob) }
  } finally { URL.revokeObjectURL(url) }
}

type UploadState =
  | { step: 'choose' }
  | { step: 'reading'; done: number; total: number }
  | { step: 'review'; result: ReadResult; read: ReadPolicy; costUsd: number }
  | { step: 'error'; message: string; costUsd?: number; settings?: boolean }

function UploadSheet({ budget, targetId, onClose, onSaved, ownerName, onOpenSettings }: {
  budget: BudgetHook; targetId: string | null; onClose: () => void; onSaved: (msg: string) => void; ownerName: (o: Owner) => string
  onOpenSettings?: () => void
}) {
  const { data, user, savePolicy } = budget
  const { apiKey, hasKey, loading: keyLoading } = useApiKey(user)
  const [files, setFiles] = useState<File[]>([])
  const [state, setState] = useState<UploadState>({ step: 'choose' })
  const [values, setValues] = useState<Record<string, string>>({})
  const [target, setTarget] = useState<string>(targetId ?? '')
  const [propertyId, setPropertyId] = useState('')
  const [owner, setOwner] = useState<Owner>('JOINT')
  const [updateBudget, setUpdateBudget] = useState(true)
  const [matchReason, setMatchReason] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const policies = useMemo(() => insurancePolicies(data), [data])
  const props = data.properties ?? []

  const totalBytes = files.reduce((a, f) => a + (f.type === 'application/pdf' ? f.size : Math.min(f.size, 900_000)), 0)
  const tooBig = totalBytes * 1.37 > MAX_UPLOAD_BYTES

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const ok = Array.from(list).filter(f => /^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(f.type))
    const rejected = Array.from(list).length - ok.length
    setFiles(fs => [...fs, ...ok.filter(f => !fs.some(x => x.name === f.name && x.size === f.size))].slice(0, 6))
    if (rejected > 0) setState({ step: 'error', message: 'Only PDFs and JPG or PNG photos can be read. If your camera saves HEIC photos, switch it to JPG or take a screenshot of the page.' })
  }

  const run = async () => {
    if (!apiKey || files.length === 0) return
    abort.current = new AbortController()
    setState({ step: 'reading', done: 0, total: files.length })
    try {
      const prepared: ReadFile[] = []
      for (const f of files) { prepared.push(await toReadFile(f)); setState({ step: 'reading', done: prepared.length, total: files.length }) }
      const res = await fetch('/api/insurance-read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.current.signal,
        body: JSON.stringify({ files: prepared, apiKey }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.result) {
        setState({ step: 'error', message: json?.message ?? (res.status === 413 ? 'These files are too large to send. Try fewer pages or photos.' : 'Something went wrong reading these. Try again.'), costUsd: json?.costUsd, settings: json?.error === 'bad_key' || json?.error === 'not_configured' })
        return
      }
      const result: ReadResult = fixRenewalDates(json.result)
      if (!result.isInsurance) {
        setState({ step: 'error', message: 'This doesn’t look like an insurance schedule. Try the policy schedule or renewal letter, not the policy wording booklet.', costUsd: json.costUsd })
        return
      }
      const read = readToPolicy(result, files.map(f => f.name))
      const m = matchRead(data, read)
      const t = targetId ?? m.policy?.id ?? ''
      setTarget(t)
      const tp = policies.find(p => p.id === t)
      setPropertyId(m.propertyId ?? tp?.propertyId ?? '')
      setOwner(tp?.owner ?? (m.propertyId ? props.find(p => p.id === m.propertyId)?.owner : undefined) ?? 'JOINT')
      setMatchReason(targetId ? null : m.reason)
      setValues(Object.fromEntries(result.fields.map(f => [f.key, f.value])))
      setState({ step: 'review', result, read, costUsd: json.costUsd ?? 0 })
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setState({ step: 'choose' }); return }
      setState({ step: 'error', message: 'Couldn’t reach the server. Check your connection and try again.' })
    }
  }

  const save = () => {
    if (state.step !== 'review') return
    // Re-map with any values the person corrected on the review screen.
    const edited: ReadResult = { ...state.result, fields: state.result.fields.map(f => ({ ...f, value: values[f.key] ?? f.value })) }
    const read = readToPolicy(edited, files.map(f => f.name))
    const existing = policies.find(p => p.id === target) ?? null
    const prop = props.find(p => p.id === propertyId)
    const label = existing?.label ?? (read.kind === 'car'
      ? `${read.details.car?.makeModel ?? 'Car'} insurance`
      : HOME_KINDS.includes(read.kind) && prop ? `${prop.label} ${read.kind === 'buildings' ? 'buildings' : 'home'} insurance`
      : KIND_LABELS[read.kind])
    const renewed = existing && read.renewalDate && existing.renewalDate && read.renewalDate > existing.renewalDate
    const older = !!(existing?.renewalDate && read.renewalDate && read.renewalDate < existing.renewalDate)
    savePolicy({
      itemId: existing?.id, owner, label,
      monthly: updateBudget || !existing ? read.monthly ?? existing?.monthly ?? 0 : undefined,
      provider: read.provider ?? existing?.provider ?? '',
      coverAmount: read.coverAmount, renewalDate: (older ? existing!.renewalDate : read.renewalDate) ?? existing?.renewalDate ?? '',
      autoRenews: read.autoRenews ?? existing?.autoRenews ?? false,
      propertyId: HOME_KINDS.includes(read.kind) ? propertyId || null : null,
      details: {
        ...read.details,
        readFrom: [...(existing?.details.readFrom ?? []).filter(r => !(read.details.readFrom ?? []).some(n => n.name === r.name)), ...(read.details.readFrom ?? [])].slice(-6),
        lastYearAnnual: renewed ? existing!.yearly : existing?.details.lastYearAnnual,
      },
    })
    onSaved(existing
      ? `Policy saved${updateBudget && read.monthly != null && read.monthly !== existing.monthly ? ` · Budget updated to ${fmt2(read.monthly)}/mo` : ''}`
      : `Policy added${read.monthly ? ` · ${fmt2(read.monthly)}/mo on Budget` : ''}`)
    onClose()
  }

  const title = state.step === 'review' ? 'Check what we found' : 'Add from documents'
  return (
    <Sheet title={title} onClose={() => { abort.current?.abort(); onClose() }}>
      {state.step === 'choose' && (
        keyLoading ? <p className="text-body text-muted">Checking…</p>
        : !user || !hasKey ? (
          <div className="py-2">
            <p className="text-[15px] text-ink mt-0">Reading documents uses your Anthropic API key. {user ? 'Add one in Settings.' : 'Sign in, then add one in Settings.'}</p>
            <p className="text-label text-muted">You can still add a policy by hand.</p>
            {onOpenSettings && <button onClick={() => { onClose(); onOpenSettings() }} className="w-full mt-2 bg-ink text-on-ink rounded-xl min-h-[52px] text-[16px] font-semibold cursor-pointer">Open Settings</button>}
          </div>
        ) : (
          <>
            <p className="text-[15px] text-muted mt-1 mb-3">Upload your policy schedule, renewal letter or certificate. Budge reads it and fills in the policy for you to check.</p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-line-2 bg-panel min-h-[150px] px-4 py-5 text-center cursor-pointer">
              <FileUp size={28} className="text-ink-2" aria-hidden="true" />
              <span className="text-[16px] font-semibold text-ink">Choose PDFs or photos</span>
              <span className="text-label text-muted">Up to 6 files · PDF, JPG or PNG</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
            <label className="mt-2 flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-fill text-[15px] font-medium cursor-pointer">
              <Camera size={18} aria-hidden="true" /> Take a photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
            {files.length > 0 && (
              <ul className="mt-3 mb-0 p-0 list-none">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 min-h-[44px] border-t border-line text-[15px]">
                    <FileText size={16} className="text-muted shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate">{f.name}</span>
                    <button onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="w-[44px] h-[44px] -mr-3 grid place-items-center text-muted cursor-pointer"><X size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
            {tooBig && <p className="text-label text-neg mt-2 mb-0">These are too large to send together. Remove a file, or photograph just the schedule pages.</p>}
            <p className="text-caption text-muted mt-3 mb-0 leading-snug">
              About 2–5p on your API key. Sent to Anthropic with your API key, read once, not stored. Only the details you confirm are saved.
            </p>
            <button onClick={run} disabled={files.length === 0 || tooBig} className="w-full mt-3 bg-ink text-on-ink rounded-xl min-h-[52px] text-[16px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default">
              Read {files.length > 1 ? `${files.length} documents` : 'document'}
            </button>
          </>
        )
      )}

      {state.step === 'reading' && (
        <div className="py-6 text-center" role="status" aria-live="polite">
          <Loader2 size={28} className="mx-auto text-ink-2 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-[17px] font-semibold text-ink mt-3 mb-1">Reading your documents</p>
          <p className="text-label text-muted m-0">
            {state.done < state.total ? `Preparing ${files[state.done]?.name ?? ''} · ${state.done + 1} of ${state.total}` : `Reading ${state.total > 1 ? `${state.total} documents` : files[0]?.name}…`}
          </p>
          <p className="text-caption text-muted mt-3">Keep this open. Usually under a minute.</p>
          <button onClick={() => abort.current?.abort()} className="mt-2 min-h-[44px] px-5 rounded-xl bg-fill text-[15px] cursor-pointer">Cancel</button>
        </div>
      )}

      {state.step === 'error' && (
        <div className="py-3">
          <div className="flex items-start gap-2.5 rounded-xl bg-neg-tint p-3.5">
            <AlertTriangle size={18} className="text-neg shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[15px] text-ink m-0">{state.message}</p>
          </div>
          {state.costUsd != null && state.costUsd > 0 && <p className="text-caption text-muted mt-2">That attempt cost about {Math.max(1, Math.round(state.costUsd * USD_TO_GBP * 100))}p.</p>}
          {state.settings && onOpenSettings
            ? <button onClick={() => { onClose(); onOpenSettings() }} className="w-full mt-3 bg-ink text-on-ink rounded-xl min-h-[52px] text-[16px] font-semibold cursor-pointer">Open Settings</button>
            : <button onClick={() => setState({ step: 'choose' })} className="w-full mt-3 bg-ink text-on-ink rounded-xl min-h-[52px] text-[16px] font-semibold cursor-pointer">Try again</button>}
        </div>
      )}

      {state.step === 'review' && (() => {
        const { result, read } = state
        const existing = policies.find(p => p.id === target) ?? null
        const sameKind = policies.filter(p => p.kind === read.kind || (HOME_KINDS.includes(p.kind) && HOME_KINDS.includes(read.kind)))
        const options = sameKind.length ? sameKind : policies
        const edited = readToPolicy({ ...result, fields: result.fields.map(f => ({ ...f, value: values[f.key] ?? f.value })) }, [])
        const newMonthly = edited.monthly
        const yearly = edited.details.paysMonthly && newMonthly != null ? newMonthly * 12 : edited.details.premiumAnnual ?? (newMonthly != null ? newMonthly * 12 : undefined)
        const lastYear = existing?.yearly
        const clearsLapse = existing?.status === 'lapsed' && edited.renewalDate && new Date(edited.renewalDate).getTime() > Date.now()
        const problems = result.fields.filter(f => fieldProblem(f.key, values[f.key] ?? ''))
        const olderDoc = existing?.renewalDate && edited.renewalDate && edited.renewalDate < existing.renewalDate
        const isHome = HOME_KINDS.includes(read.kind)
        const exC = parseFloat(values.excessCompulsory ?? ''), exV = parseFloat(values.excessVoluntary ?? '')
        const missing = (EXPECTED[read.kind] ?? []).filter(k => !result.fields.some(f => f.key === k))
        const tile: TileKind = read.kind === 'car' ? 'car' : isHome ? (props.findIndex(p => p.id === propertyId) > 0 ? 'cottage' : 'home') : PEOPLE_KINDS.includes(read.kind) ? 'people' : 'other'
        const shown = result.fields.filter(f => f.key !== 'postcode' && f.key !== 'address')
        return (
          <>
            <p className="text-[15px] text-muted mt-0 mb-3">{result.fields.length} details from {files.length > 1 ? `${files.length} documents` : 'your document'}. Tap any to change it.</p>
            <section className="panel p-4">
              <div className="flex items-center gap-3">
                <Tile kind={tile} status="covered" />
                <div className="flex-1 min-w-0">
                  <div className="text-[17px] font-semibold text-ink">{existing?.label ?? (read.kind === 'car' ? (edited.details.car?.makeModel ?? 'Car') : KIND_LABELS[read.kind])}</div>
                  <div className="text-label text-muted flex items-center gap-2 flex-wrap">
                    {matchReason ?? (existing ? 'Updating this policy' : 'A new policy')}
                    {edited.details.car?.reg && <Plate reg={edited.details.car.reg} />}
                  </div>
                </div>
              </div>
              {newMonthly != null && (
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 mt-3">
                  <div>
                    <div className="text-label text-muted">{existing ? 'New price' : 'Price'}</div>
                    <div className="figure text-[34px] leading-none font-bold tracking-[-0.02em] mt-1 num whitespace-nowrap">
                      <span className="cur">£</span>{newMonthly.toFixed(2)}<span className="text-[15px] font-medium text-muted tracking-normal ml-1.5">a month</span>
                    </div>
                  </div>
                  {lastYear != null && yearly != null && Math.abs(yearly - lastYear) >= 1 && (
                    <div className="text-caption text-muted text-right">
                      <span className={`font-semibold num ${yearly < lastYear ? 'text-pos' : 'text-warn'}`}>{yearly < lastYear ? '↓' : '↑'} {fmt(Math.abs(yearly - lastYear))}</span><br />{yearly < lastYear ? 'less' : 'more'} a year than before
                    </div>
                  )}
                </div>
              )}
              {olderDoc && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-warn-tint px-3 py-2.5 text-label text-warn font-medium">
                  <AlertTriangle size={16} className="shrink-0 mt-px" aria-hidden="true" />
                  <span>These documents end on {fmtDate(edited.renewalDate!)}, before the saved renewal date. Budge will keep {fmtDate(existing!.renewalDate!)}.</span>
                </div>
              )}
              {clearsLapse && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-pos-tint px-3 py-2.5 text-label text-pos font-medium">
                  <ShieldCheck size={16} aria-hidden="true" /> Saving this clears the lapsed warning.
                </div>
              )}
            </section>

            <div className="mt-3 py-3 border-t border-line grid grid-cols-1 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-caption text-muted uppercase tracking-label">Save as</span>
                <select value={target} onChange={e => { setTarget(e.target.value); setMatchReason(null) }} aria-label="Save as" className={`${inputClass} w-full`}>
                  <option value="">A new policy</option>
                  {options.map(p => {
                    const home = props.find(x => x.id === p.propertyId)?.label
                    const where = home && !p.label.includes(home) ? ` · ${home}` : ''
                    return <option key={p.id} value={p.id}>Update {p.label}{where}{p.provider ? ` (${p.provider})` : ''}</option>
                  })}
                </select>
              </label>
              {isHome && (
                <div className="flex flex-col gap-1">
                  <span className="text-caption text-muted uppercase tracking-label">Home</span>
                  <HomePicker value={propertyId} onChange={setPropertyId} budget={budget} owner={owner} suggestion={townFrom(values.address ?? read.address)} />
                </div>
              )}
              {!existing && (
                <div>
                  <div className="text-caption text-muted uppercase tracking-label mb-1">Who pays</div>
                  <div className="seg" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }} role="group" aria-label="Who pays">
                    {(['JOINT', 'NIAMH', 'RUPERT'] as const).map(o => (
                      <button key={o} aria-pressed={owner === o} onClick={() => setOwner(o)}><OwnerDot owner={o} label={ownerName(o)} /><span className="lbl">{ownerName(o)}</span></button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="section-label text-caption mt-2 mb-1">What we found</div>
            {shown.map(f => (
              <ReviewField key={f.key} f={f} value={values[f.key] ?? ''} problem={fieldProblem(f.key, values[f.key] ?? '')} onChange={v => setValues(x => ({ ...x, [f.key]: v }))} />
            ))}
            {(Number.isFinite(exC) || Number.isFinite(exV)) && (
              <div className="flex items-center gap-3 py-2.5 border-t border-line min-h-[60px]">
                <span className="w-[18px] shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-caption text-muted">Total excess</span>
                  <span className="block text-[16px] font-medium text-ink num">
                    {Number.isFinite(exC) ? `Compulsory £${exC}` : ''}{Number.isFinite(exC) && Number.isFinite(exV) ? ` + voluntary £${exV} = £${exC + exV}` : Number.isFinite(exV) ? `Voluntary £${exV}` : ''}
                  </span>
                </span>
              </div>
            )}
            {missing.map(k => (
              <div key={k} className="flex items-center gap-3 py-2.5 border-t border-line min-h-[56px]">
                <CircleDashed size={18} className="text-faint shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-caption text-muted">{FIELD_LABELS[k]}</span>
                  <span className="block text-[15px] text-muted">Not in these documents</span>
                </span>
              </div>
            ))}
            {result.notes.length > 0 && (
              <div className="mt-2 rounded-xl bg-fill p-3 text-label text-ink-2">{result.notes.map((n, i) => <p key={i} className="m-0">{n}</p>)}</div>
            )}

            {newMonthly != null && (
              <SheetRow
                label={existing ? `Update ${existing.label} on Budget` : 'Add to Budget'}
                hint={existing ? <span className="num">{fmt2(existing.monthly)} → {fmt2(newMonthly)}/mo</span> : <span className="num">{fmt2(newMonthly)}/mo as a bill</span>}
              >
                {existing ? <Toggle checked={updateBudget} onChange={setUpdateBudget} label="Update the budget" /> : <span />}
              </SheetRow>
            )}
            <p className="text-caption text-muted mt-1 mb-0">Read for about {Math.max(1, Math.round(state.costUsd * USD_TO_GBP * 100))}p. Nothing is saved until you do.</p>
            {problems.length > 0 && <p className="text-label text-neg text-center mt-3 mb-0">Fix {problems.length === 1 ? 'the highlighted detail' : `${problems.length} highlighted details`} to save.</p>}
            <button onClick={save} disabled={problems.length > 0 || (isHome && !propertyId)} className="w-full mt-3 bg-ink text-on-ink rounded-xl min-h-[52px] text-[16px] font-semibold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-default">
              <Check size={18} aria-hidden="true" /> Save policy
            </button>
            {isHome && !propertyId && <p className="text-caption text-muted text-center mt-1.5 mb-0">Choose or add the home it&apos;s for first.</p>}
          </>
        )
      })()}
    </Sheet>
  )
}

// ─── the screen ───────────────────────────────────────────────────────────────

export default function InsuranceScreen({ budget, backLabel, onBack, focusPolicyId, onFocusHandled, onToast, onOpenSettings }: {
  budget: BudgetHook; backLabel: string; onBack: () => void
  focusPolicyId?: string | null; onFocusHandled?: () => void; onToast?: (msg: string) => void; onOpenSettings?: () => void
}) {
  const { data } = budget
  const [sheet, setSheet] = useState<SheetMode | null>(null)
  const [upload, setUpload] = useState<{ targetId: string | null } | null>(null)
  const policies = insurancePolicies(data)
  const gaps = insuranceGaps(data, policies)
  const props = data.properties ?? []
  const ownerName = (o: Owner) => o === 'NIAMH' ? data.nameNiamh || 'Person 1' : o === 'RUPERT' ? data.nameRupert || 'Person 2' : data.nameJoint || 'Joint'

  useEffect(() => {
    // "__upload" opens the document upload straight away.
    if (focusPolicyId === '__upload') setUpload({ targetId: null })
    else if (focusPolicyId && policies.some(p => p.id === focusPolicyId)) setSheet({ type: 'edit', id: focusPolicyId })
    if (focusPolicyId) onFocusHandled?.()
  }, [focusPolicyId]) // eslint-disable-line

  const yearly = policies.reduce((a, p) => a + p.yearly, 0)
  const monthly = policies.reduce((a, p) => a + p.monthly, 0)
  const next = policies.filter(p => p.days != null && p.days >= 0).sort((a, b) => a.days! - b.days!)[0]
  const lapsed = policies.filter(p => p.status === 'lapsed')
  const counts = {
    covered: policies.filter(p => p.status === 'covered').length,
    undated: policies.filter(p => p.status === 'undated').length,
    soon: policies.filter(p => p.status === 'soon').length,
    lapsed: lapsed.length,
    gap: gaps.filter(g => g.severity === 'gap').length,
  }
  const by = (key: string) => policies.filter(p => assetOf(p) === key)
  const gapsFor = (key: string) => gaps.filter(g => g.asset === key)
  const cars = policies.filter(p => p.kind === 'car')
  const people = by('people')
  const other = by('other')
  const unlinkedHomes = by('homes')
  const addForGap = (g: InsuranceGap) => {
    if (g.id.startsWith('link:') && unlinkedHomes[0]) { setSheet({ type: 'edit', id: unlinkedHomes[0].id }); return }
    if (g.severity === 'check') {
      const pol = policies.find(p => g.id.endsWith(p.id) || g.id.endsWith(p.propertyId ?? '#'))
      if (pol) { setSheet({ type: 'edit', id: pol.id }); return }
    }
    if (g.id.startsWith('buildings:') || g.id === 'contents') setSheet({ type: 'new', kind: g.id === 'contents' ? 'contents' : 'buildings', propertyId: g.asset.split(':')[1] })
    else if (g.id === 'life') setSheet({ type: 'new', kind: 'life' })
    else if (g.id === 'income') setSheet({ type: 'new', kind: 'income' })
    else if (g.id === 'car') setSheet({ type: 'new', kind: 'car' })
    else setUpload({ targetId: null })
  }
  /** What a policy is for, in a couple of words: the home, the car, or its name. */
  const assetName = (p: Policy) => props.find(x => x.id === p.propertyId)?.label ?? p.details.car?.makeModel ?? p.label.replace(/ insurance$/i, '')
  const peopleTitle = (p: Policy) => p.details.life?.livesCovered || (p.owner === 'JOINT' ? `${ownerName('NIAMH')} & ${ownerName('RUPERT')}` : ownerName(p.owner))
  const segColor: Record<PolicyStatus, string> = { covered: 'var(--pos)', undated: 'var(--faint)', soon: 'var(--warn)', lapsed: 'var(--neg)' }

  return (
    <div className="h-full overflow-y-auto px-5 pt-1 pb-[calc(32px+env(safe-area-inset-bottom))]">
      {sheet && <PolicySheet key={JSON.stringify(sheet)} mode={sheet} budget={budget} onClose={() => setSheet(null)} onUpload={id => { setSheet(null); setUpload({ targetId: id }) }} ownerName={ownerName} />}
      {upload && <UploadSheet budget={budget} targetId={upload.targetId} onClose={() => setUpload(null)} onSaved={m => onToast?.(m)} ownerName={ownerName} onOpenSettings={onOpenSettings} />}

      <button onClick={onBack} aria-label={`Back to ${backLabel}`} className="flex items-center gap-1 min-h-[44px] -ml-1.5 text-[15px] text-ink-2 cursor-pointer"><ChevronLeft size={18} aria-hidden="true" /> {backLabel}</button>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] leading-[36px] font-semibold tracking-[-0.02em] m-0">Insurance</h1>
        <button onClick={() => setSheet({ type: 'new' })} className="flex items-center gap-1.5 min-h-[44px] px-2 -mr-2 text-[15px] font-semibold text-ink cursor-pointer"><Plus size={18} aria-hidden="true" /> Add</button>
      </div>

      {lapsed.map(p => (
        <section key={p.id} className="mt-3 rounded-[18px] bg-neg-tint overflow-hidden" aria-label={`${p.label} has lapsed`}>
          <div className="flex items-start gap-3 px-4 py-3">
            <AlertTriangle size={20} className="text-neg shrink-0 mt-0.5" aria-hidden="true" />
            <p className="m-0 text-[15px] text-ink">
              <b>{p.provider ?? p.label}</b> cover ended {-(p.days ?? 0)} {p.days === -1 ? 'day' : 'days'} ago.{' '}
              {p.kind === 'car' ? 'If it hasn’t been renewed, the car can’t legally be driven.' : 'If it’s been renewed, update the date.'}
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-[color-mix(in_srgb,var(--neg)_18%,transparent)]">
            <button onClick={() => setSheet({ type: 'renew', id: p.id })} className="min-h-[48px] text-[15px] font-semibold text-ink cursor-pointer flex items-center justify-center gap-1.5"><Check size={16} aria-hidden="true" /> Mark renewed</button>
            <button onClick={() => setUpload({ targetId: p.id })} className="min-h-[48px] text-[15px] font-semibold text-ink cursor-pointer flex items-center justify-center gap-1.5 border-l border-[color-mix(in_srgb,var(--neg)_18%,transparent)]"><FileUp size={16} aria-hidden="true" /> Upload renewal</button>
          </div>
        </section>
      ))}

      <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-8 lg:items-start">
        <div className="lg:sticky lg:top-0">
          <section className="panel hero p-5 mt-3.5" aria-label="Insurance this year">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label font-medium text-muted">Insurance this year</span>
              <span className="pill">{policies.length} {policies.length === 1 ? 'policy' : 'policies'}</span>
            </div>
            <div className="figure mt-2 flex items-baseline gap-2 text-[44px] leading-none font-bold tracking-[-0.02em] text-ink num">
              <span><span className="cur">£</span>{Math.round(yearly).toLocaleString('en-GB')}</span><span className="text-[17px] font-medium tracking-normal text-muted">a year</span>
            </div>
            <p className="text-label text-muted mt-2 mb-0 num [text-wrap:pretty]">{fmt(monthly)} a month{next ? ` · next renewal ${assetName(next)}, ${fmtDay(next.renewalDate!)}` : ''}</p>
            {(policies.length > 0 || counts.gap > 0) && (
              <>
                <div className="flex gap-[3px] mt-4 h-1.5" aria-hidden="true">
                  {policies.map(p => <span key={p.id} className="flex-1 rounded-full" style={{ background: segColor[p.status] }} />)}
                  {Array.from({ length: counts.gap }).map((_, i) => <span key={i} className="flex-1 rounded-full border border-dashed border-line-2" />)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-caption text-muted">
                  {counts.covered > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-pos" />{counts.covered} covered</span>}
                  {counts.soon > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warn" />{counts.soon} renews soon</span>}
                  {counts.lapsed > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neg" />{counts.lapsed} lapsed</span>}
                  {counts.undated > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-faint" />{counts.undated} no date</span>}
                  {counts.gap > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-line-2" />{counts.gap} not covered</span>}
                </div>
              </>
            )}
          </section>

          <button onClick={() => setUpload({ targetId: null })} className="w-full mt-3 flex items-center gap-3 rounded-[18px] border-2 border-dashed border-line-2 px-4 py-3.5 text-left cursor-pointer min-h-[64px]">
            <span className="w-10 h-10 rounded-xl bg-fill grid place-items-center shrink-0"><FileUp size={20} className="text-ink-2" aria-hidden="true" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold text-ink">Add from documents</span>
              <span className="block text-label text-muted">Upload a schedule or renewal letter. Budge fills it in.</span>
            </span>
            <ChevronRight size={18} className="text-faint shrink-0" aria-hidden="true" />
          </button>
          {policies.length === 0 && (
            <p className="text-label text-muted mt-3">Keep every policy in one place: both homes, the car and life cover. Upload a document, or tap Add to enter one by hand.</p>
          )}
        </div>

        <div className="min-w-0">
          {(props.length > 0 || unlinkedHomes.length > 0) && (
            <>
              <h2 className="flex items-baseline justify-between text-[22px] font-semibold tracking-[-0.01em] mt-7 mb-2.5">Homes</h2>
              <div className="flex flex-col gap-3">
                {[...props].sort((a, b) => Number(!!b.isMainResidence) - Number(!!a.isMainResidence)).map((prop, i) => (
                  <AssetCard
                    key={prop.id} tile={prop.isMainResidence || (i === 0 && !props.some(p => p.isMainResidence)) ? 'home' : 'cottage'} title={prop.label}
                    titleExtra={<OwnerDot owner={prop.owner} label={ownerName(prop.owner)} />}
                    sub={!prop.isMainResidence && props.length > 1 && !prop.isLet ? 'Second home' : prop.isLet ? 'Let' : prop.isMainResidence ? 'Main home' : undefined}
                    subAction={!prop.isMainResidence && !prop.isLet && props.length > 1 ? (
                      <button
                        onClick={() => { budget.updateProperty(prop.id, { isMainResidence: true }); onToast?.(`${prop.label} is now your main home`) }}
                        className="hit-44 font-semibold text-ink underline underline-offset-2 cursor-pointer"
                      >Make main home</button>
                    ) : undefined}
                    policies={by(`property:${prop.id}`)} gaps={gapsFor(`property:${prop.id}`)}
                    onOpen={p => setSheet({ type: 'edit', id: p.id })} onAddGap={addForGap} ownerName={ownerName}
                  />
                ))}
                {unlinkedHomes.length > 0 && (
                  <AssetCard tile="home" title={props.length > 0 ? 'Not linked to a home' : 'Home insurance'} sub={props.length > 0 ? 'Open a policy and choose its home' : 'Add your homes on Wealth to link them'} policies={unlinkedHomes} gaps={[]} onOpen={p => setSheet({ type: 'edit', id: p.id })} onAddGap={addForGap} ownerName={ownerName} />
                )}
              </div>
            </>
          )}

          {(cars.length > 0 || gaps.some(g => g.id === 'car')) && (
            <>
              <h2 className="text-[22px] font-semibold tracking-[-0.01em] mt-7 mb-2.5">Car</h2>
              <div className="flex flex-col gap-3">
                {cars.map(p => (
                  <AssetCard
                    key={p.id} tile="car" title={p.details.car?.makeModel || p.label}
                    titleExtra={p.details.car?.reg ? <Plate reg={p.details.car.reg} /> : undefined}
                    policies={[p]} gaps={gapsFor(`car:${p.id}`)} onOpen={x => setSheet({ type: 'edit', id: x.id })} onAddGap={addForGap} ownerName={ownerName}
                  />
                ))}
                {gaps.filter(g => g.id === 'car').map(g => (
                  <AssetCard key={g.id} tile="car" title={g.title} policies={[]} gaps={[g]} gapBodyOnly onOpen={() => {}} onAddGap={addForGap} ownerName={ownerName} />
                ))}
              </div>
            </>
          )}

          <h2 className="text-[22px] font-semibold tracking-[-0.01em] mt-7 mb-2.5">People</h2>
          <div className="flex flex-col gap-3">
            {people.map(p => (
              <AssetCard key={p.id} tile="people" title={peopleTitle(p)} policies={[p]} gaps={[]} onOpen={x => setSheet({ type: 'edit', id: x.id })} onAddGap={addForGap} ownerName={ownerName} />
            ))}
            {gapsFor('people').map(g => (
              <AssetCard key={g.id} tile="people" title={g.title} policies={[]} gaps={[g]} gapBodyOnly onOpen={() => {}} onAddGap={addForGap} ownerName={ownerName} />
            ))}
          </div>

          {other.length > 0 && (
            <>
              <h2 className="text-[22px] font-semibold tracking-[-0.01em] mt-7 mb-2.5">Other</h2>
              <div className="flex flex-col gap-3">
                {other.map(p => (
                  <AssetCard key={p.id} tile="other" title={p.label} policies={[p]} gaps={[]} onOpen={x => setSheet({ type: 'edit', id: x.id })} onAddGap={addForGap} ownerName={ownerName} />
                ))}
              </div>
            </>
          )}

          <p className="text-caption text-muted mt-6 mb-0 leading-snug">
            Prices usually rise at renewal. Budge reminds you 30 days before, so there&apos;s time to compare. These checks are general prompts, not advice.
          </p>
        </div>
      </div>
    </div>
  )
}
