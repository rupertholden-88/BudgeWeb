import { BudgetData, Owner, isInsuranceItem } from './models'

/** Streaming, apps, memberships and the like, by name. */
const SUBSCRIPTION = /netflix|spotify|disney|prime video|amazon prime|\bprime\b|apple (music|tv|one|arcade)|icloud|youtube|now tv|\bsky\b|paramount|britbox|discovery\+|audible|kindle unlimited|xbox|playstation|ps plus|nintendo|game pass|patreon|substack|google one|dropbox|onedrive|microsoft 365|office 365|adobe|chatgpt|claude|openai|\bgym\b|puregym|peloton|strava|headspace|\bcalm\b|duolingo|newspaper|the times|guardian|economist|magazine|tv licen[cs]e|subscription|membership|\bnetflix\b|\bapp\b|hello ?fresh|gousto|graze|ocado smart|deliver(y|oo) plus|uber one/i

/** SIM-only plans that roll month to month: subscriptions, not contracts. */
const ROLLING_SIM = /voxi|giffgaff|smarty|lebara|id mobile|lyca|tesco mobile sim|sim[- ]only|rolling/i

/** Contracts that run for a term and are worth switching at the end. */
const CONTRACT = /phone|mobile|\bsim\b|\bee\b|vodafone|\bo2\b|\bthree\b|broadband|internet|wi-?fi|fibre|virgin|\bbt\b|plusnet|talktalk|hyperoptic|shell energy broadband/i

const ENERGY = /electric|\bgas\b|energy|octopus|edf|british gas|ovo|e\.on|eon\b|scottish power|so energy/i

export type SubKind = 'subscription' | 'contract'

export interface Subscription {
  id: string; catKey: string; label: string; owner: Owner; amount: number
  kind: SubKind; renewalDate?: string; autoRenews?: boolean; icon?: string
}

/** Which kind of recurring thing a bill is, if any. A "Subscriptions" category counts everything in it. */
export function subscriptionKind(label: string, categoryLabel = '', override?: 'subscription' | 'contract' | 'none'): SubKind | null {
  if (override) return override === 'none' ? null : override
  if (ROLLING_SIM.test(label)) return 'subscription'
  if (isInsuranceItem(label) || ENERGY.test(label)) return null
  if (CONTRACT.test(label)) return 'contract'
  if (SUBSCRIPTION.test(label) || /subscri|streaming/i.test(categoryLabel)) return 'subscription'
  return null
}

export function subscriptions(data: BudgetData): Subscription[] {
  return data.categories
    .filter(c => c.type === 'EXPENSE')
    .flatMap(c => c.items.flatMap(i => {
      const kind = subscriptionKind(i.label, c.label, i.recurring)
      return kind ? [{ id: i.id, catKey: c.key, label: i.label, owner: c.owner, amount: i.amount, kind, renewalDate: i.renewalDate, autoRenews: i.autoRenews, icon: i.icon }] : []
    }))
    .sort((a, b) => b.amount - a.amount)
}
