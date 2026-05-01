'use client'

import { useState } from 'react'
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--surface)' }}>
      <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 36, margin: '0 0 8px', color: 'var(--ink)' }}>Budge</h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 40, textAlign: 'center' }}>A shared household budget for two.</p>
      <div className="card" style={{ width: '100%', maxWidth: 360, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Who's using Budge?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div>
            <label htmlFor="setup-name1" style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Person 1</label>
            <input id="setup-name1" value={name1} onChange={e => setName1(e.target.value)} placeholder="e.g. Niamh"
              style={{ width: '100%', fontSize: 15, border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--card)' }} />
          </div>
          <div>
            <label htmlFor="setup-name2" style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Person 2</label>
            <input id="setup-name2" value={name2} onChange={e => setName2(e.target.value)} placeholder="e.g. Rupert"
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              style={{ width: '100%', fontSize: 15, border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--card)' }} />
          </div>
        </div>
        <button onClick={submit} style={{ width: '100%', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, padding: '12px', cursor: 'pointer', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          Get started
        </button>
        <button onClick={() => { signIn(); onDone() }} style={{ width: '100%', background: 'none', color: 'var(--muted)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '12px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
  const { data, user, savedAt, isRefreshing, signIn, signOutUser, refreshFromCloud, updateOwnerName } = budget

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleRefresh = async () => {
    await refreshFromCloud()
    showToast('Synced!')
  }

  const needsSetup = !setupDone && !user && !data.nameNiamh && !data.nameRupert

  if (needsSetup) {
    return <SetupScreen onDone={() => setSetupDone(true)} updateOwnerName={updateOwnerName} signIn={() => { signIn(); setSetupDone(true) }} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--surface)' }}>

      {toast && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: 'white', padding: '10px 20px',
          borderRadius: 999, fontSize: 13, fontWeight: 500, zIndex: 100,
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          animation: 'fadeUp 0.2s ease',
        }}>
          <CheckCircle size={14} /> {toast}
        </div>
      )}

      <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, zIndex: 10 }}>
        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 24, margin: 0, flex: 1 }}>Budge</h1>
        {savedAt && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Saved {new Date(savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleRefresh}
              aria-label="Sync from cloud"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 8, display: 'flex', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button onClick={signOutUser}
              title={`${user.email} — tap to sign out`}
              aria-label={`Signed in as ${user.email}. Tap to sign out.`}
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--rupert)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', padding: 0 }}>
              {user.email?.[0].toUpperCase()}
            </button>
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
            const label = t === 'ALL' ? 'All' : t === 'NIAMH' ? (data.nameNiamh || 'Person 1') : t === 'RUPERT' ? (data.nameRupert || 'Person 2') : (data.nameJoint || 'Joint')
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

      <nav aria-label="Main navigation" style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', display: 'flex', flexShrink: 0 }}>
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setScreen(id)}
            aria-current={screen === id ? 'page' : undefined}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: screen === id ? 'var(--ink)' : 'var(--muted)', fontSize: 10, fontWeight: screen === id ? 600 : 400 }}>
            <Icon size={20} strokeWidth={screen === id ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
