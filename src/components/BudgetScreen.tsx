'use client'

import { useState, useRef } from 'react'
import { Category, TabFilter, Owner, EntryType, fmt, calcTotals, BudgetData } from '@/lib/models'
import { Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

function ownerColor(owner: Owner) {
  if (owner === 'NIAMH') return 'var(--niamh)'
  if (owner === 'RUPERT') return 'var(--rupert)'
  return 'var(--joint)'
}

function typeColor(type: EntryType) {
  if (type === 'INCOME')  return { bg: 'var(--income-bg)',  text: 'var(--income-text)' }
  if (type === 'EXPENSE') return { bg: 'var(--expense-bg)', text: 'var(--expense-text)' }
  return { bg: 'var(--savings-bg)', text: 'var(--savings-text)' }
}

function AmountCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const start = () => { setRaw(value === 0 ? '' : String(value)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  const commit = () => { const n = parseFloat(raw.replace(/[£,]/g, '')); onChange(isNaN(n) ? 0 : n); setEditing(false) }

  if (editing) return (
    <input ref={inputRef} value={raw} onChange={e => setRaw(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') commit() }}
      style={{ width: 80, textAlign: 'right', fontSize: 14, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '2px 6px', outline: 'none', background: 'var(--rupert-light)' }}
      inputMode="decimal" autoFocus />
  )

  return (
    <span onClick={start} style={{ cursor: 'text', fontVariantNumeric: 'tabular-nums', fontSize: 14, color: value > 0 ? 'var(--ink)' : 'var(--muted)', padding: '2px 4px', borderRadius: 4, minWidth: 60, display: 'inline-block', textAlign: 'right' }}>
      {value > 0 ? fmt(value) : '—'}
    </span>
  )
}

function CategoryCard({ cat, onUpdateAmount, onAddItem, onRemoveItem, onRenameCategory, onDeleteCategory }: {
  cat: Category
  onUpdateAmount: (catKey: string, itemId: string, v: number) => void
  onAddItem: (catKey: string, label: string) => void
  onRemoveItem: (catKey: string, itemId: string) => void
  onRenameCategory: (catKey: string, label: string) => void
  onDeleteCategory: (catKey: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(cat.label)
  const total = cat.items.reduce((a, i) => a + i.amount, 0)
  const { bg, text } = typeColor(cat.type)
  const color = ownerColor(cat.owner)

  const submitItem = () => { if (newItemLabel.trim()) { onAddItem(cat.key, newItemLabel.trim()); setNewItemLabel(''); setAddingItem(false) } }

  return (
    <div className="card fade-up" style={{ marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderLeft: 
