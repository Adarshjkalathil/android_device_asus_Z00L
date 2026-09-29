# Adelaide Construction AI: session context

Condensed record of the Claude session (28–29 Sep 2026). Paste or attach this file at the start of a new chat to carry on from where we stopped.

## 1. Goal

Find out how to speed up the Adelaide construction industry and save builders money by integrating existing AI into their businesses. Then decide which products to build, build a demo a builder would pay for, and research it more deeply (papers, industry and government reports, grants, events). The end goal is a demo I can sell and implement once I have a builder's real data.

## 2. Deliverables so far

| Item | Where |
|---|---|
| Playbook (research + strategy, revision B) | Online: https://claude.ai/artifact/Up9un6ji9PHviFHrQ58Zrg · Local: `1 - Adelaide Construction AI Playbook.html` |
| Margin Watch demo app (v4) | Online (AI features work here): https://claude.ai/artifact/7nSi5TBkzgVFK5ieN35ZtS · Local: `2 - Margin Watch (demo app).html` |
| Source code | GitHub `adarshjkalathil/android_device_asus_Z00L`, branch `ccr-5bc76a6b-a2re48`, folder `docs/adelaide-construction-ai/` (also `source/` in the Desktop folder) |
| Sample data | 8 CSVs in `Sample data (CSV)` / `margin-watch/sample-data/` |
| Research PDFs | Building 4.0 CRC Project 80 insolvency report (2025); SA Seed-Start guidelines (Nov 2025) |

Both online links are private until shared from the page's Share menu.

## 3. Key market facts (Adelaide / SA)

- **Volume:** 15,308 dwellings approved in the 12 months to July 2026 (40-year high). 14,130 completions in the year to March 2026, against the state target of 13,500 a year. SA construction work done up 11.5% year on year (June qtr 2026, $5.61bn) vs 2.7% nationally.
- **Constraint is capacity:**
  - Adelaide HIA trade availability index was −0.79 in the June qtr 2026 (−1.33 in March). Bricklaying, tiling, roofing and carpentry are worst.
  - Trade prices rose 5.1% in H1 2026. RLB forecasts Adelaide tender prices +5.1% in 2026.
  - An SA home takes 13.7 months from approval to completion (+74% vs 2014).
- **Workforce:** about 90,000 workers and 27,600 businesses; about 20,000 more workers needed over 5 years. Housing construction labour productivity is down 12% over 30 years (Productivity Commission 2025).
- **Megaprojects competing for labour:**
  - Osborne submarine yard: $8.5bn, construction started Sep 2026, ~4,000 workers at peak.
  - T2D tunnels: $15.4bn (John Holland / Bouygues / Arcadis / Jacobs / Ventia).
  - New Women's and Children's Hospital: $3.2bn (Lendlease, completing 2031).
  - SA 2026-27 budget: $29.1bn infrastructure program over four years.
- **Land and policy:**
  - Land releases for 23,700+ homes (Onkaparinga Heights, Sellicks, Dry Creek, Concordia); water mains delay most of them to 2028 or later.
  - $500m land purchase fund, $500m apartment underwriting, stamp duty cut for downsizers aged 60+.
  - SA Housing Trust prefab tender for 120 homes.
  - PlanSA AI assesses detached dwellings in master-planned zones in minutes (vs 9.5 business days).
- **Failures and regulation:**
  - Qattro (2023, 200+ jobs, $110m), Adelaide Designer Homes (2024), JAC Homes (Jan 2025).
  - About 3,500 construction insolvencies nationally in FY25.
  - Since 15 Jan 2026, penalties reach $550k for companies, and engaging unlicensed subcontractors is an offence.
  - Building indemnity insurance minimum cover is now $250k; the threshold rose to $20k.
  - NCC 7-star and livable housing standards apply from 1 Oct 2024.
- **Builders:**
  - Volume builders: Hickinbotham (1,507 starts; uses ClickHome), Metricon/Fairmont, Longridge, Rivergum, Metro Homes, Weeks (markets a "30 week build"), Dechellis, Sterling, Simonds, Scott Salisbury (custom).
  - Housing 100 builders do only 40% of SA starts, so mid-size builders are the sweet spot.
  - Commercial: Hansen Yuncken, Badge, Mossop, Kennett, Sarah Group, Ahrens, McMahon, Leed and others.
