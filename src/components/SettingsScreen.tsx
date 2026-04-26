'use client'

import { useState } from 'react'
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

  const handleImport = () => {
    const ok = importFromJson(importText)
    setImportResult(ok ? 'Imported successfully!' : 'Invalid JSON — check the format')
    if (ok) setImportText('')
  }

  const handleExport = () => {
    const json = getJsonString()
    navigator.clipboard.writeText(json).then(() => setImportResult('JSON copied to clipboard!'))
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

      {/* Export / Import */}
      <div className="card" style={{ padding: '4px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', padding: '10px 0 4px' }}>Export / Import</div>
        <button onClick={handleExport} style={{ width: '100%', marginTop: 8, background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Copy budget JSON to clipboard
        </button>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Paste JSON to import:</div>
          <textarea value={importText} onChange={e => setImportText(e.target.value)}
            placeholder="Paste exported JSON here..."
            style={{ width: '100%', height: 100, fontSize: 12, border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }} />
          <button onClick={handleImport} disabled={!importText.trim()}
            style={{ width: '100%', marginTop: 6, background: importText.trim() ? 'var(--rupert)' : 'var(--border)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: importText.trim() ? 'pointer' : 'default', fontSize: 14, fontWeight: 500 }}>
            Import
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
