'use client'

import { useState, useEffect, useRef } from 'react'
import { Owner, Fuel, EnergyTariff, TariffOption, fmt, propertySummaries, tariffAnnualCost, quotedAnnualCost, exitFeeFreeFrom, daysUntil, ENERGY_VAT } from '@/lib/models'
import type { TariffSearchRequest } from '@/app/api/energy-tariffs/route'
import { useApiKey } from '@/hooks/useApiKey'
import { Plus, Home, Zap, Flame, Search, ExternalLink, KeyRound } from 'lucide-react'
import { AmountCell, ConfirmDelete, ExpandButton, PanelSection, DeleteAction, Field, TapToEdit, NumberInput, inputClass, ownerBorderClass } from './ui'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>
type Summary = ReturnType<typeof propertySummaries>[number]

function numberInput(value: number | undefined, onChange: (v: number | undefined) => void, placeholder = '0', width = 'w-[120px]') {
  return <NumberInput value={value} onChange={onChange} placeholder={placeholder} className={`${inputClass} ${width}`} />
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtP = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function FuelTariff({ fuel, tariff, onChange }: { fuel: Fuel; tariff: EnergyTariff | undefined; onChange: (f: Partial<EnergyTariff>) => void }) {
  const t = tariff ?? {}
  const annual = tariffAnnualCost(t)
  const [editing, setEditing] = useState(false)
  const [twoRate, setTwoRate] = useState(t.nightRateP != null || t.nightUsageKwh != null)
  const Icon = fuel === 'gas' ? Flame : Zap
  const title = fuel === 'gas' ? 'Gas' : 'Electricity'
  const days = t.fixedUntil ? daysUntil(t.fixedUntil) : null
  const freeFrom = exitFeeFreeFrom(t)
  const freeNow = freeFrom != null && daysUntil(freeFrom) <= 0

  return (
    <div className="py-2 border-t border-border first:border-t-0">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-muted shrink-0" />
        <span className="text-sm font-semibold flex-1">{title}</span>
        {annual != null && (
          <span className="text-sm font-bold tabular-nums">{fmt(annual / 12)}<span className="text-caption text-muted font-normal">/mo</span></span>
        )}
        <button onClick={() => setEditing(e => !e)} className="text-xs text-muted bg-transparent border-0 cursor-pointer underline min-h-[36px] px-1">
          {editing ? 'Done' : annual == null ? 'Add' : 'Edit'}
        </button>
      </div>
      {annual == null && !editing && <div className="text-caption text-muted">Not added</div>}
      {annual != null && (
        <div className="text-caption text-muted leading-snug">
          {[t.supplier, t.name].filter(Boolean).join(' · ')}
          {(t.supplier || t.name) && <br />}
          {fmt(annual)}/yr inc. VAT
          {t.fixed && t.fixedUntil ? ` · fixed until ${fmtDate(t.fixedUntil)}` : t.fixed === false ? ' · variable' : ''}
        </div>
      )}
      {t.fixed && days != null && (
        days < 0
          ? <span className="pill pill-bad mt-1">Fixed deal ended — likely on a variable rate now</span>
          : freeNow
            ? <span className="pill pill-warn mt-1">No exit fee now — compare and switch</span>
            : freeFrom && <span className="pill mt-1">Exit fee waived from {fmtDate(freeFrom)}</span>
      )}

      {editing && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Field label="Supplier">
              <input value={t.supplier ?? ''} placeholder="e.g. EDF" onChange={e => onChange({ supplier: e.target.value || undefined })} className={`${inputClass} w-[120px]`} />
            </Field>
            <Field label="Tariff name">
              <input value={t.name ?? ''} placeholder="optional" onChange={e => onChange({ name: e.target.value || undefined })} className={`${inputClass} w-[170px]`} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Field label={twoRate ? 'Day rate p/kWh' : 'Unit rate p/kWh'}>{numberInput(t.unitRateP, v => onChange({ unitRateP: v }), '0', 'w-[110px]')}</Field>
            <Field label="Standing p/day">{numberInput(t.standingChargeP, v => onChange({ standingChargeP: v }), '0', 'w-[110px]')}</Field>
            <Field label={twoRate ? 'Day usage kWh/yr' : 'Usage kWh/yr'}>{numberInput(t.annualUsageKwh, v => onChange({ annualUsageKwh: v }), '0', 'w-[110px]')}</Field>
          </div>
          {fuel === 'electricity' && (
            <label className="flex items-center gap-2 cursor-pointer text-xs min-h-[32px]">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={twoRate}
                onChange={e => {
                  setTwoRate(e.target.checked)
                  if (!e.target.checked) onChange({ nightRateP: undefined, nightUsageKwh: undefined })
                }}
              />
              Day / night rates (Economy 7 style)
            </label>
          )}
          {twoRate && (
            <div className="flex flex-wrap gap-2">
              <Field label="Night rate p/kWh">{numberInput(t.nightRateP, v => onChange({ nightRateP: v }), '0', 'w-[110px]')}</Field>
              <Field label="Night usage kWh/yr">{numberInput(t.nightUsageKwh, v => onChange({ nightUsageKwh: v }), '0', 'w-[110px]')}</Field>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-xs min-h-[32px]">
            <input type="checkbox" className="w-4 h-4" checked={!!t.fixed} onChange={e => onChange({ fixed: e.target.checked })} />
            Fixed price
          </label>
          {t.fixed && (
            <div className="flex flex-wrap gap-2">
              <Field label="Fixed until">
                <input type="date" value={t.fixedUntil ?? ''} onChange={e => onChange({ fixedUntil: e.target.value || undefined })} className={inputClass} />
              </Field>
              <Field label="Exit fee £">{numberInput(t.exitFee, v => onChange({ exitFee: v }), '0', 'w-[90px]')}</Field>
            </div>
          )}
          <p className="text-caption text-muted m-0 leading-snug">
            Copy the figures from the &ldquo;About your tariff&rdquo; box on your bill. Rates there exclude VAT — {Math.round(ENERGY_VAT * 100)}% is added for you.
          </p>
        </div>
      )}
    </div>
  )
}

// Matches the route's rough USD→GBP conversion for showing spend.
const USD_TO_GBP = 0.79
const fmtPence = (usd: number) => { const gbp = usd * USD_TO_GBP; return gbp < 1 ? `${Math.max(1, Math.round(gbp * 100))}p` : `£${gbp.toFixed(2)}` }
const FUELS: Fuel[] = ['electricity', 'gas']

/** Only ever link out to http(s) — the URL comes from model output. */
function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null } catch { return null }
}

