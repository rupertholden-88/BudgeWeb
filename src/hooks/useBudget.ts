'use client'

import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { db, auth, provider } from '@/lib/firebase'
import { BudgetData, Debt, Owner, EntryType, AssetType, DebtType, defaultBudgetData, calcTotals, Totals, SpendSnapshot } from '@/lib/models'

function uuid() { return crypto.randomUUID() }

function mergeBudgets(incoming: BudgetData, current: BudgetData): BudgetData {
  // Union savingsHistory by owner+month — local entries preserved even if absent from cloud
  const savingsMap = new Map<string, BudgetData['savingsHistory'][number]>()
  current.savingsHistory.forEach(s => savingsMap.set(`${s.owner}:${s.date.slice(0, 7)}`, s))
  incoming.savingsHistory.forEach(s => savingsMap.set(`${s.owner}:${s.date.slice(0, 7)}`, s))

  // Union spendHistory by month
  const spendMap = new Map<string, SpendSnapshot>()
  ;(current.spendHistory || []).forEach(s => spendMap.set(s.date, s))
  ;(incoming.spendHistory || []).forEach(s => spendMap.set(s.date, s))

  return {
    ...incoming,
    nameNiamh:  incoming.nameNiamh  || current.nameNiamh  || 'Niamh',
    nameRupert: incoming.nameRupert || current.nameRupert || 'Rupert',
    nameJoint:  incoming.nameJoint  || current.nameJoint  || 'Joint',
    savingsHistory: Array.from(savingsMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    spendHistory:   Array.from(spendMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export function useBudget() {
  const [data, setData]               = useState<BudgetData>(defaultBudgetData())
  const [user, setUser]               = useState<User | null>(null)
  const [savedAt, setSavedAt]         = useState<string | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)
  const lastSavedAt                   = useRef<number>(0)
  const saveTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unsubscribeCloud              = useRef<(() => void) | null>(null)
  const currentData                   = useRef<BudgetData>(defaultBudgetData())

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) startCloudListener(u.email!)
      else { unsubscribeCloud.current?.(); unsubscribeCloud.current = null }
    })
  }, [])

  // Keep ref in sync so cloud listener can access latest local data
  useEffect(() => { currentData.current = data }, [data])

  const signIn = () => signInWithPopup(auth, provider)
  const signOutUser = () => signOut(auth)

  function startCloudListener(email: string) {
    unsubscribeCloud.current?.()
    const ref = doc(db, 'users', email)
    unsubscribeCloud.current = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return
      try {
        const cloudData: BudgetData = JSON.parse(snap.data().json)
        const cloudTs = new Date(cloudData.savedAt || '1970-01-01').getTime()
        if (cloudTs > lastSavedAt.current) {
          lastSavedAt.current = cloudTs
          const merged = mergeBudgets(cloudData, currentData.current)
          setData(merged)
          setSavedAt(cloudData.savedAt)
        }
      } catch { }
    })
  }

  async function syncToCloud(email: string, budget: BudgetData) {
    try {
      await setDoc(doc(db, 'users', email), { json: JSON.stringify(budget), updatedAt: new Date().toISOString() }, { merge: true })
    } catch { }
  }

  async function refreshFromCloud() {
    if (!user?.email) return
    setRefreshing(true)
    try {
      const snap = await getDoc(doc(db, 'users', user.email))
      if (snap.exists()) {
        const cloudData: BudgetData = JSON.parse(snap.data().json)
        const merged = mergeBudgets(cloudData, currentData.current)
        setData(merged)
        setSavedAt(cloudData.savedAt)
      }
    } finally { setRefreshing(false) }
  }

  function mutate(updater: (prev: BudgetData) => BudgetData) {
    setData(prev => {
      const next = updater(prev)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const now = new Date().toISOString()
        lastSavedAt.current = new Date(now).getTime()
        const stamped = { ...next, savedAt: now }
        setSavedAt(now)
        if (user?.email) syncToCloud(user.email, stamped)
      }, 1000)
      return next
    })
  }

  const updateOwnerName = (owner: Owner, name: string) => {
    if (!name.trim()) return
    mutate(b => ({ ...b, nameNiamh: owner === 'NIAMH' ? name.trim() : b.nameNiamh, nameRupert: owner === 'RUPERT' ? name.trim() : b.nameRupert, nameJoint: owner === 'JOINT' ? name.trim() : b.nameJoint }))
  }

  const addCategory = (owner: Owner, type: EntryType, label: string) => {
    if (!label.trim()) return
    mutate(b => ({ ...b, categories: [...b.categories, { key: `custom_${uuid()}`, owner, type, label: label.trim(), items: [] }] }))
  }

  const renameCategory = (catKey: string, newLabel: string) => {
    if (!newLabel.trim()) return
    mutate(b => ({ ...b, categories: b.categories.map(c => c.key === catKey ? { ...c, label: newLabel.trim() } : c) }))
  }

  const deleteCategory = (catKey: string) => {
    mutate(b => ({ ...b, categories: b.categories.filter(c => c.key !== catKey) }))
  }

  const updateItemAmount = (catKey: string, itemId: string, amount: number) => {
    mutate(b => ({ ...b, categories: b.categories.map(c => c.key !== catKey ? c : { ...c, items: c.items.map(i => i.id === itemId ? { ...i, amount } : i) }) }))
  }

  const addItem = (catKey: string, label: string) => {
    if (!label.trim()) return
    mutate(b => ({ ...b, categories: b.categories.map(c => c.key !== catKey ? c : { ...c, items: [...c.items, { id: uuid(), label: label.trim(), amount: 0, priority: 'DISCRETIONARY' as const }] }) }))
  }

  const addItemWithAmount = (catKey: string, label: string, amount: number) => {
    if (!label.trim()) return
    mutate(b => ({ ...b, categories: b.categories.map(c => c.key !== catKey ? c : { ...c, items: [...c.items, { id: uuid(), label: label.trim(), amount, priority: 'NONE' as const }] }) }))
  }

  const resyncInterest = (byOwner: { owner: Owner; assets: { label: string; amount: number; interestRate?: number }[] }[]) => {
    mutate(b => {
      // Remove all existing interest items
      let updated = {
        ...b,
        categories: b.categories.map(c => ({
          ...c,
          items: c.items.filter(i => !i.label.startsWith('Interest -'))
        }))
      }
      // Re-add with current amounts
      byOwner.forEach(({ owner, assets }) => {
        const catKey = owner === 'NIAMH' ? 'inc_n' : owner === 'RUPERT' ? 'inc_r' : 'inc_joint'
        assets.forEach(a => {
          const monthly = Math.round((a.amount * (a.interestRate || 0)) / 100 / 12)
          if (monthly > 0) {
            updated = {
              ...updated,
              categories: updated.categories.map(c => c.key !== catKey ? c : {
                ...c,
                items: [...c.items, { id: uuid(), label: `Interest - ${a.label}`, amount: monthly, priority: 'NONE' as const }]
              })
            }
          }
        })
      })
      return updated
    })
  }

  const removeItem = (catKey: string, itemId: string) => {
    mutate(b => ({ ...b, categories: b.categories.map(c => c.key !== catKey ? c : { ...c, items: c.items.filter(i => i.id !== itemId) }) }))
  }

  const renameItem = (catKey: string, itemId: string, newLabel: string) => {
    if (!newLabel.trim()) return
    mutate(b => ({ ...b, categories: b.categories.map(c => c.key !== catKey ? c : { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label: newLabel.trim() } : i) }) }))
  }

  const getOrCopySnapshot = (b: BudgetData, owner: Owner, date: string) => {
    const existing = b.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === date.slice(0, 7))
    if (existing) return existing
    const prev = b.savingsHistory
      .filter(s => s.owner === owner && s.date.slice(0, 7) < date.slice(0, 7))
      .sort((a, z) => z.date.localeCompare(a.date))[0]
    if (prev && Array.isArray(prev.assets)) {
      return { date, owner, assets: prev.assets.map(a => ({ ...a, id: uuid() })) }
    }
    return { date, owner, assets: [] }
  }

  const copyForwardAssets = () => {
    const today = new Date().toISOString().slice(0, 7)
    mutate(b => {
      let updated = { ...b, savingsHistory: [...b.savingsHistory] }
      const owners: Owner[] = ['NIAMH', 'RUPERT', 'JOINT']
      owners.forEach(owner => {
        const existing = updated.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === today)
        if (!existing || !Array.isArray(existing.assets) || existing.assets.length === 0) {
          const prev = updated.savingsHistory
            .filter(s => s.owner === owner && s.date.slice(0, 7) < today)
            .sort((a, z) => z.date.localeCompare(a.date))[0]
          if (prev && Array.isArray(prev.assets) && prev.assets.length > 0) {
            const newSnap = { date: today, owner, assets: prev.assets.map((a: any) => ({ ...a, id: uuid() })) }
            updated = {
              ...updated,
              savingsHistory: [...updated.savingsHistory.filter(s => !(s.owner === owner && s.date.slice(0, 7) === today)), newSnap]
                .sort((a, z) => a.date.localeCompare(z.date))
            }
          }
        }
      })
      return updated
    })
  }

  const moveAssetsToLastMonth = () => {
    const todayStr = new Date().toISOString().slice(0, 7)
    const prev = new Date(); prev.setMonth(prev.getMonth() - 1)
    const prevStr = prev.toISOString().slice(0, 7)
    mutate(b => {
      const currentSnaps = b.savingsHistory.filter(s => s.date.slice(0, 7) === todayStr)
      const prevSnaps = currentSnaps.map(s => ({ ...s, date: prevStr }))
      const filtered = b.savingsHistory.filter(s => s.date.slice(0, 7) !== todayStr && s.date.slice(0, 7) !== prevStr)
      return { ...b, savingsHistory: [...filtered, ...prevSnaps].sort((a, z) => a.date.localeCompare(z.date)) }
    })
  }

  const addAsset = (owner: Owner, date: string, type: AssetType, label: string) => {
    mutate(b => {
      const snap = getOrCopySnapshot(b, owner, date)
      const updated = { ...snap, assets: [...snap.assets, { id: uuid(), type, label, amount: 0 }] }
      return { ...b, savingsHistory: [...b.savingsHistory.filter(s => !(s.owner === owner && s.date.slice(0, 7) === date.slice(0, 7))), updated].sort((a, z) => a.date.localeCompare(z.date)) }
    })
  }

  const updateAsset = (owner: Owner, date: string, assetId: string, amount: number, interestRate?: number, institution?: string, label?: string, type?: AssetType) => {
    mutate(b => {
      const snap = getOrCopySnapshot(b, owner, date)
      const updated = { ...snap, assets: snap.assets.map(a => a.id === assetId ? { ...a, amount, interestRate, institution, ...(label !== undefined && { label }), ...(type !== undefined && { type }) } : a) }
      return { ...b, savingsHistory: [...b.savingsHistory.filter(s => !(s.owner === owner && s.date.slice(0, 7) === date.slice(0, 7))), updated].sort((a, z) => a.date.localeCompare(z.date)) }
    })
  }

  const deleteAsset = (owner: Owner, date: string, assetId: string) => {
    mutate(b => {
      const snap = b.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === date.slice(0, 7))
      if (!snap) return b
      const updated = { ...snap, assets: snap.assets.filter(a => a.id !== assetId) }
      return { ...b, savingsHistory: [...b.savingsHistory.filter(s => !(s.owner === owner && s.date.slice(0, 7) === date.slice(0, 7))), updated].sort((a, z) => a.date.localeCompare(z.date)) }
    })
  }

  const addDebt = (owner: Owner, type: DebtType, label: string) => {
    if (!label.trim()) return
    mutate(b => ({ ...b, debts: [...b.debts, { id: uuid(), owner, type, label: label.trim(), currentBalance: 0, monthlyPayment: 0, interestRate: 0, isZeroPercent: false }] }))
  }

  const updateDebt = (id: string, fields: Partial<Debt>) => {
    mutate(b => ({ ...b, debts: b.debts.map(d => d.id === id ? { ...d, ...fields } : d) }))
  }

  const deleteDebt = (id: string) => {
    mutate(b => ({ ...b, debts: b.debts.filter(d => d.id !== id) }))
  }

  const getJsonString = () => JSON.stringify(data, null, 2)
  const importFromJson = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json)
      const merged = mergeBudgets(parsed, currentData.current)
      setData(merged)
      return true
    } catch { return false }
  }

  const totals: Totals = calcTotals(data)

  // Auto-snapshot current month's spend whenever budget changes
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 7)
    if (totals.totalInc === 0 && totals.totalExp === 0 && totals.totalSav === 0) return
    const existing = (data.spendHistory || []).find((s: SpendSnapshot) => s.date === today)
    if (existing && existing.totalInc === totals.totalInc && existing.totalExp === totals.totalExp && existing.totalSav === totals.totalSav) return
    mutate(b => {
      const snap: SpendSnapshot = { date: today, totalInc: totals.totalInc, totalExp: totals.totalExp, totalSav: totals.totalSav }
      return { ...b, spendHistory: [...(b.spendHistory || []).filter((s: SpendSnapshot) => s.date !== today), snap].sort((a, z) => a.date.localeCompare(z.date)) }
    })
  }, [data.categories, data.debts]) // eslint-disable-line

  return {
    data, user, savedAt, isRefreshing, totals,
    signIn, signOutUser, refreshFromCloud,
    updateOwnerName, addCategory, renameCategory, deleteCategory,
    updateItemAmount, addItem, addItemWithAmount, resyncInterest, copyForwardAssets, moveAssetsToLastMonth, removeItem, renameItem,
    addAsset, updateAsset, deleteAsset,
    addDebt, updateDebt, deleteDebt,
    getJsonString, importFromJson,
  }
}
