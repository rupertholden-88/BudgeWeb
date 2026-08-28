import { BudgetData, Totals, Owner, daysUntil, monthsToClear, upcomingRenewals, householdCostSplit, ageInYears, ageInMonths } from './models'

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
  /**
   * Life stage, where the user has supplied it. Ages are what make a benchmark
   * meaningful — a pension pot or emergency fund is judged very differently at
   * 32 with a toddler than at 55 with none. Null when nothing is set.
   */
  household: {
    adultAges: number[] // same person order as incomeSplitPct
    dependantAgesMonths: number[]
  } | null
  /**
   * Household costs and who actually bears them. `jointPot` is split evenly by
   * convention; `paidAloneForHousehold` is what each person covers by
   * themselves on the household's behalf (a mortgage one partner pays, say),
   * which the even split alone would hide.
   */
  householdCosts: {
    jointPot: number
    total: number
    perPerson: { paidAloneForHousehold: number; totalContribution: number; pctOfOwnIncome: number; income: number }[]
  } | null
  assets: {
    liquidTotal: number
    pensionsTotal: number
    /** Individually held pots, same person order as incomeSplitPct. */
    pensionsPerPerson: number[]
    /** Only pensions genuinely held jointly — usually 0. */
    pensionsJoint: number
    byType: { type: string; amount: number }[]
    runwayMonths: number | null
  }
  debts: {
    totalBalance: number
    items: { type: string; balance: number; monthlyPayment: number; aprPct: number; isZeroPercent: boolean; zeroPercentDaysLeft: number | null; monthsToClear: number | null }[]
  }
  interest: { earnedPerMonth: number; paidPerMonth: number; netPerMonth: number }
  /** Category-level, not account-specific — e.g. "Energy", not a supplier name. */
  upcomingRenewals: { category: string; daysUntil: number; monthlyAmount: number }[]
  history: { monthsOfData: number }
}

export function buildFinancialSummary(data: BudgetData, totals: Totals): FinancialSummary {
  const today = new Date().toISOString().slice(0, 7)

  const liquidTotal = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    const assets = (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type !== 'PENSION')
    return acc + assets.reduce((a, i) => a + (i.amount || 0), 0)
  }, 0)

  // Pensions are individually held — a pot belonging to one partner is not
  // shared retirement provision, so keep them attributed rather than summed.
  const pensionFor = (owner: Owner) => {
    const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
    return (Array.isArray(snap?.assets) ? snap!.assets : [])
      .filter((a: any) => a.type === 'PENSION')
      .reduce((a: number, i: any) => a + (i.amount || 0), 0)
  }
  const pensionN = pensionFor('NIAMH')
  const pensionR = pensionFor('RUPERT')
  const pensionJoint = pensionFor('JOINT')
  const pensionsTotal = pensionN + pensionR + pensionJoint

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

  const split = householdCostSplit(data, totals)
  const householdCosts = split.householdTotal > 0 && totals.incN > 0 && totals.incR > 0
    ? {
        jointPot: Math.round(split.jointPot),
        total: Math.round(split.householdTotal),
        perPerson: [
          { income: totals.incN, paidAloneForHousehold: Math.round(split.sharedByN), totalContribution: Math.round(split.contributionN), pctOfOwnIncome: Math.round((split.contributionN / totals.incN) * 1000) / 10 },
          { income: totals.incR, paidAloneForHousehold: Math.round(split.sharedByR), totalContribution: Math.round(split.contributionR), pctOfOwnIncome: Math.round((split.contributionR / totals.incR) * 1000) / 10 },
        ],
      }
    : null

  const renewals = upcomingRenewals(data)
    .filter(r => r.days <= 120)
    .map(r => ({ category: r.category, daysUntil: r.days, monthlyAmount: r.amount }))

  const monthsOfData = new Set((data.spendHistory || []).map(s => s.date)).size

  const adultAges = [ageInYears(data.bornNiamh), ageInYears(data.bornRupert)].filter((a): a is number => a != null)
  const dependantAgesMonths = (data.dependants ?? [])
    .map(d => ageInMonths(d.born))
    .filter((a): a is number => a != null)
  const household = (adultAges.length > 0 || dependantAgesMonths.length > 0)
    ? { adultAges, dependantAgesMonths }
    : null

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
    household,
    householdCosts,
    assets: {
      liquidTotal,
      pensionsTotal,
      pensionsPerPerson: [pensionN, pensionR],
      pensionsJoint: pensionJoint,
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
        monthsToClear: monthsToClear(d.currentBalance, d.monthlyPayment, d.isZeroPercent ? 0 : d.interestRate),
      })),
    },
    interest: { earnedPerMonth: Math.round(earned), paidPerMonth: Math.round(paid), netPerMonth: Math.round(earned - paid) },
    upcomingRenewals: renewals,
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
