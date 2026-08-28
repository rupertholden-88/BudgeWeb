'use client'

import { useMemo, useState } from 'react'
import { fmt, Owner, upcomingRenewals, monthsToClear } from '@/lib/models'
import { buildFinancialSummary, hashSummary } from '@/lib/financialSummary'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ShieldCheck, AlertTriangle, Scale, TrendingUp, TrendingDown, CalendarClock, Sparkles } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

function formatMonth(dateStr: string) {
  const parts = dateStr.slice(0, 7).split('-')
  return `${MONTH_LABELS[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`
}

function addMonths(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function StatCard({ label, value, sub, intent }: {
  label: string; value: string; sub?: string
  intent?: 'positive' | 'negative' | 'neutral'
}) {
  const valueClass = intent === 'positive' ? 'text-positive' : intent === 'negative' ? 'text-negative' : 'text-ink'
  return (
    <div className="card p-3 flex-1 min-w-0">
      <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.06em] mb-1 truncate">{label}</div>
      <div className={`text-lg font-bold tabular-nums leading-none ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-1 leading-tight">{sub}</div>}
    </div>
  )
}

function SectionCard({ title, sub, icon, children }: {
  title: string; sub?: string; icon?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="card p-4 mb-3">
      <div className="mb-3 flex items-start gap-2">
        {icon && <span className="text-muted mt-px shrink-0">{icon}</span>}
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em]">{title}</div>
          {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
      <div className="font-semibold text-ink mb-1.5">{label}</div>
      {payload.map((p: any) => p.value != null && (
        <div key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span className="text-muted">{p.name}</span>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function healthIntent(status: string): 'positive' | 'negative' | 'neutral' {
  if (status === 'strong' || status === 'solid') return 'positive'
  if (status === 'at_risk') return 'negative'
  return 'neutral'
}
function healthLabel(status: string) {
  return status === 'strong' ? 'Strong' : status === 'solid' ? 'Solid' : status === 'at_risk' ? 'At risk' : 'Needs attention'
}

function fmtUsd(n: number) {
  return `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`
}

function FinancialHealthCard({ data, totals, recordFinancialHealthRun }: {
  data: BudgetHook['data']; totals: BudgetHook['totals']
  recordFinancialHealthRun: BudgetHook['recordFinancialHealthRun']
}) {
  const summary = useMemo(() => buildFinancialSummary(data, totals), [data, totals])
  const currentHash = useMemo(() => hashSummary(summary), [summary])

  // The result is synced via Firestore alongside the rest of the budget, so
  // it follows the account across devices rather than living per-browser.
  const cached = data.financialHealth ?? null
  const result = cached?.result ?? null
  const rawText = cached?.rawText ?? null
  const generatedAt = cached?.generatedAt ?? null
  const lastCostUsd = cached?.costUsd ?? null
  const stale = cached != null && cached.hash !== currentHash
  const usage = data.financialHealthUsage ?? null

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ notConfigured: boolean; message: string } | null>(null)

  const hasEnoughData = totals.totalInc > 0 || totals.totalExp > 0

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/financial-health', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary }),
      })
      const body = await res.json().catch(() => ({}))
      const costUsd: number = typeof body.costUsd === 'number' ? body.costUsd : 0
      if (!res.ok) {
        setError({ notConfigured: body.error === 'not_configured', message: body.message || 'Something went wrong — try again.' })
        // A refusal or an unparseable/empty reply still reached Anthropic and was billed —
        // count it even though there's nothing usable to cache.
        if (costUsd > 0) recordFinancialHealthRun({ costUsd })
        return
      }
      recordFinancialHealthRun({
        cache: {
          hash: currentHash,
          result: body.result ?? null,
          rawText: body.rawText ?? null,
          generatedAt: new Date().toISOString(),
          costUsd,
          inputTokens: body.inputTokens ?? 0,
          outputTokens: body.outputTokens ?? 0,
        },
        costUsd,
      })
    } catch {
      setError({ notConfigured: false, message: 'Could not reach the assessment service — check your connection and try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard
      title="Financial health check"
      sub="A detailed AI read on your numbers against general UK benchmarks"
      icon={<Sparkles size={14} />}
    >
      {!hasEnoughData ? (
        <p className="text-[13px] text-muted m-0">Add some budget figures first, then run a check.</p>
      ) : (
        <>
          {result && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full ${
                  healthIntent(result.status) === 'positive' ? 'bg-income-bg text-positive'
                  : healthIntent(result.status) === 'negative' ? 'bg-expense-bg text-negative'
                  : 'bg-surface text-muted'
                }`}>
                  {healthLabel(result.status)}
                </span>
                {generatedAt && (
                  <span className="text-[10px] text-muted">
                    {stale ? 'Based on earlier figures' : `Checked ${new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    {lastCostUsd != null && ` · ${fmtUsd(lastCostUsd)}`}
                  </span>
                )}
              </div>
              <div className="font-serif text-lg leading-snug mb-1.5">{result.headline}</div>
              <p className="text-[13px] text-muted leading-relaxed mb-3">{result.overview ?? ''}</p>

              {(result.sections ?? []).length > 0 && (
                <div className="space-y-3 mb-3 pt-3 border-t border-border">
                  {(result.sections ?? []).map((s, i) => (
                    <div key={i} className={`pl-2.5 ${
                      s.status && healthIntent(s.status) === 'positive' ? 'border-l-2 border-l-positive'
                      : s.status && healthIntent(s.status) === 'negative' ? 'border-l-2 border-l-negative'
                      : 'border-l-2 border-l-border'
                    }`}>
                      <div className="text-[12px] font-semibold text-ink mb-0.5">{s.title}</div>
                      <p className="text-[12px] text-muted leading-relaxed m-0">{s.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {result.benchmarks?.length > 0 && (
                <div className="space-y-2 mb-3 pt-3 border-t border-border">
                  {result.benchmarks.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          healthIntent(b.status) === 'positive' ? 'bg-positive'
                          : healthIntent(b.status) === 'negative' ? 'bg-negative' : 'bg-border'
                        }`} />
                        <span className="text-[12px] text-ink truncate">{b.metric}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[12px] font-semibold tabular-nums text-ink">{b.yours}</span>
                        <span className="text-[10px] text-muted ml-1.5">typical {b.typical}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.strengths?.length > 0 && (
                <div className="mb-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-positive mb-1">Working well</div>
                  <ul className="m-0 pl-4 space-y-0.5">
                    {result.strengths.map((s, i) => <li key={i} className="text-[12px] text-ink">{s}</li>)}
                  </ul>
                </div>
              )}
              {(result.priorityActions ?? []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-expense-text mb-1">Priority actions</div>
                  <ol className="m-0 pl-4 space-y-1 list-decimal">
                    {(result.priorityActions ?? []).map((s, i) => <li key={i} className="text-[12px] text-ink">{s}</li>)}
                  </ol>
                </div>
              )}
            </div>
          )}

          {!result && rawText && (
            <p className="text-[13px] text-ink whitespace-pre-wrap mb-3">{rawText}</p>
          )}

          {error && (
            error.notConfigured ? (
              <div className="text-[12px] text-muted bg-surface rounded-lg p-3 mb-3 leading-relaxed">
                This needs an Anthropic API key set on the server — add <code className="font-mono">ANTHROPIC_API_KEY</code> under
                your Vercel project's Environment Variables, then redeploy. It can't be entered here, since a key typed into
                the app would be visible to anyone using this browser.
              </div>
            ) : (
              <div className="text-[12px] text-negative bg-expense-bg rounded-lg p-3 mb-3">{error.message}</div>
            )
          )}

          <button
            onClick={run}
            disabled={loading}
            className={`w-full border-0 rounded-lg py-2.5 text-[13px] font-semibold ${loading ? 'bg-border text-muted cursor-default' : 'bg-ink text-white cursor-pointer'}`}
          >
            {loading ? 'Checking…' : result ? 'Refresh check' : 'Run financial health check'}
          </button>
          <p className="text-[10px] text-muted mt-2 mb-0 text-center leading-relaxed">
            General guidance from typical UK household benchmarks — not regulated financial advice.
            {usage && usage.totalRuns > 0 && (
              <> Spent {fmtUsd(usage.totalCostUsd)} on {usage.totalRuns} {usage.totalRuns === 1 ? 'check' : 'checks'} so far.</>
            )}
          </p>
        </>
      )}
    </SectionCard>
  )
}

