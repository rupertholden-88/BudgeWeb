'use client'

import { useState } from 'react'
import { Owner, Fuel, EnergyTariff, fmt, propertySummaries, tariffAnnualCost, exitFeeFreeFrom, daysUntil, ENERGY_VAT } from '@/lib/models'
import { Plus, Home, Zap, Flame } from 'lucide-react'
import { AmountCell, ConfirmDelete, ExpandButton, PanelSection, DeleteAction, Field, TapToEdit, inputClass, ownerBorderClass } from './ui'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>
type Summary = ReturnType<typeof propertySummaries>[number]

function numberInput(value: number | undefined, onChange: (v: number | undefined) => void, placeholder = '0', width = 'w-[120px]') {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={e => onChange(parseFloat(e.target.value) || undefined)}
      className={`${inputClass} ${width}`}
    />
  )
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtP = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function FuelTariff({ fuel, tariff, onChange }: { fuel: Fuel; tariff: EnergyTariff | undefined; onChange: (f: Partial<EnergyTariff>) => void }) {
  const t = tariff ?? {}
  const annual = tariffAnnualCost(t)
  const [editing, setEditing] = useState(false)
  const [twoRate, setTwoRate] = useState(t.nightRateP != null || t.nightUsageKwh != null)
  const Icon = fuel === 'gas' ? Flame : Zap
  const title = fuel === 'gas' ? 'Gas' : 'Electricity'
  const days = t.fixedUntil ? daysUntil(t.fixedUntil) : null
  const freeFrom = exitFeeFreeFrom(t)
  const freeNow = freeFrom != null && daysUntil(freeFrom) <= 0

  return (
    <div className="py-2 border-t border-border first:border-t-0">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-muted shrink-0" />
        <span className="text-sm font-semibold flex-1">{title}</span>
        {annual != null && (
          <span className="text-sm font-bold tabular-nums">{fmt(annual / 12)}<span className="text-caption text-muted font-normal">/mo</span></span>
        )}
        <button onClick={() => setEditing(e => !e)} className="text-xs text-muted bg-transparent border-0 cursor-pointer underline min-h-[36px] px-1">
          {editing ? 'Done' : annual == null ? 'Add' : 'Edit'}
        </button>
      </div>
      {annual == null && !editing && <div className="text-caption text-muted">Not added</div>}
      {annual != null && (
        <div className="text-caption text-muted leading-snug">
          {[t.supplier, t.name].filter(Boolean).join(' · ')}
          {(t.supplier || t.name) && <br />}
          {fmt(annual)}/yr inc. VAT
          {t.fixed && t.fixedUntil ? ` · fixed until ${fmtDate(t.fixedUntil)}` : t.fixed === false ? ' · variable' : ''}
        </div>
      )}
      {t.fixed && days != null && (
        days < 0
          ? <span className="pill pill-bad mt-1">Fixed deal ended — likely on a variable rate now</span>
          : freeNow
            ? <span className="pill pill-warn mt-1">No exit fee now — compare and switch</span>
            : freeFrom && <span className="pill mt-1">Exit fee waived from {fmtDate(freeFrom)}</span>
      )}

      {editing && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Field label="Supplier">
              <input value={t.supplier ?? ''} placeholder="e.g. EDF" onChange={e => onChange({ supplier: e.target.value || undefined })} className={`${inputClass} w-[120px]`} />
            </Field>
            <Field label="Tariff name">
              <input value={t.name ?? ''} placeholder="optional" onChange={e => onChange({ name: e.target.value || undefined })} className={`${inputClass} w-[170px]`} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Field label={twoRate ? 'Day rate p/kWh' : 'Unit rate p/kWh'}>{numberInput(t.unitRateP, v => onChange({ unitRateP: v }), '0', 'w-[110px]')}</Field>
            <Field label="Standing p/day">{numberInput(t.standingChargeP, v => onChange({ standingChargeP: v }), '0', 'w-[110px]')}</Field>
            <Field label={twoRate ? 'Day usage kWh/yr' : 'Usage kWh/yr'}>{numberInput(t.annualUsageKwh, v => onChange({ annualUsageKwh: v }), '0', 'w-[110px]')}</Field>
          </div>
          {fuel === 'electricity' && (
            <label className="flex items-center gap-2 cursor-pointer text-xs min-h-[32px]">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={twoRate}
                onChange={e => {
                  setTwoRate(e.target.checked)
                  if (!e.target.checked) onChange({ nightRateP: undefined, nightUsageKwh: undefined })
                }}
              />
              Day / night rates (Economy 7 style)
            </label>
          )}
          {twoRate && (
            <div className="flex flex-wrap gap-2">
              <Field label="Night rate p/kWh">{numberInput(t.nightRateP, v => onChange({ nightRateP: v }), '0', 'w-[110px]')}</Field>
              <Field label="Night usage kWh/yr">{numberInput(t.nightUsageKwh, v => onChange({ nightUsageKwh: v }), '0', 'w-[110px]')}</Field>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-xs min-h-[32px]">
            <input type="checkbox" className="w-4 h-4" checked={!!t.fixed} onChange={e => onChange({ fixed: e.target.checked })} />
            Fixed price
          </label>
          {t.fixed && (
            <div className="flex flex-wrap gap-2">
              <Field label="Fixed until">
                <input type="date" value={t.fixedUntil ?? ''} onChange={e => onChange({ fixedUntil: e.target.value || undefined })} className={inputClass} />
              </Field>
              <Field label="Exit fee £">{numberInput(t.exitFee, v => onChange({ exitFee: v }), '0', 'w-[90px]')}</Field>
            </div>
          )}
          <p className="text-caption text-muted m-0 leading-snug">
            Copy the figures from the &ldquo;About your tariff&rdquo; box on your bill. Rates there exclude VAT — {Math.round(ENERGY_VAT * 100)}% is added for you.
          </p>
        </div>
      )}
    </div>
  )
}

function EnergySection({ summary, budget }: { summary: Summary; budget: BudgetHook }) {
  const { updatePropertyEnergy, updateItemAmount } = budget
  const p = summary.property
  const annual = summary.energyAnnualCost
  const monthly = annual != null ? annual / 12 : null
  const energyItems = summary.items.filter(i => /gas|electric|energy|power/i.test(i.label))
  const budgeted = energyItems.reduce((a, i) => a + i.amount, 0)
  const gap = monthly != null && energyItems.length > 0 ? budgeted - monthly : null

  return (
    <PanelSection title="Energy tariff">
      <FuelTariff fuel="electricity" tariff={p.energy?.electricity} onChange={f => updatePropertyEnergy(p.id, 'electricity', f)} />
      <FuelTariff fuel="gas" tariff={p.energy?.gas} onChange={f => updatePropertyEnergy(p.id, 'gas', f)} />
      {monthly != null && (
        <div className="pt-2 mt-1 border-t border-border">
          <div className="flex justify-between text-xs font-semibold">
            <span>Estimated energy cost</span>
            <span className="tabular-nums">{fmtP(monthly)}/mo · {fmt(annual!)}/yr</span>
          </div>
          {energyItems.length === 0 ? (
            <p className="text-caption text-muted mt-1 mb-0 leading-snug">
              Link this property&apos;s gas &amp; electricity bill on Budget to compare it with what you&apos;ve budgeted.
            </p>
          ) : gap != null && Math.abs(gap) >= 5 && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={`text-caption ${gap < 0 ? 'text-negative' : 'text-muted'}`}>
                You budget {fmt(budgeted)}/mo — {gap < 0 ? `${fmt(-gap)} less than the tariff suggests` : `${fmt(gap)} more than the tariff suggests`}.
              </span>
              {energyItems.length === 1 && (
                <button
                  onClick={() => updateItemAmount(energyItems[0].catKey, energyItems[0].id, Math.round(monthly))}
                  className="text-caption font-semibold text-accent bg-accent-light border-0 rounded-full px-2.5 min-h-[28px] cursor-pointer"
                >
                  Set to {fmt(monthly)}
                </button>
              )}
            </div>
          )}
          <p className="text-caption text-muted mt-1 mb-0 leading-snug">Based on the supplier&apos;s estimated annual usage — real bills vary with the weather, so monthly Direct Debits are spread across the year.</p>
        </div>
      )}
    </PanelSection>
  )
}

