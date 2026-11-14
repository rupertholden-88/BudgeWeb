import { BudgetData, Debt, calcTotals, monthKey } from './models'

export function localDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null
}
export function dateKey(date = new Date()): string {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`
}
/** Whole-month estimate: a remaining partial month counts as one payment. */
export function mortgageMonths(from: Date, to: Date): number {
  if (to <= from) return 0
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + (to.getDate() > from.getDate() ? 1 : 0))
}
export function mortgagePayment(balance: number, rate: number, months: number, type: 'repayment' | 'interestOnly'): number | null {
  if (![balance, rate, months].every(Number.isFinite) || balance < 0 || rate < 0 || months <= 0) return null
  if (balance === 0) return 0
  const r = rate / 1200
  if (type === 'interestOnly') return balance * r
  if (r === 0) return balance / months
  return balance * r / -Math.expm1(-months * Math.log1p(r))
}
export function projectedBalance(balance: number, rate: number, payment: number, months: number): number {
  const r = rate / 1200
  if (r === 0) return Math.max(0, balance - payment * months)
  const growth = Math.expm1(months * Math.log1p(r))
  return Math.max(0, balance * (growth + 1) - payment * growth / r)
}
export function mortgageScenario(debt: Debt, rate: number, basis: 'today' | 'renewal', now = new Date()) {
  const m = debt.mortgage
  const end = localDate(m?.maturityDate)
  const statement = localDate(m?.balanceDate)
  const today = localDate(dateKey(now))!
  const fail = (error: string) => ({ error, payment: null, balance: null, months: null, date: null })
  if (!m?.repaymentType) return fail('Add the repayment type in Details.')
  if (!end || end <= today) return fail('Add a mortgage end date after today in Details.')
  if (!statement || statement > today) return fail('Add the date of your latest balance, no later than today.')
  if (!(debt.interestRate > 0 || m.rateConfirmed) || !Number.isFinite(debt.interestRate) || debt.interestRate < 0) return fail('Confirm your current interest rate in Details.')
  if (!Number.isFinite(debt.currentBalance) || debt.currentBalance < 0 || !Number.isFinite(debt.monthlyPayment) || debt.monthlyPayment < 0) return fail('Check the recorded balance and monthly payment.')
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return fail('Enter a scenario rate between 0% and 100%.')
  let balance = debt.currentBalance
  let date = today
  if (basis === 'renewal') {
    const renewal = localDate(m.dealEnds)
    if (!renewal || renewal <= today) return fail('Add a future deal-end date. If it has passed, confirm your current deal first.')
    if (renewal >= end) return fail('The deal must end before the mortgage ends for a renewal estimate.')
    if (m.repaymentType === 'interestOnly' && debt.monthlyPayment < balance * debt.interestRate / 1200 - .01) return fail('Your recorded payment is below the monthly interest. Confirm the payment before projecting to renewal.')
    if (m.repaymentType === 'repayment' && balance > 0 && debt.monthlyPayment <= balance * debt.interestRate / 1200) return fail('Your recorded payment does not reduce the balance. Check it before projecting to renewal.')
    date = renewal
    balance = projectedBalance(balance, debt.interestRate, debt.monthlyPayment, mortgageMonths(statement, renewal))
  }
  const months = mortgageMonths(date, end)
  const payment = mortgagePayment(balance, rate, months, m.repaymentType)
  if (payment == null || !Number.isFinite(payment)) return fail('Check the balance, rate and remaining term.')
  return { error: null, payment, balance, months, date: dateKey(date) }
}
export function mortgageImpact(data: BudgetData, id: string, payment: number) {
  const before = calcTotals(data)
  const after = calcTotals({ ...data, debts: data.debts.map(d => d.id === id ? { ...d, monthlyPayment: payment } : d) })
  return { before, after, jointBefore: before.expJoint + before.debtJoint + before.savJoint, jointAfter: after.expJoint + after.debtJoint + after.savJoint }
}
export function mortgageReviews(data: BudgetData, now = new Date()) {
  const today = localDate(dateKey(now))!
  return data.debts.filter(d => d.type === 'MORTGAGE' && d.currentBalance > 0 && localDate(d.mortgage?.dealEnds)).map(debt => {
    const end = localDate(debt.mortgage!.dealEnds)!
    // Clamp the review day when six months earlier has fewer days.
    const first = new Date(end.getFullYear(), end.getMonth() - 6, 1)
    const review = new Date(first.getFullYear(), first.getMonth(), Math.min(end.getDate(), new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()))
    const days = Math.round((end.getTime() - today.getTime()) / 86400000)
    const stage: 'upcoming' | 'review' | 'soon' | 'urgent' | 'ended' = days < 0 ? 'ended' : days <= 30 ? 'urgent' : days <= 90 ? 'soon' : today >= review ? 'review' : 'upcoming'
    return { debt, date: dateKey(end), days, reviewFrom: dateKey(review), stage }
  }).sort((a, b) => a.date.localeCompare(b.date))
}
