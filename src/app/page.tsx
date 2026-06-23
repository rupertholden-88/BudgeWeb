'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useBudget } from '@/hooks/useBudget'
import BudgetScreen from '@/components/BudgetScreen'
import SavingsScreen from '@/components/SavingsScreen'
import DebtsScreen from '@/components/DebtsScreen'
import SettingsScreen from '@/components/SettingsScreen'
import { TabFilter } from '@/lib/models'
import { LayoutDashboard, BarChart3, PiggyBank, CreditCard, User, RefreshCw, Settings, CheckCircle } from 'lucide-react'

const ChartsScreen = dynamic(() => import('@/components/ChartsScreen'))

type Screen = 'budget' | 'charts' | 'savings' | 'debts' | 'settings'

const NAV = [
  { id: 'budget'   as Screen, label: 'Budget',   Icon: LayoutDashboard },
  { id: 'charts'   as Screen, label: 'Analysis', Icon: BarChart3 },
  { id: 'savings'  as Screen, label: 'Assets',   Icon: PiggyBank },
  { id: 'debts'    as Screen, label: 'Debts',    Icon: CreditCard },
  { id: 'settings' as Screen, label: 'Settings', Icon: Settings },
]

const SCREEN_ORDER: Screen[] = ['budget', 'charts', 'savings', 'debts', 'settings']

function SetupScreen({ onDone, updateOwnerName, signIn }: {
  onDone: () => void
  updateOwnerName: (owner: 'NIAMH' | 'RUPERT' | 'JOINT', name: string) => void
  signIn: () => void
}) {
  const [name1, setName1] = useState('')
  const [name2, setName2] = useState('')
  const submit = () => {
    updateOwnerName('NIAMH', name1.trim() || 'Person 1')
    updateOwnerName('RUPERT', name2.trim() || 'Person 2')
    onDone()
  }
  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center p-8 bg-surface">
      <h1 className="font-serif text-4xl m-0 mb-2 text-ink">Budge</h1>
      <p className="text-muted text-[15px] mb-10 text-center">A shared household budget for two.</p>
      <div className="card w-full max-w-[360px] p-6">
        <div className="text-[13px] font-semibold mb-4">Who's using Budge?</div>
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <label htmlFor="setup-name1" className="text-xs text-muted block mb-1">Person 1</label>
            <input
              id="setup-name1"
              value={name1}
              onChange={e => setName1(e.target.value)}
              placeholder="e.g. Niamh"
              className="w-full text-[15px] border-[1.5px] border-border rounded-lg px-3 py-2.5 bg-card"
            />
          </div>
          <div>
            <label htmlFor="setup-name2" className="text-xs text-muted block mb-1">Person 2</label>
            <input
              id="setup-name2"
              value={name2}
              onChange={e => setName2(e.target.value)}
              placeholder="e.g. Rupert"
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              className="w-full text-[15px] border-[1.5px] border-border rounded-lg px-3 py-2.5 bg-card"
            />
          </div>
        </div>
        <button
          onClick={submit}
          className="w-full bg-ink text-white border-0 rounded-lg py-3 cursor-pointer text-[15px] font-semibold mb-3"
        >
          Get started
        </button>
        <button
          onClick={() => { signIn(); onDone() }}
          className="w-full bg-transparent text-muted border-[1.5px] border-border rounded-lg py-3 cursor-pointer text-sm flex items-center justify-center gap-2"
        >
          <User size={15} /> Sign in to restore existing budget
        </button>
      </div>
    </div>
  )
}

