'use client'

import { useMemo, useState } from 'react'
import { Shield, ShieldAlert, Zap, Repeat, TrendingUp, Upload, ChevronRight, Plus, Check, Circle, CheckCircle2 } from 'lucide-react'
import { ItemIcon, IconPicker } from '@/lib/itemIcons'
import { Owner, fmt, upcomingRenewals, isInsuranceItem } from '@/lib/models'
import { insurancePolicies, insuranceGaps } from '@/lib/insurance'
import { subscriptions, subscriptionKind, type Subscription } from '@/lib/subscriptions'
import { OwnerDot, Sheet, MoveSheet, type MoveTo } from './BudgetScreen'
import { RenewalBar } from './ui'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>
type Filter = 'all' | 'insurance' | 'energy' | 'subs'

const day = (d: string, year = true) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })
const daysText = (days: number) => days < 0 ? 'Date passed' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`

/**
 * Everything the household is signed up to: insurance, energy deals,
 * contracts and subscriptions. All of them renew, and all are worth a check
 * before they do.
 */
export default function RenewalsScreen({ budget, onOpenInsurance, onOpenProperty, onUploadInsurance, onToast }: {
  budget: BudgetHook
  onOpenInsurance: (policyId?: string) => void
  onOpenProperty: (propertyId: string) => void
  onUploadInsurance: () => void
  onToast?: (msg: string, action?: { label: string; run: () => void }) => void
}) {
  const { data, updateItemRecurring, updateItemIcon } = budget
  const [filter, setFilter] = useState<Filter>('all')
  const [person, setPerson] = useState<Owner | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  // Select mode: tick several subscriptions and move them to one group.
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [movingSel, setMovingSel] = useState(false)
  const [emptied, setEmptied] = useState<{ key: string; label: string; owner: Owner }[]>([])
  const ownerName = (o: Owner) => o === 'NIAMH' ? data.nameNiamh || 'Person 1' : o === 'RUPERT' ? data.nameRupert || 'Person 2' : data.nameJoint || 'Joint'

  const renewals = useMemo(() => upcomingRenewals(data), [data])
  const subs = useMemo(() => subscriptions(data), [data])
  const editing = subs.find(x => x.id === editingId) ?? null
  const setEditing = (x: Subscription | null) => setEditingId(x?.id ?? null)
  const iconOf = (id: string) => data.categories.flatMap(c => c.items).find(i => i.id === id)?.icon
  const policies = useMemo(() => insurancePolicies(data), [data])
  const gaps = useMemo(() => insuranceGaps(data, policies), [data, policies])
  const subIds = new Set(subs.map(s => s.id))
  const kindOf = (r: typeof renewals[number]): Filter => r.isEnergy ? 'energy' : r.isInsurance ? 'insurance' : subIds.has(r.id) ? 'subs' : 'all'
  const shown = renewals.filter(r => filter === 'all' || kindOf(r) === filter)

  // A month across everything here, counting each bill once.
  const seen = new Set<string>()
  const monthly = [...renewals, ...subs].reduce((a, r) => { if (seen.has(r.id)) return a; seen.add(r.id); return a + (r.amount || 0) }, 0)
  const next = renewals.find(r => r.days >= 0)
  const dueSoon = renewals.filter(r => r.days <= 60).length

  const perPerson = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).map(o => ({ owner: o, total: subs.filter(s => s.owner === o).reduce((a, s) => a + s.amount, 0) })).filter(p => p.total > 0)
  const subsShown = subs.filter(s => !person || s.owner === person)
  const picked = subs.filter(x => selected.has(x.id))
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); setMovingSel(false) }

  const moveSelected = (to: MoveTo, owner: Owner) => {
    const items = data.categories.flatMap(c => c.items.filter(i => selected.has(i.id)).map(i => ({ cat: c, item: i })))
    const key = budget.moveItems(items.map(x => ({ fromKey: x.cat.key, itemId: x.item.id })), to)
    if (!key) return
    const toLabel = 'key' in to ? data.categories.find(c => c.key === to.key)?.label : to.newGroup.trim()
    // Groups that had nothing else in them are offered for deletion.
    const left = Array.from(new Map(items.map(x => [x.cat.key, x.cat])).values())
      .filter(c => c.key !== key && c.items.every(i => selected.has(i.id)))
      .map(c => ({ key: c.key, label: c.label, owner: c.owner }))
    setEmptied(left)
    stopSelecting()
    onToast?.(`Moved ${items.length} to ${toLabel} · ${ownerName(owner)}`, { label: 'Undo', run: () => {
      budget.applyMoves(items.map(x => ({
        fromKey: key, itemId: x.item.id,
        to: { key: x.cat.key, recreate: { label: x.cat.label, owner: x.cat.owner } },
        patch: { sharedContribution: x.item.sharedContribution },
      })))
      setEmptied([])
    } })
  }

  const openRenewal = (r: typeof renewals[number]) => {
    if (r.isEnergy) onOpenProperty(r.id.split(':')[0])
    else if (r.isInsurance) onOpenInsurance(r.id)
    else { const s = subs.find(x => x.id === r.id); if (s) setEditing(s) }
  }
  const tappable = (r: typeof renewals[number]) => r.isEnergy || r.isInsurance || subIds.has(r.id)

  const yearly = policies.reduce((a, p) => a + p.yearly, 0)
  const missing = gaps.filter(g => g.severity === 'gap')
  const checks = gaps.filter(g => g.severity === 'check')

  return (
    <div className="h-full overflow-y-auto px-5 pt-2 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <h1 className="text-[30px] leading-[36px] font-semibold tracking-[-0.02em] m-0">Renewals</h1>
      <p className="text-[15px] text-muted mt-0.5 mb-4">Everything you’re signed up to, soonest first.</p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { k: 'A month', v: fmt(monthly) },
          { k: 'Next due', v: next ? day(next.date, false) : '—' },
          { k: 'Due in 60 days', v: dueSoon === 0 ? 'None' : String(dueSoon), bad: dueSoon > 0 },
        ].map(t => (
          <div key={t.k} className="card px-3 py-2.5 min-w-0">
            <div className="text-caption text-muted truncate">{t.k}</div>
            <div className={`text-[19px] font-semibold tabular-nums mt-0.5 truncate ${t.bad ? 'text-negative' : 'text-ink'}`}>{t.v}</div>
          </div>
        ))}
      </div>

      <div className="seg grid-cols-4 lg:max-w-[560px]" role="group" aria-label="Show">
        {([['all', 'All'], ['insurance', 'Insurance'], ['energy', 'Energy'], ['subs', 'Subs']] as [Filter, string][]).map(([f, l]) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}><span className="lbl">{l}</span></button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div className="min-w-0">
          {filter !== 'subs' || shown.length > 0 ? (
            <>
              <h2 className="text-[20px] font-semibold tracking-[-0.01em] mt-6 mb-2.5">Coming up</h2>
              {shown.length === 0 ? (
                <p className="text-[15px] text-muted m-0">
                  {filter === 'energy' ? 'No fixed energy deals recorded. Add tariffs to your homes on Wealth.' : 'Nothing with a renewal date yet. Add one to any bill on Budget.'}
                </p>
              ) : (
                <div className="card overflow-hidden">
                  {shown.map(r => {
                    const body = (
                      <>
                        <div className="flex items-start gap-3">
                          <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${r.isEnergy ? 'bg-warn-tint text-warn' : r.isInsurance ? 'bg-rupert-light text-rupert-text' : 'bg-fill text-ink-2'}`}>
                            {r.isEnergy ? <Zap size={19} aria-hidden="true" /> : r.isInsurance ? <Shield size={19} aria-hidden="true" /> : <ItemIcon label={r.label} chosen={iconOf(r.id)} fallback={subIds.has(r.id) ? 'repeat' : 'bill'} />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[16px] font-semibold text-ink leading-tight">{r.label}</div>
                            <div className="text-label text-muted mt-0.5">{[r.provider, r.category, day(r.date)].filter(Boolean).join(' · ')}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-[15px] font-semibold tabular-nums ${r.days < 0 || r.days <= 30 ? 'text-negative' : 'text-ink'}`}>{daysText(r.days)}</div>
                            {r.amount > 0 && <div className="text-label text-muted tabular-nums">{fmt(r.amount)}/mo</div>}
                          </div>
                        </div>
                        <div className="pl-[52px]">
                          {r.isEnergy
                            ? <span className="pill pill-warn mt-1.5 whitespace-normal"><TrendingUp size={12} aria-hidden="true" /> Rolls onto a variable rate{r.exitFeeFreeFrom ? ` · no exit fee from ${day(r.exitFeeFreeFrom, false)}` : ''}</span>
                            : r.autoRenews
                              ? <span className="pill mt-1.5 whitespace-normal"><Repeat size={12} aria-hidden="true" /> Auto-renews · check the new price</span>
                              : r.isInsurance && r.days <= 60
                                ? <span className="pill pill-warn mt-1.5 whitespace-normal">Not set to auto-renew · check cover continues</span>
                                : null}
                          <RenewalBar days={r.days} />
                        </div>
                      </>
                    )
                    return tappable(r)
                      ? <button key={r.id} onClick={() => openRenewal(r)} className="block w-full text-left px-4 py-3.5 border-t border-line first:border-t-0 cursor-pointer">{body}</button>
                      : <div key={r.id} className="px-4 py-3.5 border-t border-line first:border-t-0">{body}</div>
                  })}
                </div>
              )}
            </>
          ) : null}

          {(filter === 'all' || filter === 'insurance') && (
            <>
              <h2 className="flex items-baseline justify-between text-[20px] font-semibold tracking-[-0.01em] mt-7 mb-2.5">
                Insurance
                <button onClick={() => onOpenInsurance()} className="text-[15px] font-semibold text-ink-2 underline underline-offset-[3px] min-h-[44px] -my-3 cursor-pointer">Open</button>
              </h2>
              <div className="card overflow-hidden">
                <button onClick={() => onOpenInsurance()} className="w-full text-left flex items-start gap-3 px-4 py-3.5 cursor-pointer">
                  <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-rupert-light text-rupert-text"><Shield size={19} aria-hidden="true" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[16px] font-semibold text-ink">
                      {policies.length > 0 ? `${policies.length} ${policies.length === 1 ? 'policy' : 'policies'} · ${fmt(yearly)} a year` : 'No policies recorded yet'}
                    </span>
                    <span className="flex flex-wrap gap-1.5 mt-1.5">
                      {missing.slice(0, 2).map(g => <span key={g.id} className="pill pill-bad whitespace-normal"><ShieldAlert size={12} aria-hidden="true" /> {g.title}</span>)}
                      {checks.length > 0 && <span className="pill">Worth a look: {checks.length}</span>}
                      {missing.length === 0 && checks.length === 0 && policies.length > 0 && <span className="pill pill-good"><Check size={12} aria-hidden="true" /> Nothing missing</span>}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-faint shrink-0 mt-2.5" aria-hidden="true" />
                </button>
                <button onClick={onUploadInsurance} className="w-full flex items-center gap-2.5 px-4 min-h-[52px] border-t border-line text-[15px] font-semibold text-ink cursor-pointer">
                  <Upload size={18} aria-hidden="true" /> Add from documents
                  <ChevronRight size={18} className="text-faint ml-auto" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="min-w-0">
          {(filter === 'all' || filter === 'subs') && (
            <>
              <h2 className="flex items-baseline justify-between text-[20px] font-semibold tracking-[-0.01em] mt-7 mb-2.5">
                Subscriptions & contracts
                {subs.length > 1 && (
                  <button onClick={() => selecting ? stopSelecting() : setSelecting(true)} className="text-[15px] font-semibold text-ink-2 underline underline-offset-[3px] min-h-[44px] -my-3 cursor-pointer">
                    {selecting ? 'Cancel' : 'Select'}
                  </button>
                )}
              </h2>
              {emptied.filter(e => data.categories.some(c => c.key === e.key && c.items.length === 0)).map(e => (
                <div key={e.key} className="flex items-center gap-3 mb-2 px-3 py-2 rounded-xl bg-fill">
                  <span className="flex-1 min-w-0 text-label text-ink-2">{e.label} · {ownerName(e.owner)} is now empty.</span>
                  <button onClick={() => { budget.deleteCategory(e.key); setEmptied(x => x.filter(y => y.key !== e.key)) }} className="shrink-0 min-h-[40px] text-[14px] font-semibold text-ink underline underline-offset-2 cursor-pointer">Delete group</button>
                </div>
              ))}
              {perPerson.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Show subscriptions for">
                  <button onClick={() => setPerson(null)} aria-pressed={!person}
                    className={`min-h-[40px] px-3 rounded-full text-[14px] font-medium cursor-pointer border ${!person ? 'bg-ink text-on-ink border-ink' : 'bg-panel text-ink-2 border-line-2'}`}>
                    All {fmt(perPerson.reduce((a, p) => a + p.total, 0))}
                  </button>
                  {perPerson.map(p => (
                    <button key={p.owner} onClick={() => setPerson(person === p.owner ? null : p.owner)} aria-pressed={person === p.owner}
                      className={`flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-[14px] font-medium cursor-pointer border ${person === p.owner ? 'bg-ink text-on-ink border-ink' : 'bg-panel text-ink-2 border-line-2'}`}>
                      <OwnerDot owner={p.owner} label={ownerName(p.owner)} /> {ownerName(p.owner)} {fmt(p.total)}
                    </button>
                  ))}
                </div>
              )}
              <div className="card overflow-hidden">
                {subsShown.length === 0 && (
                  <p className="text-[15px] text-muted m-0 px-4 py-3.5">
                    {subs.length === 0 ? 'None found in your bills yet. Mark any bill as a subscription below.' : `Nothing for ${ownerName(person!)}.`}
                  </p>
                )}
                {subsShown.map(s => {
                  const days = s.renewalDate ? renewals.find(r => r.id === s.id)?.days ?? null : null
                  return (
                    <button
                      key={s.id} onClick={() => selecting ? toggle(s.id) : setEditing(s)}
                      aria-pressed={selecting ? selected.has(s.id) : undefined}
                      className={`block w-full text-left px-4 py-3.5 border-t border-line first:border-t-0 cursor-pointer ${selecting && selected.has(s.id) ? 'bg-fill' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {selecting && (selected.has(s.id)
                          ? <CheckCircle2 size={22} className="text-ink shrink-0 mt-2" aria-hidden="true" />
                          : <Circle size={22} className="text-faint shrink-0 mt-2" aria-hidden="true" />)}
                        <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${s.kind === 'contract' ? 'bg-pos-tint text-pos' : 'bg-fill text-ink-2'}`}>
                          <ItemIcon label={s.label} chosen={s.icon} fallback={s.kind === 'contract' ? 'contract' : 'repeat'} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[16px] font-semibold text-ink leading-tight"><span className="truncate">{s.label}</span> <OwnerDot owner={s.owner} label={ownerName(s.owner)} /></div>
                          <div className="text-label text-muted mt-0.5">
                            {ownerName(s.owner)} · {s.kind === 'contract' ? (s.renewalDate ? `contract ends ${day(s.renewalDate)}` : 'contract · add its end date on Budget') : s.renewalDate ? `renews ${day(s.renewalDate)}` : 'rolling monthly'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[15px] font-semibold tabular-nums">{fmt(s.amount)}</div>
                          <div className="text-label text-muted">a month</div>
                        </div>
                      </div>
                      {days != null && <div className="pl-[52px]"><RenewalBar days={days} /></div>}
                    </button>
                  )
                })}
                {!selecting && (
                  <button onClick={() => setMarking(true)} className="w-full flex items-center gap-2.5 px-4 min-h-[52px] border-t border-line text-[15px] font-semibold text-ink cursor-pointer">
                    <Plus size={18} aria-hidden="true" /> Mark a bill as a subscription
                    <ChevronRight size={18} className="text-faint ml-auto" aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="text-caption text-muted mt-2 mb-0">{selecting ? 'Tap the ones to move together, then Move to…' : 'Found by name in your bills on Budget. Tap one to change what it is, or Select to move several into one group.'}</p>
            </>
          )}
        </div>
      </div>

      {selecting && (
        <div className="sticky bottom-0 -mx-5 mt-4 px-5 pt-3 pb-3 bg-bg border-t border-line flex items-center gap-3" role="region" aria-label="Selection">
          <span className="flex-1 min-w-0 text-[15px] text-ink" aria-live="polite">
            {picked.length === 0 ? 'Select subscriptions' : `${picked.length} selected · ${fmt(picked.reduce((a, x) => a + x.amount, 0))} a month`}
          </span>
          <button onClick={() => setSelected(new Set(picked.length === subsShown.length ? [] : subsShown.map(x => x.id)))} className="shrink-0 min-h-[44px] px-2 text-[15px] font-semibold text-ink-2 underline underline-offset-2 cursor-pointer">
            {picked.length === subsShown.length ? 'None' : 'All'}
          </button>
          <button onClick={() => setMovingSel(true)} disabled={picked.length === 0} className="shrink-0 min-h-[44px] px-4 rounded-xl bg-ink text-on-ink text-[15px] font-semibold cursor-pointer disabled:opacity-40">Move to…</button>
        </div>
      )}

      {movingSel && picked.length > 0 && (
        <MoveSheet
          type="EXPENSE" title={`Move ${picked.length} ${picked.length === 1 ? 'subscription' : 'subscriptions'}`}
          current={picked.map(x => ({ catKey: x.catKey, owner: x.owner }))}
          budget={budget} ownerName={ownerName} onMove={moveSelected} onClose={() => setMovingSel(false)}
        />
      )}

      {editing && (
        <Sheet title={editing.label} onClose={() => setEditing(null)}>
          <p className="text-[15px] text-ink-2 mt-0 mb-3">{ownerName(editing.owner)} · {fmt(editing.amount)} a month. Change the price or renewal date on Budget.</p>
          <div className="text-caption text-muted uppercase tracking-label mb-2">Icon</div>
          <div className="mb-4"><IconPicker label={editing.label} value={editing.icon} onChange={k => updateItemIcon(editing.catKey, editing.id, k)} /></div>
          <div className="text-caption text-muted uppercase tracking-label mb-1">What it is</div>
          {([
            ['subscription', 'Subscription', 'Rolls on monthly or yearly, cancel any time'],
            ['contract', 'Contract', 'Runs for a fixed term, e.g. a phone or broadband deal'],
            ['none', 'Not a subscription', 'Leave it off this list'],
          ] as const).map(([v, l, hint]) => {
            const on = v === 'none' ? false : editing.kind === v
            return (
              <button key={v} onClick={() => { updateItemRecurring(editing.catKey, editing.id, v); setEditing(null) }}
                className="w-full flex items-center gap-3 text-left py-3 border-t border-line min-h-[56px] cursor-pointer">
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] text-ink font-medium">{l}</span>
                  <span className="block text-label text-muted">{hint}</span>
                </span>
                {on && <Check size={18} className="text-ink shrink-0" aria-hidden="true" />}
              </button>
            )
          })}
        </Sheet>
      )}

      {marking && (
        <Sheet title="Mark a bill as a subscription" onClose={() => setMarking(false)}>
          {(() => {
            const bills = data.categories.filter(c => c.type === 'EXPENSE').flatMap(c => c.items
              .filter(i => !isInsuranceItem(i.label) && !subscriptionKind(i.label, c.label, i.recurring))
              .map(i => ({ ...i, catKey: c.key, owner: c.owner, cat: c.label })))
            if (bills.length === 0) return <p className="text-[15px] text-muted">Every bill is already listed.</p>
            return bills.map(b => (
              <button key={b.id} onClick={() => { updateItemRecurring(b.catKey, b.id, 'subscription'); setMarking(false) }}
                className="w-full flex items-center gap-3 text-left py-3 border-t border-line min-h-[52px] cursor-pointer">
                <OwnerDot owner={b.owner} label={ownerName(b.owner)} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] text-ink truncate">{b.label}</span>
                  <span className="block text-label text-muted truncate">{b.cat}</span>
                </span>
                <span className="text-[15px] tabular-nums text-ink-2 shrink-0">{fmt(b.amount)}</span>
              </button>
            ))
          })()}
        </Sheet>
      )}
    </div>
  )
}
