'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CalendarDays, Home, Pencil, X } from 'lucide-react'
import { Debt, MortgageDetails, Owner, fmt, propertySummaries } from '@/lib/models'
import { dateKey, localDate, mortgageImpact, mortgagePayment, mortgageReviews, mortgageScenario } from '@/lib/mortgage'
import { inputClass, useModal } from './ui'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>
const dateText = (value?: string) => { const d = localDate(value); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded' }
const money = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 })
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`

export default function MortgagePlanner({ budget, debtId, onClose }: { budget: BudgetHook; debtId: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useModal(ref, onClose)
  const debt = budget.data.debts.find(d => d.id === debtId && d.type === 'MORTGAGE')
  const [view, setView] = useState<'overview' | 'details' | 'rates'>('overview')
  const [basis, setBasis] = useState<'today' | 'renewal'>('today')
  const [rateText, setRateText] = useState(debt && debt.interestRate > 0 ? String(debt.interestRate) : '')
  const [announcement, setAnnouncement] = useState('')
  const name = (o: Owner) => o === 'NIAMH' ? budget.data.nameNiamh || 'Person 1' : o === 'RUPERT' ? budget.data.nameRupert || 'Person 2' : budget.data.nameJoint || 'Joint account'
  const rate = rateText.trim() ? Number(rateText) : NaN
  const scenario = debt ? mortgageScenario(debt, rate, basis) : null
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(scenario?.payment != null ? `Estimated monthly payment ${money(scenario.payment)}` : ''), 500)
    return () => clearTimeout(timer)
  }, [scenario?.payment])
  if (!debt) return null
  const property = budget.data.properties?.find(p => p.id === debt.propertyId)
  const review = mortgageReviews(budget.data).find(r => r.debt.id === debt.id)
  const scenarioPayment = scenario?.payment
  const impact = scenarioPayment != null ? mortgageImpact(budget.data, debt.id, scenarioPayment) : null
  const delta = scenarioPayment != null ? scenarioPayment - debt.monthlyPayment : null
  const propertyCost = propertySummaries(budget.data).find(s => s.property.id === debt.propertyId)?.monthlyTotal
  const compareRates = Array.from(new Set([Math.max(0, rate - .5), rate, Math.min(100, rate + .5)]))
  return createPortal(<div className="fixed inset-0 z-[900] bg-bg sm:bg-black/40 sm:p-5 flex justify-center" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${debt.label} mortgage planner`} className="bg-bg outline-none w-full sm:max-w-[1000px] sm:rounded-[22px] flex flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-2 px-4 py-2 border-b border-line shrink-0">
        <button aria-label={view === 'overview' ? 'Back to previous screen' : 'Back to mortgage overview'} onClick={() => view === 'overview' ? onClose() : setView('overview')} className="min-w-[44px] min-h-[44px] grid place-items-center text-muted"><ArrowLeft size={21} /></button>
        <div className="flex-1 min-w-0"><h1 className="text-[22px] font-semibold truncate m-0">{view === 'overview' ? 'Mortgage' : view === 'details' ? 'Mortgage details' : 'Explore rates'}</h1><p className="text-caption text-muted truncate mt-0 mb-0">{[property?.label, debt.label, `Paid by ${name(debt.owner)}`].filter(Boolean).join(' · ')}</p></div>
        <button onClick={onClose} aria-label="Close mortgage planner" className="min-w-[44px] min-h-[44px] grid place-items-center text-muted"><X size={20} /></button>
      </header>
      <div className="overflow-y-auto flex-1 px-5 pt-5 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {view !== 'overview' && <div className="seg grid-cols-2 mb-5 lg:max-w-[460px]" role="group" aria-label="Mortgage planner view"><button aria-pressed={view === 'details'} onClick={() => setView('details')}>Details</button><button aria-pressed={view === 'rates'} onClick={() => setView('rates')}>Explore rates</button></div>}
        {view === 'overview' && <div className="max-w-[600px] mx-auto space-y-4">
          <section className="panel p-5"><div className="flex items-center gap-2 text-label text-muted"><Home size={18} /> Current monthly payment</div><div className="text-[42px] font-semibold num mt-2">{fmt(debt.monthlyPayment)}</div><div className="flex justify-between border-t border-line mt-4 pt-3 text-label"><span>Outstanding balance</span><b className="num">{fmt(debt.currentBalance)}</b></div><div className="flex justify-between mt-3 text-label"><span>Current rate</span><b>{debt.interestRate > 0 || debt.mortgage?.rateConfirmed ? `${debt.interestRate}%` : 'Not confirmed'}</b></div><p className="text-caption text-muted mb-0 mt-2">Balance as of {dateText(debt.mortgage?.balanceDate)}</p></section>
          <section className="rounded-2xl bg-fill p-4"><div className="flex items-center gap-2 text-label font-medium"><CalendarDays size={18} /> Current deal ends</div><div className="text-[22px] font-semibold mt-1">{dateText(debt.mortgage?.dealEnds)}</div><p className="text-label text-muted mt-1 mb-0">{review ? review.stage === 'ended' ? 'Deal-end date passed. Confirm your current rate and payment.' : `Review from ${dateText(review.reviewFrom)}` : 'Add your deal-end date for renewal reminders. Tracker or variable deals may not have one.'}</p></section>
          <button onClick={() => setView('rates')} className="w-full rounded-xl min-h-[50px] bg-ink text-on-ink font-semibold">Explore rate changes</button>
          <button onClick={() => setView('details')} className="w-full rounded-xl min-h-[50px] border border-line text-ink font-medium flex gap-2 items-center justify-center"><Pencil size={17} /> Edit mortgage details</button>
          <p className="text-caption text-muted">Mortgage ends {dateText(debt.mortgage?.maturityDate)}. {debt.mortgage?.repaymentType === 'interestOnly' ? 'Interest-only: the capital remains due at the end.' : 'The mortgage end date is separate from your current rate deal.'}</p>
        </div>}
        {view === 'details' && <MortgageDetailsForm key={debt.id} debt={debt} budget={budget} onSaved={() => setView('overview')} />}
        {view === 'rates' && <div className="lg:grid lg:grid-cols-2 gap-7 items-start">
          <div><label className="block text-[15px] font-medium mb-2" htmlFor="mortgage-basis">Calculation basis</label><select id="mortgage-basis" value={basis} onChange={e => setBasis(e.target.value as typeof basis)} className={`${inputClass} w-full mb-4`}><option value="today">If the rate changed today</option><option value="renewal">When this deal ends</option></select>
            <label className="block text-[15px] font-medium mb-2" htmlFor="scenario-rate">Scenario interest rate (%)</label>
            <div className="flex gap-2"><button aria-label="Decrease rate by 0.5 percentage points" onClick={() => setRateText(String(Math.max(0, (Number.isFinite(rate) ? rate : 0) - .5)))} className="bg-fill rounded-xl min-w-[60px] min-h-[48px]">−0.5</button><input id="scenario-rate" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={rateText} onChange={e => setRateText(e.target.value)} className={`${inputClass} min-w-0 w-full text-center text-[24px] font-semibold num`} /><button aria-label="Increase rate by 0.5 percentage points" onClick={() => setRateText(String(Math.min(100, (Number.isFinite(rate) ? rate : 0) + .5)))} className="bg-fill rounded-xl min-w-[60px] min-h-[48px]">+0.5</button></div><p className="text-caption text-muted mt-2 mb-5">Buttons change the rate by percentage points. These are scenarios, not lender offers.</p>
            {scenario?.error && <div className="rounded-xl bg-fill p-4"><p className="text-label mt-0 mb-2">{scenario.error}</p><button onClick={() => setView('details')} className="underline text-label min-h-[44px]">Add or check details</button></div>}

          </div>
          {scenarioPayment != null && impact && <div className="space-y-4">
            <section className="panel p-5 mt-4 lg:mt-0"><h2 className="text-label text-muted m-0 font-medium">Estimated monthly payment</h2><div className="text-[38px] font-semibold num mt-2">{money(scenarioPayment)}</div><p className={`num text-label mb-0 ${delta! > 0 ? 'text-warn' : delta! < 0 ? 'text-pos' : 'text-muted'}`}>{signed(delta!)} / month vs your recorded payment</p><p className="text-caption text-muted mt-2 mb-0">{signed(delta! * 12)} over 12 months if this payment stayed the same.</p></section>
            <section className="panel p-4"><h2 className="text-[17px] font-semibold m-0">Household impact</h2><p className="text-caption text-muted mt-1">If this payment applied to your current budget; other income, spending and savings are held constant.</p>{debt.owner === 'JOINT' ? <><div className="flex justify-between text-label py-2"><span>Joint account requirement</span><b className="num">{money(impact.jointAfter)}</b></div><div className="flex justify-between text-label py-2"><span>{name('NIAMH')} puts in</span><b className="num">{money(impact.jointAfter / 2)}</b></div><div className="flex justify-between text-label py-2"><span>{name('RUPERT')} puts in</span><b className="num">{money(impact.jointAfter / 2)}</b></div><p className="text-caption text-muted">{signed(delta! / 2)} each, using the current 50/50 split. Includes any joint top-ups.</p></> : <><div className="flex justify-between text-label py-2 gap-3"><span>{name(debt.owner)}’s available money</span><b className="num">{money(debt.owner === 'NIAMH' ? impact.after.netN : impact.after.netR)}</b></div><p className="text-caption text-muted">{signed(-delta!)} change for {name(debt.owner)}. The joint-account requirement stays {money(impact.jointBefore)}.</p></>}{propertyCost != null && <div className="border-t border-line pt-3 text-label flex justify-between gap-3"><span>{property?.label} monthly costs</span><b className="num">{money(propertyCost + delta!)}</b></div>}</section>
            {debt.mortgage?.repaymentType === 'interestOnly' && <p className="text-label text-warn">Interest-only payments do not repay capital. {money(scenario!.balance!)} remains due at the mortgage end unless repaid separately.</p>}
              <table className="w-full text-label num my-5"><caption className="text-left font-semibold mb-2">Compare rates</caption><thead><tr className="text-muted"><th className="text-left py-2 font-medium">Rate</th><th className="text-right font-medium">Payment/mo</th><th className="text-right font-medium">Change</th></tr></thead><tbody>{compareRates.map(r => { const p = mortgagePayment(scenario!.balance!, r, scenario!.months!, debt.mortgage!.repaymentType!)!; return <tr key={r} className={`border-t border-line ${r === rate ? 'bg-fill font-semibold' : ''}`}><td className="py-3">{r.toFixed(2)}%</td><td className="text-right">{money(p)}</td><td className="text-right">{signed(p - debt.monthlyPayment)}</td></tr> })}</tbody></table>
            <p className="text-label text-muted">Using {money(scenario!.balance!)} over {scenario!.months} months from {dateText(scenario!.date!)} · {debt.mortgage?.repaymentType === 'interestOnly' ? 'Interest-only' : 'Repayment'}</p>
            <p className="text-caption text-muted">{basis === 'renewal' ? `Whole-month projection from ${dateText(debt.mortgage?.balanceDate)}, using your recorded payment and assuming the current ${debt.interestRate}% rate stays unchanged until the deal ends.` : `Using your recorded balance from ${dateText(debt.mortgage?.balanceDate)} as today's balance. Update it if it is out of date.`} Lender calculations and payment dates may differ.</p>
            <p className="text-caption text-muted">Estimate only. Your saved monthly payment remains {money(debt.monthlyPayment)}. Record lender-confirmed changes in Details.</p>
          </div>}
          <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
        </div>}
      </div>
    </div>
  </div>, document.body)
}

