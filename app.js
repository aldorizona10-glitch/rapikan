(function () {
  "use strict";

  var WORKFLOWS = [
    {
      id: "order", name: "Order intake",
      desc: "Chat / WhatsApp order → a clean order record + confirmation draft.",
      instruction: "You are an operations assistant for a small business. Extract a structured customer ORDER from the message. Capture: customer name, phone, delivery address, payment method, and whether it is delivery or pickup. Put the ordered products as line items in \"table\" with columns [\"Item\",\"Qty\",\"Unit price\",\"Line total\"]; compute a line total only when a unit price is given. Add a \"fields\" entry for the grand total (use the stated total if present; otherwise flag it). Write a short, polite order-confirmation message in \"draft\" for the seller to review and send.",
      example: "halo kak mau order dong, nama Rina Sari, kirim ke Jl. Melati No.12 Bandung 40123. minta 2 kaos polos hitam size L @85rb sama 1 topi baseball @60rb. bayar transfer BCA. tolong dikirim besok ya. wa 0812-3456-7890 makasih"
    },
    {
      id: "support", name: "Support triage",
      desc: "Customer message → category, urgency, sentiment + a reply draft.",
      instruction: "You are a customer-support triage assistant. From the message, extract fields: category (e.g. shipping, billing, product, complaint), urgency (low/medium/high), customer sentiment, the core issue in one line, any order/invoice number mentioned, and any deadline the customer states. Write an empathetic first-response draft in \"draft\" for an agent to review. Do not promise anything the message does not support.",
      example: "Halo, saya sudah bayar sejak 3 hari lalu tapi pesanan #INV-20291 belum dikirim juga. Ini pesanan buat acara hari Sabtu, kalau nggak sampai sebelum Jumat jadi percuma. Sudah 2x saya chat CS tapi nggak dibalas. Kecewa banget, tolong dicek."
    },
    {
      id: "meeting", name: "Meeting → actions",
      desc: "Meeting notes → decisions, action items with owners & due dates.",
      instruction: "You are a meeting assistant. From the notes, extract: key decisions (as fields), and action items as a \"table\" with columns [\"Action\",\"Owner\",\"Due\"]. Add fields for any risks raised and for the next meeting date if mentioned. Set \"draft\" to a short recap message the organizer can send to the team. Only include owners and dates that are actually stated.",
      example: "Notulen rapat 24 Sep: sepakat launch fitur baru tanggal 10 Okt. Budi urus copywriting landing page sebelum 1 Okt. Sari koordinasi dengan vendor desain, target aset kelar 5 Okt. Ada risiko API pembayaran belum di-approve bank, Andi follow up ke bank minggu ini. Next meeting Selasa depan."
    },
    {
      id: "lead", name: "Lead qualification",
      desc: "Inbound inquiry → contact, need, budget signal, fit & next step.",
      instruction: "You are a sales-development assistant. From the inbound inquiry, extract fields: contact name, role, company, company size, the problem they want solved, any budget or timeline signal, and a suggested next step. Add a field \"Fit\" with a one-line judgement (and reflect it in confidence). Write a brief, professional reply in \"draft\" that proposes the next step. Do not fabricate budget or company details that are not stated.",
      example: "Hi, we're a mid-size logistics company in Surabaya (~120 staff). We want to automate our customer WhatsApp inquiries — right now 3 people handle ~400 messages a day manually. Budget is flexible if the ROI is clear, hoping to start within a month. Can we book a call next week? — Andre, Ops Manager"
    },
    {
      id: "receipt", name: "Receipt / invoice",
      desc: "Receipt or invoice text → vendor, line items, tax, total.",
      instruction: "You are a bookkeeping assistant. From the receipt/invoice text, extract fields: vendor, date, payment method. Put purchased items in a \"table\" with columns [\"Item\",\"Qty\",\"Unit price\",\"Amount\"]. Add fields for subtotal, tax, and total, using stated values; if the numbers do not add up, note it in \"flags\". No \"draft\" is needed unless useful.",
      example: "INVOICE Toko Berkah Jaya - 22/09/2026. Kertas A4 80gsm x5 rim @52.000, Tinta printer hitam x2 @95.000, Map plastik x20 @3.500. Subtotal 520.000, PPN 11% 57.200, Total 577.200. Pembayaran: Tunai."
    },
    {
      id: "custom", name: "Custom",
      desc: "Describe your own extraction task, then paste the text.",
      instruction: "",
      example: ""
    }
  ];

  var SCHEMA = [
    "",
    "Return ONLY a JSON object (no markdown fences, no commentary) with EXACTLY this shape:",
    "{",
    '  "title": "short title for this record",',
    '  "confidence": "high" | "medium" | "low",',
    '  "summary": "one plain-language sentence",',
    '  "fields": [ { "label": "Field name", "value": "extracted value", "source": "short verbatim quote from the input, or empty string if inferred" } ],',
    '  "table": { "columns": ["Col1","Col2"], "rows": [["a","b"]] },',
    '  "draft": { "label": "Suggested message", "body": "a ready-to-review draft" },',
    '  "flags": [ "anything missing, ambiguous, or needing a human decision" ]',
    "}",
    'Set "table" to null when there are no line items. Set "draft" to null when a drafted message does not apply. "flags" may be an empty array.',
    "Rules:",
    "- Never invent facts that are not in the input. If an expected value is missing or unclear, add a note to \"flags\" instead of guessing.",
    "- \"source\" MUST be copied verbatim from the input (a few words is enough). Use \"\" only when the value is genuinely inferred rather than stated.",
    "- Write \"draft.body\" in the same language as the input message.",
    "- Keep everything concise."
  ].join("\n");

  var $ = function (id) { return document.getElementById(id); };
  var current = WORKFLOWS[0];
  var sampleFn = undefined;      // undefined = still resolving, null = unavailable, function = ready
  var abortCtl = null;
  var lastEnvelope = null;

  /* ---------- theme ---------- */
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("rapikan-theme"); } catch (e) {}
    if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
    $("themeBtn").addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var isDark = cur === "dark" || (!cur && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      var next = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("rapikan-theme", next); } catch (e) {}
    });
  })();

  /* ---------- workflow chooser ---------- */
  var flowsEl = $("flows");
  WORKFLOWS.forEach(function (w) {
    var b = document.createElement("button");
    b.className = "flow";
    b.textContent = w.name;
    b.setAttribute("aria-pressed", w.id === current.id ? "true" : "false");
    b.addEventListener("click", function () { selectFlow(w); });
    flowsEl.appendChild(b);
    w._btn = b;
  });

  function selectFlow(w) {
    current = w;
    WORKFLOWS.forEach(function (x) { x._btn.setAttribute("aria-pressed", x.id === w.id ? "true" : "false"); });
    $("flowDesc").textContent = w.desc;
    $("customInstr").classList.toggle("hide", w.id !== "custom");
    $("input").placeholder = w.id === "custom"
      ? "Paste the text you want to structure…"
      : "Paste the raw message, note, or document here…";
  }
  selectFlow(current);

  /* ---------- example / clear ---------- */
  $("exampleBtn").addEventListener("click", function () {
    if (current.id === "custom") {
      $("customInstr").value = "Pull out the candidate's name, the role they applied for, years of experience, key skills, and whether they seem a strong fit.";
      $("input").value = "Halo, perkenalkan saya Dimas. Saya apply untuk posisi AI Automation Engineer. Pengalaman saya sekitar 2 tahun bikin workflow otomatisasi pakai Python dan LLM API, pernah integrasi ke WhatsApp dan Google Sheets. Skill utama: prompt engineering, REST API, sedikit n8n. Siap mulai bulan depan.";
    } else {
      $("input").value = current.example;
    }
    $("input").focus();
  });
  $("clearBtn").addEventListener("click", function () {
    $("input").value = ""; $("customInstr").value = "";
    lastEnvelope = null;
    $("out").innerHTML = '<div class="placeholder"><div class="big">🗂️</div>Your structured result appears here.<br>Pick a workflow, load an example, and hit “Structure it”.</div>';
    $("tierTag").textContent = "";
    $("input").focus();
  });

    /* ---------- provider: claude.ai, your API key, or demo ---------- */
  var KEY_LS = "rapikan-api-key";
  function getKey() { try { return (localStorage.getItem(KEY_LS) || "").trim(); } catch (e) { return ""; } }
  function setKey(v) { try { if (v) localStorage.setItem(KEY_LS, v); else localStorage.removeItem(KEY_LS); } catch (e) {} }

  function currentMode() {
    if (getKey()) return "key";
    if (typeof sampleFn === "function") return "claude";
    return "demo";
  }
  function refreshNote() {
    var n = $("noteLine"); if (!n) return;
    var m = currentMode();
    if (m === "key") n.innerHTML = 'Using your Anthropic API key — stored only in this browser, sent only to api.anthropic.com. <a href="#" class="keyLink">Change / remove</a>';
    else if (m === "claude") n.innerHTML = 'Running on your Claude account on claude.ai — asks permission on the first request. <a href="#" class="keyLink">Use an API key instead</a>';
    else n.innerHTML = 'Demo mode — load an example and hit “Structure it” for an instant sample result. <a href="#" class="keyLink">Add your API key</a> to structure your own text.';
    var l = n.querySelector(".keyLink");
    if (l) l.addEventListener("click", function (ev) { ev.preventDefault(); promptKey(); });
  }
  function promptKey() {
    var cur = getKey();
    var v = window.prompt(cur ? "Update your Anthropic API key, or clear it (leave empty to remove):" : "Paste your Anthropic API key (sk-ant-…).\nIt is stored only in this browser and sent only to api.anthropic.com.", cur);
    if (v === null) return;
    setKey(v.trim());
    refreshNote();
  }

  function parseEnvelope(txt) {
    var s = String(txt == null ? "" : txt).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    var a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    try { return JSON.parse(s); } catch (e) { var err = new Error("invalid_json"); err.code = "invalid_json"; throw err; }
  }
  async function callAnthropicJSON(prompt, opts) {
    opts = opts || {};
    if (opts.onText) opts.onText({ text: "" });
    var res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: opts.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": getKey(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-opus-5",
          max_tokens: 2000,
          output_config: { effort: "low" },
          messages: [{ role: "user", content: prompt }]
        })
      });
    } catch (e) {
      if (e && e.name === "AbortError") { var ce = new Error("cancelled"); ce.code = "cancelled"; throw ce; }
      var ne = new Error("upstream_error"); ne.code = "upstream_error"; throw ne;
    }
    if (!res.ok) {
      var code = res.status === 401 ? "bad_key" : res.status === 429 ? "rate_limited" : (res.status === 400 ? "invalid_json" : "upstream_error");
      var err = new Error("http " + res.status); err.code = code; throw err;
    }
    var data = await res.json();
    if (data && data.stop_reason === "refusal") { var r = new Error("refused"); r.code = "refused"; throw r; }
    var out = "", blocks = (data && data.content) || [];
    for (var i = 0; i < blocks.length; i++) { if (blocks[i] && blocks[i].type === "text") out += blocks[i].text; }
    return parseEnvelope(out);
  }

  /* ---------- demo-mode sample results (no key, no network) ---------- */
  var CUSTOM_DEMO_INPUT = "Halo, perkenalkan saya Dimas. Saya apply untuk posisi AI Automation Engineer. Pengalaman saya sekitar 2 tahun bikin workflow otomatisasi pakai Python dan LLM API, pernah integrasi ke WhatsApp dan Google Sheets. Skill utama: prompt engineering, REST API, sedikit n8n. Siap mulai bulan depan.";
  var DEMO = {
    order: {
      title: "Order — Rina Sari (2 items)", confidence: "high",
      summary: "Delivery order from Rina Sari: 2 black plain tees (size L) and 1 baseball cap, paid by BCA transfer, to be shipped tomorrow to Bandung.",
      fields: [
        { label: "Customer", value: "Rina Sari", source: "nama Rina Sari" },
        { label: "Phone (WhatsApp)", value: "0812-3456-7890", source: "wa 0812-3456-7890" },
        { label: "Delivery address", value: "Jl. Melati No.12, Bandung 40123", source: "kirim ke Jl. Melati No.12 Bandung 40123" },
        { label: "Fulfilment", value: "Delivery", source: "tolong dikirim besok" },
        { label: "Payment method", value: "Bank transfer (BCA)", source: "bayar transfer BCA" },
        { label: "Grand total", value: "Rp230.000", source: "" }
      ],
      table: { columns: ["Item", "Qty", "Unit price", "Line total"], rows: [["Kaos polos hitam (L)", "2", "Rp85.000", "Rp170.000"], ["Topi baseball", "1", "Rp60.000", "Rp60.000"]] },
      draft: { label: "Order confirmation", body: "Halo Kak Rina, terima kasih ordernya! 😊\n\nRekap pesanan:\n- Kaos polos hitam (L) x2 — Rp170.000\n- Topi baseball x1 — Rp60.000\nTotal: Rp230.000\n\nKirim ke: Jl. Melati No.12, Bandung 40123\nPembayaran: transfer BCA\nPengiriman: besok\n\nMohon konfirmasi ya, nanti langsung kami proses. Terima kasih!" },
      flags: ["Grand total (Rp230.000) is computed from the line items — not stated in the message; please confirm.", "No delivery fee mentioned — confirm whether shipping is free or charged."]
    },
    support: {
      title: "Support — delayed order #INV-20291", confidence: "high",
      summary: "Customer paid 3 days ago but order #INV-20291 has not shipped; they need it before Friday for a Saturday event and are frustrated after two unanswered chats.",
      fields: [
        { label: "Category", value: "Shipping / fulfilment delay", source: "belum dikirim juga" },
        { label: "Urgency", value: "High", source: "kalau nggak sampai sebelum Jumat jadi percuma" },
        { label: "Sentiment", value: "Frustrated / disappointed", source: "Kecewa banget" },
        { label: "Order number", value: "INV-20291", source: "pesanan #INV-20291" },
        { label: "Core issue", value: "Paid order not shipped after 3 days", source: "sudah bayar sejak 3 hari lalu" },
        { label: "Deadline", value: "Before Friday (event Saturday)", source: "sebelum Jumat" }
      ],
      table: null,
      draft: { label: "First response", body: "Halo Kak, mohon maaf banget atas keterlambatan dan chat yang belum terbalas 🙏 Saya bantu cek pesanan #INV-20291 sekarang. Saya paham ini untuk acara Sabtu dan perlu tiba sebelum Jumat. Boleh saya konfirmasi dulu status pengirimannya, dan saya kabari secepatnya hari ini ya. Terima kasih sudah sabar menunggu." },
      flags: ["Reply promises nothing about the delivery date until shipping status is verified.", "Two prior chats went unanswered — check the CS queue and prioritise this ticket.", "Confirm whether expedited shipping can meet the Friday deadline."]
    },
    meeting: {
      title: "Meeting recap — 24 Sep (feature launch)", confidence: "high",
      summary: "The team agreed to launch the new feature on 10 Oct, assigned copywriting and design-asset tasks, flagged a payment-API approval risk, and set the next meeting for Tuesday.",
      fields: [
        { label: "Decision", value: "Launch the new feature on 10 Oct", source: "sepakat launch fitur baru tanggal 10 Okt" },
        { label: "Risk", value: "Payment API not yet approved by the bank", source: "risiko API pembayaran belum di-approve bank" },
        { label: "Next meeting", value: "Tuesday next week", source: "Next meeting Selasa depan" }
      ],
      table: { columns: ["Action", "Owner", "Due"], rows: [["Landing-page copywriting", "Budi", "1 Oct"], ["Coordinate with design vendor (assets)", "Sari", "5 Oct"], ["Follow up payment-API approval with the bank", "Andi", "This week"]] },
      draft: { label: "Team recap", body: "Recap rapat 24 Sep:\n- Launch fitur baru: 10 Okt\n- Budi: copywriting landing page — deadline 1 Okt\n- Sari: koordinasi vendor desain, aset target 5 Okt\n- Andi: follow up approval API pembayaran ke bank minggu ini (risiko)\nNext meeting: Selasa depan.\nMohon dikoreksi kalau ada yang kurang. Terima kasih!" },
      flags: ["The exact date/time for “Tuesday next week” is not specified — confirm.", "Payment-API approval is a launch blocker — track it closely before 10 Oct."]
    },
    lead: {
      title: "Lead — Andre, Ops Manager (logistics, Surabaya)", confidence: "medium",
      summary: "A mid-size Surabaya logistics firm (~120 staff) wants to automate ~400 daily WhatsApp inquiries currently handled by 3 people; budget is flexible with clear ROI, aiming to start within a month.",
      fields: [
        { label: "Contact", value: "Andre", source: "— Andre, Ops Manager" },
        { label: "Role", value: "Operations Manager", source: "Ops Manager" },
        { label: "Company", value: "Logistics company (name not given)", source: "we're a mid-size logistics company" },
        { label: "Location", value: "Surabaya", source: "in Surabaya" },
        { label: "Company size", value: "~120 staff", source: "~120 staff" },
        { label: "Problem", value: "Automate ~400 daily WhatsApp inquiries (3 staff today)", source: "automate our customer WhatsApp inquiries" },
        { label: "Budget signal", value: "Flexible if ROI is clear", source: "Budget is flexible if the ROI is clear" },
        { label: "Timeline", value: "Start within a month", source: "start within a month" },
        { label: "Fit", value: "Strong — clear pain, volume, and timeline", source: "" },
        { label: "Next step", value: "Book a discovery call next week", source: "book a call next week" }
      ],
      table: null,
      draft: { label: "Reply", body: "Hi Andre, thanks for reaching out. Automating ~400 daily WhatsApp inquiries across a 3-person team is exactly the kind of workflow we can help with — triage, drafted replies, and human approval before anything goes out. A 30-minute call next week would let us map your current flow and the ROI. Would Tuesday or Thursday afternoon work? — Aldo" },
      flags: ["Company name not stated — ask before sending a proposal.", "No explicit budget figure — qualify the range on the call."]
    },
    receipt: {
      title: "Invoice — Toko Berkah Jaya (22 Sep 2026)", confidence: "high",
      summary: "Cash purchase from Toko Berkah Jaya on 22 Sep 2026: A4 paper, black printer ink, and plastic folders; subtotal Rp520.000, 11% VAT Rp57.200, total Rp577.200.",
      fields: [
        { label: "Vendor", value: "Toko Berkah Jaya", source: "Toko Berkah Jaya" },
        { label: "Date", value: "22/09/2026", source: "22/09/2026" },
        { label: "Payment method", value: "Cash", source: "Pembayaran: Tunai" },
        { label: "Subtotal", value: "Rp520.000", source: "Subtotal 520.000" },
        { label: "Tax", value: "PPN 11% — Rp57.200", source: "PPN 11% 57.200" },
        { label: "Total", value: "Rp577.200", source: "Total 577.200" }
      ],
      table: { columns: ["Item", "Qty", "Unit price", "Amount"], rows: [["Kertas A4 80gsm", "5 rim", "Rp52.000", "Rp260.000"], ["Tinta printer hitam", "2", "Rp95.000", "Rp190.000"], ["Map plastik", "20", "Rp3.500", "Rp70.000"]] },
      draft: null,
      flags: ["Line items (Rp260.000 + Rp190.000 + Rp70.000 = Rp520.000) match the stated subtotal.", "Line amounts are computed from qty × unit price (not itemised on the receipt) — verify against the original."]
    },
    custom: {
      title: "Candidate — Dimas (AI Automation Engineer)", confidence: "high",
      summary: "Dimas applied for AI Automation Engineer with ~2 years building automation on Python and LLM APIs (WhatsApp, Google Sheets); a strong match to the role, available next month.",
      fields: [
        { label: "Name", value: "Dimas", source: "perkenalkan saya Dimas" },
        { label: "Role applied", value: "AI Automation Engineer", source: "posisi AI Automation Engineer" },
        { label: "Experience", value: "~2 years", source: "sekitar 2 tahun" },
        { label: "Key skills", value: "Python, LLM APIs, prompt engineering, REST API, WhatsApp & Google Sheets integration, some n8n", source: "prompt engineering, REST API, sedikit n8n" },
        { label: "Availability", value: "Next month", source: "Siap mulai bulan depan" },
        { label: "Fit", value: "Strong — direct match to automation + LLM-API requirements", source: "" }
      ],
      table: null,
      draft: null,
      flags: ["No portfolio links or references provided — request work samples.", "Experience is self-reported (~2 years) — verify in the interview."]
    }
  };
  function norm(s) { return String(s || "").trim().replace(/\s+/g, " ").toLowerCase(); }
  function demoEnvelope(text) {
    var env = DEMO[current.id]; if (!env) return null;
    var example = current.id === "custom" ? CUSTOM_DEMO_INPUT : current.example;
    if (!example) return null;
    var a = norm(text), b = norm(example);
    if (a === b || (a.length >= 24 && b.indexOf(a.slice(0, 48)) >= 0) || (b.length >= 24 && a.indexOf(b.slice(0, 48)) >= 0)) {
      return JSON.parse(JSON.stringify(env));
    }
    return null;
  }

  /* ---------- availability (claude.ai) ---------- */
  (async function initSample() {
    try {
      if (!window.claude || !window.claude.use) { sampleFn = null; }
      else { sampleFn = await window.claude.use("sample"); }
    } catch (e) { sampleFn = null; }
    refreshNote();
  })();
  refreshNote();

  /* ---------- run ---------- */
  $("runBtn").addEventListener("click", run);
  $("stopBtn").addEventListener("click", function () { if (abortCtl) abortCtl.abort(); });

  function buildPrompt(text) {
    var instr = current.id === "custom"
      ? ("You are a data-extraction assistant. TASK: " + ($("customInstr").value.trim() || "Extract the key structured fields from the text below."))
      : current.instruction;
    return instr + "\n" + SCHEMA + "\n\nINPUT:\n<<<\n" + text + "\n>>>";
  }

  async function run() {
    var text = $("input").value.trim();
    if (!text) { $("input").focus(); return; }
    if (current.id === "custom" && !$("customInstr").value.trim()) {
      $("customInstr").focus(); return;
    }
    if (!getKey() && sampleFn === undefined) {
      await new Promise(function (r) { setTimeout(r, 500); });
    }
    var mode = currentMode();
    if (mode === "demo") {
      var demoEnv = demoEnvelope(text);
      if (demoEnv) { renderEnvelope(demoEnv); saveRecent(text); }
      else {
        $("out").innerHTML = '<div class="errbox"><b>Demo mode.</b><br>Load an example and hit “Structure it” to see a full sample result instantly. To structure your <i>own</i> text, add your Anthropic API key (<a href="#" id="addKeyInline">add key</a>) or open this page signed in to <a href="https://claude.ai" target="_blank" rel="noopener">claude.ai</a>.</div>';
        var ak = $("addKeyInline"); if (ak) ak.addEventListener("click", function (ev) { ev.preventDefault(); promptKey(); });
      }
      return;
    }

    var slice = text.slice(0, 6000);
    lastEnvelope = null;
    $("tierTag").textContent = "";
    setRunning(true);
    $("out").innerHTML = '<div class="thinking"><span class="spinner"></span><span id="thinkMsg">Reading the text…</span></div>';

    abortCtl = new AbortController();
    var started = false;
    try {
      var env;
      if (mode === "key") {
        env = await callAnthropicJSON(buildPrompt(slice), { signal: abortCtl.signal, onText: function () { started = true; var m = $("thinkMsg"); if (m) m.textContent = "Structuring…"; } });
      } else {
        env = await sampleFn.json(buildPrompt(slice), {
          modelTier: "default",
          signal: abortCtl.signal,
          onText: function (u) {
            started = true;
            var m = $("thinkMsg");
            if (m) m.textContent = "Structuring… (" + u.text.length + " chars)";
          }
        });
      }
      renderEnvelope(env);
      saveRecent(text);
    } catch (e) {
      renderError(e, started);
    } finally {
      setRunning(false);
      abortCtl = null;
    }
  }

  function setRunning(on) {
    $("runBtn").disabled = on;
    $("runBtn").textContent = on ? "Working…" : "Structure it →";
    $("stopBtn").style.display = on ? "" : "none";
  }

  /* ---------- render ---------- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var NUMRE = /^[\s]*(rp|idr|\$)?[\s]*[\d.,]+(\s*%)?[\s]*$/i;

  function renderEnvelope(env) {
    lastEnvelope = env;
    var out = $("out");
    out.innerHTML = "";
    if (!env || typeof env !== "object") { renderError({ code: "invalid_json" }, false); return; }

    var conf = (env.confidence || "medium").toString().toLowerCase();
    if (["high", "medium", "low"].indexOf(conf) < 0) conf = "medium";

    var top = el("div", "result-top");
    var tt = el("div");
    tt.appendChild(el("h3", "result-title", env.title || "Structured result"));
    top.appendChild(tt);
    var pill = el("span", "pill " + conf);
    pill.appendChild(el("span", "dot"));
    pill.appendChild(document.createTextNode(conf + " confidence"));
    top.appendChild(pill);
    out.appendChild(top);

    if (env.summary) out.appendChild(el("p", "result-sum", env.summary));

    // fields
    if (Array.isArray(env.fields) && env.fields.length) {
      var wrap = el("div", "fields");
      env.fields.forEach(function (f) {
        if (!f || (f.value == null && !f.label)) return;
        var row = el("div", "field");
        row.appendChild(el("div", "k", f.label || "—"));
        var v = el("div", "v");
        v.appendChild(el("div", "val", (f.value == null || f.value === "") ? "—" : String(f.value)));
        if (f.source && String(f.source).trim()) v.appendChild(el("div", "src", String(f.source).trim()));
        else if (f.value && String(f.value).trim() && String(f.value) !== "—") v.appendChild(el("div", "inferred", "inferred"));
        row.appendChild(v);
        wrap.appendChild(row);
      });
      out.appendChild(wrap);
    }

    // table
    if (env.table && Array.isArray(env.table.columns) && Array.isArray(env.table.rows) && env.table.rows.length) {
      out.appendChild(el("div", "sec-label", "Line items"));
      var tw = el("div", "tablewrap");
      var table = el("table");
      var thead = el("thead"), htr = el("tr");
      env.table.columns.forEach(function (c) {
        var th = el("th", null, String(c));
        if (NUMRE.test(String(c)) || /price|total|amount|qty|jumlah|harga|tax|ppn/i.test(String(c))) th.className = "num";
        htr.appendChild(th);
      });
      thead.appendChild(htr); table.appendChild(thead);
      var tb = el("tbody");
      env.table.rows.forEach(function (r) {
        var tr = el("tr");
        (Array.isArray(r) ? r : [r]).forEach(function (cell) {
          var td = el("td", null, cell == null ? "" : String(cell));
          if (NUMRE.test(String(cell))) td.className = "num";
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      table.appendChild(tb); tw.appendChild(table); out.appendChild(tw);
    }

    // flags
    if (Array.isArray(env.flags) && env.flags.length) {
      out.appendChild(el("div", "sec-label", "Needs your attention"));
      var ul = el("ul", "flags");
      env.flags.forEach(function (fl) { if (fl) ul.appendChild(el("li", null, String(fl))); });
      out.appendChild(ul);
    }

    // draft
    if (env.draft && (env.draft.body || env.draft.label)) {
      out.appendChild(el("div", "sec-label", "Drafted action"));
      var d = el("div", "draft");
      var dh = el("div", "draft-h");
      dh.appendChild(el("span", "dl", env.draft.label || "Suggested message"));
      dh.appendChild(el("span", "draft-tag", "DRAFT · REVIEW BEFORE SENDING"));
      d.appendChild(dh);
      var ta = el("textarea");
      ta.value = env.draft.body || "";
      ta.id = "draftBody";
      d.appendChild(ta);
      out.appendChild(d);
    }

    // approval banner
    var ap = el("div", "approve");
    var apt = el("div");
    apt.innerHTML = "<b>You're in control.</b> Nothing here is sent, saved to a server, or acted on. Edit any draft, then copy what you need.";
    ap.appendChild(apt);
    out.appendChild(ap);

    // actions
    var acts = el("div", "out-actions");
    var copyJson = el("button", "btn btn-ghost", "Copy JSON");
    copyJson.addEventListener("click", function () { copyText(JSON.stringify(env, null, 2), copyJson, "Copy JSON"); });
    acts.appendChild(copyJson);
    if (env.draft && env.draft.body) {
      var copyDraft = el("button", "btn btn-primary", "Copy draft");
      copyDraft.addEventListener("click", function () {
        var db = $("draftBody");
        copyText(db ? db.value : env.draft.body, copyDraft, "Copy draft");
      });
      acts.appendChild(copyDraft);
    }
    out.appendChild(acts);
  }

  function renderError(e, hadText) {
    if (e && e.code === "cancelled") {
      if (hadText && e.text) { $("out").innerHTML = '<div class="errbox">Stopped. Partial result discarded — hit “Structure it” to run again.</div>'; }
      else { $("out").innerHTML = '<div class="placeholder"><div class="big">🗂️</div>Stopped. Adjust the text and run again.</div>'; }
      return;
    }
    var map = {
      not_granted: "This demo needs permission to use Claude on your account. Reload and allow it, or open on claude.ai while signed in.",
      sampling_disabled: "Claude isn't available on this account. Try opening the page on claude.ai.",
      not_declared: "The live AI isn't enabled for this view.",
      capability_disabled: "The live AI can't run in this view. Open it on claude.ai.",
      capability_removed: "This viewer is out of date for the live AI.",
      rate_limited: "Too many requests right now — wait a moment, then try again.",
      bad_key: "That API key was rejected (401). Check the key and try again.",
      session_expired: "Your session expired — sign in to claude.ai again.",
      prompt_too_large: "That text is long — try a shorter sample (a few thousand characters).",
      invalid_json: "Couldn't structure that cleanly. Try again, or simplify the text a little.",
      refused: "Claude declined this input. Try different text.",
      empty_completion: "No result came back — rephrase or try a shorter sample.",
      upstream_error: "Something went wrong reaching Claude. Try again in a moment."
    };
    var msg = (e && map[e.code]) || "Something went wrong. Try again in a moment.";
    $("out").innerHTML = '<div class="errbox"><b>Couldn\'t finish.</b><br>' + escapeHtml(msg) + "</div>";
  }

  /* ---------- helpers ---------- */
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function copyText(txt, btn, label) {
    var done = function () { btn.textContent = "Copied ✓"; setTimeout(function () { btn.textContent = label; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    } else { fallbackCopy(txt); done(); }
  }
  function fallbackCopy(txt) {
    try {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    } catch (e) {}
  }

  /* ---------- recent (localStorage) ---------- */
  function loadRecent() {
    try { return JSON.parse(localStorage.getItem("rapikan-recent") || "[]"); } catch (e) { return []; }
  }
  function saveRecent(text) {
    var list = loadRecent();
    list.unshift({ w: current.id, wn: current.name, t: text.slice(0, 90), full: text.slice(0, 6000), ts: Date.now() });
    list = list.slice(0, 6);
    try { localStorage.setItem("rapikan-recent", JSON.stringify(list)); } catch (e) {}
    renderRecent();
  }
  function renderRecent() {
    var list = loadRecent();
    var wrap = $("recentWrap"), box = $("recentList");
    if (!list.length) { wrap.classList.add("hide"); return; }
    wrap.classList.remove("hide");
    box.innerHTML = "";
    list.forEach(function (r) {
      var b = el("button", "recent-item");
      b.appendChild(el("span", null, (r.t || "(text)") + (r.t && r.t.length >= 90 ? "…" : "")));
      b.appendChild(el("span", "tag", r.wn || r.w));
      b.addEventListener("click", function () {
        var wf = WORKFLOWS.filter(function (x) { return x.id === r.w; })[0];
        if (wf) selectFlow(wf);
        $("input").value = r.full || r.t || "";
        window.scrollTo({ top: 0, behavior: "smooth" });
        $("input").focus();
      });
      box.appendChild(b);
    });
  }
  renderRecent();

})();
