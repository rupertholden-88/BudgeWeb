import { useState, useRef } from 'react'
import { Owner, DebtType, Debt, fmt } from '@/lib/models'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const DEBT_LABELS: Record<DebtType, string> = {
  CREDIT_CARD: 'Credit Card', PERSONAL_LOAN: 'Personal Loan', CAR_FINANCE: 'Car Finance',
  MORTGAGE: 'Mortgage', STUDENT_LOAN: 'Student Loan', OTHER: 'Other'
}

function ownerLightBgClass(owner: Owner) {
  if (owner === 'NIAMH') return 'bg-niamh-light'
  if (owner === 'RUPERT') return 'bg-rupert-light'
  return 'bg-joint-light'
}

function DeleteModal({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/45 flex items-end justify-center" onClick={onCancel}>
      <div
        className="bg-card rounded-t-2xl px-5 pb-8 pt-5 w-full max-w-[480px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-[15px] font-semibold mb-1">Delete &ldquo;{label}&rdquo;?</div>
        <div className="text-[13px] text-muted mb-5">This can&apos;t be undone.</div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="bg-expense-text text-white border-0 rounded-[10px] p-3.5 cursor-pointer text-[15px] font-semibold"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="bg-surface text-ink border-0 rounded-[10px] p-3.5 cursor-pointer text-[15px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function DebtCard({ debt, ownerName, onUpdate, onDelete }: {
  debt: Debt; ownerName: string
  onUpdate: (id: string, fields: Partial<Debt>) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(debt.label)
  const [pendingDelete, setPendingDelete] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitLabel = () => { if (labelDraft.trim()) onUpdate(debt.id, { label: labelDraft.trim() }); setEditingLabel(false) }
  const months = debt.monthlyPayment > 0 && debt.currentBalance > 0 ? Math.ceil(debt.currentBalance / debt.monthlyPayment) : null

  const startPress = () => {
    if (editingLabel) return
    pressTimer.current = setTimeout(() => {
      navigator.vibrate?.(60)
      setPendingDelete(true)
    }, 600)
  }
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  return (
    <div style={{ display: 'contents' }}>
      {pendingDelete && (
        <DeleteModal
          label={debt.label}
          onConfirm={() => { onDelete(debt.id); setPendingDelete(false) }}
          onCancel={() => setPendingDelete(false)}
        />
      )}
      <div
        className={`card mb-2 overflow-hidden ${ownerLightBgClass(debt.owner)}`}
        onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress} onTouchCancel={cancelPress}
        onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="flex-1 min-w-0">
            {editingLabel ? (
              <input
                value={labelDraft}
                onChange={e => setLabelDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
                onBlur={commitLabel}
                onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                className="w-full text-sm font-semibold border-[1.5px] border-rupert rounded-md px-1.5 py-0.5"
                autoFocus
              />
            ) : (
              <span
                onClick={() => { setLabelDraft(debt.label); setEditingLabel(true) }}
                onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setLabelDraft(debt.label); setEditingLabel(true) } }}
                className="font-semibold text-sm cursor-text px-1 py-0.5 rounded"
              >
                {debt.label}
              </span>
            )}
            <div className="text-[11px] text-muted mt-0.5">
              {DEBT_LABELS[debt.type]} · {ownerName}{months ? ` · ~${months} months left` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-[15px] tabular-nums text-negative">{fmt(debt.currentBalance)}</div>
            {debt.monthlyPayment > 0 && <div className="text-[11px] text-muted">{fmt(debt.monthlyPayment)}/mo</div>}
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse debt details' : 'Expand debt details'}
            className="bg-transparent border-0 cursor-pointer text-muted flex p-1.5 min-w-8 min-h-8 items-center justify-center"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {expanded && (
          <div className="px-3 pb-3 border-t border-border">
            <div className="flex flex-wrap gap-3 mt-2.5">
              {[
                { label: 'Balance £', value: debt.currentBalance, key: 'currentBalance' },
                { label: 'Monthly £', value: debt.monthlyPayment, key: 'monthlyPayment' },
                { label: 'Rate %',    value: debt.interestRate,   key: 'interestRate' },
              ].map(({ label, value, key }) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <label className="text-[10px] text-muted uppercase tracking-[0.05em]">{label}</label>
                  <input
                    type="number"
                    value={value || ''}
                    onChange={e => onUpdate(debt.id, { [key]: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-[100px] text-[13px] border-[1.5px] border-border rounded-md px-2 py-1 bg-card"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <label className="flex items-center gap-1 text-[13px] cursor-pointer">
                <input type="checkbox" checked={debt.isZeroPercent} onChange={e => onUpdate(debt.id, { isZeroPercent: e.target.checked })} />
                0% deal
              </label>
              {debt.isZeroPercent && (
                <input
                  type="month"
                  value={debt.zeroPercentExpiryDate ?? ''}
                  onChange={e => onUpdate(debt.id, { zeroPercentExpiryDate: e.target.value })}
                  className="text-xs border-[1.5px] border-border rounded-md px-1.5 py-[3px]"
                />
              )}
            </div>
            <input
              value={debt.institution ?? ''}
              onChange={e => onUpdate(debt.id, { institution: e.target.value })}
              placeholder="Institution (optional)"
              className="mt-2 w-full text-[13px] border-[1.5px] border-border rounded-md px-2 py-[5px]"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function DebtsScreen({ budget }: { budget: BudgetHook }) {
  const { data, addDebt, updateDebt, deleteDebt, totals } = budget
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newOwner, setNewOwner] = useState<Owner>('JOINT')
  const [newType, setNewType] = useState<DebtType>('CREDIT_CARD')

  const ownerName = (o: Owner) => o === 'NIAMH' ? data.nameNiamh : o === 'RUPERT' ? data.nameRupert : data.nameJoint
  const submit = () => { if (newLabel.trim()) { addDebt(newOwner, newType, newLabel.trim()); setNewLabel(''); setAdding(false) } }
  const totalBalance = data.debts.reduce((a, d) => a + d.currentBalance, 0)

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="font-serif text-xl m-0">Debts</h2>
        <div className={`text-lg font-bold tabular-nums ${totalBalance > 0 ? 'text-negative' : 'text-muted'}`}>{fmt(totalBalance)}</div>
      </div>

      {data.debts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: data.nameNiamh,  total: totals.debtN,     bgClass: 'bg-niamh-light' },
            { label: data.nameRupert, total: totals.debtR,     bgClass: 'bg-rupert-light' },
            { label: data.nameJoint,  total: totals.debtJoint, bgClass: 'bg-joint-light' },
          ].map(({ label, total, bgClass }) => (
            <div key={label} className={`card px-2.5 py-2 text-center ${bgClass}`}>
              <div className="text-[10px] text-muted mb-0.5">{label}</div>
              <div className={`text-[13px] font-bold tabular-nums ${total > 0 ? 'text-negative' : 'text-muted'}`}>{total > 0 ? `${fmt(total)}/mo` : '—'}</div>
            </div>
          ))}
        </div>
      )}

      {data.debts.map(d => (
        <DebtCard key={d.id} debt={d} ownerName={ownerName(d.owner)} onUpdate={updateDebt} onDelete={deleteDebt} />
      ))}

      {data.debts.length === 0 && !adding && (
        <div className="text-center text-muted mt-8 text-sm">No debts added yet.</div>
      )}

      {adding ? (
        <div className="card p-3 mt-2">
          <div className="flex gap-2 flex-wrap mb-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="Debt name…"
              autoFocus
              className="flex-1 min-w-[140px] text-[13px] border-[1.5px] border-border rounded-md px-2.5 py-1.5"
            />
            <select
              value={newOwner}
              onChange={e => setNewOwner(e.target.value as Owner)}
              className="text-[13px] border-[1.5px] border-border rounded-md px-2 py-1.5 bg-card cursor-pointer"
            >
              <option value="NIAMH">{data.nameNiamh}</option>
              <option value="RUPERT">{data.nameRupert}</option>
              <option value="JOINT">{data.nameJoint}</option>
            </select>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as DebtType)}
              className="text-[13px] border-[1.5px] border-border rounded-md px-2 py-1.5 bg-card cursor-pointer"
            >
              {Object.entries(DEBT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5">
            <button onClick={submit} className="bg-ink text-white border-0 rounded-md px-3.5 py-1.5 cursor-pointer text-[13px]">Add</button>
            <button onClick={() => setAdding(false)} className="bg-transparent border-[1.5px] border-border rounded-md px-3.5 py-1.5 cursor-pointer text-[13px]">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-1.5 mt-3 bg-transparent border-[1.5px] border-dashed border-border rounded-lg px-4 py-2 cursor-pointer text-muted text-[13px] w-full"
        >
          <Plus size={14} /> Add debt
        </button>
      )}
    </div>
  )
}
