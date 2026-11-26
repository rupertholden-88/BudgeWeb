const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
function load(path, dependencies = {}) {
  const module = { exports: {} }
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText)(module.exports, name => dependencies[name] ?? require(name))
  return module.exports
}
const models = load('src/lib/models.ts')
const { budgetShare } = load('src/lib/budgetShare.ts', { './models': models })
const now = new Date(2026, 10, 26, 10)
function fixture() {
  const data = models.defaultBudgetData()
  Object.assign(data, { nameNiamh: 'Sam', nameRupert: 'Robin', nameJoint: 'Household account', paydayNiamh: 26, paydayRupert: 15 })
  data.categories = [
    { owner: 'JOINT', type: 'EXPENSE', items: [
      { label: 'Council tax', amount: 100.01 },
      { label: 'May only', amount: 300, paymentMonths: [5] },
    ] },
    { owner: 'JOINT', type: 'SAVINGS', items: [{ label: 'Holiday saving', amount: 20.01 }] },
    { owner: 'NIAMH', type: 'EXPENSE', items: [
      { label: 'Broadband', amount: 12.01, sharedContribution: true, propertyId: 'home' },
      { label: 'Private spending', amount: 29.03 },
    ] },
    { owner: 'NIAMH', type: 'SAVINGS', items: [{ label: 'Personal saving', amount: 70.07 }] },
    { owner: 'RUPERT', type: 'INCOME', items: [{ label: 'Secret salary', amount: 99999 }] },
  ]
  data.debts = [
    { owner: 'JOINT', label: 'Car loan', monthlyPayment: 50.02, currentBalance: 123456 },
    { owner: 'NIAMH', label: 'Mortgage', monthlyPayment: 1000.05, sharedContribution: true, currentBalance: 234567 },
    { owner: 'NIAMH', label: 'Private loan', monthlyPayment: 25.99 },
  ]
  data.properties = [{ id: 'home', label: 'Our home', estimatedValue: 654321 }]
  data.oneOffs = [
    { id: 'hoover', owner: 'JOINT', label: 'Robot hoover', amount: 315, month: '2026-11', topUp: true, done: true },
    { owner: 'JOINT', label: 'Roof repair', amount: 500, month: '2026-11', fromSavings: true },
    { owner: 'RUPERT', label: 'Personal one-off', amount: 40, month: '2026-11' },
    { owner: 'JOINT', label: 'Old cost', amount: 600, month: '2026-10' },
    { owner: 'JOINT', label: 'Future cost', amount: 700, month: '2026-12' },
  ]
  return data
}

test('household message matches joint funding, includes direct shared bills and keeps savings-funded costs separate', () => {
  const data = fixture(), before = structuredClone(data)
  const { text } = budgetShare(data, false, now)
  assert.match(text, /November 2026 · household costs/)
  assert.match(text, /\*Household account\*/)
  assert.match(text, /Joint account needed: £486\n£243 each \(50\/50 split\)/)
  assert.match(text, /Robot hoover — £315 \(top-up marked done; included below\)/)
  assert.match(text, /26 Nov 2026 to 23 Dec 2026/)
  assert.match(text, /\*Sam pays directly\*/)
  assert.match(text, /Broadband \(Our home\) — £13/)
  assert.match(text, /Direct total: £1,013/)
  assert.match(text, /Total to fund from income: £1,498/)
  assert.match(text, /One-offs from savings \(outside the funding total\):\n• Roof repair — £500/)
  assert.match(text, /Also from savings: £500/)
  assert.doesNotMatch(text, /Private spending|Private loan|Personal saving|Personal one-off|Old cost|Future cost|May only/)
  assert.doesNotMatch(text, /Secret salary|99,999|123,456|234,567|654,321/)
  assert.deepEqual(data, before)
})

test('personal opt-in adds costs with each owner’s pay period, never income or balances', () => {
  const { text } = budgetShare(fixture(), true, now)
  assert.match(text, /November 2026 · all costs/)
  assert.match(text, /Private spending — £30/)
  assert.match(text, /Private loan — £26/)
  assert.match(text, /Personal saving — £71/)
  assert.match(text, /\*Robin pays directly\*/)
  assert.match(text, /13 Nov 2026 to 14 Dec 2026/) // Weekend payday moves to Friday.
  assert.match(text, /Personal one-off — £40/)
  assert.match(text, /Total to fund from income: £1,663/)
  assert.doesNotMatch(text, /Secret salary|99,999|123,456|234,567|654,321|Old cost|Future cost/)
})

test('selected-month bills are included in full only when charged, and an empty account shares neutrally', () => {
  const data = models.defaultBudgetData()
  data.categories = [{ owner: 'JOINT', type: 'EXPENSE', items: [{ label: 'Water', amount: 300, paymentMonths: [5, 11] }] }]
  assert.match(budgetShare(data, false, new Date(2026, 4, 1)).text, /Water — £300/)
  const empty = budgetShare(data, false, new Date(2026, 5, 1))
  assert.equal(empty.hasCosts, false)
  assert.doesNotMatch(empty.text, /Water|each|Person 1|Person 2/)
  assert.match(empty.text, /No costs recorded for this month/)
})
