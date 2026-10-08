import { BudgetData, Owner, Fuel, upcomingRenewals, energySwitchReminders, debtPayoff, isMortgage, fmt } from './models'

/**
 * Everything that needs one of the couple to act, worst first. Shared by the
 * Today inbox and the Analysis tab badge so the two can never disagree.
 */
export type AttentionAction =
  | { type: 'renewal'; catKey: string; itemId: string }
  | { type: 'property'; propertyId: string }
  | { type: 'debt'; debtId: string }

export interface AttentionItem {
  id: string
  severity: 'bad' | 'warn'
  /** Left-hand "when" column: the headline ("Lapsed", "40 days", "24.9%") and a sub-line. */
  when: string
  whenSub: string
  title: string
  body: string
  owner: Owner | null
  meta: string
  action: AttentionAction
  /** For ordering within a severity: lower is sooner. */
  sortKey: number
}

const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const fuelText = (fuels: Fuel[]) => fuels.length === 2 ? 'gas & electricity' : fuels[0]

export function needsAttention(data: BudgetData): AttentionItem[] {
  const items: AttentionItem[] = []
  const ownerName = (o: Owner) => o === 'NIAMH' ? (data.nameNiamh || 'Person 1') : o === 'RUPERT' ? (data.nameRupert || 'Person 2') : (data.nameJoint || 'Joint')

  // Renewals: lapsed within the last 60 days, or due within 14 days and not auto-renewing.
  for (const r of upcomingRenewals(data)) {
    if (r.isEnergy) continue // covered by the energy switch reminders below
    const cat = data.categories.find(c => c.items.some(i => i.id === r.id))
    if (!cat) continue
    const meta = [ownerName(r.owner), r.provider, r.amount > 0 ? `${fmt(r.amount)}/mo` : null].filter(Boolean).join(' · ')
    if (r.days < 0 && r.days >= -60) {
      items.push({
        id: `renewal:${r.id}`, severity: 'bad', when: r.isInsurance ? 'Lapsed' : 'Ended', whenSub: day(r.date),
        title: r.isInsurance ? `${r.label} has ended` : `${r.label} renewal date passed`,
        body: r.autoRenews
          ? 'It was set to auto-renew. Confirm the new price and set next year’s date.'
          : r.isInsurance
            ? 'It wasn’t set to auto-renew. Mark it renewed, or set the new date.'
            : 'Mark it renewed, or set the new date.',
        owner: r.owner, meta, action: { type: 'renewal', catKey: cat.key, itemId: r.id }, sortKey: r.days,
      })
    } else if (r.days >= 0 && r.days <= 14 && !r.autoRenews) {
      items.push({
        id: `renewal:${r.id}`, severity: 'warn', when: r.days === 0 ? 'Today' : `${r.days} ${r.days === 1 ? 'day' : 'days'}`, whenSub: `to ${day(r.date)}`,
        title: `${r.label} ${r.isInsurance ? 'cover ends' : 'ends'} soon`,
        body: 'It isn’t set to auto-renew. Compare prices now, then renew or switch.',
        owner: r.owner, meta, action: { type: 'renewal', catKey: cat.key, itemId: r.id }, sortKey: r.days,
      })
    }
  }

  // Energy: fee-free switch windows and deals that have rolled onto a variable rate.
  for (const r of energySwitchReminders(data)) {
    const p = (data.properties ?? []).find(x => x.id === r.propertyId)
    const supplier = p?.energy?.[r.fuels[0]]?.supplier
    const meta = [p ? ownerName(p.owner) : null, supplier].filter(Boolean).join(' · ')
    if (r.status === 'ended') {
      items.push({
        id: `energy:${r.propertyId}`, severity: 'bad', when: 'Ended', whenSub: day(r.fixedUntil),
        title: `${r.propertyLabel} ${fuelText(r.fuels)} fix has ended`,
        body: 'You’re probably on the standard variable rate now — usually the priciest option.',
        owner: p?.owner ?? null, meta, action: { type: 'property', propertyId: r.propertyId }, sortKey: r.daysToEnd,
      })
    } else {
      items.push({
        id: `energy:${r.propertyId}`, severity: 'warn',
        when: r.status === 'open' ? `${r.daysToEnd} days` : `${r.daysToFree} days`,
        whenSub: r.status === 'open' ? `to ${day(r.fixedUntil)}` : `to ${day(r.freeFrom)}`,
        title: `Switch energy at ${r.propertyLabel}`,
        body: r.status === 'open'
          ? `No exit fee now — you can leave the ${fuelText(r.fuels)} fix (to ${day(r.fixedUntil)}) for free.`
          : `From ${day(r.freeFrom)} you can switch ${fuelText(r.fuels)} without exit fees.`,
        owner: p?.owner ?? null, meta, action: { type: 'property', propertyId: r.propertyId },
        sortKey: r.status === 'open' ? r.daysToEnd : r.daysToFree,
      })
    }
  }

  // Debts: a payment that never clears the balance, a 0% deal ending soon, or expensive borrowing.
  for (const d of data.debts) {
    if (d.currentBalance <= 0 || isMortgage(d)) continue
    const meta = [ownerName(d.owner), `${fmt(d.currentBalance)} owed`].join(' · ')
    const payoff = debtPayoff(d)
    if (d.monthlyPayment > 0 && payoff.months == null) {
      items.push({
        id: `debt:${d.id}`, severity: 'bad', when: 'Never', whenSub: 'cleared',
        title: `${d.label} payment doesn’t cover the interest`,
        body: `At ${fmt(d.monthlyPayment)}/mo the balance grows. Even a small increase gets it moving down.`,
        owner: d.owner, meta, action: { type: 'debt', debtId: d.id }, sortKey: -1,
      })
      continue
    }
    if (d.isZeroPercent && d.zeroPercentExpiryDate && payoff.balanceWhenZeroEnds != null && payoff.balanceWhenZeroEnds > 0) {
      const expiry = d.zeroPercentExpiryDate.length === 7 ? `${d.zeroPercentExpiryDate}-01` : d.zeroPercentExpiryDate
      const days = Math.round((new Date(expiry).getTime() - Date.now()) / 86400000)
      if (days <= 90) {
        items.push({
          id: `debt:${d.id}`, severity: 'warn', when: days > 0 ? `${days} days` : 'Ended', whenSub: '0% ends',
          title: `${d.label} leaves 0%`,
          body: `About ${fmt(payoff.balanceWhenZeroEnds)} will still be owed${d.interestRate ? ` at ${d.interestRate}%` : ''}. Clear it or move it before then.`,
          owner: d.owner, meta, action: { type: 'debt', debtId: d.id }, sortKey: days,
        })
        continue
      }
    }
    if (!d.isZeroPercent && d.interestRate >= 15) {
      const monthly = (d.currentBalance * d.interestRate) / 100 / 12
      items.push({
        id: `debt:${d.id}`, severity: 'warn', when: `${d.interestRate}%`, whenSub: 'APR',
        title: `${d.label} costs about ${fmt(monthly)} a month`,
        body: 'Your priciest borrowing, so it’s the first to clear or move to 0%.',
        owner: d.owner, meta, action: { type: 'debt', debtId: d.id }, sortKey: 1000 - d.interestRate,
      })
    }
  }

  return items.sort((a, b) => (a.severity === b.severity ? a.sortKey - b.sortKey : a.severity === 'bad' ? -1 : 1))
}
