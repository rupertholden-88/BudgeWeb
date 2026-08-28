export type Owner = 'NIAMH' | 'RUPERT' | 'JOINT'
export type EntryType = 'INCOME' | 'EXPENSE' | 'SAVINGS'
export type SpendingPriority = 'NECESSITY' | 'DISCRETIONARY' | 'NONE'
export type AssetType = 'CASH' | 'CASH_ISA' | 'STOCKS_SHARES_ISA' | 'JUNIOR_ISA' | 'LIFETIME_ISA' | 'SAVINGS_ACCOUNT' | 'CRYPTO' | 'OTHER' | 'PENSION'
export type DebtType = 'CREDIT_CARD' | 'PERSONAL_LOAN' | 'CAR_FINANCE' | 'MORTGAGE' | 'STUDENT_LOAN' | 'OTHER'

/**
 * `sharedContribution` marks a cost paid out of one person's own column that
 * nonetheless benefits the household — a mortgage one partner covers alone,
 * say. It doesn't change who pays it (the totals already reflect that); it
 * makes the cost visible to the fairness comparison, which would otherwise
 * treat it as personal spending and understate that person's contribution.
 */
export interface LineItem { id: string; label: string; amount: number; priority: SpendingPriority; renewalDate?: string; sharedContribution?: boolean }
export interface Category { key: string; owner: Owner; type: EntryType; label: string; shared?: boolean; note?: string; items: LineItem[] }
export interface Asset { id: string; type: AssetType; label: string; amount: number; interestRate?: number; institution?: string }
export interface SavingsSnapshot { date: string; owner: Owner; assets: Asset[] }
export interface Debt { id: string; owner: Owner; type: DebtType; label: string; currentBalance: number; monthlyPayment: number; interestRate: number; isZeroPercent: boolean; zeroPercentExpiryDate?: string; institution?: string; sharedContribution?: boolean }
export interface SpendSnapshot { date: string; totalInc: number; totalExp: number; totalSav: number }
export type FinancialHealthStatus = 'strong' | 'solid' | 'attention' | 'at_risk'
export interface FinancialHealthResult {
  headline: string
  status: FinancialHealthStatus
  overview: string
  sections: { title: string; body: string; status?: FinancialHealthStatus }[]
  benchmarks: { metric: string; yours: string; typical: string; status: FinancialHealthStatus }[]
  strengths: string[]
  priorityActions: string[]
}
/** Cached AI health check — synced like everything else so it follows the account, not just the device. */
export interface FinancialHealthCache {
  hash: string; result: FinancialHealthResult | null; rawText: string | null; generatedAt: string
  costUsd: number; inputTokens: number; outputTokens: number
}
/** Running total across every check ever run on this account — the cache above only holds the latest. */
export interface FinancialHealthUsage { totalRuns: number; totalCostUsd: number }
export interface BudgetData { categories: Category[]; savingsHistory: SavingsSnapshot[]; spendHistory: SpendSnapshot[]; debts: Debt[]; savedAt: string; nameNiamh: string; nameRupert: string; nameJoint: string; financialHealth?: FinancialHealthCache | null; financialHealthUsage?: FinancialHealthUsage | null }
export interface Totals { incN: number; incR: number; expN: number; expR: number; savN: number; savR: number; debtN: number; debtR: number; expJoint: number; savJoint: number; debtJoint: number; halfJointExp: number; halfJointSav: number; halfJointDebt: number; netN: number; netR: number; totalInc: number; totalExp: number; totalSav: number; totalDebt: number; net: number }

