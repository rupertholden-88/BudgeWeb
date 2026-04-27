'use client'

import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { db, auth, provider } from '@/lib/firebase'
import { BudgetData, Debt, Owner, EntryType, AssetType, DebtType, defaultBudgetData, calcTotals, Totals } from '@/lib/models'

function uuid() { return crypto.randomUUID() }

function mergeNames(incoming: BudgetData, current: BudgetData): BudgetData {
  return {
    ...incoming,
    nameNiamh:  incoming.nameNiamh  || current.nameNiamh  || 'Niamh',
    nameRupert: incoming.nameRupert || current.nameRupert || 'Rupert',
    nameJoint:  incoming.nameJoint  || current.nameJoint  || 'Joint',
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
          const merged = mergeNames(cloudData, currentData.current)
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
        const merged = mergeNames(cloudData, currentData.current)
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

  const removeItem = (catKey: string, itemId: string) => {
    mutate(b => ({ ...b, categories: b.categories.map(c => c.key !== catKey ? c : { ...c, items: c.items.filter(i => i.id !== itemId) }) }))
  }

  const renameItem = (catKey: string, itemId: string, newLabel: string) => {
    if (!newLabel.trim()) return
    mutate(b => ({ ...b, categories: b.categories.map(c => c.key !== catKey ? c : { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label: newLabel.trim() } : i) }) }))
  }

  const addAsset = (owner: Owner, date: string, type: AssetType, label: string) => {
    mutate(b => {
      const snap = b.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === date.slice(0, 7)) ?? { date, owner, assets: [] }
      const updated = { ...snap, assets: [...snap.assets, { id: uuid(), type, label, amount: 0 }] }
      return { ...b, savingsHistory: [...b.savingsHistory.filter(s => !(s.owner === owner && s.date.slice(0, 7) === date.slice(0, 7))), updated].sort((a, z) => a.date.localeCompare(z.date)) }
    })
  }

  const updateAsset = (owner: Owner, date: string, assetId: string, amount: number, interestRate?: number, institution?: string) => {
    mutate(b => {
      const snap = b.savingsHistory.find(s => s.owner === owner && s.date.slice(0, 7) === date.slice(0, 7)) ?? { date, owner, assets: [] }
      const updated = { ...snap, assets: snap.assets.map(a => a.id === assetId ? { ...a, amount, interestRate, institution } : a) }
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
      const merged = mergeNames(parsed, currentData.current)
      setData(merged)
      return true
    } catch { return false }
  }

  const totals: Totals = calcTotals(data)

  return {
    data, user, savedAt, isRefreshing, totals,
    signIn, signOutUser, refreshFromCloud,
    updateOwnerName, addCategory, renameCategory, deleteCategory,
    updateItemAmount, addItem, addItemWithAmount, removeItem, renameItem,
    addAsset, updateAsset, deleteAsset,
    addDebt, updateDebt, deleteDebt,
    getJsonString, importFromJson,
  }
}
