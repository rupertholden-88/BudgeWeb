'use client'

import { useState } from 'react'
import { useBudget } from '@/hooks/useBudget'
import BudgetScreen from '@/components/BudgetScreen'
import ChartsScreen from '@/components/ChartsScreen'
import SavingsScreen from '@/components/SavingsScreen'
import DebtsScreen from '@/components/DebtsScreen'
import SettingsScreen from '@/components/SettingsScreen'
import { TabFilter } from '@/lib/models'
import { LayoutDashboard, BarChart3, PiggyBank, CreditCard, User, RefreshCw, Settings } from 'lucide-react'

type Screen = 'budget' | 'charts' | 'savings' | 'debts' | 'settings'

const NAV = [
  { id: 'budget'   as Screen, label: 'Budget',   Icon: LayoutDashboard },
  { id: 'charts'   as Screen, label: 'Analysis', Icon: BarChart3 },
  { id: 'savings'  as Screen, label: 'Assets',   Icon: PiggyBank },
  { id: 'debts'    as Screen, label: 'Debts',    Icon: CreditCard },
  { id: 'settings' as Screen, label: 'Settings', Icon: Settings },
]

export default function HomePage() {
  const budget = useBudget()
  const [screen, setScreen] = useState<Screen>('budget')
  const [tab, setTab] = useState<TabFilter>('ALL')
  const { data, user, savedAt, isRefreshing, signIn, signOutUser, refreshFromCloud } = budget

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--surface)' }}>
      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 24, margin: 0, flex: 1 }}>Budge</h1>
        {savedAt && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Saved {new Date(savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={refreshFromCloud} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
              <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <div onClick={signOutUser} title={`${user.email} — click to sign out`} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--rupert)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {user.email?.[0].toUpperCase()}
            </div>
          </div>
        ) : (
          <button onClick={signIn} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            <User size={14} /> Sign in
          </button>
        )}
      </header>

      {screen === 'budget' && (
        <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', gap: 8, flexShrink: 0, overflowX: 'auto' }}>
          {(['ALL', 'NIAMH', 'RUPERT', 'JOINT'] as TabFilter[]).map(t => {
            const label = t === 'ALL' ? 'All' : t === 'NIAMH' ? data.nameNiamh : t === 'RUPERT' ? data.nameRupert : data.nameJoint
            return (
              <button key={t} onClick={() => setTab(t)} className={tab === t ? `chip chip-${t.toLowerCase()}` : 'chip chip-inactive'}>
                {label}
              </button>
            )
          })}
        </div>
      )}

      <main style={{ flex: 1, overflow: 'hidden' }}>
        {screen === 'budget'   && <BudgetScreen   budget={budget} tab={tab} onNavigateToDebts={() => setScreen('debts')} />}
        {screen === 'charts'   && <ChartsScreen   budget={budget} />}
        {screen === 'savings'  && <SavingsScreen  budget={budget} />}
        {screen === 'debts'    && <DebtsScreen    budget={budget} />}
        {screen === 'settings' && <SettingsScreen budget={budget} />}
      </main>

      <nav style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', display: 'flex', flexShrink: 0 }}>
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setScreen(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: screen === id ? 'var(--ink)' : 'var(--muted)', fontSize: 10, fontWeight: screen === id ? 600 : 400 }}>
            <Icon size={20} strokeWidth={screen === id ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
