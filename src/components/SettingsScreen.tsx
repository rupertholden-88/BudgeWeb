'use client'

import { useState, useEffect } from 'react'
import { Check, KeyRound, Plus } from 'lucide-react'
import { useApiKey } from '@/hooks/useApiKey'
import { ageInYears, ageInMonths } from '@/lib/models'

type BudgetHook = ReturnType<typeof import('@/hooks/useBudget').useBudget>

function NameRow({ label, value, onSave, colorClass }: { label: string; value: string; onSave: (v: string) => void; colorClass: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => { if (draft.trim()) { onSave(draft.trim()); setEditing(false) } }
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-border">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorClass}`} />
      <span className="text-xs text-muted w-[60px] shrink-0">{label}</span>
      {editing ? (
        <>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit() }}
            onBlur={commit}
            className="flex-1 text-sm border-[1.5px] border-rupert rounded-md px-2 py-1 outline-none"
            autoFocus
          />
          <button onClick={commit} className="bg-ink text-white border-0 rounded-md px-2 py-1 cursor-pointer flex">
            <Check size={14} />
          </button>
        </>
      ) : (
        <span
          onClick={() => { setDraft(value); setEditing(true) }}
          className="flex-1 text-sm font-semibold cursor-text"
        >
          {value}
        </span>
      )}
    </div>
  )
}

