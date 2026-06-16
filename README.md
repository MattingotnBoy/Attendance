# 🎯 The Attendance Machine

A tiny, no-install web app for **Christ University** students to figure out
**how many classes you can safely miss** while still maintaining your required
attendance — and what to do to stay above the line.

## What it does

Enter three things:

1. **Classes attended** so far
2. **Total classes held** so far
3. **Target %** you must maintain (defaults to Christ University's **85%**)

…and optionally **classes left this semester** for an exact bunk budget.

It then tells you:

- ✅ Your current attendance %
- 🎯 How many classes you can still miss (or how many you must attend to recover)
- 📌 A simple plan to hold the line for the rest of the semester

### Two modes

- **Quick check** (no "classes left"): how many in a row you can bunk *right
  now*, or how many you must attend in a row to climb back to target.
- **Full plan** (with "classes left"): your exact remaining bunk budget and how
  many of the remaining classes you must attend.

## How to run

It's pure HTML/CSS/JS — no build, no dependencies.

```bash
# just open it
open index.html        # macOS
xdg-open index.html    # Linux

# or serve it
python3 -m http.server 8000
# then visit http://localhost:8000
```

## The math

For a target fraction `p`, attended `a`, total held `t`, classes left `r`:

- **Currently safe, can miss in a row:** `floor(a / p - t)`
- **Below target, must attend in a row:** `ceil((p·t - a) / (1 - p))`
- **With classes left, must attend of the remaining:** `ceil(p·(t+r) - a)`,
  so allowed misses = `r - mustAttend`.

## Note

Unofficial helper. Some courses set a higher bar than 85%, and medical/OD
leaves may be condonable — always confirm the real requirement with your
department.