function MortgageDetailsForm({ debt, budget, onSaved }: { debt: Debt; budget: BudgetHook; onSaved: () => void }) {
  const [balance, setBalance] = useState(String(debt.currentBalance))
  const [payment, setPayment] = useState(String(debt.monthlyPayment))
  const [rate, setRate] = useState(debt.interestRate > 0 || debt.mortgage?.rateConfirmed ? String(debt.interestRate) : '')
  const [details, setDetails] = useState<MortgageDetails>({ ...debt.mortgage })
  const [lender, setLender] = useState(debt.institution ?? '')
  const [payer, setPayer] = useState(debt.owner)
  const [property, setProperty] = useState(debt.propertyId ?? '')
  const [error, setError] = useState('')
  const field = (key: keyof MortgageDetails, value: string) => setDetails(d => ({ ...d, [key]: value || undefined }))
  const label = 'block text-[15px] font-medium mb-4'
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!balance.trim() || !payment.trim() || ![Number(balance), Number(payment)].every(n => Number.isFinite(n) && n >= 0)) return setError('Enter a balance and monthly payment of zero or more.')
    if (rate.trim() && (!Number.isFinite(Number(rate)) || Number(rate) < 0 || Number(rate) > 100)) return setError('Enter a rate between 0% and 100%, or leave it blank if unknown.')
    for (const key of ['balanceDate', 'maturityDate', 'dealEnds'] as const) if (details[key] && !localDate(details[key])) return setError('Check the dates you entered.')
    if (details.balanceDate && details.balanceDate > dateKey()) return setError('The balance date cannot be in the future.')
    if (details.dealEnds && details.maturityDate && details.dealEnds > details.maturityDate) return setError('Your rate deal cannot end after the mortgage ends.')
    budget.updateDebt(debt.id, { currentBalance: Number(balance), monthlyPayment: Number(payment), interestRate: rate.trim() ? Number(rate) : 0, isZeroPercent: false, institution: lender.trim(), owner: payer, propertyId: property || undefined, mortgage: { ...details, rateConfirmed: !!rate.trim() } })
    onSaved()
  }
  return <form onSubmit={save} className="max-w-[650px] mx-auto">
    <p className="text-label text-muted mt-0 mb-5">Enter the figures from your lender. Missing details can be added later; they are needed before estimates can be calculated.</p>
    <div className="grid sm:grid-cols-2 gap-x-5"><label className={label}>Outstanding balance (£)<input required type="number" min="0" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} className={`${inputClass} w-full mt-2`} /></label><label className={label}>Balance as of<input type="date" value={details.balanceDate ?? ''} onChange={e => field('balanceDate', e.target.value)} className={`${inputClass} w-full mt-2`} /></label><label className={label}>Recorded monthly payment (£)<input required type="number" min="0" step="0.01" value={payment} onChange={e => setPayment(e.target.value)} className={`${inputClass} w-full mt-2`} /></label><label className={label}>Current interest rate (%)<input type="number" min="0" max="100" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="Unknown" className={`${inputClass} w-full mt-2`} /></label></div>
    <label className={label}>Repayment type<select aria-label="Repayment type" value={details.repaymentType ?? ''} onChange={e => field('repaymentType', e.target.value)} className={`${inputClass} w-full mt-2`}><option value="">Not recorded</option><option value="repayment">Repayment — capital and interest</option><option value="interestOnly">Interest-only</option></select></label>
    <label className={label}>Mortgage ends<input aria-label="Mortgage ends" type="date" value={details.maturityDate ?? ''} onChange={e => field('maturityDate', e.target.value)} className={`${inputClass} w-full mt-2`} /><span className="block text-caption text-muted mt-1">When the loan is due to be repaid. Different loan parts may have different end dates.</span></label>
    <label className={label}>Current rate type<select aria-label="Current rate type" value={details.rateType ?? ''} onChange={e => field('rateType', e.target.value)} className={`${inputClass} w-full mt-2`}><option value="">Not recorded</option><option value="fixed">Fixed</option><option value="tracker">Tracker</option><option value="variable">Variable</option></select></label>
    <label className={label}>Current deal ends<input aria-label="Current deal ends" type="date" value={details.dealEnds ?? ''} onChange={e => field('dealEnds', e.target.value)} className={`${inputClass} w-full mt-2`} /><span className="block text-caption text-muted mt-1">When the current rate deal ends. Leave blank if there is no end date. This does not mean the mortgage is paid off.</span></label>
    <label className={label}>Lender (optional)<input value={lender} onChange={e => setLender(e.target.value)} className={`${inputClass} w-full mt-2`} /></label>
    <label className={label}>Paid by<select aria-label="Paid by" value={payer} onChange={e => setPayer(e.target.value as Owner)} className={`${inputClass} w-full mt-2`}>{(['NIAMH','RUPERT','JOINT'] as Owner[]).map(o => <option key={o} value={o}>{o === 'NIAMH' ? budget.data.nameNiamh || 'Person 1' : o === 'RUPERT' ? budget.data.nameRupert || 'Person 2' : budget.data.nameJoint || 'Joint account'}</option>)}</select></label>
    <label className={label}>Linked property<select aria-label="Linked property" value={property} onChange={e => setProperty(e.target.value)} className={`${inputClass} w-full mt-2`}><option value="">Not linked to a property</option>{(budget.data.properties ?? []).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    {error && <p role="alert" className="text-neg text-label">{error}</p>}
    <div className="sticky bottom-0 bg-bg pt-3 pb-3 border-t border-line"><button className="bg-ink text-on-ink w-full rounded-xl min-h-[50px] font-semibold" type="submit">Save mortgage details</button></div>
  </form>
}
