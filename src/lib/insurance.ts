import { BudgetData, Owner, daysUntil, isInsuranceItem, isMortgage } from './models'

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
  ['home', /\bhome insur|house insur|household insur|\bhome\b(?!.*emergency)/i],
  ['car', /\bcar\b|motor|vehicle|van\b/i],
  ['breakdown', /breakdown|\brac\b|\baa\b/i],
  ['life', /\blife\b|death/i],
  ['income', /income protection|\bincome\b/i],
  ['illness', /critical illness/i],
  ['pet', /\bpet\b|\bdog\b|\bcat\b/i],
  ['travel', /travel/i],
  ['gadget', /phone|gadget|mobile/i],
  ['health', /health|dental|medical|bupa|vitality/i],
  ['emergency', /home emergency|boiler|homecare/i],
]

export const KIND_LABELS: Record<InsuranceKind, string> = {
  home: 'Home', buildings: 'Buildings', contents: 'Contents', landlord: 'Landlord', car: 'Car',
  life: 'Life', income: 'Income protection', illness: 'Critical illness', pet: 'Pet', travel: 'Travel',
  gadget: 'Phone & gadgets', health: 'Health', emergency: 'Home emergency', breakdown: 'Breakdown', other: 'Other',
}

export function insuranceKind(label: string): InsuranceKind {
  // Home emergency and boiler cover before "home", which would otherwise claim them.
  if (/home emergency|boiler|homecare/i.test(label)) return 'emergency'
  if (/critical illness/i.test(label)) return 'illness'
  for (const [kind, re] of KINDS) if (re.test(label)) return kind
  return 'other'
}

export interface Policy {
  id: string; catKey: string; label: string; kind: InsuranceKind; owner: Owner
  propertyId?: string; provider?: string; cover?: number
  monthly: number; renewalDate?: string; days: number | null; autoRenews: boolean
}

export interface InsuranceGap {
  id: string; severity: 'gap' | 'check'; title: string; body: string
}

export function insurancePolicies(data: BudgetData): Policy[] {
  return data.categories
    .filter(c => c.type === 'EXPENSE')
    .flatMap(c => c.items.filter(i => isInsuranceItem(i.label)).map(i => ({
      id: i.id, catKey: c.key, label: i.label, kind: insuranceKind(i.label), owner: c.owner,
      propertyId: i.propertyId, provider: i.insuranceProvider, cover: i.insuranceCoverAmount,
      monthly: i.amount, renewalDate: i.renewalDate,
      days: i.renewalDate ? daysUntil(i.renewalDate) : null, autoRenews: !!i.autoRenews,
    })))
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
}

/**
 * Cover a household like this one would usually hold but nothing in the
 * budget looks like. Deliberately cautious: each one is a prompt to check,
 * since cover can come through an employer, a lender or a packaged account.
 */
export function insuranceGaps(data: BudgetData, policies = insurancePolicies(data)): InsuranceGap[] {
  const gaps: InsuranceGap[] = []
  const has = (...kinds: InsuranceKind[]) => policies.some(p => kinds.includes(p.kind))
  const unlinkedHome = policies.filter(p => !p.propertyId && ['home', 'buildings', 'landlord'].includes(p.kind))

  for (const prop of data.properties ?? []) {
    const linked = policies.some(p => p.propertyId === prop.id && ['home', 'buildings', 'landlord'].includes(p.kind))
    if (linked) continue
    const mortgaged = data.debts.some(d => d.propertyId === prop.id && isMortgage(d) && d.currentBalance > 0)
    if (unlinkedHome.length > 0) {
      gaps.push({
        id: `link:${prop.id}`, severity: 'check', title: `Which home is your ${unlinkedHome[0].label.toLowerCase()} for?`,
        body: `Link it to ${prop.label} on Budget so Budge can tell which homes are covered.`,
      })
      continue
    }
    gaps.push({
      id: `buildings:${prop.id}`, severity: 'gap', title: `No buildings insurance for ${prop.label}`,
      body: mortgaged
        ? 'Your lender will require it while there’s a mortgage. Add the policy if you have one.'
        : prop.isLet
          ? 'A let home needs landlord buildings cover; standard home insurance usually won’t pay out.'
          : 'Rebuilding after a fire or flood is rarely affordable without it.',
    })
  }

  const main = (data.properties ?? []).find(p => p.isMainResidence) ?? (data.properties ?? [])[0]
  if (main && !has('home', 'contents')) {
    gaps.push({
      id: 'contents', severity: 'gap', title: `No contents insurance for ${main.label}`,
      body: 'Covers your belongings against theft, fire and water damage. Often bundled with buildings cover.',
    })
  }

  const children = (data.dependants ?? []).length
  if (children > 0 && !has('life')) {
    gaps.push({
      id: 'life', severity: 'gap', title: 'No life cover found',
      body: `With ${children === 1 ? 'a child' : `${children} children`} and a mortgage, life cover would clear the debts if either of you died. Check for death-in-service through work too.`,
    })
  }
  if (!has('income', 'illness')) {
    gaps.push({
      id: 'income', severity: 'check', title: 'Income protection',
      body: 'Pays a share of your salary if illness stops you working. Check what sick pay your employers give first.',
    })
  }
  const drives = data.categories.some(c => c.items.some(i => /fuel|petrol|diesel|\bcar\b|parking/i.test(i.label) && !isInsuranceItem(i.label)))
  if (drives && !has('car')) {
    gaps.push({
      id: 'car', severity: 'gap', title: 'No car insurance found',
      body: 'There’s car spending in the budget but no car policy. Driving uninsured is illegal in the UK.',
    })
  }
  return gaps
}
