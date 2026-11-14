# Product

## Register

product

## Users

People managing their personal or shared household finances. They are not financial professionals; they want to understand where their money goes without it feeling like a chore. Different users have different names, household arrangements, payment responsibilities, providers, properties, accounts and financial goals. They use Budge on phones, tablets and computers in brief, everyday sessions.

## Product Purpose

Budge helps people record and understand income, spending, savings, investments, debts and household commitments. Shared finances should make clear who pays, what a shared account needs and what each person has available. Success means users can understand their position quickly, make informed plans and keep their records current.

## Product Direction: Reusable Throughout

Every feature must be usable by people beyond the original household. This applies to the entire app: onboarding, default data, labels, settings, calculations, reminders, charts, editing and account history. A request from one household is an example of a wider need, not a reason to embed that household's details in the product.

- Names, providers, properties, account labels, payment dates and schedules come from user data or configuration. Do not hard-code a person's lender, pension provider, employer, bill dates or balances into shared behaviour.
- Use configured display names and neutral empty-state labels. Keep illustrative data clearly identified and separate from real account data.
- Keep ownership, the person or account actually paying, and contribution rules distinct. Explain the split used in a calculation; do not invent flexible splits or support for household arrangements that the app does not yet implement.
- Support missing information, optional features and differing numbers of financial records. Do not assume everyone has a partner, property, mortgage, pension, fixed-rate deal or the same number of accounts.
- Scope account-specific setup, history links and migrations to the relevant account. Preserve valid data and saved links through renames and updates.
- Keep financial assumptions, calculation dates and locale-specific rules explicit. Unknown inputs must not silently become zero or a household-specific default.
- New functionality must fit the existing storage and calculations safely. Maintain backward compatibility or provide a deliberate migration.

The current data model supports two personal owner slots and a joint slot, with a 50/50 joint contribution calculation. These are current implementation constraints, not a reason to make new features bespoke to the original users, nor evidence that arbitrary household sizes or contribution splits are already supported. Broader support should be implemented deliberately across the affected flows.

## Brand Personality

Calm, domestic, personal. The voice of a well-kept shared notebook, not a fintech dashboard. Warm but not twee. Confident without being authoritative.

## Anti-references

- No gamification: no streaks, badges, XP, or reward loops. Progress is its own reward.
- Not a generic productivity app: no Notion-style infinite canvas, no task-management metaphors, no "workspace" framing. This is a household tool, not a workspace.

## Design Principles

1. **Human and approachable** — Design for everyday people using their own financial information. Keep the experience warm and practical while making behaviour reusable across users.
2. **The numbers serve the people** — Data appears when it's useful and steps back when it isn't. No metric-dense layouts, no dashboard-for-its-own-sake. Every chart earns its screen time.
3. **Shared without friction** — Clear ownership and payment responsibility, using each household's configured labels, are central to the product. It should feel as natural as saying "that's yours, this is mine, and here's ours" — not like a permission system.
4. **Calm as the default register** — Financial anxiety is real. Nothing should flash, pulse, badge, or urgently demand attention. The interface is a quiet place to get clear on money.
5. **Domestic familiarity** — Reach for the language and feel of a shared household first. Bank language and fintech conventions are a last resort, not a default.

## Accessibility & Inclusion

Best effort: fix obvious issues (missing labels, broken keyboard navigation, low-contrast text on coloured backgrounds). No formal WCAG level target, but owner colours must maintain readable contrast against both light and dark surface tokens.