function PropertyCard({ summary, ownerName, budget }: { summary: Summary; ownerName: (o: Owner) => string; budget: BudgetHook }) {
  const { updateProperty, deleteProperty } = budget
  const { property: p, debts, items, mortgageBalance, mortgagePayment, runningCosts, monthlyTotal, equity, ltvPct } = summary
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (fields: Parameters<typeof updateProperty>[1]) => updateProperty(p.id, fields)

  const costBasis = (p.purchasePrice ?? 0) + (p.stampDutyPaid ?? 0) + (p.improvementCosts ?? 0)
  const paperGain = p.purchasePrice ? p.estimatedValue - costBasis : null

  return (
    <>
      {confirmDelete && (
        <ConfirmDelete
          label={p.label}
          detail="Its mortgage and costs stay, just unlinked from it. This can't be undone."
          onConfirm={() => { deleteProperty(p.id); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className={`card mb-3 overflow-hidden ${ownerBorderClass(p.owner)}`}>
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
          <div className="flex-1 min-w-0">
            <TapToEdit value={p.label} onSave={v => set({ label: v })} className="text-sm font-semibold block" />
            <div className="flex gap-1 flex-wrap mt-1">
              {p.isMainResidence && <span className="pill pill-accent"><Home size={9} /> Main residence</span>}
              {p.isLet && <span className="pill pill-warn">Let</span>}
              <span className="pill">{ownerName(p.owner)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-caption text-muted">Value</div>
            <AmountCell value={p.estimatedValue} onChange={v => set({ estimatedValue: v })} className="!px-0 font-serif !text-lg" />
          </div>
          <ExpandButton expanded={expanded} onClick={() => setExpanded(e => !e)} label={expanded ? `Collapse ${p.label}` : `Expand ${p.label}`} />
        </div>

        <div className="grid grid-cols-3 gap-2 px-3 py-2.5 border-t border-border text-center">
          <div>
            <div className="text-caption text-muted mb-0.5">Equity</div>
            <div className={`text-sm font-bold tabular-nums ${p.estimatedValue === 0 ? 'text-muted' : equity >= 0 ? 'text-positive' : 'text-negative'}`}>
              {p.estimatedValue > 0 ? fmt(equity) : '—'}
            </div>
          </div>
          <div>
            <div className="text-caption text-muted mb-0.5">Loan-to-value</div>
            <div className="text-sm font-bold tabular-nums">{ltvPct != null && mortgageBalance > 0 ? `${ltvPct.toFixed(0)}%` : '—'}</div>
          </div>
          <div>
            <div className="text-caption text-muted mb-0.5">Costs / mo</div>
            <div className="text-sm font-bold tabular-nums text-expense-text">{monthlyTotal > 0 ? fmt(monthlyTotal) : '—'}</div>
          </div>
        </div>

        {expanded && (
          <div className="px-3 pb-2 border-t border-border">
            <PanelSection title="Status">
              <label className="flex items-start gap-2 cursor-pointer mb-2">
                <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" checked={!!p.isMainResidence} onChange={e => set({ isMainResidence: e.target.checked || undefined })} />
                <span className="text-xs leading-snug">
                  Main residence
                  <span className="block text-caption text-muted mt-0.5">
                    Only one home can be your main residence for tax. With two, you can nominate which in writing to HMRC within two years of having both — worth checking you did.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" checked={!!p.isLet} onChange={e => set({ isLet: e.target.checked || undefined })} />
                <span className="text-xs leading-snug">
                  Let out (including holiday lets)
                  <span className="block text-caption text-muted mt-0.5">
                    Rental profit is taxable, and mortgage interest only earns a 20% tax credit rather than being deducted.
                  </span>
                </span>
              </label>
              {p.isLet && (
                <div className="mt-2">
                  <Field label="Rent £/mo">{numberInput(p.monthlyRent, v => set({ monthlyRent: v }))}</Field>
                </div>
              )}
              <div className="mt-2">
                <Field label="Owned by">
                  <select value={p.owner} onChange={e => set({ owner: e.target.value as Owner })} className={`${inputClass} w-full`}>
                    {(['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).map(o => <option key={o} value={o}>{ownerName(o)}</option>)}
                  </select>
                </Field>
              </div>
            </PanelSection>

            <PanelSection title="What it costs">
              {debts.length === 0 && items.length === 0 ? (
                <p className="text-xs text-muted m-0 leading-snug">
                  Nothing linked yet. On Debts, open its mortgage and choose this property under &ldquo;Secured on&rdquo;. On Budget, open each of its bills (council tax, insurance, energy…) and pick it under &ldquo;Property&rdquo;.
                </p>
              ) : (
                <div className="space-y-1">
                  {debts.map(d => (
                    <div key={d.id} className="flex justify-between text-xs gap-2">
                      <span className="text-muted truncate">{d.label} <span className="text-caption">({fmt(d.currentBalance)} owed)</span></span>
                      <span className="tabular-nums font-semibold shrink-0">{fmt(d.monthlyPayment)}</span>
                    </div>
                  ))}
                  {items.map(i => (
                    <div key={i.id} className="flex justify-between text-xs gap-2">
                      <span className="text-muted truncate">{i.label} <span className="text-caption">· {i.category}</span></span>
                      <span className="tabular-nums font-semibold shrink-0">{fmt(i.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs pt-1.5 mt-1 border-t border-border font-semibold">
                    <span>Mortgage {fmt(mortgagePayment)} + running {fmt(runningCosts)}</span>
                    <span className="tabular-nums text-expense-text">{fmt(monthlyTotal)}/mo</span>
                  </div>
                  {p.isLet && (p.monthlyRent ?? 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Net of rent, before tax</span>
                      <span className={`tabular-nums font-semibold ${(p.monthlyRent ?? 0) - monthlyTotal >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {fmt((p.monthlyRent ?? 0) - monthlyTotal)}/mo
                      </span>
                    </div>
                  )}
                </div>
              )}
            </PanelSection>

            <EnergySection summary={summary} budget={budget} />

            <PanelSection title="Capital gains record">
              <p className="text-caption text-muted mt-0 mb-2 leading-snug">
                {p.isMainResidence
                  ? 'Usually exempt while it’s your main residence, but worth keeping in case that changes.'
                  : 'A gain on a home that isn’t your main residence is taxable on sale. These figures set the base it’s measured from — much easier to record now than reconstruct later.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Field label="Bought for £">{numberInput(p.purchasePrice, v => set({ purchasePrice: v }))}</Field>
                <Field label="Bought">
                  <input type="month" value={p.purchaseDate ?? ''} onChange={e => set({ purchaseDate: e.target.value || undefined })} className={inputClass} />
                </Field>
                <Field label="Stamp duty £">{numberInput(p.stampDutyPaid, v => set({ stampDutyPaid: v }), '0', 'w-[110px]')}</Field>
                <Field label="Improvements £">{numberInput(p.improvementCosts, v => set({ improvementCosts: v }), '0', 'w-[110px]')}</Field>
              </div>
              {paperGain != null && p.estimatedValue > 0 && (
                <div className="flex justify-between text-xs mt-2 pt-2 border-t border-border">
                  <span className="text-muted">Gain at today&apos;s value, before selling costs</span>
                  <span className={`tabular-nums font-semibold ${paperGain >= 0 ? 'text-ink' : 'text-negative'}`}>{fmt(paperGain)}</span>
                </div>
              )}
              <p className="text-caption text-muted mt-1.5 mb-0">Improvements means lasting additions (an extension, a new kitchen) — not repairs or upkeep. A rough guide, not tax advice.</p>
            </PanelSection>

            <div className="pt-1 border-t border-border">
              <DeleteAction label="Delete property" onClick={() => setConfirmDelete(true)} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function PropertiesSection({ budget }: { budget: BudgetHook }) {
  const { data, addProperty } = budget
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [owner, setOwner] = useState<Owner>('JOINT')
  const summaries = propertySummaries(data)
  const ownerName = (o: Owner) => o === 'NIAMH' ? (data.nameNiamh || 'Person 1') : o === 'RUPERT' ? (data.nameRupert || 'Person 2') : (data.nameJoint || 'Joint')
  const totalEquity = summaries.reduce((a, s) => a + s.equity, 0)
  const submit = () => { if (label.trim()) { addProperty(label.trim(), owner); setLabel(''); setAdding(false) } }

  return (
    <div className="mt-6 pt-6 border-t-2 border-border">
      <div className="flex justify-between items-baseline mb-3">
        <h2 className="font-serif text-xl m-0 flex items-center gap-2">Property</h2>
        {summaries.length > 0 && (
          <div className="text-right">
            <div className="text-caption text-muted">Total equity</div>
            <div className={`font-serif text-xl font-bold tabular-nums leading-none ${totalEquity >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(totalEquity)}</div>
          </div>
        )}
      </div>

      {summaries.map(s => <PropertyCard key={s.property.id} summary={s} ownerName={ownerName} budget={budget} />)}

      {summaries.length === 0 && !adding && (
        <p className="text-xs text-muted mt-0 mb-3 leading-relaxed">
          Add each home you own to see its equity, loan-to-value and true monthly cost — and so net worth counts what it&apos;s worth, not just what&apos;s owed on it.
        </p>
      )}

      {adding ? (
        <div className="card p-3">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="e.g. Home, Norfolk"
            autoFocus
            className={`${inputClass} w-full mb-2`}
          />
          <select value={owner} onChange={e => setOwner(e.target.value as Owner)} aria-label="Owned by" className={`${inputClass} w-full mb-2`}>
            {(['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).map(o => <option key={o} value={o}>{ownerName(o)}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 bg-ink text-on-ink border-0 rounded-xl py-2.5 cursor-pointer text-sm font-semibold">Add property</button>
            <button onClick={() => setAdding(false)} className="px-4 bg-transparent border-[1.5px] border-border rounded-xl py-2.5 cursor-pointer text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-dashed border-border rounded-xl text-muted text-sm cursor-pointer bg-transparent"
        >
          <Plus size={14} /> Add property
        </button>
      )}
    </div>
  )
}