export function defaultBudgetData(): BudgetData {
  return {
    nameNiamh: '', nameRupert: '', nameJoint: '',
    savedAt: '', savingsHistory: [], spendHistory: [], debts: [],
    categories: [
      { key: 'inc_n', owner: 'NIAMH', type: 'INCOME', label: 'Income', items: [
        { id: 'inc_n_0', label: 'Salary / Wages', amount: 0, priority: 'NONE' },
      ]},
      { key: 'pers_n', owner: 'NIAMH', type: 'EXPENSE', label: 'Personal Spend', items: [
        { id: 'pers_n_0', label: 'Clothing', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_n_1', label: 'Personal Care', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'inc_r', owner: 'RUPERT', type: 'INCOME', label: 'Income', items: [
        { id: 'inc_r_0', label: 'Salary / Wages', amount: 0, priority: 'NONE' },
      ]},
      { key: 'pers_r', owner: 'RUPERT', type: 'EXPENSE', label: 'Personal Spend', items: [
        { id: 'pers_r_0', label: 'Clothing', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_r_1', label: 'Personal Care', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'house', owner: 'JOINT', type: 'EXPENSE', label: 'Accommodation', items: [
        { id: 'house_0', label: 'Mortgage / Rent', amount: 0, priority: 'NECESSITY' },
        { id: 'house_1', label: 'Council Tax', amount: 0, priority: 'NECESSITY' },
        { id: 'house_2', label: 'Water', amount: 0, priority: 'NECESSITY' },
        { id: 'house_3', label: 'Broadband', amount: 0, priority: 'NECESSITY' },
        { id: 'house_4', label: 'Insurance', amount: 0, priority: 'NECESSITY' },
      ]},
      { key: 'energy', owner: 'JOINT', type: 'EXPENSE', label: 'Energy', items: [
        { id: 'energy_0', label: 'Gas & Electricity', amount: 0, priority: 'NECESSITY' },
      ]},
      { key: 'food', owner: 'JOINT', type: 'EXPENSE', label: 'Food & Drink', items: [
        { id: 'food_0', label: 'Groceries', amount: 0, priority: 'NECESSITY' },
        { id: 'food_1', label: 'Eating Out', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'trans', owner: 'JOINT', type: 'EXPENSE', label: 'Transport', items: [
        { id: 'trans_0', label: 'Fuel', amount: 0, priority: 'NECESSITY' },
        { id: 'trans_1', label: 'Car Insurance', amount: 0, priority: 'NECESSITY' },
      ]},
      { key: 'subs', owner: 'JOINT', type: 'EXPENSE', label: 'Subscriptions', items: [
        { id: 'subs_0', label: 'Streaming', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'sav', owner: 'JOINT', type: 'SAVINGS', label: 'Savings', items: [
        { id: 'sav_0', label: 'Emergency Fund', amount: 0, priority: 'NONE' },
      ]},
    ]
  }
}

export function calcTotals(budget: BudgetData): Totals {
  const sum = (cats: Category[]) => cats.reduce((acc, c) => acc + c.items.reduce((a, i) => a + i.amount, 0), 0)
  const incN = sum(budget.categories.filter(c => c.owner === 'NIAMH' && c.type === 'INCOME'))
  const incR = sum(budget.categories.filter(c => c.owner === 'RUPERT' && c.type === 'INCOME'))
  const expN = sum(budget.categories.filter(c => c.owner === 'NIAMH' && c.type === 'EXPENSE'))
  const expR = sum(budget.categories.filter(c => c.owner === 'RUPERT' && c.type === 'EXPENSE'))
  const savN = sum(budget.categories.filter(c => c.owner === 'NIAMH' && c.type === 'SAVINGS'))
  const savR = sum(budget.categories.filter(c => c.owner === 'RUPERT' && c.type === 'SAVINGS'))
  const debtN = budget.debts.filter(d => d.owner === 'NIAMH').reduce((a, d) => a + d.monthlyPayment, 0)
  const debtR = budget.debts.filter(d => d.owner === 'RUPERT').reduce((a, d) => a + d.monthlyPayment, 0)
  const debtJoint = budget.debts.filter(d => d.owner === 'JOINT').reduce((a, d) => a + d.monthlyPayment, 0)
  const expJoint = sum(budget.categories.filter(c => c.owner === 'JOINT' && c.type === 'EXPENSE'))
  const savJoint = sum(budget.categories.filter(c => c.owner === 'JOINT' && c.type === 'SAVINGS'))
  const hjExp = expJoint / 2; const hjSav = savJoint / 2; const hjDebt = debtJoint / 2
  const totalInc = incN + incR
  const totalDebt = debtN + debtR + debtJoint
  const totalExp = expN + expR + expJoint + totalDebt
  const totalSav = savN + savR + savJoint
  return {
    incN, incR, expN, expR, savN, savR, debtN, debtR,
    expJoint, savJoint, debtJoint,
    halfJointExp: hjExp, halfJointSav: hjSav, halfJointDebt: hjDebt,
    netN: incN - expN - savN - debtN - hjExp - hjSav - hjDebt,
    netR: incR - expR - savR - debtR - hjExp - hjSav - hjDebt,
    totalInc, totalExp, totalSav, totalDebt,
    net: totalInc - totalExp - totalSav,
  }
}

export const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n)
export type TabFilter = 'ALL' | 'NIAMH' | 'RUPERT' | 'JOINT'

/**
 * How household costs actually break down, accounting for costs one person
 * pays alone on the household's behalf. `jointPot` is split evenly by
 * convention; `sharedByN`/`sharedByR` are borne entirely by that person.
 */
export function householdCostSplit(budget: BudgetData, totals: Totals) {
  const sharedFor = (owner: Owner) => {
    const fromItems = budget.categories
      .filter(c => c.owner === owner && c.type === 'EXPENSE')
      .reduce((a, c) => a + c.items.filter(i => i.sharedContribution).reduce((b, i) => b + i.amount, 0), 0)
    const fromDebts = budget.debts
      .filter(d => d.owner === owner && d.sharedContribution)
      .reduce((a, d) => a + d.monthlyPayment, 0)
    return fromItems + fromDebts
  }
  const jointPot = totals.expJoint + totals.savJoint + totals.debtJoint
  const sharedByN = sharedFor('NIAMH')
  const sharedByR = sharedFor('RUPERT')
  return {
    jointPot,
    sharedByN,
    sharedByR,
    householdTotal: jointPot + sharedByN + sharedByR,
    // What each person actually puts towards the household.
    contributionN: jointPot / 2 + sharedByN,
    contributionR: jointPot / 2 + sharedByR,
  }
}

/** Months to clear a balance at a given APR, or null if the payment never clears it. */
export function monthsToClear(balance: number, payment: number, annualRate: number): number | null {
  if (balance <= 0) return 0
  if (payment <= 0) return null
  const r = annualRate / 100 / 12
  if (r <= 0) return Math.ceil(balance / payment)
  if (payment <= balance * r) return null // payment doesn't even cover the interest
  return Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r))
}

/** Whole days until a renewal date. Negative once the date has passed. */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return NaN
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - startOfToday.getTime()) / 86400000)
}

/** Every expense line carrying a renewal date, soonest first. */
export function upcomingRenewals(data: BudgetData) {
  return data.categories
    .filter(c => c.type === 'EXPENSE')
    .flatMap(c => c.items
      .filter(i => i.renewalDate)
      .map(i => ({
        id: i.id,
        label: i.label,
        amount: i.amount,
        category: c.label,
        owner: c.owner,
        date: i.renewalDate!,
        days: daysUntil(i.renewalDate!),
      })))
    .filter(r => !isNaN(r.days))
    .sort((a, b) => a.days - b.days)
}

export function isFirstRun(data: BudgetData): boolean {
  return !data.nameNiamh && !data.nameRupert
}
