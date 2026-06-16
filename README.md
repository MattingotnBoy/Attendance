# 🎯 Matthew's Attendance

A slick, installable-feeling web app for **Christ University** students to plan
and track attendance — **per subject** and **overall** — so you always know
**how many classes you can safely miss**.

Built for the **75% per subject** rule, fully client-side, no login, no backend.
Everything you enter is saved in your browser (localStorage).

## Features

- **📊 Stats** — an overall attendance ring plus a card per subject, each
  showing your %, attended/held count, and exactly how many classes you can
  still miss (or must attend to recover).
- **🗓️ Calendar** — a month view; tap any day to mark each class
  **Present / Absent / Cancelled**. Dots show how each day went.
- **🧩 Timetable** — set your weekly schedule once; the calendar pre-fills each
  day's classes for one-tap marking.
- **➕ Subjects** — add subjects with their own required %, each color-coded.

Cancelled classes are excluded from the math (they don't count against you).

## How to run locally

Pure HTML/CSS/JS — no build, no dependencies.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or just open index.html in a browser
```

## Deploy on Vercel

It's a static site — no build step, no framework.

- **Dashboard:** Import the repo → Framework Preset **Other** → leave Build &
  Output settings empty → Deploy.
- **CLI:** `npm i -g vercel` then `vercel --prod`.

`vercel.json` (clean URLs + basic security headers) is included. Vercel serves
`index.html` from the root automatically.

## The math

For required fraction `p`, attended `a`, held `t` (present + absent):

- **Current %:** `a / t`
- **Safe → can miss in a row:** `floor(a / p − t)`
- **Below → must attend in a row:** `ceil((p·t − a) / (1 − p))`

The overall ring aggregates every subject's present/held totals.

## Note

Unofficial helper. Some courses set a higher bar than 75%, and medical/OD
leaves may be condonable — always confirm the real requirement with your
department.