- **AI adoption:** 46% of surveyed firms use AI tools, but only 16% have advanced digital capability and a quarter are still paper-based (Deloitte 2026). The gap is integration with existing systems (ClickHome, Databuild, Xero, spreadsheets) and SA rules.

## 4. Product decisions

Eight product ideas share one data layer:

1. **Margin Watch** (FLAGSHIP, built)
2. SiteVoice: supervisor voice diary and homeowner updates (add-on)
3. Sub Check: licence and insurance compliance (cheap entry product)
4. Trade Flow: delay risk and trade booking
5. Precon Desk: lot check against the Planning and Design Code, document chaser
6. Plan to Price: AI takeoff (partner with an existing tool, don't build the model)
7. Tender Reader: for commercial builders
8. Site Vision: photo QA and safety (partner, later)

Revision A of the playbook led with SiteVoice. After three research rounds, **Margin Watch became the lead** because the evidence of willingness to pay was strongest.

**Why Margin Watch:**
- Cash flow is the most cited cause of construction insolvency (16–20% of ASIC cases).
- The Building 4.0 CRC study calls for early-warning and traffic-light tools; builder margins run around 5%.
- Builders already pay fractional CFOs $3k–$8k a month for WIP and cash forecasting.
- US comparable Adaptive raised US$30m (Sep 2026) and has 750+ contractor customers.

**Suggested pricing (ex GST):**

| Plan | Price |
|---|---|
| 6-week pilot on exports | $7,500 (credited) |
| Starter (≤25 active jobs) | $990/mo |
| Growth (≤100 jobs) | $1,990/mo |
| Volume (≤300 jobs) | $3,900/mo |
| Onboarding | $5k–$15k |

These prices are unvalidated: test them in 10 builder interviews.

## 5. Margin Watch demo (v4): how it works

**Screens:**
- Overview: 7 business-health traffic lights, "Do this week" list, owner brief.
- WIP schedule, with job drill-down.
- Money leaks.
- Check a bill.
- 13-week cash forecast, with BAS and an "act now vs nothing changes" scenario.
- Ask.
- Your data: CSV import and templates.
- Method: editable settings, rules and evidence.

**Engine (`engine.js`, pure JS):**
- Forecast cost per cost code:
  - stage done → max(ordered, billed);
  - trade ordered → max(ordered, billed);
  - otherwise → budget plus a price-rise allowance (8%/yr, pro-rated to the stage date).
- % complete uses cost to date over forecast cost (cost-to-cost). Over/(under) billing = billed − earned.
- Checks:
  - claims not sent, overdue payments;
  - signed variations not invoiced, variations awaiting signature;
  - bills above PO, duplicate bills, supplier bills past due, bills without a PO, codes over budget;
  - extra work in site notes (keyword rules, or Claude).
- Cash forecast: claims at forecast stage date + 7 days; supplier costs paid end of the following month; overheads; BAS on 28 Oct.

**Demo results (fictional 60-job builder):**
- $23.75m WIP; margin 14.5% → 12.1% ($589k lost).
- $800k cash to collect now; $44k overcharges to stop; 9 unpriced extras.
- Cash goes negative in the week of 26 Oct if nothing changes.

**AI features:**
- They use the artifact `sample` capability: owner brief, explain job, site-note scan (JSON), drafts, Ask (with tools), bill reading (text or photo).
- They were only tested via their fallbacks, not live with Claude yet.
- Local copies show "Claude isn't available" for these buttons; everything else works.

**Real data:**
- The builder drops 8 CSVs: jobs, stages, budget, purchase_orders, supplier_invoices, variations, claims, site_notes.
- Column names are matched flexibly, and Australian day/month/year dates are handled.
- Xero line-level bill exports load directly: tracking option → job, Reference → PO, lines merged.
- Files stay in the browser. Keep amounts consistently ex-GST.

**Build:** `python3 build.py` inlines `engine.js` into `app.html` to produce `index.html`.

## 6. Research rounds (what changed)

| Round | Findings | Demo change |
|---|---|---|
| 1 | ASIC failure causes; CRC Project 80; SA deposit cap 5% and claims only for work done; BAS due 28 Oct / 28 Feb / 28 Apr / 28 Jul; NLP research on construction logs | v2: health panel, late supplier bills check, BAS in cash forecast, evidence on the Method tab |
| 2 | Adaptive (US$57m raised, 750+ customers); fractional CFO $3k–$8k/mo; AU software $79–$522/mo, Premier ERP from $349/user/mo; AI construction startups US$616m in H1 2026 | v3: "Check a bill" (supplier bill processing is what builders already pay for) |
| 3 | Xero developer tiers (Starter free up to 5 connections, Core $35, Plus $245, Advanced $1,445/mo; certification required); Xero prohibits using API data to train or build AI models (from 2 Mar 2026); ClickHome API/Zapier; OAIC AI privacy guidance (Oct 2024) | v4: Xero import, go-live guide, data-handling section |

## 7. Funding and events

**Funding:**
- **SA Seed-Start:**
  - Seed Grant: $50k–$100k at 2:1 (government:you).
  - Start Grant: over $100k up to $500k at 1:1.
  - Conditions: SA-based, turnover under $1m, cash match only.
  - Grants over $100k are repaid by a 3% royalty on revenue.
  - Process: EOI, then full application.
- **Industry Growth Program:** $50k–$250k early-stage grants, matched 1:1. Starts with an advisory session; "enabling capabilities" is the likely priority-area fit.
- **R&D Tax Incentive:** company tax rate + 18.5% refundable offset (under $20m turnover). From 1 Jul 2028: threshold $50m, minimum spend $50k, supporting R&D removed.
- **AIML Industrial AI SME program:** access to ML engineers, in kind (no cash).
- **SA $50m R&D Productivity Fund:** details still emerging.

**Events:**

| Date | Event | Place |
|---|---|---|
| 28–29 Oct 2026 | Construction Technology Leaders Summit | Sydney |
| 14 Nov 2026 | HIA SA Housing Awards | Adelaide Convention Centre |
| Ongoing | Stone & Chalk startup hub events | Lot Fourteen |
| 17–18 Mar 2027 | SOUTHSTART | Adelaide |
| May each year | SA Major Projects Conference | Adelaide |
| 11–12 May 2027 | FCON27 Future of Construction Summit | Brisbane |
| Annual | MBA SA Building Excellence Awards | Adelaide |

## 8. Risks and rules to respect

- **Scraping:** prefer open data (data.sa.gov.au P&D Code layers, ABS, BOM). Use a builder's plans only in their own private demo. Don't build homeowner lead lists from the development application register.
- **Privacy:** follow the Australian Privacy Principles. Automated-decision disclosure is required from 10 Dec 2026. Host in Australia, keep one database per builder, never train on customer data.
- **Xero:** its AI rule means the engine stays rules-based, only request-time excerpts go to the LLM, and no embeddings of Xero data are stored. Confirm with Xero during certification.
- **AI accuracy:** outputs are drafts; a person approves. Never certify compliance.

## 9. Next steps

1. Click through every Claude button in the online demo once.
2. Run 10 discovery interviews. Questions:
   - Who makes the WIP report today, and what does it cost?
   - Where do variations live?
   - Which accounting system do they use?
   - How many days from stage completion to claim?
   - Would they pay $990–$3,900 a month?
3. Personalise the demo for the top 10 prospects: Rivergum, Metro Homes, Longridge, Weeks, Sterling, Dechellis, Simonds, Scott Salisbury, regional builders.
4. Sign one 6-week pilot on exports, then submit a Seed-Start EOI and book an IGP advisory session.
5. Build connectors: Xero app certification (Starter tier for pilots), ClickHome API, estimating exports.
6. Later: add SiteVoice and Sub Check for existing customers, then Tender Reader for commercial builders.
