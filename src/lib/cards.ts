import { Debt, debtPayoff } from './models'

/**
 * Would moving credit card balances onto one 0% balance transfer card save
 * money? Compares the cards as they are against one new card, paying the same
 * total each month either way, so the only difference is the interest.
 */
export interface TransferDeal {
  /** Months at 0%. */
  months: number
  /** One-off fee as a percentage of the amount moved. */
  feePct: number
  /** The card's rate once the 0% ends. */
  rateAfter: number
}

export const TYPICAL_DEAL: TransferDeal = { months: 24, feePct: 3, rateAfter: 24.9 }

export interface CardPlan {
  cards: Debt[]
  balance: number
  payment: number
  /** As things are. Null months means a payment doesn't cover its interest. */
  now: { interest: number; months: number | null }
  /** Same payments, but each card's payment moves to the highest-rate card left once it's cleared. */
  rollover: { interest: number; months: number | null }
  transfer: { fee: number; interest: number; months: number | null; leftWhenZeroEnds: number }
  /** Positive when the transfer costs less than carrying on. */
  saving: number | null
  /** Monthly payment that clears everything before the 0% ends. */
  clearByEnd: number
}

export const isCard = (d: Debt) => d.type === 'CREDIT_CARD' && d.currentBalance > 0

/** A card is worth moving if it charges interest now, or will before a new deal's 0% would end. */
export function worthMoving(d: Debt, deal: TransferDeal): boolean {
  if (!d.isZeroPercent) return (Number(d.interestRate) || 0) > 0
  if (!d.zeroPercentExpiryDate) return false
  const end = new Date(d.zeroPercentExpiryDate.length === 7 ? `${d.zeroPercentExpiryDate}-01` : d.zeroPercentExpiryDate)
  const dealEnd = new Date(); dealEnd.setMonth(dealEnd.getMonth() + deal.months)
  return end < dealEnd && (Number(d.interestRate) || 0) > 0
}

const monthsFromNow = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10) }

/** Rate in a given month (1-based) for a card as recorded. */
function rateIn(d: Debt, m: number): number {
  const after = (Number(d.interestRate) || 0) / 100 / 12
  if (!d.isZeroPercent) return after
  if (!d.zeroPercentExpiryDate) return 0
  const end = new Date(d.zeroPercentExpiryDate.length === 7 ? `${d.zeroPercentExpiryDate}-01` : d.zeroPercentExpiryDate)
  const zeroMonths = Math.max(0, Math.floor((end.getTime() - Date.now()) / 864e5 / 30.44))
  return m <= zeroMonths ? 0 : after
}

/** Pays the same total, moving each cleared card's payment to the highest-rate card still owing. */
function withRollover(cards: Debt[]): { interest: number; months: number | null } {
  const bal = cards.map(c => c.currentBalance)
  const pay = cards.map(c => c.monthlyPayment)
  const total = pay.reduce((a, b) => a + b, 0)
  if (total <= 0) return { interest: 0, months: null }
  let interest = 0
  for (let m = 1; m <= 600; m++) {
    let spare = 0
    for (let i = 0; i < cards.length; i++) {
      if (bal[i] <= 0) { spare += pay[i]; continue }
      const int = bal[i] * rateIn(cards[i], m)
      interest += int
      bal[i] += int - pay[i]
      if (bal[i] < 0) { spare += -bal[i]; bal[i] = 0 }
    }
    while (spare > 0.005) {
      const open = cards.map((c, i) => i).filter(i => bal[i] > 0)
      if (open.length === 0) break
      const top = open.reduce((a, b) => rateIn(cards[b], m + 1) > rateIn(cards[a], m + 1) ? b : a)
      const used = Math.min(spare, bal[top]); bal[top] -= used; spare -= used
    }
    if (bal.every(b => b <= 0.005)) return { interest, months: m }
    if (m === 600) break
  }
  return { interest, months: null }
}

export function cardPlan(cards: Debt[], deal: TransferDeal): CardPlan | null {
  if (cards.length === 0) return null
  const balance = cards.reduce((a, c) => a + c.currentBalance, 0)
  const payment = cards.reduce((a, c) => a + c.monthlyPayment, 0)
  const each = cards.map(c => debtPayoff(c))
  const now = {
    interest: each.reduce((a, p) => a + p.interest, 0),
    months: each.some(p => p.months == null) ? null : Math.max(...each.map(p => p.months!)),
  }
  const fee = Math.round(balance * deal.feePct) / 100
  const moved: Debt = {
    id: 'transfer', owner: cards[0].owner, type: 'CREDIT_CARD', label: 'Balance transfer',
    currentBalance: balance + fee, monthlyPayment: payment, interestRate: deal.rateAfter,
    isZeroPercent: deal.months > 0, zeroPercentExpiryDate: monthsFromNow(deal.months),
  }
  const t = debtPayoff(moved)
  const transfer = { fee, interest: t.interest, months: t.months, leftWhenZeroEnds: Math.max(0, t.balanceWhenZeroEnds ?? 0) }
  // Can't compare against "never": a payment that doesn't cover interest has no end cost.
  const saving = now.months == null || transfer.months == null ? null : now.interest - (fee + transfer.interest)
  return {
    cards, balance, payment, now, rollover: withRollover(cards), transfer, saving,
    clearByEnd: deal.months > 0 ? Math.ceil((balance + fee) / deal.months) : 0,
  }
}
