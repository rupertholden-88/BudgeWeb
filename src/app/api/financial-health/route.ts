import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { FinancialSummary } from '@/lib/financialSummary'

export const runtime = 'nodejs'
// A detailed, high-effort report with adaptive thinking can take well over
// Vercel's default function duration to generate — raise the ceiling.
export const maxDuration = 60

// User's choice — Sonnet 5 for a good cost/quality balance on this task.
const MODEL = 'claude-sonnet-5'

// $ per 1M tokens, first-party API rates. Update if the model or its
// pricing changes — there's no live pricing endpoint to read this from.
const PRICE_PER_MILLION = { input: 2.0, output: 10.0 }

function estimateCostUsd(usage: Anthropic.Usage) {
  const costUsd = (usage.input_tokens / 1_000_000) * PRICE_PER_MILLION.input
    + (usage.output_tokens / 1_000_000) * PRICE_PER_MILLION.output
  return { costUsd, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
}

function buildPrompt(summary: FinancialSummary): string {
  return `You are writing a detailed financial health review for a UK couple who share a budgeting app. Below is an anonymised numeric summary — no names, no account or provider details, currency is GBP. Assess their financial health compared with general, well-established UK personal-finance guidelines (e.g. typical savings-rate targets, a 3–6 month emergency fund, pension contribution norms, and reasonable debt costs) — not a real individualised peer database, since you don't have access to one. Be specific and reference their actual figures throughout rather than writing generically. Where something is a genuine strength, say so plainly; don't manufacture a concern to seem balanced, and don't pad a section with filler if there's little to say.

Household summary (monthly figures unless stated; debts and renewals include per-item detail):
${JSON.stringify(summary, null, 2)}

Reply with ONLY a single JSON object, no markdown fences, no commentary outside it, matching exactly this shape:
{
  "headline": "a short, specific one-line verdict (max ~8 words), not generic",
  "status": "strong" | "solid" | "attention" | "at_risk",
  "overview": "3-5 sentences setting the overall scene, second person ('you'/'your'), referencing real numbers",
  "sections": [
    { "title": "topic name", "body": "2-5 sentences of specific, numbers-grounded analysis for this topic", "status": "strong" | "solid" | "attention" | "at_risk" }
  ],
  "benchmarks": [
    { "metric": "short metric name", "yours": "their value as a short string e.g. '9%' or '7.1 months'", "typical": "the general guideline range as a short string", "status": "strong" | "solid" | "attention" | "at_risk" }
  ],
  "strengths": ["short specific strength", "..."],
  "priorityActions": ["a concrete, specific next step with the reasoning built into the sentence, ranked most impactful first", "..."]
}

For "sections", cover whichever of these topics the data actually supports — typically 4-7 sections, skip a topic entirely rather than stretching thin: Income & cash flow, Emergency fund & runway, Debt (comment on individual debts by name/type where there's more than one, especially any 0% card nearing expiry or any payment too small to clear the interest), Savings & investments (comment on asset mix, not just the total), Pensions & retirement provision, Fairness of the joint-cost split between the two earners, Upcoming renewals (name the specific categories renewing soon and what's at stake). Include 3-6 benchmark rows. 2-5 priority actions, ordered by impact, each specific enough to act on today. Do not recommend specific financial products, providers, or investments; keep suggestions to general actions (e.g. "consider shopping around before the 0% ends", "your emergency fund is below the typical 3-month minimum").`
}

/** First text block in a response — thinking blocks (on by default) come before it. */
function extractText(content: Anthropic.ContentBlock[]): string {
  const block = content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  return block?.text ?? ''
}

function parseAssessment(raw: string): unknown | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let summary: FinancialSummary
  let apiKey: string
  try {
    const body = await req.json()
    summary = body.summary
    apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    if (!summary || typeof summary !== 'object') throw new Error('missing summary')
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Missing or invalid summary payload.' }, { status: 400 })
  }

  // No server-wide key — each person brings their own, tied to their own
  // account, so one person's usage is never billed to someone else's key.
  if (!apiKey) {
    return NextResponse.json(
      { error: 'not_configured', message: 'Add your own Anthropic API key in Settings to use this feature.' },
      { status: 501 }
    )
  }

  const client = new Anthropic({ apiKey })

  let response: Anthropic.Message
  try {
    // Streamed internally rather than a single blocking create() call — a
    // long non-streamed request risks the underlying connection timing out
    // before Anthropic finishes, independent of Vercel's own function limit.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      // A genuinely detailed, sectioned review needs more synthesis across
      // more figures than the earlier few-bullet version — worth the step up.
      output_config: { effort: 'high' },
      messages: [{ role: 'user', content: buildPrompt(summary) }],
    })
    response = await stream.finalMessage()
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'not_configured', message: 'Your Anthropic API key was rejected — check it in Settings.' },
        { status: 501 }
      )
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'upstream_error', message: 'Rate limited by the assessment service — try again shortly.' }, { status: 429 })
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: 'upstream_error', message: `Assessment service returned an error (${err.status ?? 'unknown'}).`, detail: err.message },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { error: 'upstream_unreachable', message: 'Could not reach the assessment service — check your connection and try again.', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    )
  }

  try {
    // From here on the request definitely reached Anthropic and has real usage
    // to report, even on a refusal or an empty/unparseable reply — include it
    // on every branch rather than only when there's a result to show.
    const usage = estimateCostUsd(response.usage)

    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'refused', message: 'The assessment service declined to respond to this request.', ...usage },
        { status: 502 }
      )
    }

    const raw = extractText(response.content)
    const parsed = parseAssessment(raw)

    if (parsed) return NextResponse.json({ result: parsed, ...usage })
    if (raw.trim()) return NextResponse.json({ result: null, rawText: raw, ...usage })

    // No text block at all (e.g. stopped mid-thinking) — nothing useful to show,
    // but it was still a billed request, so still report what it cost.
    return NextResponse.json(
      { error: 'empty_response', message: "Didn't get a usable response — try again.", ...usage },
      { status: 502 }
    )
  } catch (err) {
    // Belt and braces: any unexpected failure here still returns clean JSON
    // rather than a bare 500 the client can't extract a message from.
    return NextResponse.json(
      { error: 'internal_error', message: 'Something went wrong processing the response — try again.', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
