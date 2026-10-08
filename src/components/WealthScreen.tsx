'use client'

import { useState } from 'react'
import SavingsScreen from './SavingsScreen'
import DebtsScreen from './DebtsScreen'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

/** Everything the household owns and owes: savings, property, pensions and debts. */
export default function WealthScreen({ budget, focusPropertyId, onFocusHandled }: {
  budget: BudgetHook; focusPropertyId?: string | null; onFocusHandled?: () => void
}) {
  const [view, setView] = useState<'own' | 'owe'>('own')
  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-2 pb-3 shrink-0">
        <h1 className="text-[30px] leading-[36px] font-semibold tracking-[-0.025em] m-0">Wealth</h1>
        <div className="seg grid-cols-2 mt-3" role="group" aria-label="Show">
          <button aria-pressed={view === 'own'} onClick={() => setView('own')}><span className="lbl">What you own</span></button>
          <button aria-pressed={view === 'owe'} onClick={() => setView('owe')}><span className="lbl">What you owe</span></button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {view === 'own'
          ? <SavingsScreen budget={budget} focusPropertyId={focusPropertyId} onFocusHandled={onFocusHandled} />
          : <DebtsScreen budget={budget} />}
      </div>
    </div>
  )
}
