'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { User } from 'firebase/auth'
import { db } from '@/lib/firebase'

// A separate Firestore collection, not a field on the budget document — the
// budget document is what Settings' JSON export/import round-trips, and a
// secret key has no business riding along in a downloadable backup file.
const COLLECTION = 'apiKeys'

export function useApiKey(user: User | null) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.email) { setApiKey(null); setLoading(false); return }
    setLoading(true)
    try {
      const snap = await getDoc(doc(db, COLLECTION, user.email))
      setApiKey(snap.exists() ? (snap.data().anthropicApiKey ?? null) : null)
    } catch {
      setApiKey(null)
    } finally {
      setLoading(false)
    }
  }, [user?.email])

  useEffect(() => { refresh() }, [refresh])

  const saveKey = async (key: string) => {
    if (!user?.email || !key.trim()) return
    await setDoc(doc(db, COLLECTION, user.email), { anthropicApiKey: key.trim(), updatedAt: new Date().toISOString() })
    await refresh()
  }

  const removeKey = async () => {
    if (!user?.email) return
    await deleteDoc(doc(db, COLLECTION, user.email))
    await refresh()
  }

  return {
    apiKey,
    hasKey: !!apiKey,
    last4: apiKey ? apiKey.slice(-4) : null,
    loading,
    saveKey,
    removeKey,
  }
}
