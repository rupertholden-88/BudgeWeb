export type Owner = 'NIAMH' | 'RUPERT' | 'JOINT'
export type EntryType = 'INCOME' | 'EXPENSE' | 'SAVINGS'
export type SpendingPriority = 'NECESSITY' | 'DISCRETIONARY' | 'NONE'
export type AssetType = 'CASH' | 'CASH_ISA' | 'STOCKS_SHARES_ISA' | 'JUNIOR_ISA' | 'LIFETIME_ISA' | 'SAVINGS_ACCOUNT' | 'CRYPTO' | 'OTHER'
export type DebtType = 'CREDIT_CARD' | 'PERSONAL_LOAN' | 'CAR_FINANCE' | 'MORTGAGE' | 'STUDENT_LOAN' | 'OTHER'

export interface LineItem { id: string; label: string; amount: number; priority: SpendingPriority }
export interface Category { key: string; owner: Owner; type: EntryType; label: string; shared?: boolean; note?: string; items: LineItem[] }
export interface Asset { id: string; type: AssetType; label: string; amount: number; interestRate?: number; institution?: string }
export interface SavingsSnapshot { date: string; owner: Owner; assets: Asset[] }
export interface Debt { id: string; owner: Owner; type: DebtType; label: string; currentBalance: number; monthlyPayment: number; interestRate: number; isZeroPercent: boolean; zeroPercentExpiryDate?: string; institution?: string }
export interface BudgetData { categories: Category[]; savingsHistory: SavingsSnapshot[]; debts: Debt[]; savedAt: string; nameNiamh: string; nameRupert: string; nameJoint: string }
export interface Totals { incN: number; incR: number; expN: number; expR: number; savN: number; savR: number; debtN: number; debtR: number; expJoint: number; savJoint: number; debtJoint: number; halfJointExp: number; halfJointSav: number; halfJointDebt: number; netN: number; netR: number; totalInc: number; totalExp: number; totalSav: number; totalDebt: number; net: number }

