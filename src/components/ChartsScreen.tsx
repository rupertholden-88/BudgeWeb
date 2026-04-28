'use client'

import { useMemo, useState } from 'react'
import { fmt, calcTotals } from '@/lib/models'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie, LabelList } from 'recharts'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const PIE_COLORS = ['#8BAFD4','#E8A598','#A8C5A0','#F0C987','#B5A9D4','#87C5C5','#D4A5A5','#A5C4D4','#C5D4A5','#D4C5A5']

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
}

function formatMonth(dateStr: string) {
  const parts = dateStr.slice(0, 7).split('-')
  return `${MONTH_LABELS[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((a: number, p: any) => a + (p.value || 0), 0)
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ink)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.fill, marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.value)}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)' }}>
        <span>Total</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function ChartsScreen({ budget }: { budget: BudgetHook }) {
  const { data, totals } = budget
  const [expFilter, setExpFilter] = useState<'ALL' | 'NIAMH' | 'RUPERT' | 'JOINT'>('JOINT')

  const monthlyData = useMemo(() => {
    const months = new Set<string>()
    data.savingsHistory.forEach(s => months.add(s.date.slice(0, 7)))
    const today = new Date().toISOString().slice(0, 7)
    months.add(today)
    return Array.from(months).sort().map(month => {
      const totalAssets = data.savingsHistory
        .filter(s => s.date.slice(0, 7) === month)
        .reduce((acc, s) => acc + (Array.isArray(s.assets) ? s.assets.reduce((a, i) => a + (i.amount || 0), 0) : 0), 0)
      const isCurrentMonth = month === today
      return {
        month: formatMonth(month),
        Expenses: isCurrentMonth ? totals.totalExp : null,
        Savings: isCurrentMonth ? totals.totalSav : null,
        Assets: totalAssets,
      }
    })
  }, [data, totals])

  const expenseData = useMemo(() =>
    data.categories
      .filter(c => c.type === 'EXPENSE' && (expFilter === 'ALL' || c.owner === expFilter))
      .flatMap(c => c.items.map(i => ({ name: i.label, value: i.amount, category: c.label })))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
  , [data, expFilter])

  const overviewData = [
    { name: 'Expenses', value: totals.totalExp, fill: 'var(--expense-text)' },
    { name: 'Savings',  value: totals.totalSav, fill: 'var(--savings-text)' },
  ]

  const personData = [
    { name: data.nameNiamh || 'Person 1', Income: totals.incN, Expenses: totals.expN + totals.halfJointExp + totals.halfJointDebt, Savings: totals.savN + totals.halfJointSav },
    { name: data.nameRupert || 'Person 2', Income: totals.incR, Expenses: totals.expR + totals.halfJointExp + totals.halfJointDebt, Savings: totals.savR + totals.halfJointSav },
  ]

  const hasMultipleMonths = monthlyData.length > 1

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <h2 style={{ fontSize: 20, marginBottom: 16, marginTop: 0 }}>Analysis</h2>

      {/* Expenses by category */}
      {expenseData.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Expenses by Category</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {(['ALL', 'NIAMH', 'RUPERT', 'JOINT'] as const).map(f => {
              const label = f === 'ALL' ? 'All' : f === 'NIAMH' ? (data.nameNiamh || 'Person 1') : f === 'RUPERT' ? (data.nameRupert || 'Person 2') : (data.nameJoint || 'Joint')
              return (
                <button key={f} onClick={() => setExpFilter(f)} className={expFilter === f ? `chip chip-${f.toLowerCase()}` : 'chip chip-inactive'}>
                  {label}
                </button>
              )
            })}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={expenseData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                {expenseData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                itemStyle={{ color: 'var(--ink)' }}
                formatter={(v: number) => fmt(v)}
              />
            </PieChart>
          </ResponsiveContainer>
          {expenseData.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                {d.name}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Monthly stacked bar */}
      <div className="card" style={{ padding: 16, marginBottom: 12, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Monthly Spend & Savings</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Stacked — tap a bar for breakdown</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} barSize={40} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Expenses" stackId="stack" fill="var(--expense-text)" radius={[0,0,0,0]}>
              <LabelList dataKey="Expenses" position="insideTop" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }}
                formatter={(v: number) => v && v > 0 ? fmt(v) : ''} />
            </Bar>
            <Bar dataKey="Savings" stackId="stack" fill="var(--savings-text)" radius={[4,4,0,0]}>
              <LabelList dataKey="Savings" position="insideTop" style={{ fontSize: 10, fill: 'white', fontWeight: 600 }}
                formatter={(v: number) => v && v > 0 ? fmt(v) : ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Assets over time */}
      {hasMultipleMonths && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Total Assets Over Time</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barSize={32} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                itemStyle={{ color: 'var(--ink)' }}
                formatter={(v: number) => fmt(v)}
              />
              <Bar dataKey="Assets" fill="var(--joint)" radius={[4,4,0,0]}>
                <LabelList dataKey="Assets" position="top" style={{ fontSize: 10, fill: 'var(--muted)', fontWeight: 600 }}
                  formatter={(v: number) => v > 0 ? fmt(v) : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* This month */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>This Month</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={overviewData} barSize={40} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="value" radius={[4,4,0,0]}>
              <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: 'var(--muted)', fontWeight: 600 }} formatter={(v: number) => fmt(v)} />
              {overviewData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By person */}
      {(totals.incN > 0 || totals.incR > 0) && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>By Person</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={personData} barGap={4} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                itemStyle={{ color: 'var(--ink)' }}
                formatter={(v: number) => fmt(v)}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Income"   fill="var(--income-text)"  radius={[4,4,0,0]} />
              <Bar dataKey="Expenses" fill="var(--expense-text)" radius={[4,4,0,0]} />
              <Bar dataKey="Savings"  fill="var(--savings-text)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {expenseData.length === 0 && totals.totalInc === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 48, fontSize: 14 }}>
          Add some figures on the Budget tab to see charts.
        </div>
      )}
    </div>
  )
}