function compareOption(o: TariffOption, energy: Partial<Record<Fuel, EnergyTariff>>) {
  let current = 0, quoted = 0, exitFees = 0
  const covered: Fuel[] = []
  const missing: Fuel[] = []
  for (const fuel of FUELS) {
    const t = energy[fuel]
    const now = tariffAnnualCost(t)
    if (now == null) continue
    const cost = quotedAnnualCost(o[fuel], t)
    if (cost == null) { missing.push(fuel); continue }
    covered.push(fuel)
    current += now
    quoted += cost
    const free = exitFeeFreeFrom(t)
    if (t?.fixed && t.exitFee && free && daysUntil(free) > 0) exitFees += t.exitFee
  }
  const saving = current - quoted
  return { covered, missing, current, quoted, saving, exitFees, net: saving - exitFees }
}

function TariffFinder({ summary, budget }: { summary: Summary; budget: BudgetHook }) {
  const { updateProperty, user } = budget
  const p = summary.property
  const energy = p.energy ?? {}
  const { apiKey, hasKey, loading: keyLoading } = useApiKey(user)
  const [area, setArea] = useState(p.postcodeArea ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null)
  const cache = p.tariffSearch ?? null
  const result = cache?.result ?? null
  const areaOk = /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(area.trim())
  const fuels = FUELS.filter(f => tariffAnnualCost(energy[f]) != null)

  const run = async () => {
    if (!apiKey || !areaOk || fuels.length === 0) return
    const postcodeArea = area.trim().toUpperCase()
    if (postcodeArea !== p.postcodeArea) updateProperty(p.id, { postcodeArea })
    const request: TariffSearchRequest = {
      postcodeArea,
      today: new Date().toISOString().slice(0, 10),
      fuels: fuels.map(fuel => {
        const t = energy[fuel]!
        return {
          fuel,
          twoRate: (t.nightUsageKwh ?? 0) > 0,
          annualUsageKwh: t.annualUsageKwh ?? 0,
          nightUsageKwh: t.nightUsageKwh ?? null,
          current: {
            unitRatePExVat: t.unitRateP ?? 0,
            nightRatePExVat: t.nightRateP ?? null,
            standingChargePExVat: t.standingChargeP ?? 0,
            fixedUntil: t.fixed ? t.fixedUntil ?? null : null,
            exitFee: t.fixed ? t.exitFee ?? null : null,
          },
        }
      }),
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/energy-tariffs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request, apiKey }),
      })
      const rawBody = await res.text()
      const body = (() => { try { return JSON.parse(rawBody) } catch { return {} } })()
      if (!res.ok) {
        setError({ message: body.message || `Something went wrong (HTTP ${res.status}).`, detail: body.detail || (!body.message ? rawBody.slice(0, 200) : undefined) })
        return
      }
      updateProperty(p.id, {
        postcodeArea,
        tariffSearch: {
          generatedAt: new Date().toISOString(),
          costUsd: body.costUsd ?? 0,
          searches: body.searches ?? 0,
          result: body.result ?? null,
          rawText: body.rawText ?? null,
        },
      })
    } catch (err) {
      setError({ message: 'Could not reach the search service — check your connection.', detail: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  const rows = (result?.options ?? [])
    .map(o => ({ option: o, cmp: compareOption(o, energy) }))
    .filter(r => r.cmp.covered.length > 0)
    .sort((a, b) => b.cmp.net - a.cmp.net)

  return (
    <div className="pt-2 mt-2 border-t border-border">
      <div className="flex items-center gap-1.5 text-sm font-semibold mb-1"><Search size={13} /> Find cheaper tariffs</div>
      <p className="text-caption text-muted mt-0 mb-2 leading-snug">
        Searches the web for deals in your area and compares them at your usage. Uses your own API key — each search costs roughly 5–20p.
      </p>

      {fuels.length === 0 ? (
        <p className="text-caption text-muted m-0">Add at least one tariff above first.</p>
      ) : !user ? (
        <p className="text-caption text-muted m-0 flex items-start gap-1.5"><KeyRound size={11} className="mt-0.5 shrink-0" /> Sign in and add your Anthropic API key in Settings to use this.</p>
      ) : keyLoading ? null : !hasKey ? (
        <p className="text-caption text-muted m-0 flex items-start gap-1.5"><KeyRound size={11} className="mt-0.5 shrink-0" /> Add your Anthropic API key in Settings to use this.</p>
      ) : (
        <div className="flex gap-2 items-end flex-wrap">
          <Field label="Postcode area">
            <input
              value={area}
              onChange={e => setArea(e.target.value.toUpperCase())}
              placeholder="e.g. NR21"
              maxLength={4}
              autoCapitalize="characters"
              className={`${inputClass} w-[90px] uppercase`}
            />
          </Field>
          <button
            onClick={run}
            disabled={loading || !areaOk}
            className={`border-0 rounded-xl px-4 min-h-[36px] text-sm font-semibold ${loading || !areaOk ? 'bg-border text-muted cursor-default' : 'bg-ink text-on-ink cursor-pointer'}`}
          >
            {loading ? 'Searching… (up to a minute)' : result ? 'Search again' : 'Search'}
          </button>
        </div>
      )}
      {area && !areaOk && <p className="text-caption text-negative mt-1 mb-0">Just the first half of the postcode, e.g. NR21.</p>}

      {error && (
        <div className="text-xs text-negative bg-expense-bg rounded-lg p-2.5 mt-2">
          {error.message}
          {error.detail && <div className="text-caption font-mono opacity-70 mt-1 break-words">{error.detail}</div>}
        </div>
      )}

      {cache && (
        <div className="mt-3">
          <div className="text-caption text-muted mb-1.5">
            Searched {new Date(cache.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {' · '}{cache.searches} {cache.searches === 1 ? 'search' : 'searches'} · cost {fmtPence(cache.costUsd)}
          </div>
          {result ? (
            <>
              <p className="text-xs text-ink mt-0 mb-1 leading-snug">{result.summary}</p>
              {result.regionNote && <p className="text-caption text-muted mt-0 mb-2">{result.regionNote}</p>}
              <div className="space-y-2">
                {rows.map(({ option: o, cmp }, i) => {
                  const href = safeUrl(o.sourceUrl)
                  return (
                    <div key={i} className="rounded-lg border border-border p-2.5">
                      <div className="flex justify-between gap-2 items-start">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold break-words">{o.supplier} · {o.tariffName}</div>
                          <div className="text-caption text-muted">
                            {o.type === 'fixed' ? `Fixed${o.termMonths ? ` ${o.termMonths} months` : ''}` : 'Variable'}
                            {o.exitFeePerFuel ? ` · £${o.exitFeePerFuel} exit fee per fuel` : ''}
                            {cmp.missing.length > 0 ? ` · ${cmp.covered.join(' & ')} only` : ''}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold tabular-nums">{fmt(cmp.quoted)}/yr</div>
                          <div className={`text-caption font-semibold tabular-nums ${cmp.saving > 0 ? 'text-positive' : 'text-negative'}`}>
                            {cmp.saving > 0 ? `saves ${fmt(cmp.saving)}` : `costs ${fmt(-cmp.saving)} more`}
                          </div>
                        </div>
                      </div>
                      {cmp.exitFees > 0 && cmp.saving > 0 && (
                        <div className="text-caption text-muted mt-1">
                          {cmp.net > 0 ? `${fmt(cmp.net)} after your £${cmp.exitFees} exit fees if you switch now` : `Less than your £${cmp.exitFees} exit fees if you switch now — wait for the fee-free window`}
                        </div>
                      )}
                      {o.notes && <div className="text-caption text-muted mt-1 leading-snug">{o.notes}</div>}
                      {href && (
                        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-caption text-accent inline-flex items-center gap-1 mt-1 underline break-all">
                          <ExternalLink size={10} className="shrink-0" /> {new URL(href).hostname}
                        </a>
                      )}
                    </div>
                  )
                })}
                {rows.length === 0 && <p className="text-xs text-muted m-0">No comparable tariffs with full rates were found this time.</p>}
              </div>
              {result.advice && <p className="text-xs text-ink mt-2 mb-1 leading-snug">{result.advice}</p>}
              {(result.caveats ?? []).length > 0 && (
                <ul className="m-0 pl-4 list-disc text-caption text-muted space-y-0.5">
                  {result.caveats.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              )}
            </>
          ) : cache.rawText ? (
            <p className="text-xs whitespace-pre-wrap m-0">{cache.rawText}</p>
          ) : null}
          <p className="text-caption text-muted mt-2 mb-0 leading-snug">
            Costs are worked out here from the quoted rates and your own usage, including VAT. Prices change daily and depend on your exact address — confirm on the supplier&apos;s site before switching. Not financial advice.
          </p>
        </div>
      )}
    </div>
  )
}

function EnergySection({ summary, budget }: { summary: Summary; budget: BudgetHook }) {
  const { updatePropertyEnergy, updateItemAmount } = budget
  const p = summary.property
  const annual = summary.energyAnnualCost
  const monthly = annual != null ? annual / 12 : null
  const energyItems = summary.items.filter(i => /gas|electric|energy|power/i.test(i.label))
  const budgeted = energyItems.reduce((a, i) => a + i.amount, 0)
  const gap = monthly != null && energyItems.length > 0 ? budgeted - monthly : null

  return (
    <PanelSection title="Energy tariff">
      <FuelTariff fuel="electricity" tariff={p.energy?.electricity} onChange={f => updatePropertyEnergy(p.id, 'electricity', f)} />
      <FuelTariff fuel="gas" tariff={p.energy?.gas} onChange={f => updatePropertyEnergy(p.id, 'gas', f)} />
      {monthly != null && (
        <div className="pt-2 mt-1 border-t border-border">
          <div className="flex justify-between text-xs font-semibold">
            <span>Estimated energy cost</span>
            <span className="tabular-nums">{fmtP(monthly)}/mo · {fmt(annual!)}/yr</span>
          </div>
          {energyItems.length === 0 ? (
            <p className="text-caption text-muted mt-1 mb-0 leading-snug">
              Link this property&apos;s gas &amp; electricity bill on Budget to compare it with what you&apos;ve budgeted.
            </p>
          ) : gap != null && Math.abs(gap) >= 5 && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={`text-caption ${gap < 0 ? 'text-negative' : 'text-muted'}`}>
                You budget {fmt(budgeted)}/mo — {gap < 0 ? `${fmt(-gap)} less than the tariff suggests` : `${fmt(gap)} more than the tariff suggests`}.
              </span>
              {energyItems.length === 1 && (
                <button
                  onClick={() => updateItemAmount(energyItems[0].catKey, energyItems[0].id, Math.round(monthly))}
                  className="text-caption font-semibold text-accent bg-accent-light border-0 rounded-full px-2.5 min-h-[28px] cursor-pointer"
                >
                  Set to {fmt(monthly)}
                </button>
              )}
            </div>
          )}
          <p className="text-caption text-muted mt-1 mb-0 leading-snug">Based on the supplier&apos;s estimated annual usage — real bills vary with the weather, so monthly Direct Debits are spread across the year.</p>
        </div>
      )}
      <TariffFinder summary={summary} budget={budget} />
    </PanelSection>
  )
}

function PropertyCard({ summary, ownerName, budget, focused, onFocusHandled }: { summary: Summary; ownerName: (o: Owner) => string; budget: BudgetHook; focused?: boolean; onFocusHandled?: () => void }) {
  const { updateProperty, deleteProperty } = budget
  const { property: p, debts, items, mortgageBalance, mortgagePayment, runningCosts, monthlyTotal, equity, ltvPct } = summary
  const [expanded, setExpanded] = useState(!!focused)
  const finderRef = useRef<HTMLDivElement>(null)
  // Arriving from a switch reminder: open the card and bring the tariff finder into view.
  useEffect(() => {
    if (!focused) return
    setExpanded(true)
    const t = setTimeout(() => { finderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); onFocusHandled?.() }, 250)
    return () => clearTimeout(t)
  }, [focused]) // eslint-disable-line
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (fields: Parameters<typeof updateProperty>[1]) => updateProperty(p.id, fields)

  const costBasis = (p.purchasePrice ?? 0) + (p.stampDutyPaid ?? 0) + (p.improvementCosts ?? 0)
  const paperGain = p.purchasePrice ? p.estimatedValue - costBasis : null

  return (
    <>
      {confirmDelete && (
        <ConfirmDelete
          label={p.label}
          detail="Its mortgage and costs stay, just unlinked from it. This can't be undone."
          onConfirm={() => { deleteProperty(p.id); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className={`card mb-3 overflow-hidden ${ownerBorderClass(p.owner)}`}>
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
          <div className="flex-1 min-w-0">
            <TapToEdit value={p.label} onSave={v => set({ label: v })} className="text-sm font-semibold block" />
            <div className="flex gap-1 flex-wrap mt-1">
              {p.isMainResidence && <span className="pill pill-accent"><Home size={9} /> Main residence</span>}
              {p.isLet && <span className="pill pill-warn">Let</span>}
              <span className="pill">{ownerName(p.owner)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-caption text-muted">Value</div>
            <AmountCell value={p.estimatedValue} onChange={v => set({ estimatedValue: v })} className="!px-0 font-serif !text-lg" />
          </div>
          <ExpandButton expanded={expanded} onClick={() => setExpanded(e => !e)} label={expanded ? `Collapse ${p.label}` : `Expand ${p.label}`} />
        </div>

        <div className="grid grid-cols-3 gap-2 px-3 py-2.5 border-t border-border text-center">
          <div>
            <div className="text-caption text-muted mb-0.5">Equity</div>
            <div className={`text-sm font-bold tabular-nums ${p.estimatedValue === 0 ? 'text-muted' : equity >= 0 ? 'text-positive' : 'text-negative'}`}>
              {p.estimatedValue > 0 ? fmt(equity) : '—'}
            </div>
          </div>
          <div>
            <div className="text-caption text-muted mb-0.5">Loan-to-value</div>
            <div className="text-sm font-bold tabular-nums">{ltvPct != null && mortgageBalance > 0 ? `${ltvPct.toFixed(0)}%` : '—'}</div>
          </div>
          <div>
            <div className="text-caption text-muted mb-0.5">Costs / mo</div>
            <div className="text-sm font-bold tabular-nums text-expense-text">{monthlyTotal > 0 ? fmt(monthlyTotal) : '—'}</div>
          </div>
        </div>

        {expanded && (
          <div className="px-3 pb-2 border-t border-border">
            <PanelSection title="Status">
              <label className="flex items-start gap-2 cursor-pointer mb-2">
                <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" checked={!!p.isMainResidence} onChange={e => set({ isMainResidence: e.target.checked || undefined })} />
                <span className="text-xs leading-snug">
                  Main residence
                  <span className="block text-caption text-muted mt-0.5">
                    Only one home can be your main residence for tax. With two, you can nominate which in writing to HMRC within two years of having both — worth checking you did.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" checked={!!p.isLet} onChange={e => set({ isLet: e.target.checked || undefined })} />
                <span className="text-xs leading-snug">
                  Let out (including holiday lets)
                  <span className="block text-caption text-muted mt-0.5">
                    Rental profit is taxable, and mortgage interest only earns a 20% tax credit rather than being deducted.
                  </span>
                </span>
              </label>
              {p.isLet && (
                <div className="mt-2">
                  <Field label="Rent £/mo">{numberInput(p.monthlyRent, v => set({ monthlyRent: v }))}</Field>
                </div>
              )}
              <div className="mt-2">
                <Field label="Owned by">
                  <select value={p.owner} onChange={e => set({ owner: e.target.value as Owner })} className={`${inputClass} w-full`}>
                    {(['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).map(o => <option key={o} value={o}>{ownerName(o)}</option>)}
                  </select>
                </Field>
              </div>
            </PanelSection>

            <PanelSection title="What it costs">
              {debts.length === 0 && items.length === 0 ? (
                <p className="text-xs text-muted m-0 leading-snug">
                  Nothing linked yet. On Debts, open its mortgage and choose this property under &ldquo;Secured on&rdquo;. On Budget, open each of its bills (council tax, insurance, energy…) and pick it under &ldquo;Property&rdquo;.
                </p>
              ) : (
                <div className="space-y-1">
                  {debts.map(d => (
                    <div key={d.id} className="flex justify-between text-xs gap-2">
                      <span className="text-muted truncate">{d.label} <span className="text-caption">({fmt(d.currentBalance)} owed)</span></span>
                      <span className="tabular-nums font-semibold shrink-0">{fmt(d.monthlyPayment)}</span>
                    </div>
                  ))}
                  {items.map(i => (
                    <div key={i.id} className="flex justify-between text-xs gap-2">
                      <span className="text-muted truncate">{i.label} <span className="text-caption">· {i.category}</span></span>
                      <span className="tabular-nums font-semibold shrink-0">{fmt(i.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs pt-1.5 mt-1 border-t border-border font-semibold">
                    <span>Mortgage {fmt(mortgagePayment)} + running {fmt(runningCosts)}</span>
                    <span className="tabular-nums text-expense-text">{fmt(monthlyTotal)}/mo</span>
                  </div>
                  {p.isLet && (p.monthlyRent ?? 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Net of rent, before tax</span>
                      <span className={`tabular-nums font-semibold ${(p.monthlyRent ?? 0) - monthlyTotal >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {fmt((p.monthlyRent ?? 0) - monthlyTotal)}/mo
                      </span>
                    </div>
                  )}
                </div>
              )}
            </PanelSection>

            <div ref={finderRef}><EnergySection summary={summary} budget={budget} /></div>

            <PanelSection title="Capital gains record">
              <p className="text-caption text-muted mt-0 mb-2 leading-snug">
                {p.isMainResidence
                  ? 'Usually exempt while it’s your main residence, but worth keeping in case that changes.'
                  : 'A gain on a home that isn’t your main residence is taxable on sale. These figures set the base it’s measured from — much easier to record now than reconstruct later.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Field label="Bought for £">{numberInput(p.purchasePrice, v => set({ purchasePrice: v }))}</Field>
                <Field label="Bought">
                  <input type="month" value={p.purchaseDate ?? ''} onChange={e => set({ purchaseDate: e.target.value || undefined })} className={inputClass} />
                </Field>
                <Field label="Stamp duty £">{numberInput(p.stampDutyPaid, v => set({ stampDutyPaid: v }), '0', 'w-[110px]')}</Field>
                <Field label="Improvements £">{numberInput(p.improvementCosts, v => set({ improvementCosts: v }), '0', 'w-[110px]')}</Field>
              </div>
              {paperGain != null && p.estimatedValue > 0 && (
                <div className="flex justify-between text-xs mt-2 pt-2 border-t border-border">
                  <span className="text-muted">Gain at today&apos;s value, before selling costs</span>
                  <span className={`tabular-nums font-semibold ${paperGain >= 0 ? 'text-ink' : 'text-negative'}`}>{fmt(paperGain)}</span>
                </div>
              )}
              <p className="text-caption text-muted mt-1.5 mb-0">Improvements means lasting additions (an extension, a new kitchen) — not repairs or upkeep. A rough guide, not tax advice.</p>
            </PanelSection>

            <div className="pt-1 border-t border-border">
              <DeleteAction label="Delete property" onClick={() => setConfirmDelete(true)} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function PropertiesSection({ budget, focusPropertyId, onFocusHandled }: { budget: BudgetHook; focusPropertyId?: string | null; onFocusHandled?: () => void }) {
  const { data, addProperty } = budget
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [owner, setOwner] = useState<Owner>('JOINT')
  const summaries = propertySummaries(data)
  const ownerName = (o: Owner) => o === 'NIAMH' ? (data.nameNiamh || 'Person 1') : o === 'RUPERT' ? (data.nameRupert || 'Person 2') : (data.nameJoint || 'Joint')
  const totalEquity = summaries.reduce((a, s) => a + s.equity, 0)
  const submit = () => { if (label.trim()) { addProperty(label.trim(), owner); setLabel(''); setAdding(false) } }

  return (
    <div className="mt-6 pt-6 border-t-2 border-border">
      <div className="flex justify-between items-baseline mb-3">
        <h2 className="font-serif text-xl m-0 flex items-center gap-2">Property</h2>
        {summaries.length > 0 && (
          <div className="text-right">
            <div className="text-caption text-muted">Total equity</div>
            <div className={`font-serif text-xl font-bold tabular-nums leading-none ${totalEquity >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(totalEquity)}</div>
          </div>
        )}
      </div>

      {summaries.map(s => <PropertyCard key={s.property.id} summary={s} ownerName={ownerName} budget={budget} focused={s.property.id === focusPropertyId} onFocusHandled={onFocusHandled} />)}

      {summaries.length === 0 && !adding && (
        <p className="text-xs text-muted mt-0 mb-3 leading-relaxed">
          Add each home you own to see its equity, loan-to-value and true monthly cost — and so net worth counts what it&apos;s worth, not just what&apos;s owed on it.
        </p>
      )}

      {adding ? (
        <div className="card p-3">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="e.g. Home, Norfolk"
            autoFocus
            className={`${inputClass} w-full mb-2`}
          />
          <select value={owner} onChange={e => setOwner(e.target.value as Owner)} aria-label="Owned by" className={`${inputClass} w-full mb-2`}>
            {(['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).map(o => <option key={o} value={o}>{ownerName(o)}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 bg-ink text-on-ink border-0 rounded-xl py-2.5 cursor-pointer text-sm font-semibold">Add property</button>
            <button onClick={() => setAdding(false)} className="px-4 bg-transparent border-[1.5px] border-border rounded-xl py-2.5 cursor-pointer text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-dashed border-border rounded-xl text-muted text-sm cursor-pointer bg-transparent"
        >
          <Plus size={14} /> Add property
        </button>
      )}
    </div>
  )
}
