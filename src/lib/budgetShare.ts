import { BudgetData, Owner, calcTotals, fmtBudget, itemAmountForMonth, oneOffsFor, periodFor } from './models'

/** A plain-text snapshot only: no income, balances or account links. */
export function budgetShare(data: BudgetData, includePersonal = false, now = new Date()) {
  const name = (owner: Owner) => owner === 'NIAMH' ? data.nameNiamh || 'Person 1'
    : owner === 'RUPERT' ? data.nameRupert || 'Person 2' : data.nameJoint || 'Joint account'
  const month = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const title = `${month} · ${includePersonal ? 'all costs' : 'household costs'}`
  const periodLabel = (owner: Owner) => {
    const period = periodFor(data, owner, now)
    const end = new Date(period.next.getFullYear(), period.next.getMonth(), period.next.getDate() - 1)
    const date = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${date(period.start)} to ${date(end)}`
  }
  const currentOneOffs = oneOffsFor(data, now).filter(o => o.amount > 0)
  const lines = [`*${title}*`, '', `Bills and savings: ${month}. One-offs: current pay periods (dates below).`]
  let total = 0, savingsFunded = 0, hasCosts = false

  for (const owner of ['JOINT', 'NIAMH', 'RUPERT'] as const) {
    const joint = owner === 'JOINT'
    const categories = data.categories.filter(c => c.owner === owner)
    const entries = (type: 'EXPENSE' | 'SAVINGS') => categories.filter(c => c.type === type)
      .flatMap(c => c.items.filter(i => joint || includePersonal || (type === 'EXPENSE' && i.sharedContribution))
        .map(i => ({ label: i.label, amount: itemAmountForMonth(i, now), propertyId: i.propertyId })))
      .filter(i => i.amount > 0)
    const bills = entries('EXPENSE'), saving = entries('SAVINGS')
    const debts = data.debts.filter(d => d.owner === owner && d.monthlyPayment > 0 && (joint || includePersonal || d.sharedContribution))
      .map(d => ({ label: d.label, amount: d.monthlyPayment, propertyId: d.propertyId }))
    // Personal one-offs have no household marker, so only include them when explicitly requested.
    const oneOffs = currentOneOffs.filter(o => o.owner === owner && (joint || includePersonal))
    const fromIncome = oneOffs.filter(o => !o.fromSavings), fromSavings = oneOffs.filter(o => o.fromSavings)
    const subtotal = [...bills, ...saving, ...debts, ...fromIncome].reduce((sum, i) => sum + i.amount, 0)
    if (!subtotal && !fromSavings.length) continue
    hasCosts = true
    total += subtotal
    savingsFunded += fromSavings.reduce((sum, i) => sum + i.amount, 0)
    lines.push('', `*${joint ? name(owner) : `${name(owner)} pays directly`}*`)
    const itemLine = (i: { label: string; amount: number; propertyId?: string }, suffix = '') => {
      const property = data.properties?.find(p => p.id === i.propertyId)?.label
      return `• ${i.label}${property ? ` (${property})` : ''} — ${fmtBudget(i.amount)}${suffix}`
    }
    for (const [label, items] of [['Bills', bills], ['Debts & mortgages', debts], ['Savings contributions', saving]] as const) {
      if (items.length) lines.push(`${label}:`, ...items.map(i => itemLine(i)))
    }
    if (oneOffs.length) lines.push(`One-off period: ${periodLabel(owner)}`)
    if (fromIncome.length) {
      lines.push('One-offs from income:', ...fromIncome.map(i => itemLine(i,
        joint && i.topUp ? (i.done ? ' (top-up marked done; included below)' : ' (top-up; included below)') : '')))
    }
    if (joint && subtotal > 0) {
      // Use the same funding calculation as the Budget hero, before display rounding.
      const totals = calcTotals(data, { now })
      const jointTotal = totals.expJoint + totals.debtJoint + totals.savJoint
      lines.push(`Joint account needed: ${fmtBudget(jointTotal)}`, `${fmtBudget(jointTotal / 2)} each (50/50 split).`)
      if (fromIncome.some(i => i.topUp)) lines.push('This is the full period total, including top-ups; it is not an extra transfer.')
    } else if (subtotal > 0) lines.push(`Direct total: ${fmtBudget(subtotal)}`)
    if (fromSavings.length) lines.push('One-offs from savings (outside the funding total):', ...fromSavings.map(i => itemLine(i)))
  }

  if (!hasCosts) lines.push('', 'No costs recorded for this month.')
  else {
    lines.push('', `*Total to fund from income: ${fmtBudget(total)}*`, 'Includes savings contributions. Joint transfers are not counted again.')
    if (savingsFunded > 0) lines.push(`Also from savings: ${fmtBudget(savingsFunded)}.`)
  }
  lines.push('', 'Amounts rounded up to whole pounds. Totals use exact saved amounts, so rounded lines may not add up exactly.', 'Shared from Budge')
  return { title, text: lines.join('\n'), hasCosts }
}
