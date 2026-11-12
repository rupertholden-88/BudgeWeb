const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const model = { exports: {} }
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/lib/models.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(model.exports, require)
const { defaultBudgetData, calcTotals, itemAmountForMonth } = model.exports

test('full bill is charged in May and November only, every year', () => {
  const item = { amount: 300, paymentMonths: [5, 11], paymentDay: 13 }
  for (const year of [2026, 2027]) {
    for (let month = 0; month < 12; month++) {
      assert.equal(itemAmountForMonth(item, new Date(year, month, 1)), [4, 10].includes(month) ? 300 : 0)
    }
  }
})
test('monthly legacy bills and switching back to monthly retain the full amount', () => {
  assert.equal(itemAmountForMonth({ amount: 75 }, new Date(2026, 3, 1)), 75)
})
test('joint transfer and remaining funds include selected-month bills without averaging', () => {
  const data = defaultBudgetData()
  data.categories = [
    { key: 'income', owner: 'NIAMH', type: 'INCOME', items: [{ amount: 1000 }] },
    { key: 'bills', owner: 'JOINT', type: 'EXPENSE', items: [{ amount: 300, paymentMonths: [5, 11] }, { amount: 100 }] },
  ]
  for (const [month, expected] of [[4, 100], [5, 400], [11, 400], [12, 100]]) {
    const totals = calcTotals(data, { now: new Date(2026, month - 1, 13) })
    assert.equal(totals.expJoint, expected)
    assert.equal(totals.halfJointExp, expected / 2)
    assert.equal(totals.net, 1000 - expected)
  }
  data.categories[1].owner = 'RUPERT'
  assert.equal(calcTotals(data, { now: new Date(2026, 4, 13) }).expR, 400)
})

const historyModule = { exports: {} }
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/lib/jointHistory.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(historyModule.exports, name => name === './models' ? model.exports : require(name))
test('12-month joint history preserves missing months and recorded zero, with full current funding', () => {
  const data = defaultBudgetData()
  data.categories = [{ key: 'joint', owner: 'JOINT', type: 'EXPENSE', items: [{ amount: 300, paymentMonths: [5, 11] }] },
    { key: 'saving', owner: 'JOINT', type: 'SAVINGS', items: [{ amount: 50 }] },
    { key: 'personal', owner: 'NIAMH', type: 'EXPENSE', items: [{ amount: 999 }] }]
  data.debts = [{ owner: 'JOINT', monthlyPayment: 100 }]
  data.oneOffs = [{ owner: 'JOINT', amount: 60, month: '2026-11', topUp: true }, { owner: 'JOINT', amount: 500, month: '2026-11', fromSavings: true }]
  data.spendHistory = [{ date: '2026-09', totalExp: 999 }, { date: '2026-10', jointRequired: 0 }]
  const rows = historyModule.exports.jointHistory(data, new Date(2026, 10, 12))
  assert.equal(rows.length, 12)
  assert.equal(rows[0].key, '2025-12')
  assert.equal(rows[9].amount, null)
  assert.equal(rows[10].amount, 0)
  assert.equal(rows[11].amount, 510)
})
