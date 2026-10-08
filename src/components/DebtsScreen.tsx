import { useState } from 'react'
import { Owner, DebtType, Debt, Property, fmt, debtPayoff } from '@/lib/models'
import { Plus, Home } from 'lucide-react'
import { ConfirmDelete, ExpandButton, PanelSection, DeleteAction, Field, NumberInput, inputClass, useLongPress, ownerBorderClass } from './ui'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

const DEBT_LABELS: Record<DebtType, string> = {
  CREDIT_CARD: 'Credit Card', PERSONAL_LOAN: 'Personal Loan', CAR_FINANCE: 'Car Finance',
  MORTGAGE: 'Mortgage', STUDENT_LOAN: 'Student Loan', OTHER: 'Other'
}

function DebtCard({ debt, ownerName, properties, onUpdate, onDelete }: {
  debt: Debt; ownerName: string; properties: Property[]
  onUpdate: (id: string, fields: Partial<Debt>) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(debt.label)
  const [pendingDelete, setPendingDelete] = useState(false)
  const longPress = useLongPress(() => setPendingDelete(true), editingLabel)
  const commitLabel = () => { if (labelDraft.trim()) onUpdate(debt.id, { label: labelDraft.trim() }); setEditingLabel(false) }
  // Amortised, not balance ÷ payment — interest makes the real figure longer,
  // and a payment below the monthly interest never clears it at all.
  // Simulated month by month, so a 0% deal switches to its follow-on rate when it ends.
  const months = debt.currentBalance > 0 && debt.monthlyPayment > 0 ? debtPayoff(debt).months : undefined
  const property = properties.find(p => p.id === debt.propertyId)
  const securable = debt.type === 'MORTGAGE' || debt.type === 'OTHER' || debt.type === 'PERSONAL_LOAN'

  return (
    <>
      {pendingDelete && (
        <ConfirmDelete label={debt.label} onConfirm={() => { onDelete(debt.id); setPendingDelete(false) }} onCancel={() => setPendingDelete(false)} />
      )}
      <div className={`card mb-2 overflow-hidden ${ownerBorderClass(debt.owner)}`} {...longPress}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="flex-1 min-w-0">
            {editingLabel ? (
              <input
                value={labelDraft}
                onChange={e => setLabelDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
                onBlur={commitLabel}
                onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                className="w-full min-w-0 text-sm font-semibold border-[1.5px] border-accent rounded-lg px-1.5 py-1 bg-accent-light outline-none"
                autoFocus
              />
            ) : (
              <span
                onClick={() => { setLabelDraft(debt.label); setEditingLabel(true) }}
                onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setLabelDraft(debt.label); setEditingLabel(true) } }}
                className="font-semibold text-sm cursor-text py-0.5 rounded break-words"
              >
                {debt.label}
              </span>
            )}
            <div className="text-label text-muted mt-0.5">
              {DEBT_LABELS[debt.type]} · {ownerName}
              {months != null && ` · ~${months} months left`}
              {months === null && <span className="text-negative font-semibold"> · payment doesn&apos;t cover interest</span>}
            </div>
            {(property || debt.sharedContribution) && (
              <span className="flex gap-1 flex-wrap mt-1">
                {debt.sharedContribution && <span className="pill pill-joint">Household cost</span>}
                {property && <span className="pill pill-accent"><Home size={9} /> {property.label}</span>}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="font-serif font-bold text-lg tabular-nums text-negative leading-tight">{fmt(debt.currentBalance)}</div>
            {debt.monthlyPayment > 0 && <div className="text-label text-muted">{fmt(debt.monthlyPayment)}/mo</div>}
          </div>
          <ExpandButton expanded={expanded} onClick={() => setExpanded(e => !e)} label={expanded ? 'Collapse debt details' : 'Expand debt details'} />
        </div>

        {expanded && (
          <div className="px-3 pb-2 border-t border-border">
            <PanelSection title="Figures">
              <div className="flex flex-wrap gap-2">
                {([
                  { label: 'Balance £', value: debt.currentBalance, key: 'currentBalance' },
                  { label: 'Monthly £', value: debt.monthlyPayment, key: 'monthlyPayment' },
                  { label: 'Rate %',    value: debt.interestRate,   key: 'interestRate' },
                ] as const).map(({ label, value, key }) => (
                  <Field key={key} label={label}>
                    <NumberInput
                      value={value || undefined}
                      onChange={v => onUpdate(debt.id, { [key]: v ?? 0 })}
                      ariaLabel={label}
                      className={`${inputClass} w-[100px]`}
                    />
                  </Field>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-body cursor-pointer min-h-[36px]">
                  <input type="checkbox" className="w-4 h-4" checked={debt.isZeroPercent} onChange={e => onUpdate(debt.id, { isZeroPercent: e.target.checked })} />
                  0% deal
                </label>
                {debt.isZeroPercent && (
                  <input
                    type="month"
                    aria-label="0% deal ends"
                    value={debt.zeroPercentExpiryDate ?? ''}
                    onChange={e => onUpdate(debt.id, { zeroPercentExpiryDate: e.target.value })}
                    className={inputClass}
                  />
                )}
              </div>
              <input
                value={debt.institution ?? ''}
                onChange={e => onUpdate(debt.id, { institution: e.target.value })}
                placeholder="Lender (optional)"
                className={`${inputClass} mt-2 w-full`}
              />
            </PanelSection>

            {securable && properties.length > 0 && (
              <PanelSection title="Secured on">
                <select
                  value={debt.propertyId ?? ''}
                  onChange={e => onUpdate(debt.id, { propertyId: e.target.value || undefined })}
                  className={`${inputClass} w-full`}
                >
                  <option value="">Not secured on a property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <p className="text-caption text-muted mt-1 mb-0">Linking it works out that property&apos;s equity and loan-to-value on Assets.</p>
              </PanelSection>
            )}

            {debt.owner !== 'JOINT' && (
              <PanelSection title="Who it's for">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!debt.sharedContribution}
                    onChange={e => onUpdate(debt.id, { sharedContribution: e.target.checked || undefined })}
                    className="mt-0.5 shrink-0 w-4 h-4"
                  />
                  <span className="text-xs text-ink leading-snug">
                    {ownerName} pays this, but it&apos;s for the household
                    <span className="block text-caption text-muted mt-0.5">Counts the repayment towards their share of household costs on Fair Share.</span>
                  </span>
                </label>
              </PanelSection>
            )}

            <div className="pt-1 border-t border-border">
              <DeleteAction label="Delete debt" onClick={() => setPendingDelete(true)} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function DebtsScreen({ budget }: { budget: BudgetHook }) {
  const { data, addDebt, updateDebt, deleteDebt, totals } = budget
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newOwner, setNewOwner] = useState<Owner>('JOINT')
  const [newType, setNewType] = useState<DebtType>('CREDIT_CARD')

  const ownerName = (o: Owner) => o === 'NIAMH' ? (data.nameNiamh || 'Person 1') : o === 'RUPERT' ? (data.nameRupert || 'Person 2') : (data.nameJoint || 'Joint')
  const submit = () => { if (newLabel.trim()) { addDebt(newOwner, newType, newLabel.trim()); setNewLabel(''); setAdding(false) } }
  const totalBalance = data.debts.reduce((a, d) => a + d.currentBalance, 0)
  const properties = data.properties ?? []

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="font-serif text-xl m-0">Debts</h2>
        <div className={`font-serif text-xl font-bold tabular-nums ${totalBalance > 0 ? 'text-negative' : 'text-muted'}`}>{fmt(totalBalance)}</div>
      </div>

      {data.debts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {([
            { owner: 'NIAMH' as Owner, total: totals.debtN },
            { owner: 'RUPERT' as Owner, total: totals.debtR },
            { owner: 'JOINT' as Owner, total: totals.debtJoint },
          ]).map(({ owner, total }) => (
            <div key={owner} className={`card px-2.5 py-2 text-center ${ownerBorderClass(owner)}`}>
              <div className="text-caption text-muted mb-0.5 truncate">{ownerName(owner)}</div>
              <div className={`text-body font-bold tabular-nums ${total > 0 ? 'text-negative' : 'text-muted'}`}>{total > 0 ? `${fmt(total)}/mo` : '—'}</div>
            </div>
          ))}
        </div>
      )}

      {data.debts.map(d => (
        <DebtCard key={d.id} debt={d} ownerName={ownerName(d.owner)} properties={properties} onUpdate={updateDebt} onDelete={deleteDebt} />
      ))}

      {data.debts.length === 0 && !adding && (
        <div className="text-center text-muted mt-8 text-sm">No debts added yet.</div>
      )}

      {adding ? (
        <div className="card p-3 mt-2">
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Debt name…"
            autoFocus
            className={`${inputClass} w-full mb-2`}
          />
          <div className="flex gap-2 flex-wrap mb-2">
            <select value={newOwner} onChange={e => setNewOwner(e.target.value as Owner)} aria-label="Owner" className={`${inputClass} flex-1 cursor-pointer`}>
              <option value="NIAMH">{ownerName('NIAMH')}</option>
              <option value="RUPERT">{ownerName('RUPERT')}</option>
              <option value="JOINT">{ownerName('JOINT')}</option>
            </select>
            <select value={newType} onChange={e => setNewType(e.target.value as DebtType)} aria-label="Type" className={`${inputClass} flex-1 cursor-pointer`}>
              {Object.entries(DEBT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 bg-ink text-on-ink border-0 rounded-xl py-2.5 cursor-pointer text-sm font-semibold">Add debt</button>
            <button onClick={() => setAdding(false)} className="px-4 bg-transparent border-[1.5px] border-border rounded-xl py-2.5 cursor-pointer text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-2 mt-3 w-full py-3.5 border-2 border-dashed border-border rounded-xl text-muted text-sm cursor-pointer bg-transparent"
        >
          <Plus size={14} /> Add debt
        </button>
      )}

      {data.debts.length > 0 && (
        <p className="text-caption text-muted text-center mt-5 mb-1 select-none">Tap a name to edit · open a debt for details and delete</p>
      )}
    </div>
  )
}
