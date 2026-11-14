'use client'

import { useEffect, useRef, useState } from 'react'

type Tab<T extends string> = { value: T; label: string }

/** A compact, keyboard-accessible section row. Overflow never shrinks the labels. */
export default function SubTabs<T extends string>({ id, label, tabs, value, onChange }: {
  id: string; label: string; tabs: Tab<T>[]; value: T; onChange: (value: T) => void
}) {
  const row = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const measure = () => {
    const el = row.current
    if (el) setEdges({ left: el.scrollLeft > 3, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 3 })
  }
  useEffect(() => {
    const el = row.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [tabs.length])
  useEffect(() => {
    const el = row.current
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!el || !active) return
    const left = active.offsetLeft, right = left + active.offsetWidth
    if (left < el.scrollLeft) el.scrollLeft = left
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth
    measure()
  }, [value])
  return <div className="relative min-w-0 border-b border-line">
    <div ref={row} role="tablist" aria-label={label} onScroll={measure}
      className="relative flex gap-5 overflow-x-auto overscroll-x-contain" style={{ scrollbarWidth: 'none' }}
      onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
      {tabs.map((tab, index) => <button key={tab.value} id={`${id}-tab-${tab.value}`} type="button" role="tab"
        aria-selected={value === tab.value} aria-controls={`${id}-panel-${tab.value}`} tabIndex={value === tab.value ? 0 : -1}
        onClick={() => onChange(tab.value)}
        onKeyDown={e => {
          let next: number | undefined
          if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
          if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
          if (e.key === 'Home') next = 0
          if (e.key === 'End') next = tabs.length - 1
          if (next !== undefined) {
            e.preventDefault(); e.stopPropagation()
            onChange(tabs[next].value)
            document.getElementById(`${id}-tab-${tabs[next].value}`)?.focus({ preventScroll: true })
          }
        }}
        className={`relative min-h-[48px] shrink-0 whitespace-nowrap border-b-[3px] px-0.5 pt-2 pb-2.5 text-[15px] cursor-pointer ${value === tab.value ? 'border-ink text-ink font-semibold' : 'border-transparent text-muted font-medium hover:text-ink'}`}>
        {tab.label}
      </button>)}
    </div>
    {edges.left && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-3" style={{ background: 'linear-gradient(to right, var(--bg), transparent)' }} />}
    {edges.right && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-4" style={{ background: 'linear-gradient(to left, var(--bg), transparent)' }} />}
  </div>
}
