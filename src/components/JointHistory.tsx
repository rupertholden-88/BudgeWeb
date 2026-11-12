'use client'

import { BudgetData, fmt } from '@/lib/models'
import { jointHistory } from '@/lib/jointHistory'

export default function JointHistory({ data }: { data: BudgetData }) {
  const rows = jointHistory(data)
  const current = rows[11]
  const previous = rows[10]
  const change = previous.amount == null ? null : current.amount! - previous.amount
  return (
    <section className="panel p-5 mb-4" aria-label="Joint account history">
      <h2 className="text-[20px] font-semibold m-0">Into the joint account</h2>
      <p className="text-label text-muted mt-1 mb-3">Required each month · past 12 months</p>
      <div className="text-[28px] font-semibold num">{fmt(current.amount!)}</div>
      <p className="text-label text-muted mt-1">This month · {fmt(current.amount! / 2)} each</p>
      {change != null && <p className={`text-label font-medium ${change > 0 ? 'text-warn' : change < 0 ? 'text-pos' : 'text-muted'}`}>
        {change === 0 ? 'Unchanged from last month' : `${fmt(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than last month${previous.amount! > 0 ? ` (${(Math.abs(change) / previous.amount! * 100).toFixed(1)}%)` : ''}`}
      </p>}
      <div className="overflow-x-auto">
        <table className="w-full text-label num">
          <thead><tr className="text-muted text-left"><th className="py-2 font-medium">Month</th><th className="py-2 text-right font-medium">Total</th><th className="py-2 text-right font-medium">Each</th><th className="py-2 text-right font-medium">Change</th></tr></thead>
          <tbody>{rows.map((row, i) => {
            const prior = rows[i - 1]?.amount
            const delta = row.amount != null && prior != null ? row.amount - prior : null
            return <tr key={row.key} className={`border-t border-line ${row.current ? 'font-semibold' : ''}`}>
              <td className="py-2">{row.label}{row.current ? ' *' : ''}</td>
              <td className="py-2 text-right">{row.amount == null ? '—' : fmt(row.amount)}</td>
              <td className="py-2 text-right">{row.amount == null ? '—' : fmt(row.amount / 2)}</td>
              <td className={`py-2 text-right ${delta != null && delta > 0 ? 'text-warn' : delta != null && delta < 0 ? 'text-pos' : 'text-muted'}`}>{delta == null ? '—' : delta === 0 ? '£0' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <p className="text-caption text-muted mt-3 mb-0">Includes joint bills, debt repayments, savings contributions and one-offs funded from income, including top-ups. Split 50/50. These are budget requirements, not bank transactions.</p>
      <p className="text-caption text-muted mt-2 mb-0">* Current month updates as you edit. Previous months show their last saved budget. — means no joint-account history was recorded; older household totals cannot be used to calculate it. Infrequent bills count in their selected months.</p>
    </section>
  )
}