export default function HomePage() {
  const budget = useBudget()
  const [screen, setScreen] = useState<Screen>('budget')
  const [tab, setTab] = useState<TabFilter>('ALL')
  const [setupDone, setSetupDone] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const { data, user, savedAt, isRefreshing, signIn, signOutUser, refreshFromCloud, updateOwnerName } = budget

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleRefresh = async () => {
    await refreshFromCloud()
    showToast('Synced!')
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeRef.current) return
    const dx = e.changedTouches[0].clientX - swipeRef.current.x
    const dy = e.changedTouches[0].clientY - swipeRef.current.y
    const dt = Date.now() - swipeRef.current.t
    swipeRef.current = null
    if (dt > 500 || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.75) return
    const idx = SCREEN_ORDER.indexOf(screen)
    if (dx < 0 && idx < SCREEN_ORDER.length - 1) setScreen(SCREEN_ORDER[idx + 1])
    if (dx > 0 && idx > 0) setScreen(SCREEN_ORDER[idx - 1])
  }

  const needsSetup = !setupDone && !user && !data.nameNiamh && !data.nameRupert

  if (needsSetup) {
    return (
      <SetupScreen
        onDone={() => setSetupDone(true)}
        updateOwnerName={updateOwnerName}
        signIn={() => { signIn(); setSetupDone(true) }}
      />
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-surface">

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-ink text-white px-5 py-2.5 rounded-full text-[13px] font-medium z-[100] flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] fade-up"
        >
          <CheckCircle size={14} /> {toast}
        </div>
      )}

      <header className="bg-card border-b border-border px-4 h-14 flex items-center gap-3 shrink-0 z-10">
        <h1 className="font-serif text-2xl m-0 flex-1">Budge</h1>
        {savedAt && (
          <span className="text-[11px] text-muted">
            Saved {new Date(savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {user ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              aria-label="Sync from cloud"
              className="bg-transparent border-0 cursor-pointer text-muted p-2 flex min-w-9 min-h-9 items-center justify-center"
            >
              <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              onClick={signOutUser}
              title={`${user.email} — tap to sign out`}
              aria-label={`Signed in as ${user.email}. Tap to sign out.`}
              className="w-8 h-8 rounded-full bg-rupert text-white flex items-center justify-center text-[13px] font-semibold cursor-pointer border-0 p-0 overflow-hidden"
            >
              {user.photoURL
                ? <img src={user.photoURL} alt={user.email ?? ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                : user.email?.[0].toUpperCase()
              }
            </button>
          </div>
        ) : (
          <button
            onClick={signIn}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-[1.5px] border-border bg-card cursor-pointer text-[13px] font-medium"
          >
            <User size={14} /> Sign in
          </button>
        )}
      </header>

      {screen === 'budget' && (
        <div className="bg-card border-b border-border px-4 py-2 flex gap-2 shrink-0 overflow-x-auto">
          {(['ALL', 'NIAMH', 'RUPERT', 'JOINT'] as TabFilter[]).map(t => {
            const label = t === 'ALL' ? 'All' : t === 'NIAMH' ? (data.nameNiamh || 'Person 1') : t === 'RUPERT' ? (data.nameRupert || 'Person 2') : (data.nameJoint || 'Joint')
            return (
              <button key={t} onClick={() => setTab(t)} className={tab === t ? `chip chip-${t.toLowerCase()}` : 'chip chip-inactive'}>
                {label}
              </button>
            )
          })}
        </div>
      )}

      <main
        className="flex-1 overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {screen === 'budget'   && <BudgetScreen   budget={budget} tab={tab} onNavigateToDebts={() => setScreen('debts')} />}
        {screen === 'charts'   && <ChartsScreen   budget={budget} />}
        {screen === 'savings'  && <SavingsScreen  budget={budget} />}
        {screen === 'debts'    && <DebtsScreen    budget={budget} />}
        {screen === 'settings' && <SettingsScreen budget={budget} />}
      </main>

      <nav aria-label="Main navigation" className="bg-card border-t border-border flex shrink-0">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            aria-current={screen === id ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-[3px] py-2.5 bg-transparent border-0 cursor-pointer text-[10px] ${screen === id ? 'text-ink font-semibold' : 'text-muted font-normal'}`}
          >
            <Icon size={20} strokeWidth={screen === id ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
