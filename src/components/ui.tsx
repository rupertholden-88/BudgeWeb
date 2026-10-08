'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { fmt, Owner } from '@/lib/models'

export function ownerBorderClass(owner: Owner) {
  if (owner === 'NIAMH') return 'border-l-[3px] border-l-niamh'
  if (owner === 'RUPERT') return 'border-l-[3px] border-l-rupert'
  return 'border-l-[3px] border-l-joint'
}

export function ownerTextClass(owner: Owner) {
  if (owner === 'NIAMH') return 'text-niamh'
  if (owner === 'RUPERT') return 'text-rupert'
  return 'text-joint'
}

/** Bottom-sheet confirmation, used for every delete in the app. */
export function ConfirmDelete({ label, detail, onConfirm, onCancel }: {
  label: string; detail?: string; onConfirm: () => void; onCancel: () => void
}) {
  // Portalled to <body> so it always sits above the tab bar and any open sheet.
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/45 flex items-end justify-center" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card rounded-t-2xl px-5 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] w-full max-w-[480px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-lead font-semibold mb-1 break-words">Delete &ldquo;{label}&rdquo;?</div>
        <div className="text-body text-muted mb-5">{detail ?? "This can't be undone."}</div>
        <div className="flex flex-col gap-2">
          <button onClick={onConfirm} className="bg-ink text-on-ink border-0 rounded-xl p-3.5 cursor-pointer text-lead font-semibold min-h-[48px]">
            Delete
          </button>
          <button onClick={onCancel} className="bg-fill text-ink border-0 rounded-xl p-3.5 cursor-pointer text-lead min-h-[48px]">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Headline figure tile. Serif numerals, matching the other headline numbers. */
export function StatCard({ label, value, sub, intent }: {
  label: string; value: string; sub?: string
  intent?: 'positive' | 'negative' | 'neutral'
}) {
  const valueClass = intent === 'positive' ? 'text-positive' : intent === 'negative' ? 'text-negative' : 'text-ink'
  return (
    <div className="card p-3 flex-1 min-w-0">
      <div className="section-label text-caption mb-1 truncate">{label}</div>
      <div className={`font-serif text-xl font-bold tabular-nums leading-none ${valueClass}`}>{value}</div>
      {sub && <div className="text-caption text-muted mt-1">{sub}</div>}
    </div>
  )
}

/** Tap-to-edit money figure. */
export function AmountCell({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const start = () => { setRaw(value === 0 ? '' : String(value)); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  const commit = () => { const n = parseFloat(raw.replace(/[£,]/g, '')); onChange(isNaN(n) ? 0 : n); setEditing(false) }
  if (editing) return (
    <input
      ref={inputRef}
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Tab') commit() }}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      className="w-24 text-right text-sm border-[1.5px] border-accent rounded-lg px-2 py-1.5 outline-none bg-accent-light font-semibold"
      inputMode="decimal"
      autoFocus
    />
  )
  return (
    <button
      type="button"
      onClick={start}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      className={`bg-transparent border-0 cursor-text tabular-nums text-sm font-semibold px-2 py-2 rounded-lg min-w-[64px] min-h-[36px] text-right ${value > 0 ? 'text-ink' : 'text-muted opacity-60'} ${className ?? ''}`}
    >
      {value > 0 ? fmt(value) : '—'}
    </button>
  )
}

/** Tap-to-edit text. */
export function TapToEdit({ value, onSave, className, placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => { if (draft.trim()) onSave(draft.trim()); setEditing(false) }
  if (editing) return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      className={`w-full min-w-0 border-[1.5px] border-accent rounded-lg px-2 py-1 outline-none bg-accent-light ${className ?? ''}`}
      autoFocus
    />
  )
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => { setDraft(value); setEditing(true) }}
      onKeyDown={e => { if (e.key === 'Enter') { setDraft(value); setEditing(true) } }}
      className={`cursor-text ${value ? '' : 'text-muted'} ${className ?? ''}`}
    >
      {value || placeholder}
    </span>
  )
}

/** 44×44 tap target for expand/collapse, whatever the icon size. */
export function ExpandButton({ expanded, onClick, label, active, icon }: {
  expanded: boolean; onClick: () => void; label: string; active?: boolean; icon?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      aria-label={label}
      aria-expanded={expanded}
      className={`border-0 cursor-pointer flex items-center justify-center shrink-0 w-11 h-11 -my-1.5 -mr-1.5 rounded-xl ${
        active ? 'bg-accent-light text-accent' : expanded ? 'bg-surface text-ink' : 'bg-transparent text-muted'
      }`}
    >
      {icon ?? (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
    </button>
  )
}

/** Labelled group inside an expanded options panel. */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-2 border-t border-border first:border-t-0">
      <div className="section-label text-caption mb-1.5">{title}</div>
      {children}
    </div>
  )
}

/** Visible delete action, so deleting never depends on discovering long-press. */
export function DeleteAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 bg-transparent border-0 cursor-pointer text-negative text-xs font-medium min-h-[36px] px-0"
    >
      <Trash2 size={13} /> {label}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-caption text-muted uppercase tracking-label">{label}</span>
      {children}
    </label>
  )
}

export const inputClass = 'text-[15px] text-ink border border-line-2 rounded-xl px-3 py-2 outline-none bg-panel min-h-[44px]'

/** Long press as a shortcut only — every delete also has a visible button. */
export function useLongPress(onLongPress: () => void, disabled = false) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = (e: React.SyntheticEvent) => {
    if (disabled) return
    // Pressing and holding inside a field (to paste, select text…) or on a
    // control must never turn into a delete prompt.
    const target = e.target as HTMLElement | null
    if (target?.closest('input, select, textarea, button, a, label, [role="button"]')) return
    timer.current = setTimeout(() => { navigator.vibrate?.(50); onLongPress() }, 600)
  }
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  return {
    onMouseDown: start, onMouseUp: cancel, onMouseLeave: cancel,
    onTouchStart: start, onTouchEnd: cancel, onTouchMove: cancel, onTouchCancel: cancel,
  }
}

/**
 * Number field that keeps exactly what was typed ("0.", ".5", "0") while
 * reporting the parsed value as you go — a plain `parseFloat(v) || x`
 * swallows zeros and mangles half-typed decimals.
 */
export function NumberInput({ value, onChange, placeholder = '0', className, ariaLabel }: {
  value: number | null | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  const show = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '' : String(v))
  const [draft, setDraft] = useState(show(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setDraft(show(value)) }, [value])
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={() => { focused.current = true }}
      onBlur={() => { focused.current = false; setDraft(show(value)) }}
      onChange={e => {
        const raw = e.target.value.replace(/[£,\s%]/g, '')
        if (!/^\d*\.?\d*$/.test(raw)) return
        setDraft(raw)
        if (raw === '' || raw === '.') onChange(undefined)
        else { const n = parseFloat(raw); if (Number.isFinite(n)) onChange(n) }
      }}
      className={className ?? inputClass}
    />
  )
}
