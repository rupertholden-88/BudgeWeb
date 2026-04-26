'use client'

import { useMemo } from 'react'
import { fmt, calcTotals } from '@/lib/models'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const PIE_COLORS = ['#8BAFD4','#E8A598','#A8C5A0','#F0C987','#B5A9D4','#87C5C5','#D4A5A5','#A5C4D4','#C5D4A5','#D4C5A5']

export default function ChartsScreen({ budget }: { budget: BudgetHook }) {
  const { data, totals } = budget

  const expenseData = useMemo(() =>
    data.categories.filter(c => c.type === 'EXPENSE')
      .map(c => ({ name: c.label, value: c.items.reduce((a, i) => a + i.amount, 0) }))
      .filter(d => d.value > 0).sort((a, b) => b.value - a.value)
  , [data])

  const overviewData = [
    { name: 'Income',   value: totals.totalInc, fill: 'var(--income-text)' },
    { name: 'Expenses', value: totals.totalExp,  fill: 'var(--expense-text)' },
    { name: 'Savings',  value: totals.totalSav,  fill: 'var(--savings-text)' },
  ]

  const personData = [
    { name: data.nameNiamh,  Income: totals.incN, Expenses: totals.expN + totals.halfJointExp + totals.halfJointDebt, Savings: totals.savN + totals.halfJointSav },
    { name: data.nameRupert, Income: totals.incR, Expenses: totals.expR + totals.halfJointExp + totals.halfJointDebt, Savings: totals.savR + totals.halfJointSav },
  ]

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <h2 style={{ fontSize: 20, marginBottom: 16, marginTop: 0 }}>Analysis</h2>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Monthly Overview</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={overviewData} barSize={40}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="value" radius={[4,4,0,0]}>
              {overviewData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Monthly Net</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: totals.net >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{fmt(totals.net)}</span>
      </div>

      {(totals.incN > 0 || totals.incR > 0) && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>By Person</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={personData} barGap={4}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Income"   fill="var(--income-text)"  radius={[4,4,0,0]} />
              <Bar dataKey="Expenses" fill="var(--expense-text)" radius={[4,4,0,0]} />
              <Bar dataKey="Savings"  fill="var(--savings-text)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {expenseData.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Expenses by Category</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={expenseData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                {expenseData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          {expenseData.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block' }} />
                {d.name}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}

      {expenseData.length === 0 && totals.totalInc === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 48, fontSize: 14 }}>Add some figures on the Budget tab to see charts.</div>
      )}
    </div>
  )
}
