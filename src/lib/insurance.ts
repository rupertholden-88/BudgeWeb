import { BudgetData, Owner, PolicyDetails, daysUntil, isInsuranceItem, isMortgage } from './models'

/**
 * What a policy covers, worked out from its name. "Home insurance" usually
 * means buildings and contents together, so it counts as both.
 */
export type InsuranceKind =
  | 'home' | 'buildings' | 'contents' | 'landlord' | 'car' | 'life' | 'income' | 'illness'
  | 'pet' | 'travel' | 'gadget' | 'health' | 'emergency' | 'breakdown' | 'other'

const KINDS: [InsuranceKind, RegExp][] = [
  ['landlord', /landlord/i],
  ['buildings', /building/i],
  ['contents', /content/i],
  ['home', /\bhome insur|house insur|household insur|\bhome\b/i],
  ['car', /\bcar\b|motor|vehicle|\bvan\b/i],
  ['breakdown', /breakdown|\brac\b|\baa\b/i],
  ['life', /\blife\b|death/i],
  ['income', /income protection|\bincome\b/i],
  ['pet', /\bpet\b|\bdog\b|\bcat\b/i],
  ['travel', /travel/i],
  ['gadget', /phone|gadget|mobile/i],
  ['health', /health|dental|medical|bupa|vitality/i],
]

export const KIND_LABELS: Record<InsuranceKind, string> = {
  home: 'Buildings & contents', buildings: 'Buildings', contents: 'Contents', landlord: 'Landlord', car: 'Car',
  life: 'Life cover', income: 'Income protection', illness: 'Critical illness', pet: 'Pet', travel: 'Travel',
  gadget: 'Phone & gadgets', health: 'Health', emergency: 'Home emergency', breakdown: 'Breakdown', other: 'Insurance',
}

export const ALL_KINDS = Object.keys(KIND_LABELS) as InsuranceKind[]
export const HOME_KINDS: InsuranceKind[] = ['home', 'buildings', 'contents', 'landlord', 'emergency']
export const PEOPLE_KINDS: InsuranceKind[] = ['life', 'income', 'illness']

export function insuranceKind(label: string): InsuranceKind {
  // Home emergency and critical illness before "home" and "life", which would otherwise claim them.
  if (/home emergency|boiler|homecare/i.test(label)) return 'emergency'
  if (/critical illness/i.test(label)) return 'illness'
  for (const [kind, re] of KINDS) if (re.test(label)) return kind
  return 'other'
}

export type PolicyStatus = 'covered' | 'soon' | 'lapsed' | 'undated'

export interface Policy {
  id: string; catKey: string; label: string; kind: InsuranceKind; owner: Owner
  propertyId?: string; provider?: string; cover?: number
  monthly: number; yearly: number
  renewalDate?: string; days: number | null; autoRenews: boolean
  status: PolicyStatus
  /** For life cover and the like: the date cover runs to, in place of a renewal. */
  coverTo?: string
  /** 0–1 through the policy year, when the renewal date is known. */
  yearProgress: number | null
  details: PolicyDetails
}

const isKind = (k: unknown): k is InsuranceKind => typeof k === 'string' && (ALL_KINDS as string[]).includes(k)

export function statusOf(days: number | null): PolicyStatus {
  if (days == null) return 'undated'
  if (days < 0) return 'lapsed'
  if (days <= 30) return 'soon'
  return 'covered'
}

/**
 * A policy that renews automatically carries on past its renewal date, so a
 * date in the past moves on a year at a time until it's ahead.
 */
