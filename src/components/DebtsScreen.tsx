import { useState, useRef } from 'react'
import { Owner, DebtType, Debt, fmt } from '@/lib/models'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const DEBT_LABELS: Record<DebtType, string> = { CREDIT_CARD: 'Credit Card', PERSONAL_LOAN: 'Personal Loan', CAR_FINANCE: 'Car Finance', MORTGAGE: 'Mortgage', STUDENT_LOAN: 'Student Loan', OTHER: 'Other' }

function ownerLightColor(owner: Owner) {
  if (owner === 'NIAMH') return 'var(--niamh-light)'
  if (owner === 'RUPERT') return 'var(--rupert-light)'
  return 'var(--joint-light)'
}

function DeleteModal({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: '16px 16px 0 0', padding: '20px 20px 32px', width: '100%', maxWidth: 480 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Delete "{label}"?</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>This can't be undone.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onConfirm} style={{ background: 'var(--expense-text)', color: 'white', border: 'none', borderRadius: 10, padding: 14, cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>Delete</button>
          <button onClick={onCancel} style={{ background: 'var(--surface)', color: 'var(--ink)', border: 'none', borderRadius: 10, padding: 14, cursor: 'pointer', fontSize: 15 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function DebtCard({ debt, ownerName, onUpdate, onDelete }: { debt: Debt; ownerName: string; onUpdate: (id: string, fields: Partial<Debt>) => void; onDelete: (id: string) => void }) {
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

  return (<div style={{display: 'contents'}}>
      {pendingDelete && (
        <DeleteModal
          label={debt.label}
          onConfirm={() => { onDelete(debt.id); setPendingDelete(false) }}
          onCancel={() => setPendingDelete(false)}
        />
      )}
      <div className="card" style={{ marginBottom: 8, background: ownerLightColor(debt.owner), overflow: 'hidden' }}
        onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress} onTouchCancel={cancelPress}
        onMouseDown={startPress} onMouseUp={cancelPress} onMouseLeave={cancelPress}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingLabel ? (
              <input value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
                onBlur={commitLabel}
                onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                style={{ width: '100%', fontSize: 14, fontWeight: 600, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px' }}
                autoFocus />
            ) : (
              <span onClick={() => { setLabelDraft(debt.label); setEditingLabel(true) }}
                onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setLabelDraft(debt.label); setEditingLabel(true) } }}
                style={{ fontWeight: 600, fontSize: 14, cursor: 'text', padding: '2px 4px', borderRadius: 4 }}>
                {debt.label}
              </span>
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
