'use client'

import { useMemo } from 'react'
import { fmt } from '@/lib/models'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area, LineChart, Line, ReferenceLine, Legend,
} from 'recharts'

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

function fmtK(n: number) {
  if (Math.abs(n) >= 1000) return `£${(n / 1000).toFixed(1)}k`
  return fmt(n)
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

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 mb-3">
      <div className="mb-3">
        <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em]">{title}</div>
        {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
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
      {payload.map((p: any) => (
        p.value != null && (
          <div key={p.name} className="flex justify-between gap-4 mb-0.5">
            <span className="text-muted">{p.name}</span>
            <span className="font-semibold tabular-nums" style={{ color: p.color }}>{fmt(p.value)}</span>
          </div>
        )
      ))}
    </div>
  )
}

export default function ChartsScreen({ budget }: { budget: BudgetHook }) {
  const { data, totals } = budget
  const today = new Date().toISOString().slice(0, 7)

  const monthlyData = useMemo(() => {
    const months = new Set<string>()
    ;(data.spendHistory || []).forEach((s: any) => months.add(s.date))
    months.add(today)
    return Array.from(months).sort().map(month => {
      const snap = (data.spendHistory || []).find((s: any) => s.date === month)
      const isNow = month === today
      const inc  = isNow ? totals.totalInc : (snap?.totalInc ?? null)
      const exp  = isNow ? totals.totalExp : (snap?.totalExp ?? null)
      const sav  = isNow ? totals.totalSav : (snap?.totalSav ?? null)
      const outgoings = (exp != null && sav != null) ? exp + sav : null
      const surplus = (inc != null && outgoings != null) ? inc - outgoings : null
      const rate = (inc != null && inc > 0 && sav != null) ? Math.round((sav / inc) * 100) : null
      return { month: formatMonth(month), Income: inc, Outgoings: outgoings, Surplus: surplus, SavingsRate: rate }
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
  const biggestExpense = expenseBreakdown[0]

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

      {/* Key stats */}
      <div className="flex gap-2 mb-4">
        <StatCard
          label="Savings rate"
          value={`${savingsRate}%`}
          sub={savingsRate >= 20 ? 'On track ✓' : 'Below 20% goal'}
          intent={savingsRate >= 20 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Leftover"
          value={fmt(totals.net)}
          sub="unallocated"
          intent={totals.net >= 0 ? 'positive' : 'negative'}
        />
        {biggestExpense && (
          <StatCard
            label="Top expense"
            value={fmtK(biggestExpense.amount)}
            sub={biggestExpense.name}
            intent="neutral"
          />
        )}
      </div>

      {/* Income vs Outgoings area chart */}
      {hasHistory && (
        <SectionCard title="Income vs Outgoings" sub="Monthly trend — the gap between lines is your surplus">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--positive)"     stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--positive)"     stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOutgoings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--expense-text)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--expense-text)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone" dataKey="Income" name="Income"
                stroke="var(--positive)" fill="url(#gradIncome)"
                strokeWidth={2.5} dot={false} connectNulls
              />
              <Area
                type="monotone" dataKey="Outgoings" name="Outgoings"
                stroke="var(--expense-text)" fill="url(#gradOutgoings)"
                strokeWidth={2.5} dot={false} connectNulls
              />
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

      {/* Monthly surplus / deficit */}
      {hasHistory && (
        <SectionCard title="Monthly surplus" sub="Leftover after all expenses and savings — green is good">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barSize={32} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const v = payload[0].value as number
                  return (
                    <div className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
                      <div className="font-semibold text-ink mb-1">{label}</div>
                      <div className={`font-bold tabular-nums ${v >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(v)}</div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="Surplus" name="Surplus" radius={[4, 4, 0, 0]}>
                {monthlyData.map((entry, i) => (
                  <Cell key={i}
                    fill={(entry.Surplus ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* Spending breakdown — custom horizontal bars */}
      {expenseBreakdown.length > 0 && (
        <SectionCard title="Spending breakdown" sub="This month's expenses — largest first">
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
                  <div className="h-[7px] bg-surface rounded-full overflow-hidden">
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

      {/* Savings rate trend */}
      {hasHistory && monthlyData.some(d => d.SavingsRate != null) && (
        <SectionCard title="Savings rate" sub="% of income saved each month — 20% is a healthy target">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={monthlyData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, (max: number) => Math.max(max, 25)]} />
              <ReferenceLine
                y={20}
                stroke="var(--positive)"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: '20%', position: 'right', fontSize: 10, fill: 'var(--positive)', fontWeight: 600 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const v = payload[0].value as number
                  return (
                    <div className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
                      <div className="font-semibold text-ink mb-1">{label}</div>
                      <div className={`font-bold tabular-nums ${v >= 20 ? 'text-positive' : 'text-savings-text'}`}>{v}%</div>
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="SavingsRate"
                name="Savings rate"
                stroke="var(--savings-text)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: 'var(--savings-text)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--savings-text)', strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      )}

      {/* By person */}
      {totals.incN > 0 && totals.incR > 0 && (
        <SectionCard title="By person" sub="How income and spending split between you">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={[
                {
                  name: data.nameNiamh || 'Person 1',
                  Income: totals.incN,
                  Expenses: totals.expN + totals.halfJointExp + totals.halfJointDebt,
                  Savings: totals.savN + totals.halfJointSav,
                },
                {
                  name: data.nameRupert || 'Person 2',
                  Income: totals.incR,
                  Expenses: totals.expR + totals.halfJointExp + totals.halfJointDebt,
                  Savings: totals.savR + totals.halfJointSav,
                },
              ]}
              barGap={4}
              margin={{ top: 16, right: 4, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Income"   fill="var(--income-text)"  radius={[4,4,0,0]} />
              <Bar dataKey="Expenses" fill="var(--expense-text)" radius={[4,4,0,0]} />
              <Bar dataKey="Savings"  fill="var(--savings-text)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      )}
    </div>
  )
}
