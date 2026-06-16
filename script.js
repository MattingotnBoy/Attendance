(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const attendedEl = $("attended");
  const totalEl = $("total");
  const remainingEl = $("remaining");
  const targetEl = $("target");
  const resultEl = $("result");

  // Preset buttons set the target %
  document.querySelectorAll(".preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      targetEl.value = btn.dataset.target;
      document.querySelectorAll(".preset").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

  // Keep preset highlight in sync when typing a custom target
  targetEl.addEventListener("input", () => {
    document.querySelectorAll(".preset").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.target === targetEl.value);
    });
  });

  $("calc").addEventListener("click", calculate);
  // Enter key triggers calculation
  [attendedEl, totalEl, remainingEl, targetEl].forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") calculate();
    });
  });

  function num(el) {
    const v = parseInt(el.value, 10);
    return Number.isFinite(v) ? v : null;
  }

  function showError(msg) {
    resultEl.hidden = false;
    resultEl.innerHTML = '<p class="error-msg">' + msg + "</p>";
  }

  function calculate() {
    const attended = num(attendedEl);
    const total = num(totalEl);
    const remaining = num(remainingEl); // optional
    const targetPct = num(targetEl);

    // --- Validation ---
    if (attended === null || total === null) {
      return showError("Please enter both classes attended and total classes held.");
    }
    if (total <= 0) {
      return showError("Total classes held must be greater than 0.");
    }
    if (attended < 0 || total < 0) {
      return showError("Numbers can't be negative.");
    }
    if (attended > total) {
      return showError("Attended classes can't be more than total classes held.");
    }
    if (targetPct === null || targetPct <= 0 || targetPct > 100) {
      return showError("Enter a target between 1 and 100.");
    }
    if (remaining !== null && remaining < 0) {
      return showError("Classes left can't be negative.");
    }

    const p = targetPct / 100;
    const current = (attended / total) * 100;
    const hasRemaining = remaining !== null && remaining > 0;

    let html = "";

    // --- Current status block ---
    const meetsNow = current >= targetPct - 1e-9;
    html += currentBlock(current, targetPct);

    // --- Core advice ---
    if (hasRemaining) {
      html += finiteAdvice(attended, total, remaining, p, targetPct);
    } else {
      html += openAdvice(attended, total, p, targetPct, meetsNow);
    }

    // --- General tips ---
    html += tipsBlock(targetPct);

    resultEl.hidden = false;
    resultEl.innerHTML = html;

    // animate the progress bar fill after insertion
    requestAnimationFrame(() => {
      const fill = resultEl.querySelector(".bar > span");
      if (fill) fill.style.width = Math.min(100, current).toFixed(1) + "%";
    });

    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function currentBlock(current, targetPct) {
    const meets = current >= targetPct - 1e-9;
    const color = meets ? "var(--green)" : current >= targetPct - 5 ? "var(--amber)" : "var(--red)";
    const markerPos = Math.min(100, targetPct);
    return (
      '<div class="current">' +
      '<div class="big">' + current.toFixed(2) + "%</div>" +
      '<div class="lbl">Your attendance right now</div>' +
      '<div class="bar">' +
      '<span style="width:0%;background:' + color + '"></span>' +
      '<div class="marker" style="left:' + markerPos + '%"></div>' +
      "</div>" +
      '<div class="bar-legend"><span>0%</span><span>Target: ' + targetPct + "%</span><span>100%</span></div>" +
      "</div>"
    );
  }

  // No "remaining" given: open-ended advice
  function openAdvice(attended, total, p, targetPct, meetsNow) {
    if (meetsNow) {
      // How many classes in a row can you miss and stay >= target?
      const canMiss = Math.floor(attended / p - total + 1e-9);
      const safeMiss = Math.max(0, canMiss);
      const banner = bannerHTML(
        "ok",
        "✅",
        "You're safe — above the line.",
        "You currently meet the " + targetPct + "% requirement."
      );
      const headline = headlineHTML(
        safeMiss,
        safeMiss === 1 ? "class you can miss right now" : "classes you can miss right now",
        "Skip more than this in a row and you'll drop below " + targetPct + "%."
      );
      let note;
      if (safeMiss === 0) {
        note =
          '<p class="hint" style="text-align:center;margin-top:0">' +
          "You're right at the edge — missing even one class drops you below target. Attend the next few to build a buffer." +
          "</p>";
      } else {
        note =
          '<p class="hint" style="text-align:center;margin-top:0">' +
          "After missing those, you'd need to attend everything else to hold steady. Tip: enter your <strong>classes left this semester</strong> above for an exact bunk budget." +
          "</p>";
      }
      return banner + headline + note;
    } else {
      // How many in a row must you attend to climb back to target?
      const needAttend = Math.ceil((p * total - attended) / (1 - p) - 1e-9);
      const k = Math.max(0, needAttend);
      const banner = bannerHTML(
        "bad",
        "⚠️",
        "Below the line.",
        "You're under the " + targetPct + "% requirement."
      );
      const headline = headlineHTML(
        k,
        k === 1 ? "class you must attend (no misses)" : "classes you must attend in a row (no misses)",
        "Attend that many straight to climb back to " + targetPct + "%."
      );
      return banner + headline;
    }
  }

  // "remaining" given: exact budget for the rest of the semester
  function finiteAdvice(attended, total, remaining, p, targetPct) {
    const finalTotal = total + remaining;
    // classes of the remaining you must attend
    const mustAttend = Math.max(0, Math.ceil(p * finalTotal - attended - 1e-9));
    const canMiss = remaining - mustAttend;

    if (canMiss < 0) {
      // Even attending all remaining won't reach target
      const best = ((attended + remaining) / finalTotal) * 100;
      const banner = bannerHTML(
        "bad",
        "🚫",
        "Target out of reach this semester.",
        "Even attending every remaining class, you'd top out at " + best.toFixed(2) + "%."
      );
      const headline = headlineHTML(
        remaining,
        "classes left — attend them all",
        "Attend everything to get as close as possible, then talk to your department about condonation."
      );
      return banner + headline;
    }

    const finalIfPlan = ((attended + mustAttend) / finalTotal) * 100;
    const bannerType = canMiss > 0 ? "ok" : "warn";
    const bannerEmoji = canMiss > 0 ? "✅" : "⚠️";
    const bannerTitle =
      canMiss > 0 ? "You've got room to breathe." : "Zero room to spare.";
    const bannerSub =
      canMiss > 0
        ? "Plan your bunks below and you'll stay at or above " + targetPct + "%."
        : "You must attend every remaining class to hold " + targetPct + "%.";

    const banner = bannerHTML(bannerType, bannerEmoji, bannerTitle, bannerSub);
    const headline = headlineHTML(
      canMiss,
      canMiss === 1 ? "class you can still miss" : "classes you can still miss",
      "out of " + remaining + " classes left this semester."
    );

    const breakdown =
      '<ul class="tips">' +
      tip("📌", "<strong>Attend at least " + mustAttend + "</strong> of the " + remaining + " remaining classes.") +
      tip("🎯", "Stick to the plan and you'll finish around <strong>" + finalIfPlan.toFixed(2) + "%</strong>.") +
      tip("📅", "Spread your " + canMiss + " allowed misses across the semester — don't blow them in one week.") +
      "</ul>";

    return banner + headline + breakdown;
  }

  function bannerHTML(type, emoji, title, sub) {
    return (
      '<div class="status-banner ' + type + '">' +
      '<span class="emoji">' + emoji + "</span>" +
      "<div><p class=\"stitle\">" + title + "</p><p class=\"ssub\">" + sub + "</p></div>" +
      "</div>"
    );
  }

  function headlineHTML(num, desc, sub) {
    return (
      '<div class="headline">' +
      '<div class="num">' + num + "</div>" +
      '<div class="desc">' + desc + "</div>" +
      (sub ? '<p class="hint" style="margin-top:8px">' + sub + "</p>" : "") +
      "</div>"
    );
  }

  function tip(ic, text) {
    return '<li><span class="ic">' + ic + '</span><span>' + text + "</span></li>";
  }

  function tipsBlock(targetPct) {
    return (
      '<h2 style="font-size:14px;color:var(--navy);margin:20px 0 10px">How to hold the line</h2>' +
      '<ul class="tips">' +
      tip("🧮", "Recalculate every couple of weeks — one missed lab or extra class shifts the math.") +
      tip("🤧", "Keep a buffer for sick days and emergencies instead of bunking to the exact limit.") +
      tip("📝", "Medical / OD leaves may be condonable — keep certificates and apply on time.") +
      tip("🏫", "Some courses need more than " + targetPct + "%. Check each subject's own requirement.") +
      "</ul>"
    );
  }
})();
