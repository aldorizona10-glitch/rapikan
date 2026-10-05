# Rapikan 🗂️

**Turn messy business text into structured, ready-to-act data — with evidence and human approval.**

Rapikan ("tidy up" in Indonesian) is a small, focused applied-LLM tool. You paste a raw
message — a WhatsApp order, a customer complaint, meeting notes, an inbound sales lead, a
receipt — and it returns a clean, structured record: the extracted fields, a **verbatim quote
from your text showing where each value came from**, a list of anything **missing or ambiguous
that a human should decide**, and a **drafted reply you review before sending**.

It is deliberately not an "autopilot". The design principle is the one that matters when AI
touches real orders, money, and customers: **read the source, don't guess; flag gaps instead of
inventing them; and keep a human in the loop.**

## ▶️ Live demo

**https://aldorizona10-glitch.github.io/rapikan/**

Open it and click **Load example → Structure it** — **Demo mode** shows a real structured result
instantly, with no sign-in and no key required. To structure *your own* text, either add your own
**Anthropic API key** (stored only in your browser, sent only to `api.anthropic.com`) or open the
page signed in to **claude.ai** (it then runs on your own Claude account). Nothing is stored on a
server either way.

## What it does

| Workflow | Input | Output |
|---|---|---|
| **Order intake** | Chat / WhatsApp order | Customer, items table, total, confirmation draft |
| **Support triage** | Customer message | Category, urgency, sentiment, reply draft |
| **Meeting → actions** | Meeting notes | Decisions, action items (owner + due), recap draft |
| **Lead qualification** | Inbound inquiry | Contact, need, budget signal, fit, next-step reply |
| **Receipt / invoice** | Receipt text | Vendor, line items, subtotal, tax, total |
| **Custom** | Any text + your instruction | Whatever fields you describe |

## How it's built

- **No framework, no build step** — plain HTML, CSS, and JavaScript (`rapikan.html` +
  `styles.css` + `app.js`), no dependencies, no backend. All state stays in the browser.
  (The live demo above is served as a single self-contained page.)
- **Structured output** — one uniform JSON contract (`title`, `confidence`, `fields[]` with a
  `source` quote each, optional `table`, optional `draft`, `flags[]`) is requested from the model
  and rendered by a single view, so every workflow shares the same reviewable shape.
- **Evidence grounding** — the prompt requires each extracted value to carry a verbatim quote
  from the input, and inferred values are labelled rather than presented as fact.
- **Approval gate** — drafted messages are shown as editable `DRAFT`s; nothing is auto-sent.
- **Runs anywhere** — Demo mode gives instant sample results with no key; add an Anthropic API key (browser-only) or open on claude.ai for live structuring of your own text.
  the UI still loads and explains where to run it.
- **Accessible & themed** — full light/dark theming (system + manual toggle), keyboard focus
  states, and `prefers-reduced-motion` support.

## Why this exists

Small businesses drown in unstructured text — orders in chat apps, complaints, notes. Most
"AI automation" either does too little (a chatbot) or too much (auto-acting on hallucinated
data). Rapikan is a demonstration of the middle path: **LLMs applied to real operational work,
grounded in evidence and gated on human judgement.**

## Author

Built by **Aldo Rizona** — AI Implementation & Automation.

- GitHub: https://github.com/aldorizona10-glitch
- LinkedIn: https://www.linkedin.com/in/aldo-rizona-9366b2345

## License

MIT
