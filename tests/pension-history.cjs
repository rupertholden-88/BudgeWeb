const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const loaded = { exports: {} }
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/pensionHistory.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(loaded.exports)
const { pensionHistory } = loaded.exports
const pension = (label, amount, extra = {}) => ({ id: label, type: 'PENSION', label, amount, ...extra })
const fixture = () => ({ savingsHistory: [
  { owner: 'RUPERT', date: '2026-09', assets: [pension('Aviva', 80000), pension('HL', 20000)] },
  { owner: 'RUPERT', date: '2026-11', assets: [pension('Panmure', 83000, { pensionHistoryNames: ['Aviva'] }), pension('Singer', 21000, { pensionHistoryNames: ['HL'] })] },
], nameNiamh: 'Niamh', nameRupert: 'Rupert' })
test('two renamed pots form two continuous histories rather than four charts', () => {
  const { pots, rows } = pensionHistory(fixture(), ['2026-09', '2026-10', '2026-11'], '2026-11')
  assert.deepEqual(pots.map(p => p.label), ['Panmure', 'Singer'])
  assert.equal(rows[0][pots[0].key], 80000)
  assert.equal(rows[0][pots[1].key], 20000)
  assert.equal(rows[1][pots[0].key], null)
  assert.equal(rows[2].total, 104000)
})
test('unlinked names are not silently matched by position or provider', () => {
  const data = fixture(); data.savingsHistory[1].assets.forEach(a => a.pensionHistoryNames = [])
  const { pots, rows } = pensionHistory(data, ['2026-09', '2026-11'], '2026-11')
  assert.equal(pots.length, 2)
  assert.equal(rows[0][pots[0].key], null)
})
test('matching is owner scoped, preserves zero and does not sum alias copies', () => {
  const data = fixture(); data.savingsHistory.push({ owner: 'NIAMH', date: '2026-09', assets: [pension('Aviva', 500000)] })
  data.savingsHistory[1].assets.push(pension('Aviva', 123))
  data.savingsHistory[1].assets[0].amount = 0
  const { pots, rows } = pensionHistory(data, ['2026-09', '2026-11'], '2026-11')
  const pot = pots.find(p => p.owner === 'RUPERT' && p.label === 'Panmure')
  assert.equal(rows[0][pot.key], 80000)
  assert.equal(rows[1][pot.key], 0)
})
