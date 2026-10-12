# Demo Video Script and Submission Checklist

## Before you record

- Use Chrome or Edge on a computer with a working microphone. Open the project with VS Code Live Server (see README) so speech features behave as in normal browsing.
- Click **"Reset demo data"** in the footer so the balance starts at Rs 48,500 with no extra transactions.
- Do a dry run: check that speech recognition actually works on your machine in Urdu. **If Urdu recognition does not work on your device, say so in the video and show typing/buttons instead. Do not fake it.**
- Screen-record at 1080p; record system audio and microphone if possible; keep to **2–3 minutes** (about 330–450 spoken words at a calm pace).

## Script with timestamps (target 2:40)

| Time | On screen | Say (adapt to your own words) |
|---|---|---|
| 0:00–0:15 | `index.html` landing page | "This is AwaazPay, a voice-first, Urdu-friendly bill payment prototype for people who find banking apps hard to use. It is a demo for my HCI assignment; **no real money moves**, as the banner shows on every page." |
| 0:15–0:30 | Click English, then Urdu | "I can choose Urdu or English. Urdu switches the layout right-to-left; my choice is remembered." |
| 0:30–0:45 | Click **Start with Voice** | "Users can start with voice, or continue with buttons if speaking is not comfortable." |
| 0:45–1:15 | Assistant: press mic, say "مجھے بجلی کا بل ادا کرنا ہے"; point to transcript and status bar; use demo-number button, then "Yes, full amount" | "The status bar shows it is listening, then processing. My words appear as text, so I can check what it heard. The assistant asks one question at a time and I can use the suggested buttons." |
| 1:15–1:40 | Summary card → **Open confirmation page** → press **Confirm (demo)** → receipt | "Before anything happens I see the biller, reference and amount. **Speech alone never completes a payment**: the assistant cannot press this final button. The receipt is stamped DEMO with a fictional reference number." |
| 1:40–2:05 | Back to assistant; type "blah blah" (error), then a second unclear phrase; show guided choices; also say "I need to pay" for the four bill options | "If it does not understand, it says so politely and offers buttons. After repeated misunderstandings it offers simpler choices and the help page." |
| 2:05–2:20 | Start a transfer ("Paise bhejne hain" → Ahmed → 500) then **Cancel** or the Cancel button | "I can cancel before confirming. Nothing is sent and no money is taken. I can also go back one step, start again, or exit." |
| 2:20–2:35 | Optional: deny microphone permission or use a browser without speech; show the explanation and the text fallback | "If the microphone or Urdu voice is unavailable, the app explains why and every task still works by typing or buttons." |
| 2:35–2:50 | Dashboard, then help page | "One key HCI decision: separating *preparing* a task from *confirming* it, so a misheard command cannot cost money. This applies Nielsen's error prevention and user control, and supports Norman's gulf of evaluation. The next step is a pilot with real users." |

Do not claim in the video that testing with users has been done unless it has.

## Run in VS Code Live Server

1. Install VS Code and the **Live Server** extension (Ritwick Dey).
2. File → Open Folder → select the `awaazpay` folder.
3. Right-click `index.html` → **Open with Live Server** (or click "Go Live" in the status bar).
4. The page opens at `http://127.0.0.1:5500/index.html`. Allow the microphone when the browser asks.

You can also double-click `index.html`. Most things work from `file://`, but some browsers handle microphone permission and storage more reliably over `http://`, so Live Server is recommended.

## Final submission checklist

**Prototype**
- [ ] `awaazpay/` runs from `index.html`; every page opens; no missing images, styles or scripts
- [ ] Footer "Reset demo data" works; balance returns to Rs 48,500
- [ ] Bill and transfer flows end in a DEMO receipt; cancellation works at the confirmation page and in the assistant
- [ ] Urdu and English both checked by a fluent reader; wording corrected if needed
- [ ] Demo notice visible on all ten pages
- [ ] No real financial data entered anywhere

**Documentation**
- [ ] Name, enrolment number, instructor and date filled in on the report title block
- [ ] Report is 2,000–3,000 words (check with your instructor whether tables and the flowchart count)
- [ ] References verified against the publisher/Google Scholar; at least two peer-reviewed sources added on voice interfaces, financial inclusion or older adults' technology use
- [ ] Mermaid flowchart rendered to an image and inserted
- [ ] Requirements table, persona, intent catalogue, interaction model all present
- [ ] Appendices attached: test tasks, consent script, questionnaire, screenshot set
- [ ] Section 12 completed **only** from real testing, or clearly marked "not conducted" with the reason

**Evidence**
- [ ] 15+ annotated screenshots taken from your own running copy (see checklist, Appendix D)
- [ ] Demo video 2–3 minutes, uploaded; link added to the report
- [ ] Real-user test notes, consent sheets (stored separately) and result tables, if testing was done
- [ ] Prototype exported as a ZIP (or hosted link) as the assignment requires
- [ ] Instructor approval obtained where required (topic, testing with participants)