export default function SettingsScreen({ budget }: { budget: BudgetHook }) {
  const { data, user, updateOwnerName, getJsonString, importFromJson, updateBirthMonth, addDependant, updateDependant, removeDependant } = budget
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  const { hasKey, last4, keyLength, loading: keyLoading, saveKey, removeKey } = useApiKey(user)
  const [keyDraft, setKeyDraft] = useState('')
  const [editingKey, setEditingKey] = useState(false)
  const [keyMsg, setKeyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingKey, setSavingKey] = useState(false)

  const handleSaveKey = async () => {
    if (!keyDraft.trim()) return
    setSavingKey(true)
    const result = await saveKey(keyDraft.trim())
    setSavingKey(false)
    if (result.ok) {
      setKeyDraft('')
      setEditingKey(false)
      setKeyMsg({ ok: true, text: 'Key saved.' })
      setTimeout(() => setKeyMsg(null), 2500)
    } else {
      setKeyMsg({ ok: false, text: result.message ?? 'Something went wrong.' })
    }
  }
  const handleRemoveKey = async () => {
    const result = await removeKey()
    setKeyMsg({ ok: result.ok, text: result.ok ? 'Key removed.' : (result.message ?? 'Something went wrong.') })
    if (result.ok) setTimeout(() => setKeyMsg(null), 2500)
  }

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

  const importOk = importResult?.includes('success') || importResult?.includes('copied') || importResult?.includes('Downloaded')

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="font-serif text-xl mb-4 mt-0">Settings</h2>

      <div className="card py-1 px-4 mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted py-2.5 pb-1">Person Names</div>
        <NameRow label="Person 1" value={data.nameNiamh} colorClass="bg-niamh" onSave={v => updateOwnerName('NIAMH', v)} />
        <NameRow label="Person 2" value={data.nameRupert} colorClass="bg-rupert" onSave={v => updateOwnerName('RUPERT', v)} />
        <NameRow label="Joint"    value={data.nameJoint}  colorClass="bg-joint"  onSave={v => updateOwnerName('JOINT', v)} />
        <p className="text-xs text-muted my-2">
          These names appear throughout the app. Changes sync to all devices.
        </p>
      </div>

      <div className="card py-1 px-4 mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted py-2.5 pb-1">Household</div>

        {([
          { owner: 'NIAMH' as const, label: data.nameNiamh || 'Person 1', value: data.bornNiamh, colour: 'bg-niamh' },
          { owner: 'RUPERT' as const, label: data.nameRupert || 'Person 2', value: data.bornRupert, colour: 'bg-rupert' },
        ]).map(p => (
          <div key={p.owner} className="flex items-center gap-2 py-2.5 border-b border-border">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.colour}`} />
            <span className="text-sm flex-1 min-w-0 truncate">{p.label}</span>
            <input
              type="month"
              value={p.value ?? ''}
              onChange={e => updateBirthMonth(p.owner, e.target.value)}
              aria-label={`${p.label} born`}
              className="text-xs border-[1.5px] border-border rounded-md px-2 py-1 outline-none bg-card shrink-0"
            />
            {p.value && (
              <span className="text-[11px] text-muted tabular-nums shrink-0 w-8 text-right">{ageInYears(p.value)}y</span>
            )}
          </div>
        ))}

        {(data.dependants ?? []).map((d, i) => {
          const months = ageInMonths(d.born)
          return (
            <div key={d.id} className="flex items-center gap-2 py-2.5 border-b border-border">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-joint" />
              <span className="text-sm flex-1 min-w-0 truncate">Child {i + 1}</span>
              <input
                type="month"
                value={d.born}
                onChange={e => updateDependant(d.id, e.target.value)}
                aria-label={`Child ${i + 1} born`}
                className="text-xs border-[1.5px] border-border rounded-md px-2 py-1 outline-none bg-card shrink-0"
              />
              <span className="text-[11px] text-muted tabular-nums shrink-0 w-8 text-right">
                {months == null ? '' : months < 24 ? `${months}m` : `${Math.floor(months / 12)}y`}
              </span>
              <button
                onClick={() => removeDependant(d.id)}
                aria-label={`Remove child ${i + 1}`}
                className="bg-transparent border-0 cursor-pointer text-muted text-sm shrink-0 px-1"
              >
                ✕
              </button>
            </div>
          )
        })}

        <button
          onClick={addDependant}
          className="flex items-center gap-1 mt-2 bg-transparent border-0 cursor-pointer text-muted text-xs"
        >
          <Plus size={12} /> Add a child
        </button>

        <p className="text-xs text-muted my-2 leading-relaxed">
          Used only by the financial health check, so it can compare you against households at
          the same stage rather than generic guidance. Birth months are stored, so ages stay current.
        </p>
      </div>

      <div className="card py-1 px-4 mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted py-2.5 pb-1">Appearance</div>
        <div className="flex justify-between items-center py-2.5">
          <span className="text-sm">Dark mode</span>
          <button
            onClick={toggleDarkMode}
            className="w-12 h-[26px] rounded-full border-0 cursor-pointer relative transition-colors duration-200"
            style={{ background: darkMode ? 'var(--ink)' : 'var(--border)' }}
          >
            <div
              className="w-5 h-5 rounded-full bg-white absolute top-[3px] transition-[left] duration-200"
              style={{ left: darkMode ? 24 : 4 }}
            />
          </button>
        </div>
      </div>

      <div className="card py-1 px-4 mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted py-2.5 pb-1">Export / Import</div>
        <button
          onClick={handleExport}
          className="w-full mt-2 bg-ink text-white border-0 rounded-lg py-2.5 px-4 cursor-pointer text-sm font-medium"
        >
          Download backup (.json)
        </button>
        <div className="mt-2.5">
          <label className="block w-full bg-rupert text-white border-0 rounded-lg py-2.5 px-4 cursor-pointer text-sm font-medium text-center">
            Upload backup (.json)
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
        <div className="mt-2.5">
          <div className="text-xs text-muted mb-1.5">Or paste JSON directly:</div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste exported JSON here..."
            className="w-full h-20 text-xs border-[1.5px] border-border rounded-lg p-2 outline-none resize-y font-mono"
          />
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className={`w-full mt-1.5 border-0 rounded-lg py-2.5 px-4 text-sm font-medium text-white ${importText.trim() ? 'bg-rupert cursor-pointer' : 'bg-border cursor-default'}`}
          >
            Import from text
          </button>
        </div>
        {importResult && (
          <div className={`mt-2 text-[13px] px-2.5 py-1.5 rounded-md ${importOk ? 'text-positive bg-income-bg' : 'text-negative bg-expense-bg'}`}>
            {importResult}
          </div>
        )}
      </div>

      <div className="card px-4 py-3 mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-2 flex items-center gap-1.5">
          <KeyRound size={12} /> AI Financial Health Check
        </div>
        {!user ? (
          <p className="text-[13px] text-muted m-0 leading-relaxed">
            Sign in to add your own Anthropic API key. It's tied to your Google account — anyone else who opens this
            app needs to add their own key too, so the check only ever runs (and is only ever billed) against the
            person who's using it.
          </p>
        ) : keyLoading ? (
          <p className="text-[13px] text-muted m-0">Checking…</p>
        ) : hasKey && !editingKey ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium tabular-nums">•••• {last4}</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setKeyDraft(''); setEditingKey(true) }}
                  className="text-[12px] bg-transparent border-[1.5px] border-border rounded-md px-2.5 py-1 cursor-pointer"
                >
                  Replace
                </button>
                <button
                  onClick={handleRemoveKey}
                  className="text-[12px] bg-transparent text-negative border-[1.5px] border-negative/40 rounded-md px-2.5 py-1 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted mt-2 mb-0 leading-relaxed">
              {keyLength} characters. Used only for the financial health check on Analysis, and only for your own account.
              {keyLength != null && keyLength < 90 && (
                <span className="text-negative"> An Anthropic key is normally ~108 characters, so this one looks truncated — try copying it again.</span>
              )}
            </p>
          </>
        ) : (
          <>
            <input
              type="password"
              value={keyDraft}
              onChange={e => setKeyDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveKey() }}
              placeholder="sk-ant-..."
              // Mobile keyboards will happily capitalise or autocorrect a
              // pasted key and silently break it.
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full text-sm border-[1.5px] border-border rounded-lg px-3 py-2 outline-none font-mono"
            />
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={handleSaveKey}
                disabled={!keyDraft.trim() || savingKey}
                className={`flex-1 border-0 rounded-lg py-2 text-sm font-medium text-white ${keyDraft.trim() && !savingKey ? 'bg-ink cursor-pointer' : 'bg-border cursor-default'}`}
              >
                {savingKey ? 'Saving…' : 'Save key'}
              </button>
              {hasKey && (
                <button
                  onClick={() => setEditingKey(false)}
                  className="px-3 bg-transparent border-[1.5px] border-border rounded-lg py-2 text-sm cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted mt-2 mb-0 leading-relaxed">
              From <span className="font-mono">console.anthropic.com</span> — stored against your account, never
              shared with anyone else who signs into this app, and never included in your JSON backup.
            </p>
          </>
        )}
        {keyMsg && (
          <div className={`mt-2 text-[13px] px-2.5 py-1.5 rounded-md leading-relaxed ${keyMsg.ok ? 'text-positive bg-income-bg' : 'text-negative bg-expense-bg'}`}>
            {keyMsg.text}
          </div>
        )}
      </div>

      <div className="card px-4 py-3 mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-2">About</div>
        <p className="text-[13px] text-muted m-0 leading-relaxed">
          Budge syncs your household budget across devices in real time via Firebase. Sign in with Google to enable sync.
        </p>
      </div>
    </div>
  )
}
