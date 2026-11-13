import { BudgetData, Owner } from './models'

const normal = (name: string) => name.trim().toLowerCase()
export function pensionHistory(data: BudgetData, months: string[], today: string) {
  const pots = (['NIAMH', 'RUPERT', 'JOINT'] as Owner[]).flatMap(owner => {
    const current = data.savingsHistory.filter(s => s.owner === owner && s.date.slice(0, 7) <= today)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    const assets = (current?.assets ?? []).filter(a => a.type === 'PENSION')
    return assets.map(asset => ({
      key: `pot:${owner}:${asset.id}`, assetId: asset.id, owner, label: asset.label,
      ownerLabel: owner === 'NIAMH' ? data.nameNiamh || 'Person 1' : owner === 'RUPERT' ? data.nameRupert || 'Person 2' : data.nameJoint || 'Joint',
      color: owner === 'NIAMH' ? 'var(--niamh)' : owner === 'RUPERT' ? 'var(--rupert)' : 'var(--joint)',
      historyNames: asset.pensionHistoryNames ?? [],
    }))
  })
  const rows = months.map(month => {
    const row: { month: string; total: number | null; [key: string]: string | number | null } = { month, total: null }
    for (const pot of pots) {
      const names = [pot.label, ...pot.historyNames].map(normal)
      const entries = data.savingsHistory.filter(s => s.owner === pot.owner && s.date.slice(0, 7) === month)
        .flatMap(s => (s.assets ?? []).filter(a => a.type === 'PENSION' && names.includes(normal(a.label))))
      // A rename can leave both names in a snapshot. Prefer the current name;
      // aliases describe the same pot and must never be added together.
      const entry = entries.find(a => normal(a.label) === normal(pot.label)) ?? entries[0]
      row[pot.key] = entry ? entry.amount : null
    }
    const recorded = data.savingsHistory.filter(s => s.date.slice(0, 7) === month)
      .flatMap(s => (s.assets ?? []).filter(a => a.type === 'PENSION'))
    row.total = recorded.length ? recorded.reduce((sum, a) => sum + a.amount, 0) : null
    return row
  })
  return { pots, rows }
}
