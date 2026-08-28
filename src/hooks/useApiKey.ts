'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { User } from 'firebase/auth'
import { db } from '@/lib/firebase'

// A separate Firestore collection, not a field on the budget document — the
// budget document is what Settings' JSON export/import round-trips, and a
// secret key has no business riding along in a downloadable backup file.
const COLLECTION = 'apiKeys'

/**
 * Catches the common paste failures — a partial copy, or a mobile keyboard
 * capitalising the first character — before spending a round-trip to be told
 * "authentication_error" with no clue which of those it was.
 */
export function validateKeyShape(key: string): string | null {
  const k = key.trim()
  if (!k) return 'Enter a key.'
  if (/\s/.test(k)) return "That key has a space in it — it was probably copied incompletely."
  if (!k.startsWith('sk-ant-')) {
    return k.toLowerCase().startsWith('sk-ant-')
      ? "That key's capitalisation is wrong — it should start with a lowercase 'sk-ant-'."
      : "That doesn't look like an Anthropic key — they start with 'sk-ant-'."
  }
  if (k.length < 40) return `That key looks too short (${k.length} characters) — it was probably cut off when copied.`
  return null
}

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

  const saveKey = async (key: string): Promise<{ ok: boolean; message?: string }> => {
    if (!user?.email) return { ok: false, message: 'Sign in first.' }
    const shapeError = validateKeyShape(key)
    if (shapeError) return { ok: false, message: shapeError }
    try {
      await setDoc(doc(db, COLLECTION, user.email), { anthropicApiKey: key.trim(), updatedAt: new Date().toISOString() })
      await refresh()
      return { ok: true }
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        return { ok: false, message: "Firestore's security rules are blocking this — the apiKeys collection needs a rule allowing a signed-in user to write their own document." }
      }
      return { ok: false, message: 'Could not save — check your connection and try again.' }
    }
  }

  const removeKey = async (): Promise<{ ok: boolean; message?: string }> => {
    if (!user?.email) return { ok: false, message: 'Sign in first.' }
    try {
      await deleteDoc(doc(db, COLLECTION, user.email))
      await refresh()
      return { ok: true }
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        return { ok: false, message: "Firestore's security rules are blocking this." }
      }
      return { ok: false, message: 'Could not remove — check your connection and try again.' }
    }
  }

  return {
    apiKey,
    hasKey: !!apiKey,
    last4: apiKey ? apiKey.slice(-4) : null,
    // Length is the giveaway for a truncated paste, and safe to show — it
    // reveals nothing about the key itself.
    keyLength: apiKey ? apiKey.length : null,
    loading,
    saveKey,
    removeKey,
  }
}
