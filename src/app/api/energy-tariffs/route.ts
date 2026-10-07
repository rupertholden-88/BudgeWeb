import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
// Several searches and page fetches in one go — give it the most time Vercel's plan allows.
export const maxDuration = 60

const MODEL = 'claude-sonnet-5-5'
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
// $ per 1M tokens, plus web search at $10 per 1,000 searches. Web fetch has
// no per-use fee. Update alongside the health-check route if pricing changes.
const PRICE_PER_MILLION = { input: 2.0, output: 10.0 }
const USD_PER_SEARCH = 0.01
// A paused turn resumes server-side work; cap it so a run can't spiral.
const MAX_CONTINUATIONS = 3

export interface FuelRequest {
  fuel: 'electricity' | 'gas'
  twoRate: boolean
  annualUsageKwh: number
  nightUsageKwh: number | null
  current: { unitRatePExVat: number; nightRatePExVat: number | null; standingChargePExVat: number; fixedUntil: string | null; exitFee: number | null }
}

export interface TariffSearchRequest {
  postcodeArea: string
  today: string
  fuels: FuelRequest[]
}

function buildPrompt(req: TariffSearchRequest): string {
  return `You are helping a UK household check whether they could pay less for energy at one of their homes. Search the web for tariffs a new customer in postcode area ${req.postcodeArea} could sign up to today (${req.today}), and report what you find.

Their current setup (rates are as printed on their bill: pence, EXCLUDING 5% VAT):
${JSON.stringify(req.fuels, null, 2)}

How to search:
- UK energy prices differ by region, so prefer pages that give rates for this postcode area or its electricity region; say which region figures you used.
- Look at supplier tariff pages and reputable comparison or deal-tracking sites. Include the current Ofgem price cap (standard variable) rates for the region as one option, as the benchmark.
- ${req.fuels.some(f => f.twoRate) ? 'The electricity meter is two-rate (Economy 7 style): you need day AND night unit rates for electricity options, otherwise mark nightRateP null and say so in notes.' : 'The electricity meter is single-rate.'}
- Only quote rates you actually read on a page. Never estimate or invent a rate; if you can't find a figure, leave that option out.
- Aim for 3-6 options, favouring the cheapest credible ones, fixed and variable. Only include options covering the fuels listed above${req.fuels.length > 1 ? ' (dual fuel, or each fuel separately)' : ''}.

Reply with ONLY one JSON object, no markdown, in exactly this shape:
{
  "summary": "one or two sentences on what the market looks like for them right now",
  "regionNote": "which region's rates you used, or null",
  "options": [
    {
      "supplier": "name",
      "tariffName": "name as published",
      "type": "fixed" | "variable",
      "termMonths": number or null,
      "exitFeePerFuel": number in pounds or null,
      "electricity": { "unitRateP": number, "nightRateP": number or null, "standingChargeP": number } or null,
      "gas": { "unitRateP": number, "nightRateP": null, "standingChargeP": number } or null,
      "sourceUrl": "the page the rates came from",
      "notes": "anything that matters: eligibility, smart meter needed, bundled extras, region assumption" or null
    }
  ],
  "advice": "2-3 sentences: whether switching looks worth it given their fixed-deal end date and exit fees (they pay no exit fee in the last 49 days of a fixed deal), and what to do next",
  "caveats": ["short caveat", "..."]
}

All option rates must be in pence INCLUDING VAT, as consumers are normally quoted (unit rates p/kWh, standing charges p/day). If a page quotes ex-VAT, multiply by 1.05. Don't work out annual costs — the app calculates them from the rates.`
}

function joinText(content: Anthropic.Beta.BetaContentBlock[]): string {
  // Web search answers carry citations, which split the reply across several text blocks.
  return content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('')
}

function parseJson(raw: string): unknown | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { return null }
}

function isValidRequest(r: any): r is TariffSearchRequest {
  return r && typeof r.postcodeArea === 'string' && /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(r.postcodeArea.trim())
    && Array.isArray(r.fuels) && r.fuels.length > 0
}

export async function POST(req: NextRequest) {
  let request: TariffSearchRequest
  let apiKey: string
  try {
    const body = await req.json()
    request = body.request
    apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    if (!isValidRequest(request)) throw new Error('bad request')
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Add the first half of the postcode (e.g. NR21) and at least one tariff first.' }, { status: 400 })
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'not_configured', message: 'Add your own Anthropic API key in Settings to use this feature.' }, { status: 501 })
  }

  const client = new Anthropic({ apiKey })
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: 'web_search_20260209', name: 'web_search', max_uses: 5,
      user_location: { type: 'approximate', country: 'GB', timezone: 'Europe/London' },
    },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4, max_content_tokens: 10000 },
  ]
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: buildPrompt(request) }]
  const totals = { inputTokens: 0, outputTokens: 0, searches: 0 }
  const costUsd = () =>
    (totals.inputTokens / 1_000_000) * PRICE_PER_MILLION.input
    + (totals.outputTokens / 1_000_000) * PRICE_PER_MILLION.output
    + totals.searches * USD_PER_SEARCH

  let response: Anthropic.Beta.BetaMessage | null = null
  try {
    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      response = await client.beta.messages.stream({
        model: MODEL,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        // Searching and reading pages is the slow part; low effort keeps the
        // reasoning between them short so a run fits in the function limit.
        output_config: { effort: 'low' },
        tools,
        messages,
      }).finalMessage()
      // Cache writes bill at 1.25x input and reads at 0.1x — fold them in as input-equivalent tokens.
      totals.inputTokens += response.usage.input_tokens
        + 1.25 * (response.usage.cache_creation_input_tokens ?? 0)
        + 0.1 * (response.usage.cache_read_input_tokens ?? 0)
      totals.outputTokens += response.usage.output_tokens
      totals.searches += response.usage.server_tool_use?.web_search_requests ?? 0
      if (response.stop_reason !== 'pause_turn') break
      // Resume the server-side search loop: send the paused turn back as-is.
      messages.push({ role: 'assistant', content: response.content })
    }
  } catch (err) {
    const spent = { costUsd: costUsd(), searches: totals.searches }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'not_configured', message: 'Your Anthropic API key was rejected — check it in Settings.', detail: err.message, ...spent }, { status: 501 })
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'upstream_error', message: 'Rate limited — try again shortly.', ...spent }, { status: 429 })
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: 'upstream_error', message: `The search service returned an error (${err.status ?? 'unknown'}).`, detail: err.message, ...spent }, { status: 502 })
    }
    return NextResponse.json({ error: 'upstream_unreachable', message: 'Could not reach the search service — try again.', detail: err instanceof Error ? err.message : String(err), ...spent }, { status: 502 })
  }

  const spent = { costUsd: costUsd(), searches: totals.searches }
  if (!response || response.stop_reason === 'refusal') {
    return NextResponse.json({ error: 'refused', message: 'The search service declined this request.', ...spent }, { status: 502 })
  }
  if (response.stop_reason === 'pause_turn') {
    return NextResponse.json({ error: 'incomplete', message: "The search ran long and didn't finish — try again.", ...spent }, { status: 502 })
  }
  const raw = joinText(response.content)
  const parsed = parseJson(raw)
  if (parsed) return NextResponse.json({ result: parsed, ...spent })
  if (raw.trim()) return NextResponse.json({ result: null, rawText: raw, ...spent })
  return NextResponse.json({ error: 'empty_response', message: "Didn't get a usable answer — try again.", ...spent }, { status: 502 })
}
