// Shared between the document-reading route and the app.
import type { BudgetData, PolicyDetails } from './models'
import { insurancePolicies, type InsuranceKind, type Policy, HOME_KINDS } from './insurance'

/** Every detail Budge can fill in. Values come back as text and are parsed in the app. */
export const FIELD_KEYS = [
  'insurer', 'policyNumber', 'policyholders', 'startDate', 'endDate',
  'premiumAnnual', 'premiumMonthly', 'paymentFrequency', 'autoRenews',
  'address', 'postcode', 'buildingsSum', 'contentsSum', 'accidentalDamage', 'unoccupiedDays',
  'excessCompulsory', 'excessVoluntary', 'escapeOfWaterExcess', 'homeEmergency', 'legalExpenses', 'secondHomeDeclared',
  'reg', 'makeModel', 'coverLevel', 'mainDriver', 'namedDrivers', 'ncdYears', 'ncdProtected', 'breakdown', 'courtesyCar',
  'livesCovered', 'sumAssured', 'termEnd', 'coverType', 'inTrust',
  'covers', 'exclusions',
] as const
export type FieldKey = typeof FIELD_KEYS[number]

export const KIND_VALUES = [
  'home', 'buildings', 'contents', 'landlord', 'car', 'life', 'income', 'illness',
  'pet', 'travel', 'gadget', 'health', 'emergency', 'breakdown', 'other',
] as const

export interface ReadField { key: FieldKey; value: string; confidence: 'high' | 'low'; source: string }
export interface ReadResult {
  isInsurance: boolean
  kind: typeof KIND_VALUES[number]
  documents: { name: string; type: 'schedule' | 'renewal' | 'certificate' | 'statement_of_fact' | 'wording' | 'other' }[]
  fields: ReadField[]
  notes: string[]
}

export interface ReadFile { name: string; mediaType: string; data: string }


const num = (v?: string) => {
  if (!v) return undefined
  const n = parseFloat(v.replace(/[£,\s]/g, ''))
  return Number.isFinite(n) ? n : undefined
}
const yes = (v?: string) => v == null ? undefined : /^y/i.test(v.trim()) ? true : /^n/i.test(v.trim()) ? false : undefined
const date = (v?: string) => v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : undefined
const list = (v?: string) => v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined
const normReg = (r?: string) => (r ?? '').replace(/\s+/g, '').toUpperCase()

/** What a read turns into: the bill's fields plus the policy details. */
export interface ReadPolicy {
  kind: InsuranceKind
  provider?: string
  renewalDate?: string
  /** Monthly cost for the budget: the instalment if paying monthly, else the yearly price ÷ 12. */
  monthly?: number
  autoRenews?: boolean
  coverAmount?: number
  postcode?: string
  address?: string
  details: PolicyDetails
}

