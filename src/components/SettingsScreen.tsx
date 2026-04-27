'use client'

import { useState, useEffect } from 'react'
import { Owner } from '@/lib/models'
import { Check, Pencil } from 'lucide-react'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

function NameRow({ label, value, onSave, color }: { label: string; value: string; onSave: (v: string) => void; color: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => { if (draft.trim()) { onSave(draft.trim()); setEditing(false) } }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--muted)', width: 60, flexShrink: 0 }}>{label}</span>
      {editing ? (
        <>
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit() }}
            onBlur={commit}
            style={{ flex: 1, fontSize: 14, border: '1.5px solid var(--rupert)', borderRadius: 6, padding: '4px 8px', outline: 'none' }}
            autoFocus />
          <button onClick={commit} style={{ background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex' }}>
            <Check size={14} />
          </button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{value}</span>
          <button onClick={() => { setDraft(value); setEditing(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4 }}>
            <Pencil size={14} />
          </button>
        </>
      )}
    </div>
  )
}

export default function SettingsScreen({ budget }: { budget: BudgetHook }) {
  const { data, updateOwnerName, getJsonString, importFromJson } = budget
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('budge-dark-mode')
    if (saved === 'true') { setDarkMode(true); document.documentElement.setAttribute('data-theme', 'dark') }
  }, [])

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '')
    localStorage.setItem('budge-dark-mode', String(next))
  }

  const handleImport = () => {
    const ok = importFromJson(importText)
    setImportResult(ok ? 'Imported successfully!' : 'Invalid JSON — check the format')
    if (ok) setImportText('')
  }

  const handleExport = () => {
    const json = getJsonString()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budge-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setImportResult('Downloaded!')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const ok = importFromJson(text)
      setImportResult(ok ? 'Imported successfully!' : 'Invalid file — check the format')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <h2 style={{ fontSize: 20, marginBottom: 16, marginTop: 0 }}>Settings</h2>

      {/* Person names */}
      <div className="card" style={{ padding: '4px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', padding: '10px 0 4px' }}>Person Names</div>
        <NameRow label="Person 1" value={data.nameNiamh} color="var(--niamh)" onSave={v => updateOwnerName('NIAMH', v)} />
        <NameRow label="Person 2" value={data.nameRupert} color="var(--rupert)" onSave={v => updateOwnerName('RUPERT', v)} />
        <NameRow label="Joint" value={data.nameJoint} color="var(--joint)" onSave={v => updateOwnerName('JOINT', v)} />
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0' }}>
          These names appear throughout the app. Changes sync to all devices.
        </p>
      </div>

      {/* Dark mode */}
      <div className="card" style={{ padding: '4px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', padding: '10px 0 4px' }}>Appearance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <span style={{ fontSize: 14 }}>Dark mode</span>
          <button onClick={toggleDarkMode} style={{
            width: 48, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: darkMode ? 'var(--ink)' : 'var(--border)',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 3, transition: 'left 0.2s',
              left: darkMode ? 24 : 4,
            }} />
          </button>
        </div>
      </div>

      {/* Export / Import */}
      <div className="card" style={{ padding: '4px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', padding: '10px 0 4px' }}>Export / Import</div>
        <button onClick={handleExport} style={{ width: '100%', marginTop: 8, background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Download backup (.json)
        </button>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', width: '100%', background: 'var(--rupert)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500, textAlign: 'center' }}>
            Upload backup (.json)
            <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Or paste JSON directly:</div>
          <textarea value={importText} onChange={e => setImportText(e.target.value)}
            placeholder="Paste exported JSON here..."
            style={{ width: '100%', height: 80, fontSize: 12, border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }} />
          <button onClick={handleImport} disabled={!importText.trim()}
            style={{ width: '100%', marginTop: 6, background: importText.trim() ? 'var(--rupert)' : 'var(--border)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: importText.trim() ? 'pointer' : 'default', fontSize: 14, fontWeight: 500 }}>
            Import from text
          </button>
        </div>
        {importResult && (
          <div style={{ marginTop: 8, fontSize: 13, color: importResult.includes('success') || importResult.includes('copied') ? 'var(--positive)' : 'var(--negative)', padding: '6px 10px', borderRadius: 6, background: importResult.includes('success') || importResult.includes('copied') ? 'var(--income-bg)' : 'var(--expense-bg)' }}>
            {importResult}
          </div>
        )}
      </div>

      {/* About */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>About</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          Budge syncs your household budget across devices in real time via Firebase. Sign in with Google to enable sync.
        </p>
      </div>
    </div>
  )
}
