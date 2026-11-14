const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const modules = {}
function load(name) {
  if (modules[name]) return modules[name]
  const output = ts.transpileModule(fs.readFileSync(`src/lib/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const mod = { exports: {} }; new Function('exports', 'require', output)(mod.exports, dependency => load(dependency.replace('./','')))
  return modules[name] = mod.exports
}
const m = load('mortgage'), { defaultBudgetData } = load('models')
const today = new Date(2026, 10, 14)
const debt = () => ({ id:'m', label:'Mortgage', type:'MORTGAGE', owner:'JOINT', currentBalance:200000, monthlyPayment:1211.96, interestRate:4, isZeroPercent:false, mortgage:{ repaymentType:'repayment', maturityDate:'2046-11-14', dealEnds:'2027-11-14', balanceDate:'2026-11-14', rateType:'fixed' } })
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .01, `${actual} != ${expected}`)
test('repayment amortisation, 0% and interest-only do not share a payoff formula', () => {
  near(m.mortgagePayment(200000,4,240,'repayment'),1211.96)
  near(m.mortgagePayment(200000,5,240,'repayment'),1319.91)
  near(m.mortgagePayment(200000,0,240,'repayment'),833.3333)
  near(m.mortgagePayment(200000,4,240,'interestOnly'),666.6667)
  assert.equal(m.mortgagePayment(200000,-1,240,'repayment'),null)
  assert.equal(m.mortgagePayment(200000,4,0,'repayment'),null)
})
test('renewal uses projected principal and remaining term instead of today principal', () => {
  const d = debt(), s = m.mortgageScenario(d,5,'renewal',today)
  assert.equal(s.error,null); assert.equal(s.months,228)
  assert.ok(s.balance < d.currentBalance)
  near(s.balance,m.projectedBalance(200000,4,1211.96,12))
  near(s.payment,m.mortgagePayment(s.balance,5,228,'repayment'))
})
test('missing, invalid, expired and unknown-rate inputs return a reason', () => {
  const d = debt()
  assert.ok(m.mortgageScenario({...d,mortgage:{}},5,'today',today).error)
  assert.ok(m.mortgageScenario({...d,interestRate:0},5,'today',today).error)
  assert.equal(m.mortgageScenario({...d,interestRate:0,mortgage:{...d.mortgage,rateConfirmed:true}},0,'today',today).error,null)
  assert.ok(m.mortgageScenario({...d,mortgage:{...d.mortgage,dealEnds:'2025-01-01'}},5,'renewal',today).error)
  assert.ok(m.mortgageScenario({...d,mortgage:{...d.mortgage,dealEnds:d.mortgage.maturityDate}},5,'renewal',today).error)
  assert.ok(m.mortgageScenario({...d,monthlyPayment:100},5,'renewal',today).error)
  assert.equal(m.localDate('2026-02-31'),null)
  assert.ok(m.mortgageScenario(d,NaN,'today',today).error)
})
test('interest-only capital remains; zero and fully repaid balances are safe', () => {
  const d={...debt(),monthlyPayment:200000*4/1200,mortgage:{...debt().mortgage,repaymentType:'interestOnly'}}
  const s=m.mortgageScenario(d,5,'renewal',today)
  near(s.balance,200000); near(s.payment,833.3333)
  assert.ok(m.mortgageScenario({...d,monthlyPayment:0},5,'renewal',today).error)
  assert.equal(m.projectedBalance(100,0,200,1),0)
  assert.equal(m.mortgagePayment(0,4,240,'repayment'),0)
})
test('joint and personal impact respects the payer without saving scenarios', () => {
  const data=defaultBudgetData();data.debts=[debt()]
  const before=JSON.stringify(data)
  let impact=m.mortgageImpact(data,'m',1411.96)
  near(impact.jointAfter-impact.jointBefore,200)
  near((impact.jointAfter-impact.jointBefore)/2,100)
  assert.equal(JSON.stringify(data),before)
  data.debts[0].owner='RUPERT'; data.debts[0].sharedContribution=true
  impact=m.mortgageImpact(data,'m',1411.96)
  near(impact.jointAfter-impact.jointBefore,0)
  near(impact.after.netR-impact.before.netR,-200)
})
test('review window clamps calendar dates and ignores fully repaid mortgages', () => {
  const data=defaultBudgetData();data.debts=[{...debt(),mortgage:{dealEnds:'2027-08-31'}}]
  const [review]=m.mortgageReviews(data,new Date(2027,1,28))
  assert.equal(review.reviewFrom,'2027-02-28');assert.equal(review.stage,'review')
  assert.equal(m.mortgageReviews(data,new Date(2027,8,1))[0].stage,'ended')
  data.debts[0].currentBalance=0;assert.equal(m.mortgageReviews(data,today).length,0)
})