export function defaultBudgetData(): BudgetData {
  return {
    nameNiamh: 'Niamh', nameRupert: 'Rupert', nameJoint: 'Joint',
    savedAt: '', savingsHistory: [], debts: [],
    categories: [
      { key: 'inc_n', owner: 'NIAMH', type: 'INCOME', label: 'Income', items: [
        { id: 'inc_n_0', label: 'Salary / Wages', amount: 0, priority: 'NONE' },
        { id: 'inc_n_1', label: 'Freelance', amount: 0, priority: 'NONE' },
        { id: 'inc_n_2', label: 'Benefits', amount: 0, priority: 'NONE' },
        { id: 'inc_n_3', label: 'Other', amount: 0, priority: 'NONE' },
      ]},
      { key: 'pers_n', owner: 'NIAMH', type: 'EXPENSE', label: 'Personal Spend', items: [
        { id: 'pers_n_0', label: 'Clothing', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_n_1', label: 'Personal Care', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_n_2', label: 'Hobbies', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_n_3', label: 'Eating Out (solo)', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_n_4', label: 'Other', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'sav_n', owner: 'NIAMH', type: 'SAVINGS', label: 'Monthly Savings Plan', items: [
        { id: 'sav_n_0', label: 'Personal Savings', amount: 0, priority: 'NONE' },
      ]},
      { key: 'inc_r', owner: 'RUPERT', type: 'INCOME', label: 'Income', items: [
        { id: 'inc_r_0', label: 'Salary / Wages', amount: 0, priority: 'NONE' },
        { id: 'inc_r_1', label: 'Freelance', amount: 0, priority: 'NONE' },
        { id: 'inc_r_2', label: 'Benefits', amount: 0, priority: 'NONE' },
        { id: 'inc_r_3', label: 'Other', amount: 0, priority: 'NONE' },
      ]},
      { key: 'pers_r', owner: 'RUPERT', type: 'EXPENSE', label: 'Personal Spend', items: [
        { id: 'pers_r_0', label: 'Clothing', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_r_1', label: 'Personal Care', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_r_2', label: 'Hobbies', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_r_3', label: 'Eating Out (solo)', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'pers_r_4', label: 'Other', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'sav_r', owner: 'RUPERT', type: 'SAVINGS', label: 'Monthly Savings Plan', items: [
        { id: 'sav_r_0', label: 'Personal Savings', amount: 0, priority: 'NONE' },
      ]},
      { key: 'house_n', owner: 'JOINT', type: 'EXPENSE', label: 'Laurel Gardens', items: [
        { id: 'house_n_0', label: 'Mortgage / Rent', amount: 0, priority: 'NECESSITY' },
        { id: 'house_n_1', label: 'Council Tax', amount: 0, priority: 'NECESSITY' },
        { id: 'house_n_2', label: 'Water', amount: 0, priority: 'NECESSITY' },
        { id: 'house_n_3', label: 'Broadband', amount: 0, priority: 'NECESSITY' },
        { id: 'house_n_4', label: 'Insurance', amount: 0, priority: 'NECESSITY' },
        { id: 'house_n_5', label: 'Maintenance', amount: 0, priority: 'NECESSITY' },
      ]},
      { key: 'house_r', owner: 'JOINT', type: 'EXPENSE', label: 'Mulberry Cottage', items: [
        { id: 'house_r_0', label: 'Mortgage / Rent', amount: 0, priority: 'NECESSITY' },
        { id: 'house_r_1', label: 'Council Tax', amount: 0, priority: 'NECESSITY' },
        { id: 'house_r_2', label: 'Water', amount: 0, priority: 'NECESSITY' },
        { id: 'house_r_3', label: 'Broadband', amount: 0, priority: 'NECESSITY' },
        { id: 'house_r_4', label: 'Insurance', amount: 0, priority: 'NECESSITY' },
        { id: 'house_r_5', label: 'Maintenance', amount: 0, priority: 'NECESSITY' },
      ]},
      { key: 'energy', owner: 'JOINT', type: 'EXPENSE', label: 'Energy (Shared)', shared: true, note: 'One bill between both houses — split 50/50', items: [
        { id: 'energy_0', label: 'Gas & Electricity', amount: 0, priority: 'NECESSITY' },
      ]},
      { key: 'food', owner: 'JOINT', type: 'EXPENSE', label: 'Food & Drink', items: [
        { id: 'food_0', label: 'Groceries', amount: 0, priority: 'NECESSITY' },
        { id: 'food_1', label: 'Eating Out', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'food_2', label: 'Coffee & Snacks', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'baby', owner: 'JOINT', type: 'EXPENSE', label: 'Baby & Family', items: [
        { id: 'baby_0', label: 'Childcare / Nursery', amount: 0, priority: 'NECESSITY' },
        { id: 'baby_1', label: 'Baby Supplies', amount: 0, priority: 'NECESSITY' },
        { id: 'baby_2', label: 'Clothing', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'baby_3', label: 'Activities', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'trans', owner: 'JOINT', type: 'EXPENSE', label: 'Transport', items: [
        { id: 'trans_0', label: 'Car Insurance', amount: 0, priority: 'NECESSITY' },
        { id: 'trans_1', label: 'Fuel', amount: 0, priority: 'NECESSITY' },
        { id: 'trans_2', label: 'Road Tax / MOT', amount: 0, priority: 'NECESSITY' },
        { id: 'trans_3', label: 'Public Transport', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'subs', owner: 'JOINT', type: 'EXPENSE', label: 'Subscriptions & Leisure', items: [
        { id: 'subs_0', label: 'Streaming', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'subs_1', label: 'Gym / Fitness', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'subs_2', label: 'Holidays (saving)', amount: 0, priority: 'DISCRETIONARY' },
        { id: 'subs_3', label: 'Other', amount: 0, priority: 'DISCRETIONARY' },
      ]},
      { key: 'sav', owner: 'JOINT', type: 'SAVINGS', label: 'Monthly Savings Plan', items: [
        { id: 'sav_0', label: 'Emergency Fund', amount: 0, priority: 'NONE' },
        { id: 'sav_1', label: 'Joint Savings', amount: 0, priority: 'NONE' },
        { id: 'sav_2', label: 'Shared Loan / Repayment', amount: 0, priority: 'NONE' },
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
export type TabFilter = 'ALL' | 'NIAMH' | 'RUPERT' | 'JOINT'
