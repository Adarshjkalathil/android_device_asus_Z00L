/* Margin Watch engine: synthetic data, CSV import, WIP / margin / leakage / cash analysis.
   Pure functions, no DOM. Works in the browser (window.MW) and in Node (module.exports). */
var MW = (function () {
  "use strict";

  var AS_AT = "2026-09-28";
  var DAY = 86400000;

  // ---------- dates ----------
  function D(s) { return Date.parse(s + "T00:00:00Z"); }
  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(s, n) { return iso(D(s) + Math.round(n) * DAY); }
  function daysBetween(a, b) { return Math.round((D(b) - D(a)) / DAY); }
  function eomFollowing(s) { var d = new Date(D(s)); return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)); }
  function sum(arr, f) { var t = 0; for (var i = 0; i < arr.length; i++) t += f ? f(arr[i]) : arr[i]; return t; }

  // ---------- reference data ----------
  var STAGES = ["Pre-site", "Base", "Frame", "Lock-up", "Fixing", "Practical completion"];
  var STAGE_ORDER = { "Deposit": -1 };
  STAGES.forEach(function (s, i) { STAGE_ORDER[s] = i; });
  var CLAIM_PCT = [["Deposit", 5], ["Base", 15], ["Frame", 20], ["Lock-up", 25], ["Fixing", 20], ["Practical completion", 15]];

  var CODES = [
    ["01", "Preliminaries & fees", 6, "Pre-site"],
    ["02", "Site works & earthworks", 4, "Pre-site"],
    ["03", "Concrete slab & piers", 10, "Base"],
    ["04", "Plumbing & drainage", 8, "Base"],
    ["05", "Frame & trusses", 11, "Frame"],
    ["06", "Roofing & gutters", 6, "Lock-up"],
    ["07", "Bricklaying & cladding", 10, "Lock-up"],
    ["08", "Windows & external doors", 6, "Lock-up"],
    ["09", "Electrical", 5, "Fixing"],
    ["10", "Insulation & plasterboard", 7, "Fixing"],
    ["11", "Cabinetry & joinery", 8, "Fixing"],
    ["12", "Tiling & waterproofing", 5, "Fixing"],
    ["13", "Carpentry fit-off & doors", 4, "Fixing"],
    ["14", "Painting", 4, "Fixing"],
    ["15", "Floor coverings", 3, "Practical completion"],
    ["16", "Driveway, paths & clean", 3, "Practical completion"]
  ].map(function (r) { return { code: r[0], name: r[1], pct: r[2], stage: r[3] }; });
  var CODE_MAP = {};
  CODES.forEach(function (c) { CODE_MAP[c.code] = c; });

  var DEFAULTS = {
    asAt: AS_AT,
    escalation: 0.08,        // annual trade price escalation applied to uncommitted budget
    delayFactor: 1.15,       // stretch applied to planned durations when forecasting stage ends
    overPoTolPct: 0.02,      // invoice total above PO before flagging
    overPoTolAmt: 100,
    claimLagDays: 2,         // days after stage completion before an unraised claim is flagged
    paymentTermsDays: 7,     // days a homeowner has to pay a stage claim
    varChaseDays: 7,         // days an unsigned variation can wait before it is flagged
    overrunTolPct: 0.10,
    overrunTolAmt: 2000,
    noPoMin: 300,
    varCostRatio: 0.75,      // cost of a variation as a share of its price
    openingCash: 4600000,
    weeklyOverhead: 45000,
    basAmount: 210000,       // next quarterly GST/PAYG payment to the ATO (estimate)
    basDate: "2026-10-28",    // quarterly BAS due 28 Oct, 28 Feb, 28 Apr, 28 Jul
    bufferWeeks: 4,          // weeks of overheads to keep as a cash buffer
    riskFade: 0.03,          // margin fade (points) that marks a job at risk
    watchFade: 0.025,        // margin fade (points) that puts a job on the watch list
    watchIssue: 10000,       // money in open items on one job that puts it on the watch list
    noteFindings: null       // AI results replace keyword detection when present
  };

  // ---------- schema (drives import, templates and docs) ----------
  var SCHEMA = [
    { key: "jobs", label: "Jobs", file: "jobs.csv", from: "Job list or contract register",
      match: /job|contract|register/i,
      cols: [
        ["job_id", 1, "Job number", ["job", "jobno", "jobnumber", "jobid", "contractno", "contractnumber"]],
        ["client", 0, "Client name", ["customer", "owner", "clientname"]],
        ["address", 0, "Site address", ["siteaddress", "lotaddress"]],
        ["suburb", 0, "Suburb", ["locality"]],
        ["estate", 0, "Estate or development", ["development", "project"]],
        ["design", 0, "Home design", ["model", "housetype", "plan"]],
        ["supervisor", 0, "Site supervisor", ["siteSupervisor", "super", "constructionsupervisor"]],
        ["contract_date", 1, "Date contract signed", ["contractdate", "datesigned", "signeddate", "signed"]],
        ["contract_value", 1, "Contract price", ["contractvalue", "contractprice", "price", "value", "contractsum"]]
      ] },
    { key: "stages", label: "Schedule", file: "stages.csv", from: "Construction schedule export",
      match: /stage|schedule|program|milestone/i,
      cols: [
        ["job_id", 1, "Job number", ["job", "jobno", "jobnumber", "jobid"]],
        ["stage", 1, "Stage name (Pre-site, Base, Frame, Lock-up, Fixing, Practical completion)", ["milestone", "stagename"]],
        ["planned_start", 0, "Planned start", ["plannedstart", "baselinestart", "start"]],
        ["planned_end", 0, "Planned finish", ["plannedend", "plannedfinish", "baselinefinish", "finish"]],
        ["actual_start", 0, "Actual start", ["actualstart", "started"]],
        ["actual_end", 0, "Actual finish (blank if not finished)", ["actualend", "actualfinish", "completed", "completeddate"]]
      ] },
    { key: "budget", label: "Estimate", file: "budget.csv", from: "Estimate or job budget by cost code",
      match: /budget|estimate|costing/i,
      cols: [
        ["job_id", 1, "Job number", ["job", "jobno", "jobnumber", "jobid"]],
        ["cost_code", 1, "Cost code", ["code", "costcode", "costcentre", "costcenter", "account"]],
        ["description", 0, "Cost code name", ["name", "costname", "item"]],
        ["budget", 1, "Budgeted cost", ["budgetamount", "estimate", "estimated", "amount", "budgetcost"]],
        ["stage", 0, "Stage the cost belongs to (optional)", ["stagename"]]
      ] },
    { key: "purchase_orders", label: "Purchase orders", file: "purchase_orders.csv", from: "Purchase order register",
      match: /purchase|order|\bpo\b|pos\b/i,
      cols: [
        ["po_id", 1, "PO number", ["po", "ponumber", "pono", "ordernumber", "orderno"]],
        ["job_id", 1, "Job number", ["job", "jobno", "jobnumber", "jobid"]],
        ["cost_code", 1, "Cost code", ["code", "costcode", "costcentre", "account"]],
        ["supplier", 1, "Supplier or trade", ["vendor", "subcontractor", "trade", "suppliername"]],
        ["po_date", 0, "Order date", ["date", "orderdate", "issued"]],
        ["amount", 1, "Order value", ["poamount", "total", "value", "ordervalue"]]
      ] },
    { key: "supplier_invoices", label: "Supplier invoices", file: "supplier_invoices.csv", from: "Accounts payable bills (e.g. Xero bills tracked by job)",
      match: /invoice|bill|payable|\bap\b/i,
      cols: [
        ["invoice_id", 1, "Your internal bill ID", ["id", "billid", "billno", "billnumber", "entryno"]],
        ["supplier", 1, "Supplier or trade", ["vendor", "subcontractor", "contact", "suppliername"]],
        ["supplier_invoice_no", 0, "Supplier's invoice number", ["invoiceno", "invoicenumber", "reference", "ref", "supplierref"]],
        ["job_id", 1, "Job number", ["job", "jobno", "jobnumber", "jobid", "tracking", "trackingcategory"]],
        ["cost_code", 0, "Cost code", ["code", "costcode", "costcentre", "account"]],
        ["po_id", 0, "Matching PO number", ["po", "ponumber", "pono", "ordernumber"]],
        ["invoice_date", 1, "Invoice date", ["date", "invoicedate", "billdate"]],
        ["due_date", 0, "Due date", ["due", "duedate"]],
        ["amount", 1, "Invoice amount", ["total", "value", "invoiceamount", "amountexgst"]],
        ["paid_date", 0, "Date paid (blank if unpaid)", ["paid", "datepaid", "paymentdate"]]
      ] },
    { key: "variations", label: "Variations", file: "variations.csv", from: "Variation register",
      match: /variation|change/i,
      cols: [
        ["var_id", 1, "Variation number", ["variation", "variationno", "id", "vo", "vono"]],
        ["job_id", 1, "Job number", ["job", "jobno", "jobnumber", "jobid"]],
        ["description", 1, "What changed", ["desc", "details", "scope"]],
        ["amount", 1, "Price to the client", ["price", "value", "total"]],
        ["status", 0, "Requested, Signed or Declined", ["state"]],
        ["request_date", 0, "Date requested", ["requested", "requestdate", "raised"]],
        ["signed_date", 0, "Date signed by client", ["signed", "signeddate", "approveddate", "approved"]],
        ["invoice_date", 0, "Date invoiced", ["invoiced", "invoicedate"]],
        ["paid_date", 0, "Date paid", ["paid", "datepaid"]]
      ] },
    { key: "claims", label: "Progress claims", file: "claims.csv", from: "Stage claim schedule and receivables",
      match: /claim|progress|receivable|\bar\b/i,
      cols: [
        ["job_id", 1, "Job number", ["job", "jobno", "jobnumber", "jobid"]],
        ["stage", 1, "Claim stage (Deposit, Base, Frame, Lock-up, Fixing, Practical completion)", ["claimstage", "milestone", "claim"]],
        ["pct", 0, "Percent of contract", ["percent", "percentage"]],
        ["amount", 0, "Claim amount", ["claimamount", "value", "total"]],
        ["invoice_date", 0, "Date invoiced (blank if not yet)", ["invoiced", "invoicedate", "claimdate"]],
        ["invoice_no", 0, "Invoice number", ["invoicenumber", "ref", "reference"]],
        ["paid_date", 0, "Date paid (blank if unpaid)", ["paid", "datepaid", "receiptdate"]]
      ] },
    { key: "site_notes", label: "Site notes", file: "site_notes.csv", from: "Site diary, supervisor notes or emails",
      match: /note|diary|log|comment/i,
      cols: [
        ["note_id", 0, "Note ID", ["id", "noteno", "entry"]],
        ["job_id", 1, "Job number", ["job", "jobno", "jobnumber", "jobid"]],
        ["date", 1, "Date", ["notedate", "created", "entrydate"]],
        ["author", 0, "Who wrote it", ["user", "by", "supervisor"]],
        ["text", 1, "Note text", ["note", "notes", "comment", "body", "details", "description"]]
      ] }
  ];
  var MONEY_FIELDS = { contract_value: 1, budget: 1, amount: 1, pct: 1 };
  var DATE_FIELDS = { contract_date: 1, planned_start: 1, planned_end: 1, actual_start: 1, actual_end: 1, po_date: 1, invoice_date: 1, due_date: 1, paid_date: 1, request_date: 1, signed_date: 1, date: 1 };

  // ---------- synthetic data ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var ESTATES = [["Riverlea", "Buckland Park", "North"], ["Eyre", "Penfield", "North"], ["Playford Alive", "Munno Para", "North"], ["Springwood", "Gawler East", "North"], ["Bluestone", "Mount Barker", "Hills"], ["Aston Hills", "Mount Barker", "Hills"], ["Seaford Heights", "Seaford Heights", "South"], ["Aldinga Beach", "Aldinga Beach", "South"], ["Onkaparinga Heights", "Hackham", "South"], ["Lightsview", "Lightsview", "Inner north-east"]];
  var DESIGNS = [["Kestrel 24", 224], ["Coast 21", 196], ["Hills 28", 262], ["Urban 19", 178], ["Banksia 26", 242], ["Mallee 23", 214], ["Wattle 30", 281]];
  var STREETS = ["Kestrel Way", "Saltbush Cres", "Redgum Rd", "Quandong Ave", "Mallee Dr", "Bottlebrush Ct", "Samphire St", "Pelican Pde", "Ironbark Cl", "Wattle St", "Banksia Tce", "Emu Ln"];
  var SURNAMES = ["Nguyen", "Patel", "Smith", "Rossi", "Kaur", "Brown", "Wilson", "Tran", "Singh", "Taylor", "Martin", "Anderson", "Thompson", "Lee", "Kowalski", "Papadopoulos", "Murphy", "Chen", "Walker", "Hall", "Russo", "Ahmed", "O'Brien", "Clarke"];
  var SUPERVISORS = ["Daniel", "Mia", "Tom", "Aisha"];
  var SUPPLIERS = { "01": "Gulf Building Certifiers", "02": "Plains Earthmoving", "03": "Portside Concrete", "04": "Torrens Plumbing", "05": "Southern Cross Frames & Trusses", "06": "Ridgeline Roofing", "07": "Parklands Bricklaying", "08": "Northgate Windows & Doors", "09": "Brightline Electrical", "10": "Coastal Plaster & Insulation", "11": "Mallee Kitchens & Joinery", "12": "Gulfview Tiling", "13": "Redgum Carpentry", "14": "Onka Painting", "15": "Riverland Floors", "16": "Metro Paving & Cleaning" };
  var VAR_LIST = [["Upgrade to 2.7 m ceilings", 6000, 9500, "ceiling"], ["Ducted reverse-cycle air upgrade", 3500, 6200, "ducted"], ["Solar 6.6 kW system", 5200, 7400, "solar"], ["Double garage panel-lift door upgrade", 1200, 2100, "garage"], ["Additional data points (4)", 600, 1100, "data"], ["Alfresco ceiling lining upgrade", 1800, 3200, "lining"], ["Upgrade to 900 mm freestanding cooker", 1400, 2300, "cooker"], ["Rainwater tank and pump", 2600, 3900, "tank"]];
  var STAGE_NOTES = {
    "Pre-site": ["Soil report and engineering received. Site set-out done, pegs in.", "Site cleared, temporary fence and toilet delivered.", "Building rules consent received, ready for slab booking."],
    "Base": ["Slab poured this morning, pump on site 7:10. Finish looks good.", "Piers drilled and inspected. Plumbing under-slab passed.", "Slab stripped, termite barrier certificate received."],
    "Frame": ["Wall frames stood, trusses delivered. Frame inspection booked.", "Trusses fixed and braced. Waiting on frame inspection.", "Frame inspection passed. Roofer booked for next week."],
    "Lock-up": ["Roof on. Brickwork about 70% done, bricklayer back Monday.", "Windows installed except bed 3, glass on back order.", "Brickwork finished, garage door fitted. Lock-up this week."],
    "Fixing": ["Plasterboard hung and set. Sparky on fit-off Thursday.", "Cabinets installed. Tiler booked for Tuesday.", "Painter started internals. Waterproofing certificate received."],
    "Practical completion": ["PC walkthrough with owner done. 6 minor defect items listed.", "Final clean done, driveway poured. Keys handover booked.", "Defects list closed except one cracked tile."]
  };
  var EXTRA_NOTES = [
    { text: "Owner asked for 4 extra double power points in the alfresco and a fan point in bed 2. Sparky quoted about $1,150.", stage: "Fixing", billable: true, amount: 1150 },
    { text: "Hit rock at the rear footings. Excavator back for an extra day and a half, rock breaking approx $2,400.", stage: "Base", billable: true, amount: 2400, rock: true },
    { text: "Client wants to upgrade the kitchen benchtop to 40mm stone. Supplier says the difference is $1,850.", stage: "Fixing", billable: true, amount: 1850 },
    { text: "Homeowner requested the ensuite shower screen be changed to frameless. Need a price from the glazier.", stage: "Fixing", billable: true, amount: null },
    { text: "Owner agreed on site to an extra sleeper retaining wall on the east boundary, about 6 m.", stage: "Lock-up", billable: true, amount: null },
    { text: "Owner asked to move the laundry door 600mm. Chippy re-framed it this morning.", stage: "Frame", billable: true, amount: null },
    { text: "Customer wants 2 extra downlights in the living room and the TV point relocated. Approx $420.", stage: "Fixing", billable: true, amount: 420 },
    { text: "Council required a bigger stormwater pit at the front. Plumber charging an extra $780.", stage: "Base", billable: true, amount: 780 },
    { text: "Client asked to add a gas point for the BBQ on the patio, approx $450.", stage: "Fixing", billable: true, amount: 450 },
    { text: "Owner changed the floor tile selection after the order was placed. Supplier restocking fee $320.", stage: "Fixing", billable: true, amount: 320 },
    { text: "Frame carpenter set the bed 3 window opening at the wrong height. Rework at our cost.", stage: "Frame", billable: false, amount: null },
    { text: "Talked with the owner about upgrading to 2.7 m ceilings in the family room. They will confirm next week.", stage: "Frame", billable: false, amount: null }
  ];

  function buildSchedule(contractDate, plan, delay) {
    var ps = contractDate, as = contractDate, out = [];
    STAGES.forEach(function (s) {
      var pe = addDays(ps, plan[s]);
      var ae = addDays(as, Math.round(plan[s] * delay[s]));
      out.push({ stage: s, pStart: ps, pEnd: pe, aStart: as, aEnd: ae });
      ps = pe; as = ae;
    });
    return out;
  }

  function generate(seed) {
    var r = rng(seed || 20260928);
    function rand(a, b) { return a + (b - a) * r(); }
    function ri(a, b) { return Math.floor(rand(a, b + 1)); }
    function pick(arr) { return arr[Math.floor(r() * arr.length)]; }
    var out = { jobs: [], stages: [], budget: [], purchase_orders: [], supplier_invoices: [], variations: [], claims: [], site_notes: [] };
    var poN = 5100, invN = 88000, varN = 1, noteN = 1, claimN = 3000;
    var metas = [];

    function pushInv(po, date, amount, extra) {
      if (date > AS_AT) date = AS_AT;
      var due = eomFollowing(date);
      var row = { invoice_id: "B" + (invN++), supplier: po.supplier, supplier_invoice_no: "INV-" + ri(10000, 99999), job_id: po.job_id, cost_code: po.cost_code, po_id: po.po_id, invoice_date: date, due_date: due, amount: amount, paid_date: due <= AS_AT ? due : "" };
      if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
      out.supplier_invoices.push(row);
      return row;
    }

    for (var i = 0; i < 60; i++) {
      var id = String(2360 + i * 2 + ri(0, 1));
      var est = pick(ESTATES), des = pick(DESIGNS);
      var value = Math.round(des[1] * rand(1620, 1880) / 100) * 100 + (est[2] === "Hills" ? 15000 : 0);
      var plan = { "Pre-site": ri(84, 126), "Base": ri(21, 28), "Frame": ri(28, 35), "Lock-up": ri(42, 56), "Fixing": ri(56, 70), "Practical completion": ri(21, 28) };
      var delay = { "Pre-site": rand(0.95, 1.35), "Base": rand(0.95, 1.25), "Frame": rand(0.95, 1.3), "Lock-up": rand(1.0, 1.45), "Fixing": rand(1.0, 1.4), "Practical completion": rand(0.95, 1.2) };
      var back = ri(60, 430), contractDate, sched;
      for (var tries = 0; tries < 8; tries++) {
        contractDate = addDays(AS_AT, -back);
        sched = buildSchedule(contractDate, plan, delay);
        var gap = daysBetween(sched[sched.length - 1].aEnd, AS_AT);
        if (gap > 35) back = Math.max(40, back - gap + ri(-10, 150)); else break;
      }
      var S = {}; sched.forEach(function (x) { S[x.stage] = x; });
      var supervisor = SUPERVISORS[i % SUPERVISORS.length];
      out.jobs.push({ job_id: id, client: pick(SURNAMES) + " family", address: ri(3, 88) + " " + pick(STREETS), suburb: est[1], estate: est[0], design: des[0], supervisor: supervisor, contract_date: contractDate, contract_value: value });
      sched.forEach(function (x) {
        out.stages.push({ job_id: id, stage: x.stage, planned_start: x.pStart, planned_end: x.pEnd, actual_start: x.aStart <= AS_AT ? x.aStart : "", actual_end: x.aEnd <= AS_AT ? x.aEnd : "" });
      });

      // estimate
      var margin = rand(0.12, 0.17), budgetCost = value * (1 - margin);
      var raw = CODES.map(function (c) { return c.pct * rand(0.92, 1.08); });
      var rawSum = sum(raw);
      var budgets = raw.map(function (v) { return Math.round(budgetCost * v / rawSum); });
      CODES.forEach(function (c, k) { out.budget.push({ job_id: id, cost_code: c.code, description: c.name, budget: budgets[k] }); });

      // purchase orders and supplier invoices
      CODES.forEach(function (c, k) {
        var st = S[c.stage];
        var poDate = addDays(st.aStart, -ri(7, 21));
        if (poDate < contractDate) poDate = addDays(contractDate, ri(1, 10));
        if (poDate > AS_AT) return;
        var yrs = daysBetween(contractDate, poDate) / 365;
        var amt = budgets[k] * (1 + 0.06 * yrs * rand(0.3, 1.1)) * rand(0.975, 1.025);
        if (c.code === "07" || c.code === "12") amt *= 1 + rand(0, 0.05);
        amt = Math.round(amt / 10) * 10;
        var po = { po_id: "PO" + (poN++), job_id: id, cost_code: c.code, supplier: SUPPLIERS[c.code], po_date: poDate, amount: amt };
        out.purchase_orders.push(po);
        var done = st.aEnd <= AS_AT, cur = st.aStart <= AS_AT && !done;
        if (done) {
          var d1 = addDays(st.aEnd, -ri(0, 6)); if (d1 < st.aStart) d1 = st.aStart;
          pushInv(po, d1, amt);
        } else if (cur && r() < 0.55) {
          pushInv(po, addDays(st.aStart, ri(0, Math.max(0, daysBetween(st.aStart, AS_AT)))), Math.round(amt * rand(0.4, 0.7) / 10) * 10);
        }
      });

      // variations
      var nv = ri(0, 2), used = {};
      for (var v = 0; v < nv; v++) {
        var item = pick(VAR_LIST); if (used[item[0]]) continue; used[item[0]] = 1;
        var reqMin = addDays(contractDate, 14);
        if (reqMin > addDays(AS_AT, -12)) continue;
        var req = addDays(reqMin, ri(0, Math.max(0, daysBetween(reqMin, addDays(AS_AT, -12)))));
        var vamt = Math.round(rand(item[1], item[2]) / 10) * 10;
        var roll = r();
        var row = { var_id: "V" + (varN++), job_id: id, description: item[0], amount: vamt, status: "Signed", request_date: req, signed_date: "", invoice_date: "", paid_date: "" };
        row.signed_date = addDays(req, ri(2, 9)); if (row.signed_date > AS_AT) row.signed_date = AS_AT;
        if (roll < 0.6) {
          row.invoice_date = addDays(row.signed_date, ri(0, 10)); if (row.invoice_date > AS_AT) row.invoice_date = AS_AT;
          var pd = addDays(row.invoice_date, ri(3, 10)); row.paid_date = pd <= AS_AT ? pd : "";
        } else if (roll < 0.8) {
          // signed, not yet invoiced
        } else {
          row.status = "Requested"; row.signed_date = "";
        }
        out.variations.push(row);
      }

      // stage claims
      CLAIM_PCT.forEach(function (cp) {
        var amt = Math.round(value * cp[1] / 100);
        var row = { job_id: id, stage: cp[0], pct: cp[1], amount: amt, invoice_date: "", invoice_no: "", paid_date: "" };
        var doneDate = cp[0] === "Deposit" ? contractDate : (S[cp[0]].aEnd <= AS_AT ? S[cp[0]].aEnd : "");
        if (doneDate) {
          var inv = addDays(doneDate, ri(0, 2)); if (inv > AS_AT) inv = AS_AT;
          row.invoice_date = inv; row.invoice_no = "C" + (claimN++);
          var paid = addDays(inv, ri(2, 8)); row.paid_date = paid <= AS_AT ? paid : "";
        }
        out.claims.push(row);
      });

      // routine site notes
      sched.forEach(function (x) {
        if (x.aStart > AS_AT) return;
        var end = x.aEnd <= AS_AT ? x.aEnd : AS_AT;
        var d = addDays(end, -ri(0, 5)); if (d < x.aStart) d = x.aStart;
        out.site_notes.push({ note_id: "N" + (noteN++), job_id: id, date: d, author: supervisor, text: pick(STAGE_NOTES[x.stage]) });
      });
      metas.push({ id: id, S: S, contractDate: contractDate, supervisor: supervisor });
    }

    // ---- injected problems, so the demo has something real to find ----
    // 1. stage claims not raised
    var recent = metas.filter(function (m) {
      var last = null; STAGES.slice(1).forEach(function (s) { if (m.S[s].aEnd <= AS_AT) last = m.S[s]; });
      if (!last) return false; var g = daysBetween(last.aEnd, AS_AT); m.lastDone = last; return g >= 4 && g <= 16;
    });
    recent.slice(0, 5).forEach(function (m) {
      out.claims.forEach(function (c) { if (c.job_id === m.id && c.stage === m.lastDone.stage) { c.invoice_date = ""; c.invoice_no = ""; c.paid_date = ""; } });
    });
    // 2. overdue claims
    var od = out.claims.filter(function (c) { return c.invoice_date && c.stage !== "Deposit" && daysBetween(c.invoice_date, AS_AT) >= 11 && daysBetween(c.invoice_date, AS_AT) <= 30; });
    od.slice(0, 4).forEach(function (c) { c.paid_date = ""; });
    // 3. signed variations not invoiced: make sure there are at least 8
    var unb = out.variations.filter(function (v) { return v.signed_date && !v.invoice_date; });
    out.variations.filter(function (v) { return v.invoice_date; }).slice(0, Math.max(0, 8 - unb.length)).forEach(function (v) { v.invoice_date = ""; v.paid_date = ""; });
    // 4. invoices above PO (price rises passed on without approval)
    var unpaidFull = out.supplier_invoices.filter(function (b) { var po = null; out.purchase_orders.forEach(function (p) { if (p.po_id === b.po_id) po = p; }); return !b.paid_date && po && b.amount === po.amount; });
    unpaidFull.slice(0, 6).forEach(function (b) { b.amount = Math.round(b.amount * rand(1.03, 1.09) / 10) * 10; });
    // 5. duplicate invoices
    var dupSrc = out.supplier_invoices.filter(function (b) { return daysBetween(b.invoice_date, AS_AT) <= 25; });
    [dupSrc[3], dupSrc[11]].forEach(function (b) {
      if (!b) return; var copy = {}; Object.keys(b).forEach(function (k) { copy[k] = b[k]; });
      copy.invoice_id = "B" + (invN++); copy.invoice_date = addDays(b.invoice_date, ri(3, 9)); if (copy.invoice_date > AS_AT) copy.invoice_date = AS_AT;
      copy.due_date = eomFollowing(copy.invoice_date); copy.paid_date = "";
      out.supplier_invoices.push(copy);
    });
    // 6a. supplier bills past their due date and still unpaid
    out.supplier_invoices.filter(function (b) { return b.paid_date && b.due_date < addDays(AS_AT, -2) && b.due_date >= addDays(AS_AT, -40); })
      .filter(function (b, k) { return k % 9 === 4; }).slice(0, 6).forEach(function (b) { b.paid_date = ""; });
    // 6. site notes that describe extra work nobody turned into a variation
    var usedJobs = {};
    EXTRA_NOTES.forEach(function (n) {
      var cands = metas.filter(function (m) { var st = m.S[n.stage]; return !usedJobs[m.id] && st.aStart <= AS_AT && daysBetween(st.aStart, AS_AT) <= 120; });
      if (!cands.length) return;
      var m = cands[Math.floor(r() * cands.length)]; usedJobs[m.id] = 1;
      var st = m.S[n.stage]; var end = st.aEnd <= AS_AT ? st.aEnd : AS_AT;
      var d = addDays(st.aStart, ri(0, Math.max(0, daysBetween(st.aStart, end))));
      out.site_notes.push({ note_id: "N" + (noteN++), job_id: m.id, date: d, author: m.supervisor, text: n.text });
      if (n.rock) {
        var rd = addDays(d, ri(1, 5)); if (rd > AS_AT) rd = AS_AT;
        out.supplier_invoices.push({ invoice_id: "B" + (invN++), supplier: "Rock Breaking Services", supplier_invoice_no: "RB-" + ri(1000, 9999), job_id: m.id, cost_code: "02", po_id: "", invoice_date: rd, due_date: eomFollowing(rd), amount: 2380, paid_date: "" });
      }
    });
    // 7. bills with no purchase order
    [["Adelaide Skip Hire", "01", 540], ["Site Clean Crew", "16", 460]].forEach(function (x, k) {
      var m = metas[7 + k * 13];
      var d = addDays(AS_AT, -ri(3, 20));
      out.supplier_invoices.push({ invoice_id: "B" + (invN++), supplier: x[0], supplier_invoice_no: "SC-" + ri(100, 999), job_id: m.id, cost_code: x[1], po_id: "", invoice_date: d, due_date: eomFollowing(d), amount: x[2], paid_date: "" });
    });
    out.site_notes.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return out;
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    var rows = [], row = [], field = "", q = false, i = 0, c;
    text = String(text).replace(/^﻿/, "");
    while (i < text.length) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
      i++;
    }
    if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
    return rows;
  }
  function csvCell(v) { var s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCSV(rows, cols) { return [cols.join(",")].concat(rows.map(function (r) { return cols.map(function (k) { return csvCell(r[k]); }).join(","); })).join("\n") + "\n"; }
  function norm(h) { return String(h).toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function parseMoney(v) {
    if (v == null) return 0; var s = String(v).trim(); if (!s) return 0;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s);
    var n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return isFinite(n) ? (neg ? -n : n) : 0;
  }
  function parseDate(v) {
    var s = String(v == null ? "" : v).trim(); if (!s) return "";
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);   // Australian day/month/year
    if (m) { var y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2); }
    var t = Date.parse(s); return isFinite(t) ? iso(t) : "";
  }
  function tableSpec(key) { for (var i = 0; i < SCHEMA.length; i++) if (SCHEMA[i].key === key) return SCHEMA[i]; return null; }
  function mapHeaders(spec, headers) {
    var map = {}, n = headers.map(norm);
    spec.cols.forEach(function (col) {
      var names = [norm(col[0])].concat(col[3].map(norm));
      for (var i = 0; i < n.length; i++) if (names.indexOf(n[i]) >= 0 && !(i in map)) { map[i] = col[0]; return; }
    });
    return map;
  }
  function detectTable(filename, headers) {
    var best = null, bestScore = 0;
    SCHEMA.forEach(function (spec) {
      var map = mapHeaders(spec, headers), hits = Object.keys(map).length;
      var req = spec.cols.filter(function (c) { return c[1]; }).map(function (c) { return c[0]; });
      var got = {}; Object.keys(map).forEach(function (k) { got[map[k]] = 1; });
      var reqHit = req.filter(function (k) { return got[k]; }).length;
      var score = hits + reqHit * 2 + (spec.match.test(filename || "") ? 6 : 0);
      if (reqHit < req.length) score -= 8;
      if (score > bestScore) { bestScore = score; best = spec.key; }
    });
    return best;
  }
  function importTable(key, text) {
    var spec = tableSpec(key), rows = parseCSV(text);
    if (!rows.length) return { key: key, rows: [], warnings: ["The file is empty."], matched: [] };
    var headers = rows[0], map = mapHeaders(spec, headers), warnings = [];
    var matched = Object.keys(map).map(function (k) { return map[k]; });
    spec.cols.forEach(function (c) { if (c[1] && matched.indexOf(c[0]) < 0) warnings.push("Missing required column “" + c[0] + "”."); });
    var outRows = rows.slice(1).map(function (r) {
      var o = {};
      spec.cols.forEach(function (c) { o[c[0]] = ""; });
      Object.keys(map).forEach(function (i) {
        var k = map[i], v = r[i] == null ? "" : String(r[i]).trim();
        if (MONEY_FIELDS[k]) o[k] = parseMoney(v); else if (DATE_FIELDS[k]) o[k] = parseDate(v); else o[k] = v;
      });
      return o;
    }).filter(function (o) { return o.job_id || o.po_id || o.invoice_id; });
    return { key: key, rows: outRows, warnings: warnings, matched: matched, headers: headers };
  }

  // ---------- analysis ----------
  var EXTRA_RE = /\b(extra|additional|upgrade|upgrading|asked|requested|wants|changed|change to|relocat\w*|move the|moved|add a|add an|bigger|larger|rock|restocking)\b/i;
  var NONBILL_RE = /(our cost|our error|wrong|rework at our|our mistake)/i;
  var PENDING_RE = /(will confirm|thinking about|might |maybe|discussed|talked (with|to))/i;
  var SCOPE_WORDS = ["benchtop", "shower", "retaining", "power point", "gas", "ceiling", "fan", "downlight", "laundry", "door", "tile", "stormwater", "rock", "solar", "garage", "cooker", "tank", "data", "lining", "ducted"];

  function stageOrder(a, b) { return (STAGE_ORDER[a.stage] == null ? 99 : STAGE_ORDER[a.stage]) - (STAGE_ORDER[b.stage] == null ? 99 : STAGE_ORDER[b.stage]); }
  function isSigned(v) { return /sign|approv|accept/i.test(v.status || "") || (!!v.signed_date && !/declin|reject|cancel/i.test(v.status || "")); }
  function groupBy(rows) { var m = {}; (rows || []).forEach(function (r) { (m[r.job_id] = m[r.job_id] || []).push(r); }); return m; }

  function analyse(data, opts) {
    var s = {}; Object.keys(DEFAULTS).forEach(function (k) { s[k] = DEFAULTS[k]; });
    Object.keys(opts || {}).forEach(function (k) { if (opts[k] != null) s[k] = opts[k]; });
    var asAt = s.asAt;
    var stagesBy = groupBy(data.stages), budgetBy = groupBy(data.budget), poBy = groupBy(data.purchase_orders),
        invBy = groupBy(data.supplier_invoices), varBy = groupBy(data.variations), claimBy = groupBy(data.claims), noteBy = groupBy(data.site_notes);
    var issues = [], n = 0, jobs = [], jobIndex = {};
    function issue(o) { o.id = "I" + (++n); issues.push(o); return o; }

    // supplier-invoice checks across the ledger: duplicates first, then over-PO, then bills without a PO
    var invoices = (data.supplier_invoices || []).slice().sort(function (a, b) { return a.invoice_date < b.invoice_date ? -1 : 1; });
    var seen = {}, dupIds = {};
    invoices.forEach(function (b) {
      var key = b.supplier_invoice_no ? norm(b.supplier) + "|" + norm(b.supplier_invoice_no) : null;
      if (key && seen[key]) {
        dupIds[b.invoice_id] = seen[key];
        issue({ type: "duplicate", job_id: b.job_id, amount: b.amount, supplier: b.supplier, ref: b.invoice_id, paid: !!b.paid_date,
          detail: b.supplier + " invoice " + b.supplier_invoice_no + " was entered twice (" + seen[key].invoice_id + " and " + b.invoice_id + ")." });
      } else if (key) seen[key] = b;
    });
    var poMap = {}; (data.purchase_orders || []).forEach(function (p) { poMap[p.po_id] = p; });
    var byPo = {};
    invoices.forEach(function (b) { if (b.po_id && !dupIds[b.invoice_id]) (byPo[b.po_id] = byPo[b.po_id] || []).push(b); });
    Object.keys(byPo).forEach(function (poId) {
      var p = poMap[poId]; if (!p) return;
      var tot = sum(byPo[poId], function (b) { return b.amount; }), over = tot - p.amount;
      if (over > p.amount * s.overPoTolPct && over > s.overPoTolAmt) {
        var last = byPo[poId][byPo[poId].length - 1];
        issue({ type: "overpo", job_id: p.job_id, amount: Math.round(over), supplier: p.supplier, ref: poId, paid: !!last.paid_date,
          detail: p.supplier + " has billed $" + Math.round(tot).toLocaleString("en-AU") + " against " + poId + " for $" + Math.round(p.amount).toLocaleString("en-AU") + " (" + (over / p.amount * 100).toFixed(1) + "% over)." });
      }
    });
    invoices.forEach(function (b) {
      if (!b.paid_date && b.due_date && b.due_date < asAt && !dupIds[b.invoice_id]) {
        var late = daysBetween(b.due_date, asAt);
        issue({ type: "latepay", job_id: b.job_id, amount: b.amount, days: late, supplier: b.supplier, ref: b.invoice_id,
          detail: b.supplier + " bill " + b.invoice_id + " was due " + late + " days ago and is unpaid." });
      }
      if (!b.po_id && b.amount >= s.noPoMin && !dupIds[b.invoice_id])
        issue({ type: "nopo", job_id: b.job_id, amount: b.amount, supplier: b.supplier, ref: b.invoice_id, paid: !!b.paid_date,
          detail: b.supplier + " bill " + b.invoice_id + " has no purchase order. Check it was approved and coded to the right job." });
    });

    (data.jobs || []).forEach(function (j) {
      var id = j.job_id;
      var st = (stagesBy[id] || []).slice().sort(stageOrder);
      var status = {}, stageRow = {}, current = null, hasStages = st.length > 0;
      st.forEach(function (x) {
        stageRow[x.stage] = x;
        var done = !!x.actual_end && x.actual_end <= asAt;
        status[x.stage] = done ? "done" : (x.actual_start && x.actual_start <= asAt ? "current" : "future");
        if (!done && !current) current = x.stage;
      });
      // forecast stage ends
      var pred = {}, cursor = asAt;
      st.forEach(function (x) {
        var dur = x.planned_start && x.planned_end ? Math.max(daysBetween(x.planned_start, x.planned_end), 7) : 30;
        if (status[x.stage] === "done") { pred[x.stage] = x.actual_end; cursor = x.actual_end; }
        else if (status[x.stage] === "current") { var e = addDays(x.actual_start, Math.round(dur * s.delayFactor)); if (e <= asAt) e = addDays(asAt, 5); pred[x.stage] = e; cursor = e; }
        else { var start = cursor > asAt ? cursor : asAt; var e2 = addDays(start, Math.round(dur * s.delayFactor)); pred[x.stage] = e2; cursor = e2; }
      });

      // cost codes
      var codes = {};
      function code(c) {
        if (!codes[c]) { var def = CODE_MAP[c]; codes[c] = { code: c, name: def ? def.name : c, stage: def ? def.stage : "", budget: 0, committed: 0, actual: 0 }; }
        return codes[c];
      }
      (budgetBy[id] || []).forEach(function (b) { var c = code(b.cost_code || "—"); c.budget += b.budget || 0; if (b.description) c.name = b.description; if (b.stage) c.stage = b.stage; });
      (poBy[id] || []).forEach(function (p) { code(p.cost_code || "—").committed += p.amount || 0; });
      (invBy[id] || []).forEach(function (b) { if (!dupIds[b.invoice_id]) code(b.cost_code || "—").actual += b.amount || 0; });
      var codeList = Object.keys(codes).sort().map(function (k) { return codes[k]; });
      var escalationExposure = 0;
      codeList.forEach(function (c) {
        var stt = c.stage && status[c.stage] ? status[c.stage] : (hasStages ? "future" : "unknown");
        var known = Math.max(c.committed, c.actual);
        if (stt === "done") c.forecast = known > 0 ? known : c.budget;
        else if (c.committed > 0) c.forecast = known;
        else {
          var until = pred[c.stage] || asAt;
          var yrs = j.contract_date ? Math.max(0, daysBetween(j.contract_date, until) - 21) / 365 : 0;
          var esc = c.budget * s.escalation * yrs;
          escalationExposure += esc;
          c.forecast = Math.max(c.actual, c.budget + esc);
        }
        c.stageStatus = stt;
        c.variance = c.forecast - c.budget;
        var realised = Math.max(c.committed, c.actual) - c.budget;
        if (realised > Math.max(c.budget * s.overrunTolPct, s.overrunTolAmt))
          issue({ type: "overrun", job_id: id, amount: Math.round(realised), ref: c.code,
            detail: c.name + " is committed at $" + Math.round(Math.max(c.committed, c.actual)).toLocaleString("en-AU") + " against a budget of $" + Math.round(c.budget).toLocaleString("en-AU") + "." });
      });

      // variations
      var varSigned = 0, varBilled = 0;
      (varBy[id] || []).forEach(function (v) {
        var signed = isSigned(v);
        if (signed) varSigned += v.amount || 0;
        if (v.invoice_date && v.invoice_date <= asAt) {
          varBilled += v.amount || 0;
          if (!v.paid_date) { var odv = daysBetween(v.invoice_date, asAt) - s.paymentTermsDays; if (odv > 0) issue({ type: "overdue", job_id: id, amount: v.amount, days: odv, ref: v.var_id, detail: "Variation " + v.var_id + " (" + v.description + ") is " + odv + " days past due." }); }
        } else if (signed) {
          var since = v.signed_date ? daysBetween(v.signed_date, asAt) : null;
          issue({ type: "unbilled", job_id: id, amount: v.amount, days: since, ref: v.var_id, detail: "Variation " + v.var_id + " (" + v.description + ") was signed" + (since != null ? " " + since + " days ago" : "") + " but hasn't been invoiced." });
        } else if (!/declin|reject|cancel/i.test(v.status || "") && v.request_date && daysBetween(v.request_date, asAt) > s.varChaseDays) {
          issue({ type: "unsigned", job_id: id, amount: v.amount, days: daysBetween(v.request_date, asAt), ref: v.var_id, detail: "Variation " + v.var_id + " (" + v.description + ") has waited " + daysBetween(v.request_date, asAt) + " days for the client's signature." });
        }
      });

      // stage claims
      var billedClaims = 0, paidClaims = 0, futureClaims = [], unraised = [], overdue = [];
      (claimBy[id] || []).forEach(function (c) {
        var amt = c.amount || (c.pct ? (j.contract_value || 0) * c.pct / 100 : 0);
        if (c.invoice_date && c.invoice_date <= asAt) {
          billedClaims += amt;
          if (c.paid_date && c.paid_date <= asAt) paidClaims += amt;
          else {
            var odd = daysBetween(c.invoice_date, asAt) - s.paymentTermsDays;
            if (odd > 0) { overdue.push(c); issue({ type: "overdue", job_id: id, amount: amt, days: odd, ref: c.stage, detail: c.stage + " claim " + (c.invoice_no || "") + " is " + odd + " days past due." }); }
          }
        } else {
          var doneDate = c.stage === "Deposit" ? j.contract_date : (status[c.stage] === "done" ? stageRow[c.stage].actual_end : "");
          if (doneDate) {
            var late = daysBetween(doneDate, asAt);
            if (late > s.claimLagDays) { unraised.push({ stage: c.stage, amount: amt }); issue({ type: "claim", job_id: id, amount: amt, days: late, ref: c.stage, detail: c.stage + " stage finished " + late + " days ago but the claim hasn't been sent." }); }
            else futureClaims.push({ stage: c.stage, amount: amt, date: asAt });
          } else futureClaims.push({ stage: c.stage, amount: amt, date: pred[c.stage] || null });
        }
      });

      // notes that describe extra work
      if (!s.noteFindings) {
        var vtext = (varBy[id] || []).map(function (v) { return (v.description || "").toLowerCase(); }).join(" | ");
        (noteBy[id] || []).forEach(function (nt) {
          var t = nt.text || "";
          if (!EXTRA_RE.test(t) || NONBILL_RE.test(t) || PENDING_RE.test(t)) return;
          var covered = SCOPE_WORDS.some(function (w) { return t.toLowerCase().indexOf(w) >= 0 && vtext.indexOf(w) >= 0; });
          if (covered) return;
          var m = t.match(/\$\s?([\d,]+(?:\.\d+)?)/);
          issue({ type: "note", job_id: id, amount: m ? parseMoney(m[1]) : null, ref: nt.note_id, source: "Keyword rule", quote: t, date: nt.date,
            detail: "Site note on " + nt.date + " describes extra work with no variation on file." });
        });
      }

      var contract = j.contract_value || 0;
      var origBudget = sum(codeList, function (c) { return c.budget; });
      var varCost = varSigned * s.varCostRatio;
      var forecastCost = sum(codeList, function (c) { return c.forecast; }) + varCost;
      var revised = contract + varSigned;
      var costToDate = sum(codeList, function (c) { return c.actual; });
      var pctComplete = forecastCost > 0 ? Math.min(costToDate / forecastCost, 1) : 0;
      var earned = pctComplete * revised;
      var billed = billedClaims + varBilled;
      var origGP = contract - origBudget, origGPpct = contract > 0 ? origGP / contract : 0;
      var expectedGP = origGP + varSigned * (1 - s.varCostRatio);
      var fcGP = revised - forecastCost, fcGPpct = revised > 0 ? fcGP / revised : 0;
      var row = {
        job: j, id: id, stage: current || (hasStages ? "Complete" : "—"), status: status, pred: pred, codes: codeList,
        contract: contract, varSigned: varSigned, revised: revised, origBudget: origBudget, forecastCost: forecastCost,
        costToDate: costToDate, pctComplete: pctComplete, earned: earned, billed: billed, overUnder: billed - earned,
        received: paidClaims, origGP: origGP, origGPpct: origGPpct, fcGP: fcGP, fcGPpct: fcGPpct,
        fade: origGPpct - fcGPpct, fadeDollars: expectedGP - fcGP, escalationExposure: escalationExposure,
        futureClaims: futureClaims, unraised: unraised, overdue: overdue, notes: noteBy[id] || [], variations: varBy[id] || [],
        claims: claimBy[id] || [], stages: st
      };
      jobs.push(row); jobIndex[id] = row;
    });

    // AI note findings replace keyword detection
    if (s.noteFindings) {
      s.noteFindings.forEach(function (f) {
        if (!f || !f.billable || !jobIndex[f.job_id]) return;
        issue({ type: "note", job_id: f.job_id, amount: typeof f.amount === "number" && f.amount > 0 ? f.amount : null, ref: f.note_id, source: "Claude", quote: f.quote || "",
          confidence: f.confidence, category: f.category, detail: f.description || "Extra work described in a site note has no variation on file." });
      });
    }

    // risk rating
    var issueSumByJob = {};
    issues.forEach(function (i) { if (RECOVER[i.type] && i.amount) issueSumByJob[i.job_id] = (issueSumByJob[i.job_id] || 0) + i.amount; });
    jobs.forEach(function (r) {
      r.issueValue = issueSumByJob[r.id] || 0;
      r.risk = (r.fade >= s.riskFade || r.fcGPpct < 0.08) ? "critical" : (r.fade >= s.watchFade || r.issueValue >= s.watchIssue) ? "warning" : "good";
    });

    var t = {
      jobs: jobs.length,
      revised: sum(jobs, function (r) { return r.revised; }),
      contract: sum(jobs, function (r) { return r.contract; }),
      fcGP: sum(jobs, function (r) { return r.fcGP; }),
      origGP: sum(jobs, function (r) { return r.origGP; }),
      fadeDollars: sum(jobs, function (r) { return Math.max(0, r.fadeDollars); }),
      underbilled: sum(jobs, function (r) { return r.overUnder < 0 ? -r.overUnder : 0; }),
      overbilled: sum(jobs, function (r) { return r.overUnder > 0 ? r.overUnder : 0; }),
      escalation: sum(jobs, function (r) { return r.escalationExposure; }),
      atRisk: jobs.filter(function (r) { return r.risk === "critical"; }).length,
      watch: jobs.filter(function (r) { return r.risk === "warning"; }).length
    };
    t.fcGPpct = t.revised ? t.fcGP / t.revised : 0;
    t.origGPpct = t.contract ? t.origGP / t.contract : 0;
    t.collect = sum(issues.filter(function (i) { return i.type === "claim" || i.type === "unbilled" || i.type === "overdue"; }), function (i) { return i.amount || 0; });
    t.stop = sum(issues.filter(function (i) { return (i.type === "overpo" || i.type === "duplicate") && !i.paid; }), function (i) { return i.amount || 0; });
    var notes = issues.filter(function (i) { return i.type === "note"; });
    t.notesKnown = sum(notes, function (i) { return i.amount || 0; });
    t.notesCount = notes.length;
    t.notesUnpriced = notes.filter(function (i) { return !i.amount; }).length;

    var late = issues.filter(function (i) { return i.type === "latepay"; });
    t.latePay = sum(late, function (i) { return i.amount; });
    t.latePayCount = late.length;
    var result = { settings: s, jobs: jobs, jobIndex: jobIndex, issues: issues, totals: t, dupIds: dupIds };
    result.cash = cashForecast(result, data, true);
    result.cashAsIs = cashForecast(result, data, false);
    result.health = health(result);
    return result;
  }
  var RECOVER = { claim: 1, unbilled: 1, overdue: 1, overpo: 1, duplicate: 1, note: 1 };

  // Early-warning indicators, following the financial-health signals recommended in Australian insolvency research
  function health(res) {
    var t = res.totals, s = res.settings, out = [];
    function lvl(bad, warn) { return bad ? "critical" : warn ? "warning" : "good"; }
    var weeks = res.cashAsIs, low = weeks.reduce(function (m, w) { return w.closing < m.closing ? w : m; }, weeks[0]);
    var buffer = s.weeklyOverhead * s.bufferWeeks;
    out.push({ key: "cash", label: "Cash runway", value: low.closing < 0 ? "Short in week of " + low.start : "Low " + Math.round(low.closing / 1000) + "k",
      level: lvl(low.closing < 0, low.closing < buffer), note: "Lowest cash over 13 weeks if nothing changes, against a buffer of " + s.bufferWeeks + " weeks of overheads." });
    var fadePts = (t.origGPpct - t.fcGPpct) * 100;
    out.push({ key: "fade", label: "Margin fade", value: fadePts.toFixed(1) + " pts", level: lvl(fadePts >= 3, fadePts >= 1.5), note: "Forecast gross margin against margin at contract, across all jobs." });
    var ub = t.revised ? t.underbilled / t.revised * 100 : 0;
    out.push({ key: "under", label: "Work not yet claimed", value: ub.toFixed(1) + "% of WIP", level: lvl(ub > 8, ub > 4), note: "Earned but unbilled work. Under SA law you can claim only for work done, so claim promptly." });
    var od = res.issues.filter(function (i) { return i.type === "overdue"; }), odMax = od.reduce(function (m, i) { return Math.max(m, i.days || 0); }, 0);
    out.push({ key: "debtors", label: "Client payments overdue", value: od.length ? od.length + " · oldest " + odMax + " d" : "None", level: lvl(odMax > 21, od.length > 0), note: "Stage claims and variations past the client's payment days." });
    out.push({ key: "trades", label: "Trades paid on time", value: t.latePayCount ? t.latePayCount + " bills late" : "All on time", level: lvl(t.latePay > 50000 || t.latePayCount > 8, t.latePayCount > 0), note: "Late payment to trades is an early sign of distress, and in a shortage it costs you crews." });
    var escShare = t.fcGP > 0 ? t.escalation / t.fcGP * 100 : 100;
    out.push({ key: "fixed", label: "Fixed-price exposure", value: Math.round(escShare) + "% of profit", level: lvl(escShare > 25, escShare > 10), note: "Price-rise allowance on trades not yet ordered, as a share of forecast profit." });
    var basWeek = weeks.filter(function (w) { return s.basDate >= w.start && s.basDate <= w.end; })[0];
    out.push({ key: "tax", label: "Next BAS", value: s.basAmount ? "$" + Math.round(s.basAmount / 1000) + "k on " + s.basDate : "Not set", level: basWeek ? lvl(basWeek.closing < 0, basWeek.closing < buffer) : "good", note: "Quarterly GST and PAYG payment to the ATO, included in the cash forecast." });
    return out;
  }

  function cashForecast(res, data, actNow) {
    var s = res.settings, asAt = s.asAt, weeks = [];
    for (var k = 0; k < 13; k++) weeks.push({ start: addDays(asAt, 7 * k), end: addDays(asAt, 7 * k + 6), inflow: 0, outflow: 0, overhead: s.weeklyOverhead, parts: {} });
    function put(date, amt, dir, part) {
      if (!amt || !date) return;
      var k = Math.floor(daysBetween(asAt, date) / 7); if (k < 0) k = 0; if (k > 12) return;
      weeks[k][dir] += amt; weeks[k].parts[part] = (weeks[k].parts[part] || 0) + amt;
    }
    var excessByInvoice = {};
    if (actNow) res.issues.forEach(function (i) { if (i.type === "overpo") excessByInvoice[i.ref] = i.amount; });
    res.jobs.forEach(function (r) {
      r.futureClaims.forEach(function (c) { if (c.date) put(addDays(c.date, 1 + s.paymentTermsDays), c.amount, "inflow", "Stage claims"); });
      r.unraised.forEach(function (c) { put(addDays(asAt, (actNow ? 0 : 21) + s.paymentTermsDays), c.amount, "inflow", "Late claims"); });
      r.overdue.forEach(function (c) { put(addDays(asAt, actNow ? 7 : 28), c.amount || 0, "inflow", "Overdue claims"); });
      r.variations.forEach(function (v) {
        if (isSigned(v) && !v.invoice_date) {
          var when = actNow ? addDays(asAt, 2 + s.paymentTermsDays) : (r.pred["Practical completion"] ? addDays(r.pred["Practical completion"], s.paymentTermsDays) : null);
          put(when, v.amount, "inflow", "Variations");
        }
      });
      // costs still to be billed by suppliers
      r.codes.forEach(function (c) {
        var billedSoFar = c.actual, stillToBill = c.forecast - billedSoFar;
        if (stillToBill <= 0) return;
        var billDate = r.pred[c.stage] || addDays(asAt, 30);
        if (billDate < asAt) billDate = asAt;
        put(eomFollowing(billDate), stillToBill, "outflow", c.committed > billedSoFar ? "Committed orders" : "Uncommitted costs");
      });
    });
    var poOver = {};
    res.issues.forEach(function (i) { if (i.type === "overpo") poOver[i.ref] = i.amount; });
    (data.supplier_invoices || []).forEach(function (b) {
      if (b.paid_date) return;
      if (actNow && res.dupIds[b.invoice_id]) return;
      var amt = b.amount;
      if (actNow && b.po_id && poOver[b.po_id]) { amt -= poOver[b.po_id]; poOver[b.po_id] = 0; }
      put(b.due_date && b.due_date > asAt ? b.due_date : asAt, Math.max(0, amt), "outflow", "Supplier bills");
    });
    if (s.basAmount > 0 && s.basDate) put(s.basDate < asAt ? asAt : s.basDate, s.basAmount, "outflow", "Tax (BAS)");
    var bal = s.openingCash;
    weeks.forEach(function (w) { w.net = w.inflow - w.outflow - w.overhead; bal += w.net; w.closing = bal; });
    return weeks;
  }

  function summaryForAI(res) {
    var t = res.totals;
    var top = res.jobs.slice().sort(function (a, b) { return b.fadeDollars - a.fadeDollars; }).slice(0, 6).map(function (r) {
      return { job: r.id, estate: r.job.estate, stage: r.stage, margin_at_contract_pct: +(r.origGPpct * 100).toFixed(1), forecast_margin_pct: +(r.fcGPpct * 100).toFixed(1), margin_lost: Math.round(r.fadeDollars), underbilled: Math.round(Math.max(0, -r.overUnder)) };
    });
    var iss = res.issues.filter(function (i) { return RECOVER[i.type]; }).sort(function (a, b) { return (b.amount || 0) - (a.amount || 0); }).slice(0, 10)
      .map(function (i) { return { type: TYPE_LABEL[i.type], job: i.job_id, amount: i.amount ? Math.round(i.amount) : null, detail: i.detail }; });
    var low = res.cash.reduce(function (m, w) { return w.closing < m.closing ? w : m; }, res.cash[0]);
    return {
      as_at: res.settings.asAt, active_jobs: t.jobs, work_in_progress_value: Math.round(t.revised),
      margin_at_contract_pct: +(t.origGPpct * 100).toFixed(1), forecast_margin_pct: +(t.fcGPpct * 100).toFixed(1),
      margin_lost_since_contract: Math.round(t.fadeDollars), cash_to_collect_now: Math.round(t.collect), supplier_overcharges_to_stop: Math.round(t.stop),
      underbilled: Math.round(t.underbilled), unpriced_extras_in_site_notes: t.notesCount, uncommitted_cost_escalation: Math.round(t.escalation),
      jobs_at_risk: t.atRisk, jobs_to_watch: t.watch, lowest_cash_week: { week_starting: low.start, closing_cash: Math.round(low.closing) },
      supplier_bills_past_due: { count: t.latePayCount, amount: Math.round(t.latePay || 0) }, next_bas: { due: res.settings.basDate, amount: res.settings.basAmount },
      health_signs: (res.health || []).map(function (h) { return { sign: h.label, value: h.value, level: h.level === "critical" ? "red" : h.level === "warning" ? "amber" : "green" }; }),
      worst_jobs: top, biggest_items: iss
    };
  }
  // ---------- check one incoming supplier bill against the ledger ----------
  function checkBill(data, res, bill) {
    var s = res.settings, checks = [];
    var pos = data.purchase_orders || [], invs = data.supplier_invoices || [];
    var ns = norm(bill.supplier || ""), nno = norm(bill.supplier_invoice_no || "");
    var amount = +bill.amount || 0;
    function supMatch(x) { var a = norm(x || ""); return a && ns && (a === ns || a.indexOf(ns) >= 0 || ns.indexOf(a) >= 0); }
    // purchase order
    var po = null, pn = norm(bill.po_number || "").replace(/^po/, "");
    if (pn) pos.forEach(function (p) { if (norm(p.po_id).replace(/^po/, "") === pn) po = p; });
    // job
    var job = null;
    if (po) job = res.jobIndex[po.job_id] || null;
    if (!job && bill.job_reference) { var jr = String(bill.job_reference).replace(/[^0-9a-z]/gi, ""); res.jobs.forEach(function (r) { if (norm(r.id) === norm(jr) || (jr && norm(jr).indexOf(norm(r.id)) >= 0 && norm(r.id).length >= 3)) job = r; }); }
    if (!job && bill.site_address) { var ad = norm(bill.site_address); res.jobs.forEach(function (r) { var ja = norm(r.job.address || ""); if (ja && ad.indexOf(ja) >= 0) job = r; }); }
    if (!po && job) {
      var cands = pos.filter(function (p) { return p.job_id === job.id && supMatch(p.supplier); });
      if (cands.length === 1) { po = cands[0]; checks.push({ level: "warning", label: "PO number missing", detail: "The bill doesn't quote a PO. It matches " + po.po_id + " for this supplier on job " + job.id + "." }); }
    }
    // duplicate
    var dup = invs.filter(function (x) { return nno && supMatch(x.supplier) && norm(x.supplier_invoice_no || "") === nno; })[0];
    if (dup) checks.push({ level: "critical", label: "Already entered", detail: "Invoice " + bill.supplier_invoice_no + " from this supplier is already in the ledger as " + dup.invoice_id + " (" + dup.invoice_date + ", $" + Math.round(dup.amount).toLocaleString("en-AU") + ")." + (dup.paid_date ? " It was paid on " + dup.paid_date + "." : "") });
    var code = po ? po.cost_code : null;
    if (po) {
      var billed = invs.filter(function (x) { return x.po_id === po.po_id && !res.dupIds[x.invoice_id]; }).reduce(function (t, x) { return t + (x.amount || 0); }, 0);
      var after = billed + (dup ? 0 : amount), over = after - po.amount;
      if (over > po.amount * s.overPoTolPct && over > s.overPoTolAmt)
        checks.push({ level: "critical", label: "Above purchase order", detail: po.po_id + " is for $" + Math.round(po.amount).toLocaleString("en-AU") + ". Already billed $" + Math.round(billed).toLocaleString("en-AU") + "; this bill takes it to $" + Math.round(after).toLocaleString("en-AU") + ", $" + Math.round(over).toLocaleString("en-AU") + " over.", over: Math.round(over) });
      else if (!dup) checks.push({ level: "good", label: "Within purchase order", detail: po.po_id + " has $" + Math.round(Math.max(0, po.amount - billed)).toLocaleString("en-AU") + " left before this bill." });
    } else checks.push({ level: "warning", label: "No purchase order", detail: "No matching PO was found. Check the work was approved before paying." });
    if (!job) checks.push({ level: "warning", label: "Job not identified", detail: "The bill doesn't name a job number or a site address we recognise." });
    if (!code && job) {
      var counts = {}; invs.forEach(function (x) { if (supMatch(x.supplier) && x.cost_code) counts[x.cost_code] = (counts[x.cost_code] || 0) + 1; });
      code = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || null;
    }
    if (job && code) {
      var c = job.codes.filter(function (x) { return x.code === code; })[0];
      if (c && c.stageStatus === "future") checks.push({ level: "warning", label: "Stage not started", detail: c.name + " belongs to the " + c.stage + " stage, which hasn't started on job " + job.id + "." });
    }
    if (bill.due_date && bill.invoice_date && daysBetween(bill.invoice_date, bill.due_date) < 14) checks.push({ level: "warning", label: "Short payment terms", detail: "Due " + daysBetween(bill.invoice_date, bill.due_date) + " days after the invoice date. Your usual terms are end of the following month." });
    return { po: po, job: job, code: code, codeName: code && CODE_MAP[code] ? CODE_MAP[code].name : code, checks: checks, verdict: checks.some(function (c) { return c.level === "critical"; }) ? "critical" : checks.some(function (c) { return c.level === "warning"; }) ? "warning" : "good" };
  }

  // Regex extraction used when Claude isn't available (works on simple text invoices)
  function roughExtract(text) {
    var t = String(text || ""), m;
    var lines = t.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var supplier = lines.filter(function (l) { return !/tax invoice|invoice$/i.test(l); })[0] || "";
    function grab(re) { var x = t.match(re); return x ? x[1].trim() : null; }
    var money = function (re) { var v = grab(re); return v ? parseMoney(v) : null; };
    return {
      supplier: supplier, supplier_invoice_no: grab(/invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i),
      invoice_date: parseDate(grab(/\bdate\s*[:\-]?\s*([0-9]{1,2}[\/.\-][0-9]{1,2}[\/.\-][0-9]{2,4})/i) || "") || null,
      due_date: parseDate(grab(/\bdue(?:\s*date)?\s*[:\-]?\s*([0-9]{1,2}[\/.\-][0-9]{1,2}[\/.\-][0-9]{2,4})/i) || "") || null,
      subtotal_ex_gst: money(/sub\s*-?total[^0-9$]*\$?\s*([0-9,]+(?:\.[0-9]+)?)/i),
      total_inc_gst: money(/\btotal(?!\s*ex)[^0-9$]*\$?\s*([0-9,]+(?:\.[0-9]+)?)\s*$/im),
      po_number: grab(/\b(PO\s*-?\s*[0-9]+)/i), job_reference: grab(/\bjob\s*(?:no\.?|#)?\s*[:\-]?\s*([0-9]{3,6})/i),
      site_address: grab(/\bsite\s*[:\-]\s*([^\n—]+)/i)
    };
  }

  var TYPE_LABEL = { latepay: "Supplier bill past due", claim: "Claim not sent", unbilled: "Signed variation not invoiced", overdue: "Overdue payment", unsigned: "Variation awaiting signature", overpo: "Bill above purchase order", duplicate: "Duplicate bill", nopo: "Bill without a purchase order", overrun: "Cost code over budget", note: "Extra work in site notes" };

  return {
    AS_AT: AS_AT, STAGES: STAGES, CODES: CODES, SCHEMA: SCHEMA, DEFAULTS: DEFAULTS, TYPE_LABEL: TYPE_LABEL, RECOVER: RECOVER,
    generate: generate, analyse: analyse, parseCSV: parseCSV, toCSV: toCSV, detectTable: detectTable, importTable: importTable,
    summaryForAI: summaryForAI, checkBill: checkBill, roughExtract: roughExtract, parseDate: parseDate, parseMoney: parseMoney, addDays: addDays, daysBetween: daysBetween, tableSpec: tableSpec, isSigned: isSigned
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MW;
