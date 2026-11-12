import { BudgetData, calcTotals, monthKey } from './models'

/** Missing snapshots stay missing: household spending cannot establish joint funding. */
export function jointHistory(data: BudgetData, now = new Date()) {
  const totals = calcTotals(data, { now })
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = monthKey(date)
    const saved = data.spendHistory.find(s => s.date === key)
    const amount = i === 11 ? totals.expJoint + totals.debtJoint + totals.savJoint : saved?.jointRequired ?? null
    return { key, label: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), amount, current: i === 11 }
  })
}
