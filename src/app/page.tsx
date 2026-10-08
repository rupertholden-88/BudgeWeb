'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useBudget } from '@/hooks/useBudget'
import BudgetScreen from '@/components/BudgetScreen'
import WealthScreen from '@/components/WealthScreen'
import Brand from '@/components/Brand'
import SettingsScreen from '@/components/SettingsScreen'
import { TabFilter } from '@/lib/models'
import { needsAttention } from '@/lib/attention'
import { Wallet, BarChart3, Landmark, Settings2, User, CheckCircle } from 'lucide-react'

const ChartsScreen = dynamic(() => import('@/components/ChartsScreen'))

type Screen = 'budget' | 'charts' | 'wealth' | 'settings'

const NAV = [
  { id: 'budget'   as Screen, label: 'Budget',   Icon: Wallet },
  { id: 'charts'   as Screen, label: 'Analysis', Icon: BarChart3 },
  { id: 'wealth'   as Screen, label: 'Wealth',   Icon: Landmark },
  { id: 'settings' as Screen, label: 'Settings', Icon: Settings2 },
]

const SCREEN_ORDER: Screen[] = ['budget', 'charts', 'wealth', 'settings']


function SetupScreen({ onDone, updateOwnerName, signIn, isSignedIn }: {
  onDone: () => void
  updateOwnerName: (owner: 'NIAMH' | 'RUPERT' | 'JOINT', name: string) => void
  signIn: () => void
  isSignedIn: boolean
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
      <p className="text-muted text-lead mb-10 text-center">A shared household budget for two.</p>
      <div className="card w-full max-w-[360px] p-6">
        <div className="text-body font-semibold mb-1">Who's using Budge?</div>
        <p className="text-xs text-muted mb-4 mt-0">
          {isSignedIn
            ? "You're all set up — we just need your names to get started."
            : 'You can change these later in Settings.'}
        </p>
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <label htmlFor="setup-name1" className="text-xs text-muted block mb-1">Person 1</label>
            <input
              id="setup-name1"
              value={name1}
              onChange={e => setName1(e.target.value)}
              placeholder="First name"
              className="w-full text-lead border-[1.5px] border-border rounded-lg px-3 py-2.5 bg-card"
            />
          </div>
          <div>
            <label htmlFor="setup-name2" className="text-xs text-muted block mb-1">Person 2</label>
            <input
              id="setup-name2"
              value={name2}
              onChange={e => setName2(e.target.value)}
              placeholder="First name"
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              className="w-full text-lead border-[1.5px] border-border rounded-lg px-3 py-2.5 bg-card"
            />
          </div>
        </div>
        <button
          onClick={submit}
          className="w-full bg-ink text-on-ink border-0 rounded-xl py-3 cursor-pointer text-lead font-semibold"
        >
          Get started
        </button>
        {!isSignedIn && (
          <>
            <button
              onClick={signIn}
              className="w-full mt-3 bg-transparent text-ink border-[1.5px] border-border rounded-lg py-3 cursor-pointer text-sm font-medium flex items-center justify-center gap-2"
            >
              <User size={15} /> Continue with Google
            </button>
            <p className="text-label text-muted leading-relaxed mt-4 mb-0 text-center">
              Your budget saves to this device either way. Signing in backs it up
              and syncs it across your devices — and lets you pick up an existing one.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const budget = useBudget()
  const [screen, setScreen] = useState<Screen>('budget')
  const [tab, setTab] = useState<TabFilter>('ALL')
  const [focusPropertyId, setFocusPropertyId] = useState<string | null>(null)
  const [setupDone, setSetupDone] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const { data, user, authLoading, cloudLoading, localLoading, signIn, signOutUser, updateOwnerName } = budget
  const attentionCount = needsAttention(data).length
  // A property filter outlives its property if that property is deleted.
  const activeTab: TabFilter = tab.startsWith('property:') && !(data.properties ?? []).some(p => `property:${p.id}` === tab) ? 'ALL' : tab

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const confirmSignOut = () => {
    if (window.confirm(`Signed in as ${user?.email}.\n\nSign out of Budge on this device?`)) signOutUser()
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

  // Wait for both the local and cloud reads, so we don't prompt for names
  // before an existing budget has had a chance to load.
  const needsSetup = !authLoading && !cloudLoading && !localLoading && !setupDone && !data.nameNiamh && !data.nameRupert

  if (authLoading || cloudLoading || localLoading) return (
    <div className="splash h-[100dvh]">
      <div className="splash-monogram">B<span>.</span></div>
      <div className="splash-tag">Budge</div>
    </div>
  )

  if (needsSetup) {
    return (
      <SetupScreen
        onDone={() => setSetupDone(true)}
        updateOwnerName={updateOwnerName}
        signIn={signIn}
        isSignedIn={!!user}
      />
    )
  }

  const initial = (name: string, fallback: string) => (name.trim()[0] || fallback).toUpperCase()

  return (
    <div className="flex flex-col h-[100dvh] bg-bg">

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-24 inset-x-0 z-[100] flex justify-center pointer-events-none px-4">
          <div className="bg-ink text-on-ink px-5 py-2.5 rounded-full text-label font-medium flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] fade-up">
            <CheckCircle size={14} /> {toast}
          </div>
        </div>
      )}

      <header className="px-5 pt-[max(12px,env(safe-area-inset-top))] pb-1 flex items-center justify-between shrink-0 min-h-[56px]">
        <Brand />
        {user ? (
          <button
            onClick={confirmSignOut}
            title={`${user.email} — tap to sign out`}
            aria-label={`Signed in as ${user.email}. Tap to sign out.`}
            className="flex items-center min-h-[44px] min-w-[44px] justify-end cursor-pointer"
          >
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center text-caption font-semibold bg-niamh-light text-niamh-text ring-2 ring-bg">{initial(data.nameNiamh, 'N')}</span>
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center text-caption font-semibold bg-rupert-light text-rupert-text ring-2 ring-bg -ml-[9px]">{initial(data.nameRupert, 'R')}</span>
          </button>
        ) : (
          <button onClick={signIn} className="flex items-center gap-1.5 min-h-[44px] text-label text-muted cursor-pointer">
            <User size={14} aria-hidden="true" />
            <span>On this phone only · <span className="font-semibold text-ink underline underline-offset-2">Back up</span></span>
          </button>
        )}
      </header>

      <main
        className="flex-1 overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div key={screen} className="h-full screen-enter">
          {screen === 'budget'   && <BudgetScreen   budget={budget} tab={activeTab} onTabChange={setTab} onNavigateToDebts={() => setScreen('wealth')} />}
          {screen === 'charts'   && <ChartsScreen   budget={budget} onOpenProperty={id => { setFocusPropertyId(id); setScreen('wealth') }} onOpenWealth={() => setScreen('wealth')} />}
          {screen === 'wealth'   && <WealthScreen   budget={budget} focusPropertyId={focusPropertyId} onFocusHandled={() => setFocusPropertyId(null)} />}
          {screen === 'settings' && <SettingsScreen budget={budget} onToast={showToast} />}
        </div>
      </main>

      <nav aria-label="Main navigation" className="bg-bg border-t border-line flex shrink-0 pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            aria-current={screen === id ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 min-h-[56px] cursor-pointer text-caption ${screen === id ? 'text-ink font-semibold' : 'text-muted font-medium'}`}
          >
            <span className="relative flex">
              <Icon size={22} strokeWidth={screen === id ? 2.1 : 1.75} aria-hidden="true" />
              {id === 'charts' && attentionCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-neg text-on-ink text-caption leading-[18px] font-bold text-center ring-2 ring-bg">
                  {attentionCount}<span className="sr-only"> things need attention</span>
                </span>
              )}
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
