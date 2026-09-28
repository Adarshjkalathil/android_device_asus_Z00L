# Margin Watch

Live WIP, margin and cash control for home builders. Working demo for the
Adelaide Construction AI Playbook (`../index.html`).

## Files

- `engine.js` — pure JavaScript engine (no DOM): synthetic data generator,
  CSV import with flexible column matching (including Xero line-level bill
  exports), WIP / margin / leakage analysis, 13-week cash forecast,
  business-health indicators and supplier-bill checks. Runs in Node:
  `node -e 'const MW=require("./engine.js"); console.log(MW.analyse(MW.generate()).totals)'`
- `app.html` — the user interface. AI features call Claude through the
  artifact `sample` capability; file saves use `downloads`.
- `build.py` — inlines `engine.js` into `app.html` to produce `index.html`.
- `index.html` — the built, published page.
- `sample-data/` — the eight demo tables as CSV (fictional builder, 60 jobs).
  Use them as templates for a real builder's exports.

## Using real data

Export the eight tables (jobs, schedule, estimate, purchase orders, supplier
bills, variations, stage claims, site notes) as CSV and drop them on the
"Your data" tab. Files are read in the browser only. Keep all amounts
consistently ex-GST.

Build: `python3 build.py`