export default function ChartsScreen({ budget }: { budget: BudgetHook }) {
  const { data, totals, recordFinancialHealthRun } = budget
  const today = new Date().toISOString().slice(0, 7)

  const n1 = data.nameNiamh || 'Person 1'
  const n2 = data.nameRupert || 'Person 2'

  // ── Runway ────────────────────────────────────────────────────────────────
  const liquidAssets = useMemo(() =>
    (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
      const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
      const assets = (Array.isArray(snap?.assets) ? snap!.assets : []).filter((a: any) => a.type !== 'PENSION')
      return acc + assets.reduce((a, i) => a + (i.amount || 0), 0)
    }, 0)
  , [data.savingsHistory, today])

  const monthlyOutgoings = totals.totalExp // already includes debt payments
  const runway = monthlyOutgoings > 0 ? liquidAssets / monthlyOutgoings : null

  // ── Debt payoff ───────────────────────────────────────────────────────────
  const debtAnalysis = useMemo(() => {
    const rows = data.debts
      .filter(d => d.currentBalance > 0)
      .map(d => {
        const effectiveRate = d.isZeroPercent ? 0 : d.interestRate
        const months = monthsToClear(d.currentBalance, d.monthlyPayment, effectiveRate)
        const totalPaid = months != null ? d.monthlyPayment * months : null
        const interest = totalPaid != null ? Math.max(0, totalPaid - d.currentBalance) : null
        const naive = d.monthlyPayment > 0 ? Math.ceil(d.currentBalance / d.monthlyPayment) : null
        return { debt: d, months, interest, naive }
      })
      .sort((a, b) => (b.months ?? 9999) - (a.months ?? 9999))
    const longest = rows.reduce((max, r) => Math.max(max, r.months ?? 0), 0)
    const stalled = rows.some(r => r.months == null)
    const totalInterest = rows.reduce((a, r) => a + (r.interest ?? 0), 0)
    return { rows, longest, stalled, totalInterest }
  }, [data.debts])

  // ── 0% expiries ───────────────────────────────────────────────────────────
  const expiries = useMemo(() => {
    const now = new Date()
    return data.debts
      .filter(d => d.isZeroPercent && d.zeroPercentExpiryDate && d.currentBalance > 0)
      .map(d => {
        const expiry = new Date(d.zeroPercentExpiryDate!)
        const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
        const monthsLeft = Math.max(0, days / 30.44)
        const balanceAtExpiry = Math.max(0, d.currentBalance - d.monthlyPayment * monthsLeft)
        // Rate is often left blank on a 0% card — treat it as unknown rather
        // than letting undefined poison the arithmetic.
        const rate = Number(d.interestRate) || 0
        const monthlyInterestAfter = (balanceAtExpiry * rate) / 100 / 12
        return { debt: d, days, expiry, balanceAtExpiry, monthlyInterestAfter, rate }
      })
      // Nothing to warn about if the current payments clear it before expiry.
      .filter(e => e.balanceAtExpiry > 0)
      .sort((a, b) => a.days - b.days)
  }, [data.debts])

  // ── Net interest position ─────────────────────────────────────────────────
  const interestPosition = useMemo(() => {
    const earned = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).reduce((acc, owner) => {
      const snap = data.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
      const assets = (Array.isArray(snap?.assets) ? snap!.assets : [])
        .filter((a: any) => a.type !== 'PENSION' && a.interestRate && a.amount > 0)
      return acc + assets.reduce((a: number, i: any) =>
        a + i.amount * (Math.pow(1 + i.interestRate / 100, 1 / 12) - 1), 0)
    }, 0)
    const paid = data.debts.reduce((a, d) =>
      a + (d.isZeroPercent ? 0 : (d.currentBalance * d.interestRate) / 100 / 12), 0)
    return { earned, paid, net: earned - paid }
  }, [data.savingsHistory, data.debts, today])

  // ── Fair share ────────────────────────────────────────────────────────────
  const fairShare = useMemo(() => {
    const jointTotal = totals.expJoint + totals.savJoint + totals.debtJoint
    if (jointTotal <= 0 || totals.incN <= 0 || totals.incR <= 0) return null
    const half = jointTotal / 2
    const shareN = totals.incN / (totals.incN + totals.incR)
    return {
      jointTotal,
      half,
      currentPctN: (half / totals.incN) * 100,
      currentPctR: (half / totals.incR) * 100,
      fairN: jointTotal * shareN,
      fairR: jointTotal * (1 - shareN),
      fairPct: shareN * 100,
    }
  }, [totals])

  // ── Trend ─────────────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months = new Set<string>()
    ;(data.spendHistory || []).forEach((s: any) => months.add(s.date))
    months.add(today)
    return Array.from(months).sort().map(month => {
      const snap = (data.spendHistory || []).find((s: any) => s.date === month)
      const isNow = month === today
      const inc = isNow ? totals.totalInc : (snap?.totalInc ?? null)
      const exp = isNow ? totals.totalExp : (snap?.totalExp ?? null)
      const sav = isNow ? totals.totalSav : (snap?.totalSav ?? null)
      const outgoings = (exp != null && sav != null) ? exp + sav : null
      return { month: formatMonth(month), Income: inc, Outgoings: outgoings }
    })
  }, [data.spendHistory, totals, today])

  const hasHistory = monthlyData.length > 1

  const expenseBreakdown = useMemo(() =>
    data.categories
      .filter(c => c.type === 'EXPENSE')
      .map(c => ({ name: c.label, amount: c.items.reduce((a, i) => a + i.amount, 0) }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  , [data.categories])

  const savingsRate = totals.totalInc > 0 ? Math.round((totals.totalSav / totals.totalInc) * 100) : 0

  const renewals = useMemo(() => upcomingRenewals(data), [data])
  // Anything inside the switching window, plus anything already lapsed.
  const dueSoon = renewals.filter(r => r.days <= 60)

  if (totals.totalInc === 0 && totals.totalExp === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-muted text-sm text-center">Add some figures on the Budget tab to see analysis.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="font-serif text-xl mt-0 mb-4">Analysis</h2>

      {/* Headline stats */}
      <div className="flex gap-2 mb-4">
        <StatCard
          label="Runway"
          value={runway != null ? `${runway.toFixed(1)} mo` : '—'}
          sub={runway != null ? (runway >= 6 ? 'Healthy cover' : runway >= 3 ? 'Building up' : 'Below 3 months') : 'Add assets'}
          intent={runway == null ? 'neutral' : runway >= 6 ? 'positive' : runway >= 3 ? 'neutral' : 'negative'}
        />
        <StatCard
          label="Net interest"
          value={`${interestPosition.net >= 0 ? '+' : ''}${fmt(interestPosition.net)}`}
          sub="per month"
          intent={interestPosition.net >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Savings rate"
          value={`${savingsRate}%`}
          sub={savingsRate >= 20 ? 'On track' : 'Below 20% goal'}
          intent={savingsRate >= 20 ? 'positive' : 'neutral'}
        />
      </div>

      <FinancialHealthCard data={data} totals={totals} recordFinancialHealthRun={recordFinancialHealthRun} />

      {/* 0% expiry warnings — time-sensitive, so they lead */}
      {expiries.map(({ debt, days, expiry, balanceAtExpiry, monthlyInterestAfter, rate }) => (
        <div
          key={debt.id}
          className={`card p-4 mb-3 border-l-[3px] ${days <= 90 ? 'border-l-negative' : 'border-l-expense-text'}`}
        >
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${days <= 90 ? 'text-negative' : 'text-expense-text'}`} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink">
                {debt.label} leaves 0% {days > 0 ? `in ${days} days` : '— already expired'}
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                {expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                {rate > 0 ? ` · then ${rate}% APR` : ' · rate after 0% not set'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <div>
              <div className="text-[10px] text-muted mb-0.5">Balance at expiry</div>
              <div className="text-sm font-bold tabular-nums text-ink">{fmt(balanceAtExpiry)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted mb-0.5">Interest starts costing</div>
              {rate > 0
                ? <div className="text-sm font-bold tabular-nums text-negative">{fmt(monthlyInterestAfter)}/mo</div>
                : <div className="text-sm font-medium text-muted">Add the rate on Debts</div>
              }
            </div>
          </div>
          {balanceAtExpiry > 0 && days > 0 && (
            <div className="text-[11px] text-muted mt-2.5 pt-2.5 border-t border-border">
              Clearing it in time needs{' '}
              <span className="font-semibold text-ink tabular-nums">
                {fmt(debt.currentBalance / Math.max(1, days / 30.44))}/mo
              </span>
              {' '}instead of {fmt(debt.monthlyPayment)}.
            </div>
          )}
        </div>
      ))}

      {/* Renewals */}
      {renewals.length > 0 && (
        <SectionCard
          title="Renewals"
          sub={dueSoon.length > 0
            ? `${dueSoon.length} ${dueSoon.length === 1 ? 'contract needs' : 'contracts need'} attention`
            : 'Nothing due in the next 60 days'}
          icon={<CalendarClock size={14} />}
        >
          <div className="space-y-2.5">
            {renewals.map(r => {
              const passed = r.days < 0
              const urgent = r.days >= 0 && r.days <= 30
              const soon = r.days > 30 && r.days <= 60
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${passed || urgent ? 'bg-negative' : soon ? 'bg-expense-text' : 'bg-border'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-ink truncate">{r.label}</div>
                    <div className="text-[10px] text-muted">
                      {r.category} · {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[11px] font-semibold tabular-nums ${passed || urgent ? 'text-negative' : soon ? 'text-expense-text' : 'text-muted'}`}>
                      {passed ? 'Date passed'
                        : r.days === 0 ? 'Today'
                        : r.days === 1 ? 'Tomorrow'
                        : `${r.days} days`}
                    </div>
                    {r.amount > 0 && (
                      <div className="text-[10px] text-muted tabular-nums">{fmt(r.amount)}/mo</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-muted mt-3 pt-3 border-t border-border mb-0">
            {renewals.some(r => r.days < 0)
              ? 'Dates in the past need updating to next year’s renewal.'
              : 'Insurers and energy suppliers rarely offer their best price on renewal — worth comparing about a month out.'}
          </p>
        </SectionCard>
      )}

      {/* Runway detail */}
      {runway != null && liquidAssets > 0 && (
        <SectionCard
          title="Runway"
          sub="How long your savings would cover outgoings with no income"
          icon={<ShieldCheck size={14} />}
        >
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`font-serif text-3xl font-bold tabular-nums leading-none ${runway >= 6 ? 'text-positive' : runway >= 3 ? 'text-ink' : 'text-negative'}`}>
              {runway.toFixed(1)}
            </span>
            <span className="text-sm text-muted">months of cover</span>
          </div>

          <div className="h-[7px] bg-surface rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${runway >= 6 ? 'bg-positive' : runway >= 3 ? 'bg-savings-text' : 'bg-negative'}`}
              style={{ width: `${Math.min(100, (runway / 6) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted mb-3">
            <span>0</span><span>3 months</span><span>6 months</span>
          </div>

          <div className="flex justify-between text-xs pt-2.5 border-t border-border">
            <span className="text-muted">Liquid savings</span>
            <span className="tabular-nums font-semibold text-ink">{fmt(liquidAssets)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted">Monthly outgoings</span>
            <span className="tabular-nums font-semibold text-expense-text">{fmt(monthlyOutgoings)}</span>
          </div>
          <p className="text-[10px] text-muted mt-2 mb-0">Pensions excluded — not accessible in an emergency.</p>
        </SectionCard>
      )}

      {/* Net interest position */}
      {(interestPosition.earned > 0 || interestPosition.paid > 0) && (
        <SectionCard
          title="Interest position"
          sub="What your savings earn against what your debts cost"
          icon={interestPosition.net >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[10px] text-muted mb-0.5">Earning</div>
              <div className="text-base font-bold tabular-nums text-positive">{fmt(interestPosition.earned)}</div>
            </div>
            <div className="hairline-v" />
            <div className="flex-1">
              <div className="text-[10px] text-muted mb-0.5">Paying</div>
              <div className="text-base font-bold tabular-nums text-negative">{fmt(interestPosition.paid)}</div>
            </div>
            <div className="hairline-v" />
            <div className="flex-1">
              <div className="text-[10px] text-muted mb-0.5">Net</div>
              <div className={`text-base font-bold tabular-nums ${interestPosition.net >= 0 ? 'text-positive' : 'text-negative'}`}>
                {interestPosition.net >= 0 ? '+' : ''}{fmt(interestPosition.net)}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted mt-3 pt-3 border-t border-border mb-0">
            {interestPosition.paid > interestPosition.earned
              ? `Your debts cost more than your savings earn — overpaying debt beats holding cash by ${fmt(interestPosition.paid - interestPosition.earned)}/mo.`
              : `Your savings out-earn your debt costs by ${fmt(interestPosition.net)}/mo — ${fmt(interestPosition.net * 12)} a year.`}
          </p>
        </SectionCard>
      )}

      {/* Debt payoff */}
      {debtAnalysis.rows.length > 0 && (
        <SectionCard
          title="Debt payoff"
          sub={debtAnalysis.stalled
            ? 'One payment is too small to clear its interest'
            : `Debt free ${addMonths(debtAnalysis.longest)} at current payments`}
        >
          <div className="space-y-3">
            {debtAnalysis.rows.map(({ debt, months, interest, naive }) => (
              <div key={debt.id}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-[13px] font-medium text-ink truncate pr-2">{debt.label}</span>
                  <span className="text-xs tabular-nums text-muted shrink-0">
                    {months == null
                      ? <span className="text-negative font-semibold">never at this rate</span>
                      : <>{months} mo · <span className="text-ink font-semibold">{addMonths(months)}</span></>
                    }
                  </span>
                </div>
                <div className="h-[6px] bg-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${debt.isZeroPercent ? 'bg-savings-text' : 'bg-expense-text'}`}
                    style={{ width: `${months == null ? 100 : Math.min(100, (months / Math.max(1, debtAnalysis.longest)) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted mt-1">
                  {fmt(debt.currentBalance)} at {debt.isZeroPercent ? '0%' : `${debt.interestRate}%`}
                  {interest != null && interest > 0 && ` · ${fmt(interest)} interest to come`}
                  {naive != null && months != null && months > naive &&
                    ` · ${months - naive} mo longer than the balance suggests`}
                </div>
              </div>
            ))}
          </div>
          {debtAnalysis.totalInterest > 0 && (
            <div className="flex justify-between text-xs pt-3 mt-3 border-t border-border">
              <span className="text-muted font-medium">Interest still to pay</span>
              <span className="tabular-nums font-bold text-negative">{fmt(debtAnalysis.totalInterest)}</span>
            </div>
          )}
        </SectionCard>
      )}

      {/* Fair share */}
      {fairShare && (
        <SectionCard
          title="Fair share"
          sub={`Splitting ${fmt(fairShare.jointTotal)} of joint costs down the middle`}
          icon={<Scale size={14} />}
        >
          <div className="space-y-3">
            {[
              { name: n1, pct: fairShare.currentPctN, cls: 'bg-niamh' },
              { name: n2, pct: fairShare.currentPctR, cls: 'bg-rupert' },
            ].map(p => (
              <div key={p.name}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-[13px] font-medium text-ink">{p.name}</span>
                  <span className="text-xs tabular-nums text-muted">
                    {fmt(fairShare.half)} — <span className="font-semibold text-ink">{p.pct.toFixed(0)}%</span> of income
                  </span>
                </div>
                <div className="h-[6px] bg-surface rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${p.cls}`} style={{ width: `${Math.min(100, p.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {Math.abs(fairShare.currentPctN - fairShare.currentPctR) > 2 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-[11px] text-muted mb-2">
                Split by income instead ({fairShare.fairPct.toFixed(0)}/{(100 - fairShare.fairPct).toFixed(0)}), each would pay:
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="text-[10px] text-muted mb-0.5">{n1}</div>
                  <div className="text-sm font-bold tabular-nums text-ink">{fmt(fairShare.fairN)}</div>
                  <div className={`text-[10px] tabular-nums ${fairShare.fairN < fairShare.half ? 'text-positive' : 'text-negative'}`}>
                    {fairShare.fairN < fairShare.half ? '−' : '+'}{fmt(Math.abs(fairShare.fairN - fairShare.half))}
                  </div>
                </div>
                <div className="hairline-v" />
                <div className="flex-1">
                  <div className="text-[10px] text-muted mb-0.5">{n2}</div>
                  <div className="text-sm font-bold tabular-nums text-ink">{fmt(fairShare.fairR)}</div>
                  <div className={`text-[10px] tabular-nums ${fairShare.fairR < fairShare.half ? 'text-positive' : 'text-negative'}`}>
                    {fairShare.fairR < fairShare.half ? '−' : '+'}{fmt(Math.abs(fairShare.fairR - fairShare.half))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Trend */}
      {hasHistory && (
        <SectionCard title="Income vs Outgoings" sub="The gap between the lines is your surplus">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--positive)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--positive)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOutgoings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--expense-text)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--expense-text)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Income" name="Income"
                stroke="var(--positive)" fill="url(#gradIncome)" strokeWidth={2.5} dot={false} connectNulls />
              <Area type="monotone" dataKey="Outgoings" name="Outgoings"
                stroke="var(--expense-text)" fill="url(#gradOutgoings)" strokeWidth={2.5} dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-5 justify-center mt-2">
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="w-4 h-0.5 rounded-full bg-positive inline-block" /> Income
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="w-4 h-0.5 rounded-full bg-expense-text inline-block" /> Outgoings
            </span>
          </div>
        </SectionCard>
      )}

      {/* Spending breakdown */}
      {expenseBreakdown.length > 0 && (
        <SectionCard title="Where it goes" sub="This month's expenses, largest first">
          <div className="space-y-3">
            {expenseBreakdown.map((cat, i) => {
              const pct = totals.totalExp > 0 ? (cat.amount / totals.totalExp) * 100 : 0
              const opacity = 1 - (i / expenseBreakdown.length) * 0.35
              return (
                <div key={i}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[13px] font-medium text-ink">{cat.name}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {fmt(cat.amount)} <span className="text-[10px]">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-[6px] bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-expense-text transition-[width] duration-500"
                      style={{ width: `${Math.max(pct, 0.5)}%`, opacity }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs pt-3 mt-3 border-t border-border">
            <span className="text-muted font-medium">Total expenses</span>
            <span className="tabular-nums font-bold text-expense-text">{fmt(totals.totalExp)}</span>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
