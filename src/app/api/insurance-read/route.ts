import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Reads insurance documents (PDF or photos) once and returns the details found.
// Nothing is stored here: the files only exist for the length of this request.
export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'claude-sonnet-5-5'
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
const PRICE_PER_MILLION = { input: 2.0, output: 10.0 }
const MAX_FILES = 6

import { FIELD_KEYS, KIND_VALUES, type ReadFile, type ReadResult } from '@/lib/insuranceRead'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isInsurance', 'kind', 'documents', 'fields', 'notes'],
  properties: {
    isInsurance: { type: 'boolean', description: 'false if none of the documents are an insurance schedule, certificate, renewal or statement of fact for a specific person' },
    kind: { type: 'string', enum: KIND_VALUES },
    documents: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['schedule', 'renewal', 'certificate', 'statement_of_fact', 'wording', 'other'] },
        },
      },
    },
    fields: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['key', 'value', 'confidence', 'source'],
        properties: {
          key: { type: 'string', enum: FIELD_KEYS },
          value: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] },
          source: { type: 'string', description: 'where it was read, e.g. "p.1", "Schedule p.2", "certificate"' },
        },
      },
    },
    notes: { type: 'array', items: { type: 'string' }, description: 'short notes for the user, e.g. a page that could not be read' },
  },
} as const

const PROMPT = `These are a UK household's insurance documents (policy schedule, renewal letter, certificate or statement of fact; photos or PDFs). Read them and report the policy's details so they can be saved in the household's budgeting app.

Rules:
- Only report what the documents actually say. Never guess or fill in typical values. Leave a field out if it isn't there.
- confidence "high" when the value is printed clearly; "low" when it's blurred, cut off, ambiguous, or you had to choose between two figures. The person checks low ones.
- If the documents cover two policies or years, report the most recent policy period and say so in notes.
- A policy wording booklet with no personal details isn't enough: set isInsurance false if there's no schedule, certificate, renewal or statement of fact.

What to report for insurer: the insurer's short everyday name as a person would say it (e.g. "AXA", "Aviva", "Admiral"), not the legal entity, underwriter or broker.

Formats for value:
- Dates: YYYY-MM-DD. endDate is the last day of cover or the renewal date.
- Money: a plain number in pounds, no £ or commas, e.g. 612.40. For a sum insured with no limit, write "unlimited".
- premiumAnnual is the yearly price. premiumMonthly is the monthly instalment if paying monthly. paymentFrequency is "monthly" or "annual".
- Yes/no fields (autoRenews, ncdProtected, secondHomeDeclared, inTrust, homeEmergency, legalExpenses, courtesyCar): "yes" or "no".
- accidentalDamage: "none", "buildings", "contents" or "both". coverLevel: "comprehensive", "third party, fire and theft" or "third party only". breakdown: "none", "roadside", "at home", "national" or "european". coverType: "level" or "decreasing".
- unoccupiedDays and ncdYears: whole numbers.
- namedDrivers, policyholders, livesCovered, covers and exclusions: comma-separated. covers lists the main cover and add-ons in a few words each (e.g. "Buildings, Contents, Accidental damage, Home emergency").
- reg: as printed, upper case. postcode: the full postcode of the insured address.`

function isFiles(f: any): f is ReadFile[] {
  return Array.isArray(f) && f.length > 0 && f.length <= MAX_FILES && f.every(x =>
    x && typeof x.name === 'string' && typeof x.data === 'string' && typeof x.mediaType === 'string'
    && /^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(x.mediaType))
}

export async function POST(req: NextRequest) {
  let files: ReadFile[]
  let apiKey: string
  try {
    const body = await req.json()
    files = body.files
    apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    if (!isFiles(files)) throw new Error('bad files')
  } catch {
    return NextResponse.json({ error: 'bad_request', message: `Add between 1 and ${MAX_FILES} PDFs or photos (JPG or PNG).` }, { status: 400 })
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'not_configured', message: 'Reading documents uses your Anthropic API key. Add one in Settings.' }, { status: 501 })
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  for (const f of files) {
    content.push({ type: 'text', text: `Document: ${f.name}` })
    content.push(f.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: f.data } })
  }
  content.push({ type: 'text', text: PROMPT })

  const client = new Anthropic({ apiKey })
  try {
    const response = await client.beta.messages.stream({
      model: MODEL,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }],
    }).finalMessage()

    const costUsd = (response.usage.input_tokens / 1_000_000) * PRICE_PER_MILLION.input
      + (response.usage.output_tokens / 1_000_000) * PRICE_PER_MILLION.output
    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'refused', message: 'These documents couldn’t be read. Try the policy schedule or renewal letter.', costUsd }, { status: 422 })
    }
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('')
    let result: ReadResult
    try { result = JSON.parse(text) } catch {
      return NextResponse.json({ error: 'unreadable', message: 'Couldn’t make sense of these documents. Try a clearer photo or the PDF.', costUsd }, { status: 422 })
    }
    return NextResponse.json({ result, costUsd })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'bad_key', message: 'Your API key wasn’t accepted. Check it in Settings.' }, { status: 401 })
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'rate_limited', message: 'Too many requests just now. Try again in a minute.' }, { status: 429 })
    }
    if (e instanceof Anthropic.BadRequestError) {
      const msg = /credit|billing/i.test(e.message) ? 'Your Anthropic account is out of credit.' : 'These files couldn’t be sent. A PDF may be password-protected, or a file too large.'
      return NextResponse.json({ error: 'bad_request', message: msg, detail: e.message }, { status: 400 })
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: 'api_error', message: 'Anthropic’s service had a problem. Try again shortly.', detail: e.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'network', message: 'Couldn’t reach Anthropic. Check your connection and try again.' }, { status: 502 })
  }
}
