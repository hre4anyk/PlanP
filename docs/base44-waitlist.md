# Base44 waitlist: prompt to paste

Build this in Base44 (no code). Paste the prompt below into a new Base44 app, check the result on your phone, publish it, and send the public link to Claude so it can go on the landing page and the final demo screen as a QR code.

---

Build a single-page waitlist app called **Plan P**.

**What Plan P is (show at the top):**
Headline: "The lot is full. You already have Plan B."
Subhead: "Plan P lines up backup parking before you arrive. If your spot is taken, it reroutes you hands-free."

**Form (no login needed):**
- Email (required)
- "Would you pay $4.99/month for Plan P?" with three big buttons: Yes / Maybe / No (required)
- "Where do you drive to most?" short text (optional)
- Submit button: "Join the waitlist"

After submitting, show: "You're on the list. Thanks for testing Plan P at SF Tech Week." and hide the form.

**Live counter (big, under the form, visible to everyone):**
"[N] people joined" and "[X]% would pay", updating as new signups arrive.

**Data:** store each signup with email, would_pay (yes/maybe/no), destination, and created time. Reject duplicate emails politely ("You're already on the list").

**Design:** mobile-first, readable on a phone held at arm's length. Dark background #0a0a0f, white text, one accent color #FF4D2E for the button and the counter. Big text, generous spacing, no images needed.

**Admin view (for me only):** a table of all signups with a count of yes / maybe / no, and a CSV export.
