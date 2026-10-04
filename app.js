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

  /* ---------- sample availability ---------- */
  (async function initSample() {
    try {
      if (!window.claude || !window.claude.use) { sampleFn = null; }
      else { sampleFn = await window.claude.use("sample"); }
    } catch (e) { sampleFn = null; }
    if (sampleFn === null) {
      $("noteLine").innerHTML = "⚠️ The live AI runs on your Claude account on <b>claude.ai</b>. Open this page there (signed in) to structure real text.";
    } else {
      $("noteLine").textContent = "Runs on your own Claude account — it asks permission on the first request.";
    }
  })();

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
    if (sampleFn === null) {
      $("out").innerHTML = '<div class="errbox"><b>Live AI unavailable here.</b><br>This demo calls Claude on your own account. Open it on <a href="https://claude.ai" target="_blank" rel="noopener">claude.ai</a> while signed in, then allow it to use Claude on the first request.</div>';
      return;
    }
    if (sampleFn === undefined) {
      // still resolving — wait briefly
      await new Promise(function (r) { setTimeout(r, 400); });
      if (sampleFn === undefined) { $("out").innerHTML = '<div class="thinking"><span class="spinner"></span>Connecting to Claude…</div>'; }
    }

    var slice = text.slice(0, 6000);
    lastEnvelope = null;
    $("tierTag").textContent = "";
    setRunning(true);
    $("out").innerHTML = '<div class="thinking"><span class="spinner"></span><span id="thinkMsg">Reading the text…</span></div>';

    abortCtl = new AbortController();
    var started = false;
    try {
      var env = await sampleFn.json(buildPrompt(slice), {
        modelTier: "default",
        signal: abortCtl.signal,
        onText: function (u) {
          started = true;
          var m = $("thinkMsg");
          if (m) m.textContent = "Structuring… (" + u.text.length + " chars)";
        }
      });
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
