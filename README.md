<<<<<<< HEAD
# AwaazPay — آواز سے ادائیگی

**A voice-first, Urdu-friendly bill-payment and money-transfer assistant — an educational HCI prototype.**
Tagline: *Your money, your language, your voice.* (آپ کا پیسہ، آپ کی زبان، آپ کی آواز۔)

Bahria University, Islamabad Campus · Department of Computer Sciences · Human Computer Interaction · Assignment #2

> ## ⚠ Demo only — no real money
> AwaazPay is **not a banking app**. Every balance, biller, contact, reference number and transaction is **fictional**. It never connects to a bank, wallet, payment gateway or any server. It never asks for a PIN, password, OTP or card number — **do not type real ones**. Receipts are marked DEMO.

## Run it

**Easiest:** open the folder in VS Code → install the **Live Server** extension → right-click `index.html` → *Open with Live Server*.
**Or:** double-click `index.html` (works in most browsers; voice features are more reliable over `http://`).
No build step, no install, no internet connection needed (speech recognition in some browsers uses an online service provided by the browser vendor).

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing: language choice, Start with Voice / Continue with Buttons, demo and accessibility notes |
| `dashboard.html` | Five large action cards + microphone |
| `voice-assistant.html` | Main conversational interface (voice, text, buttons) |
| `pay-bill.html` | 3-step bill payment form |
| `transfer-money.html` | 2-step transfer form |
| `confirmation.html` | Review and final confirm / change / cancel |
| `receipt.html` | Fictional DEMO receipt |
| `balance.html`, `transactions.html` | Fictional balance and history |
| `help.html` | FAQ, capability check, simulated human-help request |

## Try these

- Say or type: "مجھے بجلی کا بل ادا کرنا ہے", "Pay my electricity bill", "Mera bill pay karna hai"
- "Paise bhejne hain", "Send 1000 to Ahmed", "Fatima ko 2000 bhejo"
- "میرا بیلنس بتائیں", "How much money do I have?", "Show my recent transactions"
- Errors: "I need to pay" (ambiguous), "blah" (unrecognised), "what's the weather" (off-topic), "-500" (invalid amount), "123" (invalid reference)
- Control: "cancel", "go back" / "wapis", "start again" / "dobara shuru", "I want to talk to a human"
- Demo bill numbers: electricity `10010001`, gas `20020002`, water `30030003`, internet `40040004`

## How it works

- **Rule-based assistant, not AI.** `js/conversation.js` normalises text, checks global commands (cancel, restart, exit, back, human), then the current dialogue step, then keyword-scored intents (`pay_bill`, `transfer_money`, `check_balance`, `transaction_history`, `help`, `cancel_or_restart`). Replies carry both languages.
- **Voice never pays.** The assistant only prepares a *pending* action and links to `confirmation.html`, where **you** press the final button. Scripted clicks and double clicks are ignored.
- **Push-to-talk.** The microphone never starts by itself and never runs while the assistant speaks, so it cannot hear itself.
- **Graceful fallbacks.** Unsupported browser, denied microphone permission, no speech, network error, unsupported language and missing Urdu voice are each explained in plain language with retry / type / buttons.
- **State** (language, balance, pending action, receipt, chat) lives in `localStorage`. **This is not secure storage.** Use the footer's *Reset demo data* to clear it.

## Browser and device notes

Speech support varies. Chrome and Edge on desktop/Android generally offer speech recognition; Firefox does not. **Urdu recognition quality and the availability of an Urdu text-to-speech voice depend on your browser, operating system and installed voices and are not guaranteed.** If no Urdu voice is installed, replies are shown as text only (by design, to avoid reading Urdu with an English voice). Everything works without voice.

## Project structure

```
awaazpay/
├── index.html  dashboard.html  voice-assistant.html  pay-bill.html  transfer-money.html
├── balance.html  transactions.html  help.html  confirmation.html  receipt.html
├── css/   style.css (tokens, layout, header/footer)  components.css  responsive.css
├── js/    demo-data.js  i18n.js  app.js  navigation.js  speech.js  payments.js
│          conversation.js  assistant-ui.js  pages.js
├── assets/icons/   SVG icons (original, simple line icons)
├── docs/  01-planning.md  02-report.md  03-appendices-testing.md
│          04-demo-video-and-submission.md  dialogue-flowchart.mmd
├── tests/ optional developer checks (jsdom) — not needed to run the prototype
└── README.md
```

## What has and has not been verified

- **Done (automated, in a simulated DOM — jsdom):** 98 conversation-engine checks and 806 page/flow checks pass, including every listed example utterance, error cases A–H, undo/cancel/restart, validation, link and asset existence, translation keys, language switching, and mocked speech failures. Re-run with `cd tests && npm install && npm test`.
- **Not done:** testing in real browsers on real devices; a real microphone; real Urdu voices; screen-reader testing; visual review of screenshots; usability testing with real people. These are listed in `docs/04-demo-video-and-submission.md`.

## Accessibility summary

Semantic landmarks and skip link; labelled controls; visible focus; built from native controls so it should be keyboard-operable (not yet verified with a keyboard-only run); targets ≥ 48 px; status shown by text + shape + colour; live regions for status and chat; `dir="rtl"` for Urdu with amounts/reference numbers isolated left-to-right; reduced-motion support; responsive layouts; print stylesheet for the receipt. Text contrast ratios (computed) are at least 5.1:1.

## Known limitations

Keyword-based understanding (unusual phrasing will fail); simple number-word parsing; no real authentication, banking or post-confirmation reversal (by design); `localStorage` only; layouts not yet checked on physical devices; Urdu wording should be reviewed by a native speaker.
=======
# Awaazpay
voice based electricity
>>>>>>> 4b159f07879242d26add375be925a554e2cfba53
