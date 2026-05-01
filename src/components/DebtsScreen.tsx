'use client'

import { useState } from 'react'
import { Owner, DebtType, Debt, fmt } from '@/lib/models'
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const DEBT_LABELS: Record<DebtType, string> = { CREDIT_CARD: 'Credit Card', PERSONAL_LOAN: 'Personal Loan', CAR_FINANCE: 'Car Finance', MORTGAGE: 'Mortgage', STUDENT_LOAN: 'Student Loan', OTHER: 'Other' }

function ownerLightColor(owner: Owner) {
  if (owner === 'NIAMH') return 'var(--niamh-light)'
  if (owner === 'RUPERT') return 'var(--rupert-light)'
  return 'var(--joint-light)'
}

function DebtCard({ debt, ownerName, onUpdate, onDelete }: { debt: Debt; ownerName: string; onUpdate: (id: string, fields: Partial<Debt>) => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(debt.label)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const commitLabel = () => { if (labelDraft.trim()) onUpdate(debt.id, { label: labelDraft.trim() }); setEditingLabel(false) }
  const months = debt.monthlyPayment > 0 && debt.currentBalance > 0 ? Math.ceil(debt.currentBalance / debt.monthlyPayment) : null

  return (
    <div className="card" style={{ marginBottom: 8, background: ownerLightColor(debt.owner), overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingLabel ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
                onBlur={commitLabel}
                style={{ flex: 1, fontSize: 14, fontWeight: 600, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px' }}
                autoFocus />
              <button onClick={commitLabel} aria-label="Save debt name"
                style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', display: 'flex' }}>
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{debt.label}</span>
              <button onClick={() => { setLabelDraft(debt.label); setEditingLabel(true) }}
                aria-label={`Rename ${debt.label}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 6, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
                <Pencil size={11} />
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {DEBT_LABELS[debt.type]} · {ownerName}{months ? ` · ~${months} months left` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>{fmt(debt.currentBalance)}</div>
          {debt.monthlyPayment > 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmt(debt.monthlyPayment)}/mo</div>}
        </div>
        <button onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse debt details' : 'Expand debt details'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 6, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
            {[
              { label: 'Balance £', value: debt.currentBalance, key: 'currentBalance' },
              { label: 'Monthly £', value: debt.monthlyPayment, key: 'monthlyPayment' },
              { label: 'Rate %',    value: debt.interestRate,   key: 'interestRate' },
            ].map(({ label, value, key }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                <input type="number" value={value || ''} onChange={e => onUpdate(debt.id, { [key]: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  style={{ width: 100, fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--card)' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={debt.isZeroPercent} onChange={e => onUpdate(debt.id, { isZeroPercent: e.target.checked })} />
              0% deal
            </label>
            {debt.isZeroPercent && (
              <input type="month" value={debt.zeroPercentExpiryDate ?? ''} onChange={e => onUpdate(debt.id, { zeroPercentExpiryDate: e.target.value })}
                style={{ fontSize: 12, border: '1.5px solid var(--border)', borderRadius: 6, padding: '3px 6px' }} />
            )}
          </div>
          <input value={debt.institution ?? ''} onChange={e => onUpdate(debt.id, { institution: e.target.value })}
            placeholder="Institution (optional)"
            style={{ marginTop: 8, width: '100%', fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '5px 8px' }} />
          {confirmingDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Delete this debt?</span>
              <button onClick={() => onDelete(debt.id)}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--expense-text)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Yes, delete</button>
              <button onClick={() => setConfirmingDelete(false)}
                style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)}
              style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1.5px solid var(--expense-text)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: 'var(--expense-text)', fontSize: 12, opacity: 0.7 }}>
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}
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
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Debts</h2>
        <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: totalBalance > 0 ? 'var(--negative)' : 'var(--muted)' }}>{fmt(totalBalance)}</div>
      </div>

      {data.debts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: data.nameNiamh,  total: totals.debtN,     lightColor: 'var(--niamh-light)' },
            { label: data.nameRupert, total: totals.debtR,     lightColor: 'var(--rupert-light)' },
            { label: data.nameJoint,  total: totals.debtJoint, lightColor: 'var(--joint-light)' },
          ].map(({ label, total, lightColor }) => (
            <div key={label} className="card" style={{ padding: '8px 10px', background: lightColor, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: total > 0 ? 'var(--negative)' : 'var(--muted)' }}>{total > 0 ? `${fmt(total)}/mo` : '—'}</div>
            </div>
          ))}
        </div>
      )}

      {data.debts.map(d => <DebtCard key={d.id} debt={d} ownerName={ownerName(d.owner)} onUpdate={updateDebt} onDelete={deleteDebt} />)}

      {data.debts.length === 0 && !adding && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 32, fontSize: 14 }}>No debts added yet.</div>
      )}

      {adding ? (
        <div className="card" style={{ padding: 12, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="Debt name…" autoFocus
              style={{ flex: 1, minWidth: 140, fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 10px' }} />
            <select value={newOwner} onChange={e => setNewOwner(e.target.value as Owner)} style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 8px', background: 'var(--card)', cursor: 'pointer' }}>
              <option value="NIAMH">{data.nameNiamh}</option>
              <option value="RUPERT">{data.nameRupert}</option>
              <option value="JOINT">{data.nameJoint}</option>
            </select>
            <select value={newType} onChange={e => setNewType(e.target.value as DebtType)} style={{ fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 8px', background: 'var(--card)', cursor: 'pointer' }}>
              {Object.entries(DEBT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={submit} style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>Add</button>
            <button onClick={() => setAdding(false)} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'none', border: '1.5px dashed var(--border)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> Add debt
        </button>
      )}
    </div>
  )
}