export function rollForward(iso?: string): string | undefined {
  if (!iso) return iso
  const d = new Date(iso + 'T12:00:00Z')
  if (isNaN(d.getTime())) return iso
  const today = new Date().toISOString().slice(0, 10)
  for (let n = 0; n < 50 && d.toISOString().slice(0, 10) < today; n++) d.setUTCFullYear(d.getUTCFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export function insurancePolicies(data: BudgetData): Policy[] {
  return data.categories
    .filter(c => c.type === 'EXPENSE')
    .flatMap(c => c.items.filter(i => isInsuranceItem(i.label) || data.policyDetails?.[i.id]).map(i => {
      const details = data.policyDetails?.[i.id] ?? {}
      const renewalDate = i.autoRenews ? rollForward(i.renewalDate) : i.renewalDate
      const days = renewalDate ? daysUntil(renewalDate) : null
      let yearProgress: number | null = null
      if (renewalDate) {
        const end = new Date(renewalDate).getTime()
        const started = details.startDate ? new Date(details.startDate).getTime() : NaN
        const start = started < end && end - started < 400 * 864e5 ? started : end - 365 * 864e5
        yearProgress = end > start ? Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : null
      }
      const kind: InsuranceKind = isKind(details.kind) ? details.kind : insuranceKind(i.label)
      const coverTo = !renewalDate && PEOPLE_KINDS.includes(kind) ? details.life?.termEnd : undefined
      return {
        id: i.id, catKey: c.key, label: i.label, kind, coverTo,
        owner: c.owner, propertyId: i.propertyId, provider: i.insuranceProvider, cover: i.insuranceCoverAmount,
        monthly: i.amount, yearly: details.premiumAnnual && !details.paysMonthly ? details.premiumAnnual : i.amount * 12,
        renewalDate, days, autoRenews: !!i.autoRenews,
        status: coverTo && new Date(coverTo).getTime() > Date.now() ? 'covered' as const : statusOf(days), yearProgress, details,
      }
    }))
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
}

export type AssetKey = `property:${string}` | `car:${string}` | 'people' | 'other' | 'homes'

/** Which group a policy belongs to on the Insurance screen. */
export function assetOf(p: Policy): AssetKey {
  if (HOME_KINDS.includes(p.kind)) return p.propertyId ? `property:${p.propertyId}` : 'homes'
  if (p.kind === 'car') return `car:${p.id}`
  if (PEOPLE_KINDS.includes(p.kind)) return 'people'
  return 'other'
}

export interface InsuranceGap {
  id: string; severity: 'gap' | 'check'; title: string; body: string
  /** Where it shows on the Insurance screen. */
  asset: AssetKey
}

/**
 * Cover a household like this one would usually hold, or details worth a
 * look. Deliberately cautious: each is a prompt to check, since cover can
 * come through an employer, a lender or a packaged bank account.
 */
export function insuranceGaps(data: BudgetData, policies = insurancePolicies(data)): InsuranceGap[] {
  const gaps: InsuranceGap[] = []
  const has = (...kinds: InsuranceKind[]) => policies.some(p => kinds.includes(p.kind))
  const homeCover = (p: Policy) => ['home', 'buildings', 'landlord'].includes(p.kind)
  const unlinkedHome = policies.filter(p => !p.propertyId && homeCover(p))

  for (const prop of data.properties ?? []) {
    const asset: AssetKey = `property:${prop.id}`
    const own = policies.filter(p => p.propertyId === prop.id)
    if (!own.some(homeCover)) {
      const mortgaged = data.debts.some(d => d.propertyId === prop.id && isMortgage(d) && d.currentBalance > 0)
      if (unlinkedHome.length > 0) {
        gaps.push({
          id: `link:${prop.id}`, severity: 'check', asset, title: `Is your ${unlinkedHome[0].label.toLowerCase()} for ${prop.label}?`,
          body: 'Open the policy and choose its home, so Budge can tell which homes are covered.',
        })
      } else {
        gaps.push({
          id: `buildings:${prop.id}`, severity: 'gap', asset, title: 'No buildings cover recorded',
          body: mortgaged
            ? 'Your lender will usually require buildings cover while there’s a mortgage.'
            : prop.isLet
              ? 'A let home needs landlord cover; standard home insurance usually won’t pay out.'
              : 'Rebuilding after a fire or flood is rarely affordable without it.',
        })
      }
    }
    const second = !prop.isMainResidence && !prop.isLet && (data.properties ?? []).length > 1
    if (second && own.length > 0 && !own.some(p => p.details.home?.secondHomeDeclared)) {
      const limit = own.map(p => p.details.home?.unoccupiedDays).find(d => d != null)
      gaps.push({
        id: `second:${prop.id}`, severity: 'check', asset, title: 'Second home: check the insurer knows',
        body: limit
          ? `Cover is limited once it’s empty for ${limit} days in a row. Check that suits how often it’s used.`
          : 'Most home policies limit cover once a home is empty for 30–60 days in a row. Check your limit.',
      })
    }
  }

  const main = (data.properties ?? []).find(p => p.isMainResidence) ?? (data.properties ?? [])[0]
  if (main && !has('home', 'contents')) {
    gaps.push({
      id: 'contents', severity: 'gap', asset: `property:${main.id}`, title: 'No contents cover recorded',
      body: 'Covers your belongings against theft, fire and water damage. Often part of a home policy.',
    })
  }

  for (const car of policies.filter(p => p.kind === 'car')) {
    const c = car.details.car ?? {}
    const excess = (c.excessCompulsory ?? 0) + (c.excessVoluntary ?? 0)
    if (excess > 500) {
      gaps.push({
        id: `excess:${car.id}`, severity: 'check', asset: `car:${car.id}`, title: `Excess of £${excess}`,
        body: 'That’s what you’d pay towards any claim. Check you could cover it from savings.',
      })
    }
    if ((c.breakdown === 'none' || (!c.breakdown && car.details.readFrom?.length)) && !has('breakdown')) {
      gaps.push({
        id: `breakdown:${car.id}`, severity: 'check', asset: `car:${car.id}`, title: 'No breakdown cover found',
        body: 'Not a legal requirement, but a recovery without it can cost a few hundred pounds.',
      })
    }
  }
  const drives = data.categories.some(c => c.items.some(i => /fuel|petrol|diesel|\bcar\b|parking/i.test(i.label) && !isInsuranceItem(i.label)))
  if (drives && !has('car')) {
    gaps.push({
      id: 'car', severity: 'gap', asset: 'other', title: 'No car insurance found',
      body: 'There’s car spending in the budget but no car policy. Driving uninsured is illegal in the UK.',
    })
  }

  const children = (data.dependants ?? []).length
  if (children > 0 && !has('life')) {
    gaps.push({
      id: 'life', severity: 'gap', asset: 'people', title: 'No life cover found',
      body: `With ${children === 1 ? 'a child' : `${children} children`} and a mortgage, life cover would clear the debts if either of you died. Check for death-in-service through work too.`,
    })
  }
  for (const life of policies.filter(p => p.kind === 'life' && p.details.life?.inTrust === false)) {
    gaps.push({
      id: `trust:${life.id}`, severity: 'check', asset: 'people', title: 'Life cover not written in trust',
      body: 'In trust, a payout usually reaches your family faster and outside your estate for inheritance tax. Your insurer can set it up, usually free.',
    })
  }
  if (!has('income', 'illness')) {
    gaps.push({
      id: 'income', severity: 'check', asset: 'people', title: 'Income protection',
      body: 'Pays part of a salary if illness stops either of you working. Check what sick pay your employers give first.',
    })
  }
  return gaps
}
