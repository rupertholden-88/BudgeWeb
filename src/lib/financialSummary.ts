import { BudgetData, Totals, Owner, daysUntil } from './models'

/**
 * A numbers-only snapshot of the household's finances for an AI assessment.
 * Deliberately excludes names, emails, and institution names — only
 * quantities and rates that matter for a financial-health read.
 */
export interface FinancialSummary {
  monthly: {
    totalIncome: number
    totalExpenses: number
    totalSavingsContribution: number
    debtPayments: number
    leftover: number
    savingsRatePct: number
  }
  earners: number
  incomeSplitPct: number[] // e.g. [38, 62] — proportion of household income each earner brings
  jointCostSplit: { sharedTotal: number; equalSplitPctOfIncome: number[] } | null
  assets: {
    liquidTotal: number
    pensionsTotal: number
    byType: { type: string; amount: number }[]
    runwayMonths: number | null
  }
  debts: {
    totalBalance: number
    items: { type: string; balance: number; monthlyPayment: number; aprPct: number; isZeroPercent: boolean; zeroPercentDaysLeft: number | null }[]
  }
  interest: { earnedPerMonth: number; paidPerMonth: number; netPerMonth: number }
  upcomingRenewalsCount: number
  history: { monthsOfData: number }
}

export function buildFinancialSummary(data: BudgetData, totals: Totals): FinancialSummary {
  const today = new Date().toISOString().slice(0, 7)

  const liquidTotal = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    const assets = (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type !== 'PENSION')
    return acc + assets.reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)

  const pensionsTotal = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    const assets = (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type === 'PENSION')
    return acc + assets.reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)

  const byTypeMap = new Map<string, number>()
  ;(['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).forEach(owner => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    ;(Array.isArray(snap?.assets) ? snap!.assets : []).forEach((a: any) => {
      byTypeMap.set(a.type, (byTypeMap.get(a.type) || 0) + (a.amount || 0))
    })
  })

  const earned = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    const assets = (Array.isArray(snap?.assets) ? snap!.assets : [])
      .filter((a: any) => a.type !== 'PENSION' && a.interestRate && a.amount > 0)
    return acc + assets.reduce((a: number, i: any) => a + i.amount * (Math.pow(1 + i.interestRate / 100, 1 / 12) - 1), 0)
  }, 0)
  const paid = data.debts.reduce((a, d) => a + (d.isZeroPercent ? 0 : (d.currentBalance * d.interestRate) / 100 / 12), 0)

  const totalExpenses = totals.totalExp
  const leftover = totals.net
  const savingsRatePct = totals.totalInc > 0 ? Math.round((totals.totalSav / totals.totalInc) * 100) : 0
  const runwayMonths = totalExpenses > 0 ? Math.round((liquidTotal / totalExpenses) * 10) / 10 : null

  const incomes = [totals.incN, totals.incR].filter(v => v > 0)
  const incomeSum = incomes.reduce((a, b) => a + b, 0)
  const incomeSplitPct = incomeSum > 0 ? incomes.map(v => Math.round((v / incomeSum) * 100)) : []

  const jointTotal = totals.expJoint + totals.savJoint + totals.debtJoint
  const jointCostSplit = jointTotal > 0 && incomeSum > 0
    ? { sharedTotal: jointTotal, equalSplitPctOfIncome: incomes.map(v => Math.round(((jointTotal / incomes.length) / v) * 1000) / 10) }
    : null

  const renewalsCount = data.categories
    .filter(c => c.type === 'EXPENSE')
    .flatMap(c => c.items)
    .filter(i => i.renewalDate && daysUntil(i.renewalDate) <= 60 && daysUntil(i.renewalDate) >= 0)
    .length

  const monthsOfData = new Set((data.spendHistory || []).map(s => s.date)).size

  return {
    monthly: {
      totalIncome: totals.totalInc,
      totalExpenses,
      totalSavingsContribution: totals.totalSav,
      debtPayments: totals.totalDebt,
      leftover,
      savingsRatePct,
    },
    earners: incomes.length,
    incomeSplitPct,
    jointCostSplit,
    assets: {
      liquidTotal,
      pensionsTotal,
      byType: Array.from(byTypeMap.entries()).map(([type, amount]) => ({ type, amount })).filter(t => t.amount > 0),
      runwayMonths,
    },
    debts: {
      totalBalance: data.debts.reduce((a, d) => a + d.currentBalance, 0),
      items: data.debts.filter(d => d.currentBalance > 0).map(d => ({
        type: d.type,
        balance: d.currentBalance,
        monthlyPayment: d.monthlyPayment,
        aprPct: d.isZeroPercent ? 0 : d.interestRate,
        isZeroPercent: d.isZeroPercent,
        zeroPercentDaysLeft: d.isZeroPercent && d.zeroPercentExpiryDate ? daysUntil(d.zeroPercentExpiryDate) : null,
      })),
    },
    interest: { earnedPerMonth: Math.round(earned), paidPerMonth: Math.round(paid), netPerMonth: Math.round(earned - paid) },
    upcomingRenewalsCount: renewalsCount,
    history: { monthsOfData },
  }
}

/** Small, non-cryptographic hash used only to detect when the summary has changed. */
export function hashSummary(summary: FinancialSummary): string {
  const str = JSON.stringify(summary)
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return (h >>> 0).toString(36)
}
