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
    <div className="bg-card border border-border rounded-lg px-3.5 py-2.5 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <div className="font-semibold mb-1.5 text-ink">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4 mb-0.5" style={{ color: p.fill }}>
          <span>{p.name}</span>
          <span className="font-semibold tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-border mt-1.5 pt-1.5 flex justify-between font-bold text-ink">
        <span>Total</span>
        <span className="tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function ChartsScreen({ budget }: { budget: BudgetHook }) {
  const { data, totals } = budget
  const [expFilter, setExpFilter] = useState<'ALL' | 'NIAMH' | 'RUPERT' | 'JOINT'>('JOINT')

  const monthlyData = useMemo(() => {
    const months = new Set<string>()
    const today = new Date().toISOString().slice(0, 7)
    ;(data.spendHistory || []).forEach((s: any) => months.add(s.date))
    months.add(today)
    return Array.from(months).sort().map(month => {
      const snap = (data.spendHistory || []).find((s: any) => s.date === month)
      const isCurrentMonth = month === today
      return {
        month: formatMonth(month),
        Expenses: isCurrentMonth ? totals.totalExp : (snap?.totalExp ?? null),
        Savings: isCurrentMonth ? totals.totalSav : (snap?.totalSav ?? null),
      }
    })
  }, [data.spendHistory, totals])

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

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="font-serif text-xl mb-4 mt-0">Analysis</h2>

      {expenseData.length > 0 && (
        <div className="card p-4 mb-3">
          <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em] mb-2.5">Expenses by Category</div>
          <div className="flex gap-1.5 mb-3 flex-wrap">
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
            <div key={i} className="flex justify-between text-xs py-1 border-b border-border">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {d.name}
              </span>
              <span className="tabular-nums font-semibold">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4 mb-3 mt-4">
        <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em] mb-1">Monthly Spend & Savings</div>
        <div className="text-[11px] text-muted mb-3">Stacked — tap a bar for breakdown</div>
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

      <div className="card p-4 mb-3">
        <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em] mb-3">This Month</div>
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

      {(totals.incN > 0 || totals.incR > 0) && (
        <div className="card p-4 mb-3">
          <div className="text-xs font-semibold text-muted uppercase tracking-[0.06em] mb-3">By Person</div>
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
        <div className="text-center text-muted mt-12 text-sm">
          Add some figures on the Budget tab to see charts.
        </div>
      )}
    </div>
  )
}
