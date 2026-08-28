import { NextRequest, NextResponse } from 'next/server'
import type { FinancialSummary } from '@/lib/financialSummary'

export const runtime = 'nodejs'

const MODEL = 'claude-sonnet-5'

function buildPrompt(summary: FinancialSummary): string {
  return `You are reviewing the household finances of a UK couple who share a budgeting app. Below is an anonymised numeric summary — no names, no account or provider details, currency is GBP. Assess their financial health compared with general, well-established UK personal-finance guidelines (e.g. typical savings-rate targets, a 3–6 month emergency fund, pension contribution norms, and reasonable debt costs) — not a real individualised peer database, since you don't have access to one. Be specific and reference their actual figures rather than writing generically. Where something is a genuine strength, say so plainly; don't manufacture a concern to seem balanced.

Household summary (monthly figures unless stated):
${JSON.stringify(summary, null, 2)}

Reply with ONLY a single JSON object, no markdown fences, no commentary outside it, matching exactly this shape:
{
  "headline": "a short, specific one-line verdict (max ~8 words), not generic",
  "status": "strong" | "solid" | "attention" | "at_risk",
  "summary": "2-3 sentences, second person ('you'/'your'), referencing real numbers from the data",
  "benchmarks": [
    { "metric": "short metric name", "yours": "their value as a short string e.g. '9%' or '7.1 months'", "typical": "the general guideline range as a short string", "status": "strong" | "solid" | "attention" | "at_risk" }
  ],
  "strengths": ["short specific strength", "..."],
  "watchouts": ["short specific thing worth addressing, with a concrete suggestion where possible", "..."]
}

Include 3-5 benchmark rows covering whichever of these are answerable from the data: savings rate, emergency runway, debt cost vs savings interest, pension provision, upcoming 0% expiries. Omit strengths or watchouts arrays' entries you can't honestly support from the data — 1-4 items each is fine. Do not recommend specific financial products, providers, or investments; keep suggestions to general actions (e.g. "consider shopping around before the 0% ends", "your emergency fund is below the typical 3-month minimum").`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'not_configured', message: 'ANTHROPIC_API_KEY is not set on the server.' },
      { status: 501 }
    )
  }

  let summary: FinancialSummary
  try {
    const body = await req.json()
    summary = body.summary
    if (!summary || typeof summary !== 'object') throw new Error('missing summary')
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Missing or invalid summary payload.' }, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1400,
        messages: [{ role: 'user', content: buildPrompt(summary) }],
      }),
    })
  } catch {
    return NextResponse.json({ error: 'upstream_unreachable', message: 'Could not reach the assessment service.' }, { status: 502 })
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return NextResponse.json(
      { error: 'upstream_error', message: `Assessment service returned ${upstream.status}.`, detail: text.slice(0, 500) },
      { status: 502 }
    )
  }

  const data = await upstream.json()
  const raw: string = data?.content?.[0]?.text ?? ''

  // Model was asked for bare JSON; strip fences defensively if it added them anyway.
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  try {
    if (start === -1 || end === -1) throw new Error('no JSON object found')
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return NextResponse.json({ result: parsed })
  } catch {
    // Fall back to raw text so the UI can still show something rather than a hard error.
    return NextResponse.json({ result: null, rawText: raw })
  }
}
