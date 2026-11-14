'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Landmark, PiggyBank, Home, CreditCard, Wallet } from 'lucide-react'
import { fmt, monthKey, netWorth } from '@/lib/models'
import SavingsScreen from './SavingsScreen'
import DebtsScreen from './DebtsScreen'
import SubTabs from './SubTabs'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>
type WealthTab = 'overview' | 'accounts' | 'pensions' | 'property' | 'borrowing'
const TABS: { value: WealthTab; label: string }[] = [
  { value: 'overview', label: 'Overview' }, { value: 'accounts', label: 'Accounts' },
  { value: 'pensions', label: 'Pensions' }, { value: 'property', label: 'Property' }, { value: 'borrowing', label: 'Borrowing' },
]
const STORAGE_KEY = 'budge-wealth-navigation'
const validTab = (value: unknown): value is WealthTab => TABS.some(t => t.value === value)

export default function WealthScreen({ budget, focusBorrowing, onBorrowingFocusHandled, focusPropertyId, onFocusHandled, focusMortgageId, onMortgageFocusHandled, onOpenMortgage, onOpenInsurance }: {
  budget: BudgetHook; focusBorrowing?: boolean; onBorrowingFocusHandled?: () => void; focusPropertyId?: string | null; onFocusHandled?: () => void
  focusMortgageId?: string | null; onMortgageFocusHandled?: () => void
  onOpenMortgage: (id: string) => void; onOpenInsurance?: (policyId?: string) => void
}) {
  const [tab, setTab] = useState<WealthTab>('overview')
  const [ready, setReady] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const positions = useRef<Partial<Record<WealthTab, number>>>({})
  const active = useRef(tab)
  const restoring = useRef(false)
  const focusedMortgage = useRef<string | null>(null)
  const persist = (section: WealthTab) => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tab: section, positions: positions.current })) } catch { }
  }
  const selectTab = (section: WealthTab) => {
    if (section === active.current) return
    if (scroll.current) positions.current[active.current] = scroll.current.scrollTop
    restoring.current = true
    active.current = section
    setTab(section)
    persist(section)
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
      if (saved && validTab(saved.tab)) {
        positions.current = Object.fromEntries(Object.entries(saved.positions ?? {}).filter(([key, value]) => validTab(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0))
        active.current = saved.tab
        setTab(saved.tab)
      }
    } catch { }
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    restoring.current = true
    let releaseFrame = 0
    const frame = requestAnimationFrame(() => {
      if (scroll.current) scroll.current.scrollTop = positions.current[tab] ?? 0
      releaseFrame = requestAnimationFrame(() => { restoring.current = false })
    })
    persist(tab)
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(releaseFrame) }
  }, [tab, ready])
  useEffect(() => {
    if (ready && focusPropertyId) selectTab('property')
  }, [ready, focusPropertyId]) // eslint-disable-line
  useEffect(() => {
    if (!focusMortgageId) { focusedMortgage.current = null; return }
    if (!ready || focusedMortgage.current === focusMortgageId) return
    focusedMortgage.current = focusMortgageId
    selectTab('borrowing')
    onOpenMortgage(focusMortgageId)
    onMortgageFocusHandled?.()
  }, [ready, focusMortgageId, onOpenMortgage, onMortgageFocusHandled]) // eslint-disable-line

  useEffect(() => {
    if (ready && focusBorrowing) { selectTab('borrowing'); onBorrowingFocusHandled?.() }
  }, [ready, focusBorrowing]) // eslint-disable-line

  const { data } = budget
  const worth = netWorth(data, monthKey())
  const mortgages = data.debts.filter(d => d.type === 'MORTGAGE')
  const otherDebts = data.debts.filter(d => d.type !== 'MORTGAGE')
  const hasRecords = data.savingsHistory.some(s => (s.assets?.length ?? 0) > 0) || data.debts.length > 0 || (data.properties?.length ?? 0) > 0
  const categories = [
    { section: 'accounts' as const, label: 'Cash, savings & investments', value: worth.liquid, icon: Wallet },
    { section: 'pensions' as const, label: 'Pensions', value: worth.pensions, icon: PiggyBank },
    { section: 'property' as const, label: 'Property value', value: worth.property, icon: Home },
    { section: 'borrowing' as const, label: 'Total borrowing', value: worth.debts, icon: CreditCard },
  ]
  return <div className="h-full flex flex-col">
    <div className="px-5 pt-2 shrink-0">
      <h1 className="text-[30px] leading-[36px] font-semibold tracking-[-0.02em] m-0">Wealth</h1>
      <SubTabs id="wealth" label="Wealth sections" tabs={TABS} value={tab} onChange={selectTab} />
    </div>
    <div ref={scroll} className="flex-1 min-h-0 overflow-y-auto" onScroll={e => {
      if (!ready || restoring.current) return
      positions.current[active.current] = e.currentTarget.scrollTop
      persist(active.current)
    }}>
      {TABS.filter(section => section.value !== tab).map(section => <div key={section.value} hidden role="tabpanel" id={`wealth-panel-${section.value}`} aria-labelledby={`wealth-tab-${section.value}`} />)}
      <div role="tabpanel" id={`wealth-panel-${tab}`} aria-labelledby={`wealth-tab-${tab}`} tabIndex={0} className="outline-none min-h-full">
        {ready && tab === 'overview' && <div className="px-5 pt-5 pb-[calc(32px+env(safe-area-inset-bottom))]">
          <section className="card p-5 mb-5">
            <div className="flex items-center gap-2 text-label text-muted"><Landmark size={17} /> Your net worth</div>
            <div className="text-[38px] leading-tight font-semibold tracking-tight num mt-2">{hasRecords ? fmt(worth.total) : '—'}</div>
            <p className="text-label text-muted mt-2 mb-0">{hasRecords ? 'Accounts, pensions and property, less everything owed.' : 'Add your balances to build a clear picture of what you own and owe.'}</p>
          </section>
          <div className="card px-4 mb-5">{categories.map(category => <button key={category.section} onClick={() => selectTab(category.section)} className="w-full flex items-center gap-3 text-left min-h-[70px] py-3 border-b border-line last:border-0 cursor-pointer">
            <category.icon size={20} className="text-muted shrink-0" />
            <span className="flex-1 min-w-0 text-[15px] font-medium">{category.label}</span>
            <span className="num font-semibold text-[16px] shrink-0">{hasRecords ? fmt(category.value) : 'Add'}</span><ChevronRight size={17} className="text-muted shrink-0" />
          </button>)}</div>
          <section className="mb-5" aria-label="Mortgage overview">
            <div className="flex justify-between items-center mb-2"><h2 className="text-[20px] font-semibold m-0">Mortgages</h2><button onClick={() => selectTab('borrowing')} className="min-h-[44px] text-label text-ink-2 cursor-pointer">View borrowing <ChevronRight size={15} className="inline" /></button></div>
            {mortgages.length === 0 ? <button onClick={() => selectTab('borrowing')} className="card p-4 w-full flex items-center gap-3 text-left cursor-pointer"><Home size={20} className="text-muted" /><span className="flex-1 text-[15px]">Add a mortgage to track its payment and deal end.</span><ChevronRight size={18} className="text-muted" /></button> : mortgages.map(debt => <button key={debt.id} onClick={() => onOpenMortgage(debt.id)} className="card p-4 w-full mb-2 flex items-center gap-3 text-left cursor-pointer">
              <Home size={20} className="text-muted shrink-0" /><span className="flex-1 min-w-0"><strong className="block text-[15px] font-semibold">{debt.label}</strong><span className="block text-label text-muted mt-0.5">{debt.mortgage?.dealEnds ? `Deal ends ${new Date(debt.mortgage.dealEnds + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Add deal details to plan ahead'}</span></span><span className="text-right shrink-0"><strong className="block text-[17px] font-semibold num">{fmt(debt.monthlyPayment)}</strong><span className="text-caption text-muted">a month</span></span><ChevronRight size={17} className="text-muted shrink-0" />
            </button>)}
          </section>
          {otherDebts.length > 0 && <button onClick={() => selectTab('borrowing')} className="w-full card p-4 flex items-center gap-3 text-left cursor-pointer"><CreditCard size={20} className="text-muted" /><span className="flex-1"><strong className="block text-[15px] font-medium">Other borrowing</strong><span className="text-label text-muted">Loans, cards and other balances</span></span><strong className="num">{fmt(otherDebts.reduce((sum, debt) => sum + debt.currentBalance, 0))}</strong><ChevronRight size={17} className="text-muted" /></button>}
        </div>}
        {ready && (tab === 'accounts' || tab === 'pensions' || tab === 'property') && <SavingsScreen key={tab} section={tab} budget={budget} focusPropertyId={focusPropertyId} onFocusHandled={onFocusHandled} onOpenInsurance={onOpenInsurance} onOpenMortgage={onOpenMortgage} />}
        {ready && tab === 'borrowing' && <DebtsScreen budget={budget} onOpenMortgage={onOpenMortgage} />}
      </div>
    </div>
  </div>
}
