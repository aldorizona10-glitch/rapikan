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

**https://claude.ai/code/artifact/fc3ef796-3760-4435-bc63-568264d157ea**

The live app runs the LLM on the viewer's own Claude account (it asks permission on the first
request) and stores nothing on a server. Open it while signed in to claude.ai, click
**Load example → Structure it**, and watch it work.

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

- **Single self-contained page** — plain HTML/CSS/JavaScript, no build step, no dependencies,
  no backend. All state stays in the browser.
- **Structured output** — one uniform JSON contract (`title`, `confidence`, `fields[]` with a
  `source` quote each, optional `table`, optional `draft`, `flags[]`) is requested from the model
  and rendered by a single view, so every workflow shares the same reviewable shape.
- **Evidence grounding** — the prompt requires each extracted value to carry a verbatim quote
  from the input, and inferred values are labelled rather than presented as fact.
- **Approval gate** — drafted messages are shown as editable `DRAFT`s; nothing is auto-sent.
- **Graceful degradation** — if the LLM runtime isn't available (e.g. opened outside claude.ai),
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