export function readToPolicy(r: ReadResult, docNames: string[]): ReadPolicy {
  const f = (k: FieldKey) => r.fields.find(x => x.key === k)?.value
  const annual = num(f('premiumAnnual'))
  const monthlyInstal = num(f('premiumMonthly'))
  const paysMonthly = /month/i.test(f('paymentFrequency') ?? '') || (monthlyInstal != null && annual == null)
  const kind = r.kind as InsuranceKind
  const buildings = f('buildingsSum'), contents = f('contentsSum')
  const isHome = HOME_KINDS.includes(kind)
  const details: PolicyDetails = {
    kind,
    policyNumber: f('policyNumber'), policyholders: f('policyholders'),
    startDate: date(f('startDate')),
    premiumAnnual: annual, paysMonthly,
    covers: list(f('covers')), excluded: list(f('exclusions')),
    readFrom: docNames.map(name => ({ name, readAt: new Date().toISOString().slice(0, 10) })),
  }
  if (isHome) {
    details.home = {
      buildingsSum: num(buildings), buildingsUnlimited: /unlimited/i.test(buildings ?? '') || undefined,
      contentsSum: num(contents), contentsUnlimited: /unlimited/i.test(contents ?? '') || undefined,
      accidentalDamage: f('accidentalDamage'), unoccupiedDays: num(f('unoccupiedDays')),
      excessCompulsory: num(f('excessCompulsory')), excessVoluntary: num(f('excessVoluntary')),
      escapeOfWaterExcess: num(f('escapeOfWaterExcess')), secondHomeDeclared: yes(f('secondHomeDeclared')),
    }
  }
  if (kind === 'car') {
    details.car = {
      reg: f('reg')?.toUpperCase(), makeModel: f('makeModel'), coverLevel: f('coverLevel'),
      mainDriver: f('mainDriver'), namedDrivers: f('namedDrivers'),
      ncdYears: num(f('ncdYears')), ncdProtected: yes(f('ncdProtected')),
      excessCompulsory: num(f('excessCompulsory')), excessVoluntary: num(f('excessVoluntary')),
      breakdown: f('breakdown'),
    }
  }
  if (['life', 'income', 'illness'].includes(kind)) {
    details.life = {
      livesCovered: f('livesCovered'), sumAssured: num(f('sumAssured')), termEnd: date(f('termEnd')),
      coverType: f('coverType'), inTrust: yes(f('inTrust')),
    }
  }
  return {
    kind,
    provider: f('insurer'),
    renewalDate: date(f('endDate')),
    monthly: paysMonthly && monthlyInstal != null ? monthlyInstal : annual != null ? Math.round(annual / 12 * 100) / 100 : monthlyInstal,
    autoRenews: yes(f('autoRenews')),
    coverAmount: num(f('sumAssured')) ?? num(buildings),
    postcode: f('postcode'), address: f('address'),
    details,
  }
}

export interface Match { policy: Policy | null; propertyId: string | null; reason: string | null }

/** Find the policy and home a read belongs to: by reg, then postcode or address, then insurer and type. */
export function matchRead(data: BudgetData, read: ReadPolicy): Match {
  const policies = insurancePolicies(data)
  const props = data.properties ?? []
  let propertyId: string | null = null
  let reason: string | null = null
  if (HOME_KINDS.includes(read.kind)) {
    const pc = (read.postcode ?? '').toUpperCase().replace(/\s+/g, ' ').trim()
    const area = pc.split(' ')[0]
    const byArea = area ? props.filter(p => p.postcodeArea && p.postcodeArea.toUpperCase() === area) : []
    const byName = props.filter(p => (read.address ?? '').toLowerCase().includes(p.label.toLowerCase()))
    const hit = byName.length === 1 ? byName[0] : byArea.length === 1 ? byArea[0] : null
    if (hit) { propertyId = hit.id; reason = byName.length === 1 ? 'Matched by address' : 'Matched by postcode' }
  }
  if (read.kind === 'car' && read.details.car?.reg) {
    const reg = normReg(read.details.car.reg)
    const car = policies.find(p => p.kind === 'car' && normReg(p.details.car?.reg) === reg)
    if (car) return { policy: car, propertyId: null, reason: 'Matched by registration' }
  }
  const sameKind = policies.filter(p => p.kind === read.kind || (HOME_KINDS.includes(p.kind) && HOME_KINDS.includes(read.kind) && p.kind !== 'emergency' && read.kind !== 'emergency'))
  const candidates = propertyId ? sameKind.filter(p => p.propertyId === propertyId || !p.propertyId) : sameKind
  const byInsurer = read.provider ? candidates.filter(p => p.provider && p.provider.toLowerCase().split(' ')[0] === read.provider!.toLowerCase().split(' ')[0]) : []
  const policy = byInsurer.length === 1 ? byInsurer[0] : candidates.length === 1 ? candidates[0] : null
  if (policy && !reason) reason = byInsurer.length === 1 ? `Matched by insurer` : 'Matched by policy type'
  return { policy, propertyId: propertyId ?? policy?.propertyId ?? null, reason }
}
