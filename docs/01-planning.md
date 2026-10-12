# AwaazPay — Phase 1 Planning

**Course:** Human Computer Interaction, Bahria University Islamabad Campus — Assignment #2
**Prototype:** AwaazPay, a voice-first, Urdu-friendly bill-payment and money-transfer assistant (educational demo, no real money)

## 1. Project summary

AwaazPay lets a first-time digital-finance user pay a fictional utility bill, send fictional money to a saved contact, check a fictional balance, and review fictional transactions by **speaking, typing or pressing large buttons**, in Urdu or English. A rule-based assistant guides one question at a time, shows the full details before anything is "paid", and leaves the final confirmation to the user.

## 2. Core problem and design rationale

Conventional finance apps assume English terminology, menu navigation, small text and form filling. For some older adults, people with limited digital or reading literacy, and Urdu-first users, these demands raise the *gulf of execution* (how do I do what I want?) and the *gulf of evaluation* (did it work, what happened?). AwaazPay narrows both gulfs with familiar language, conversational guidance, visible system status, plain-language errors, and a deliberate review-then-confirm step.

Design stance: **safety and trust first.** A voice command is never treated as consent to move money.

## 3. Target users and primary tasks

Three representative groups (design assumptions, not stereotypes; literacy, vision, hearing and confidence vary within each): older adults with limited finance-app experience; users with low digital/reading literacy; Urdu-speaking users uncomfortable with English-only interfaces.

Tasks implemented: pay a bill (4 categories) · send money to a saved contact · check balance · review transactions · get help · recover from wrong selection or misheard speech · cancel before confirmation · restart/exit · request (simulated) human help.

## 4. Page map

```
index.html (language + start)
 ├─ Start with Voice ─────► voice-assistant.html ──┐
 └─ Continue with Buttons ► dashboard.html ────────┤
        ├─ pay-bill.html ────────────┐             │ (review step)
        ├─ transfer-money.html ──────┼──► confirmation.html ──► receipt.html
        ├─ balance.html              │        ▲  │ cancel ► cancelled state
        ├─ transactions.html         │        │  └ change ► back to the form / assistant
        ├─ help.html (#human)        │   (pending action in localStorage)
        └─ voice-assistant.html ◄────┘
```

Every page has the same demo banner, header (brand, menu, language switch) and footer.

## 5. Major features

Language switch (Urdu RTL / English LTR, remembered) · push-to-talk speech recognition with spoken replies where the device has a voice · live transcript · chat history with suggested replies · text fallback · status bar (idle / listening / processing / speaking / error) · step-by-step bill and transfer forms with validation · review and confirmation page · fictional DEMO receipt with reference number · undo one step, cancel, restart, exit · help page with FAQ, capability check and simulated human-help request · demo-only safety notices on every page.

## 6. Requirement-to-principle matrix (summary; full table in the report)

| Req | Short form | Principal HCI link |
|---|---|---|
| FR1 | Speak, type or tap for every task | Accessibility; Shneiderman: universal usability |
| FR2 | Review details, then separate final confirmation | Nielsen: error prevention; Norman: evaluation |
| FR3 | Cancel / undo / restart at any point | Nielsen: user control and freedom |
| FR4 | Plain-language error recovery | Nielsen: recognise, diagnose, recover |
| FR5 | Show system status | Nielsen: visibility of system status |
| FR6 | Clear demo-only labelling | Grice: Quality; trust |
| NFR1 | Urdu/English, RTL | Match with real world |
| NFR2 | Large, high-contrast, keyboard-operable | WCAG 2.1 |
| NFR3 | Works without speech | Resilience; inclusion |
| NFR4 | Short one-question-at-a-time replies | Grice: Quantity, Manner |

## 7. Technical architecture

Static site: HTML5 + CSS3 + vanilla JavaScript; no framework, backend or database; runs by opening `index.html` or with VS Code Live Server.

| Layer | File(s) | Role |
|---|---|---|
| Data | `js/demo-data.js` | All fictional billers, contacts, transactions |
| Text | `js/i18n.js` | UI strings, Urdu + English |
| Core | `js/app.js`, `js/navigation.js` | Language/RTL, formatting, state in `localStorage`, shared shell |
| Speech | `js/speech.js` | Web Speech API wrapper, capability detection, error classes |
| Logic | `js/payments.js` | Validation, pending action, simulated confirmation and receipt |
| Dialogue | `js/conversation.js` | Rule-based engine: normalise → global commands → current step → keyword-scored intents |
| UI | `js/assistant-ui.js`, `js/pages.js` | Page controllers |

Key design decision: the engine only *prepares* a pending action. The only code path that records a simulated payment is the confirmation page's button, which ignores scripted (untrusted) clicks.

## 8. Assumptions

1. The browser is a recent Chrome or Edge for voice; other browsers get the text/button experience.
2. Urdu speech recognition may be partial and Urdu text-to-speech voices are often not installed; the prototype detects this and falls back to text.
3. Western digits (0–9) are used in both languages for amounts and references because they are widely seen on Pakistani bills and phones.
4. Roman Urdu support is keyword-based and limited to the phrases in the intent catalogue plus common variations.
5. Local storage is used only to carry prototype state between pages; it is not secure storage.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Misrecognised speech triggers a wrong action | Nothing executes from speech; summary + separate confirmation page |
| User believes real money moved | Banner on every page, "DEMO" stamp/watermark, receipt reference prefixed `DEMO-` |
| Urdu voice or recognition unavailable | Capability detection, plain explanation, text and buttons for every task |
| Assistant and microphone feedback loop | Push-to-talk; speaking cancels listening and vice-versa |
| Rule-based engine is brittle | Keyword scoring, step-aware parsing, guided choices after repeated misses |
| Sample size too small to generalise | Report as pilot; do not claim statistical significance |
