'use client'

import { useMemo, useState } from 'react'
import { CreditCard, Check } from 'lucide-react'
import { Debt, fmt } from '@/lib/models'
import { cardPlan, isCard, worthMoving, TYPICAL_DEAL, type TransferDeal } from '@/lib/cards'
import { NumberInput } from './ui'

const until = (months: number | null) => {
  if (months == null) return 'never at these payments'
  const d = new Date(); d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

const small = 'text-[16px] text-ink bg-transparent w-full min-w-0 text-right tabular-nums outline-none'

/**
 * Would one 0% balance transfer card beat the cards as they are? Paying the
 * same each month either way, so the difference is all interest and fee.
 */
export default function CombineCards({ debts }: { debts: Debt[] }) {
  const cards = debts.filter(isCard)
  const [deal, setDeal] = useState<TransferDeal>(TYPICAL_DEAL)
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const chosen = picked ?? new Set(cards.filter(c => worthMoving(c, deal)).map(c => c.id))
  const plan = useMemo(() => cardPlan(cards.filter(c => chosen.has(c.id)), deal), [cards, chosen, deal]) // eslint-disable-line

  if (cards.length === 0 || !cards.some(c => worthMoving(c, TYPICAL_DEAL) || (Number(c.interestRate) || 0) > 0)) return null

  const toggle = (id: string) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id); else next.add(id)
    setPicked(next)
  }
  const set = (k: keyof TransferDeal) => (v: number | undefined) => setDeal(d => ({ ...d, [k]: Math.max(0, v ?? 0) }))
  const s = plan?.saving
  const verdict = !plan ? 'Choose the cards you’d move'
    : plan.payment <= 0 ? 'Add each card’s monthly payment on Wealth to compare'
    : s == null ? (plan.now.months == null ? 'Your payments don’t cover the interest now. A 0% card would stop it growing.' : 'At these payments the new card never clears. Pay more each month.')
    : s >= 10 ? `Moving ${plan.cards.length > 1 ? 'them to one card' : 'it'} would save about ${fmt(s)}`
    : s <= -10 ? `Not worth it: the fee costs ${fmt(-s)} more than you'd save`
    : 'About the same either way'
  const showRollover = plan && plan.cards.length > 1 && plan.rollover.months != null && plan.now.interest - plan.rollover.interest >= 10

  return (
    <div className="card p-4 mb-3">
      <div className="mb-3 flex items-start gap-2">
        <span className="text-muted mt-px shrink-0"><CreditCard size={16} aria-hidden="true" /></span>
        <div className="min-w-0">
          <div className="section-label">{cards.length > 1 ? 'Combine your cards' : 'Move to a 0% card'}</div>
          <div className={`text-[15px] font-semibold mt-0.5 ${s != null && s >= 10 ? 'text-pos' : 'text-ink'}`}>{verdict}</div>
        </div>
      </div>

      {cards.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Cards to move">
          {cards.map(c => {
            const on = chosen.has(c.id)
            return (
              <button
                key={c.id} onClick={() => toggle(c.id)} aria-pressed={on}
                className={`flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-[14px] cursor-pointer border ${on ? 'bg-ink text-on-ink border-ink' : 'bg-panel text-ink-2 border-line-2'}`}
              >
                {on && <Check size={14} aria-hidden="true" />}
                {c.label} · {fmt(c.currentBalance)} · {c.isZeroPercent ? `0%${c.zeroPercentExpiryDate ? ` to ${new Date(c.zeroPercentExpiryDate.length === 7 ? c.zeroPercentExpiryDate + '-01' : c.zeroPercentExpiryDate).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}` : ''}` : `${c.interestRate}%`}
              </button>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3" role="group" aria-label="The new card's deal">
        <DealField label="0% for" unit="months"><NumberInput value={deal.months} onChange={set('months')} ariaLabel="Months at 0%" className={small} /></DealField>
        <DealField label="Fee" unit="%"><NumberInput value={deal.feePct} onChange={set('feePct')} ariaLabel="Transfer fee percent" className={small} /></DealField>
        <DealField label="Then" unit="%"><NumberInput value={deal.rateAfter} onChange={set('rateAfter')} ariaLabel="Rate after the 0% ends" className={small} /></DealField>
      </div>

      {plan && plan.payment > 0 && (
        <div className="border-t border-border">
          <Row label="Carry on as you are" sub={`Clear ${until(plan.now.months)}`} value={plan.now.months == null ? '—' : `${fmt(plan.now.interest)} interest`} />
          {showRollover && (
            <Row label="Free option: pay the dearest card first" sub={`When a card’s paid off, put its payment on the highest-rate one left. Clear ${until(plan.rollover.months)}`} value={`${fmt(plan.rollover.interest)} interest`} />
          )}
          <Row
            label={`One 0% card for ${fmt(plan.balance)}`}
            sub={`${fmt(plan.transfer.fee)} fee${plan.transfer.interest >= 1 ? ` + ${fmt(plan.transfer.interest)} interest after the 0% ends` : ''}. Clear ${until(plan.transfer.months)}`}
            value={plan.transfer.months == null ? '—' : `${fmt(plan.transfer.fee + plan.transfer.interest)} cost`}
            strong={s != null && s >= 10}
          />
          {deal.months > 0 && (
            <p className="text-label text-ink-2 mt-3 mb-0">
              {plan.transfer.leftWhenZeroEnds > 0
                ? <>At {fmt(plan.payment)} a month, {fmt(plan.transfer.leftWhenZeroEnds)} would be left when the 0% ends. Pay <b className="text-ink">{fmt(plan.clearByEnd)} a month</b> to clear it all in time.</>
                : <>At {fmt(plan.payment)} a month you’d clear it before the 0% ends.</>}
            </p>
          )}
        </div>
      )}

      <details className="mt-3 text-label text-muted">
        <summary className="cursor-pointer min-h-[32px] flex items-center font-medium text-ink-2">Before you apply</summary>
        <ul className="mt-1 mb-0 pl-4 space-y-1 [text-wrap:pretty]">
          <li>The figures above are a typical deal. Change them to match a real offer.</li>
          <li>Use an eligibility checker first: it’s a soft search, so it won’t mark your credit file.</li>
          <li>You usually can’t move a balance between two cards from the same bank.</li>
          <li>The new limit may not cover everything. Move the highest-rate card first.</li>
          <li>Don’t spend on the new card: purchases often aren’t 0%. Missing a payment can end the 0% early.</li>
          <li>Keep the old cards open but unused, or close them once they’re clear.</li>
        </ul>
      </details>
    </div>
  )
}

function Row({ label, sub, value, strong }: { label: string; sub: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-ink">{label}</div>
        <div className="text-caption text-muted [text-wrap:pretty]">{sub}</div>
      </div>
      <div className={`text-[15px] tabular-nums shrink-0 ${strong ? 'font-semibold text-pos' : 'text-ink'}`}>{value}</div>
    </div>
  )
}

function DealField({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-caption text-muted uppercase tracking-label">{label}</span>
      <span className="flex items-center gap-1 border border-line-2 rounded-xl px-2.5 min-h-[44px] bg-panel focus-within:border-ink">
        {children}
        <span className="text-label text-muted shrink-0">{unit}</span>
      </span>
    </label>
  )
}
