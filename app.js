(function () {
  "use strict";

  /* ============================ State ============================ */
  const KEY = "matthews-attendance-v2";
  const PALETTE = ["#7c5cff", "#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#f472b6", "#a78bfa", "#2dd4bf", "#fb923c", "#60a5fa"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  let state = load();
  let calCursor = startOfMonth(new Date());
  let openDateKey = null;

  function blank() {
    return { subjects: [], timetable: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }, records: {} };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const s = JSON.parse(raw);
      if (!s.timetable) s.timetable = blank().timetable;
      if (!s.records) s.records = {};
      if (!s.subjects) s.subjects = [];
      return s;
    } catch (e) { return blank(); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  /* ============================ Helpers ============================ */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function dateKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function keyToDate(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
  function subjectById(id) { return state.subjects.find((s) => s.id === id); }

  /* ============================ Attendance math ============================ */
  // returns {attended, held, pct, req, verdict, canMiss, mustAttend, status}
  function statsFor(subjectId) {
    const subj = subjectById(subjectId);
    const req = subj ? subj.required : 75;
    let attended = 0, held = 0;
    Object.values(state.records).forEach((day) => {
      const st = day[subjectId];
      if (st === "present") { attended++; held++; }
      else if (st === "absent") { held++; }
      // cancelled => ignored
    });
    return computeStats(attended, held, req);
  }
  function computeStats(attended, held, req) {
    const p = req / 100;
    const pct = held > 0 ? (attended / held) * 100 : 0;
    const meets = held === 0 ? true : pct >= req - 1e-9;
    let canMiss = 0, mustAttend = 0;
    if (held > 0 && meets) {
      canMiss = Math.max(0, Math.floor(attended / p - held + 1e-9));
    } else if (held > 0) {
      mustAttend = Math.max(0, Math.ceil((p * held - attended) / (1 - p) - 1e-9));
    }
    let status = "ok";
    if (held === 0) status = "none";
    else if (!meets) status = "bad";
    else if (pct < req + 3) status = "warn";
    return { attended, held, pct, req, meets, canMiss, mustAttend, status };
  }

  /* ============================ Views / tabs ============================ */
  function showView(name) {
    $$(".view").forEach((v) => v.classList.toggle("is-active", v.id === "view-" + name));
    $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === name));
    if (name === "dash") renderDash();
    if (name === "cal") { openDateKey = null; const dp = $("#dayPanel"); if (dp) dp.hidden = true; renderCalendar(); }
    if (name === "tt") renderTimetable();
    if (name === "subj") renderSubjects();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));
  $("#goSubjects").addEventListener("click", () => showView("subj"));
  $("#emptyAddSubject").addEventListener("click", () => showView("subj"));

  /* ============================ Dashboard ============================ */
  const RING_C = 2 * Math.PI * 50; // 314.16

  function renderDash() {
    const cards = $("#subjectCards");
    cards.innerHTML = "";
    const hasSubjects = state.subjects.length > 0;
    $("#dashEmpty").hidden = hasSubjects;

    let totA = 0, totH = 0;
    state.subjects.forEach((subj) => {
      const s = statsFor(subj.id);
      totA += s.attended; totH += s.held;
      cards.appendChild(subjectCard(subj, s));
    });

    // overall — weighted by classes, required = max of subject requireds (or 75)
    const req = state.subjects.length ? Math.max(...state.subjects.map((s) => s.required)) : 75;
    const ov = computeStats(totA, totH, req);
    $("#overallAttended").textContent = totA;
    $("#overallHeld").textContent = totH;
    $("#overallPct").textContent = totH ? ov.pct.toFixed(1) + "%" : "—";

    const ring = $("#overallRing");
    const frac = Math.min(1, totH ? ov.pct / 100 : 0);
    ring.style.strokeDashoffset = RING_C * (1 - frac);
    ring.style.stroke = totH ? colorForStatus(ov.status) : "rgba(255,255,255,0.15)";

    const vEl = $("#overallVerdict");
    if (!totH) { vEl.textContent = "No data"; vEl.style.color = "var(--muted)"; }
    else if (ov.meets) { vEl.textContent = "Can miss " + ov.canMiss; vEl.style.color = "var(--green)"; }
    else { vEl.textContent = "Attend " + ov.mustAttend; vEl.style.color = "var(--red)"; }
  }

  function colorForStatus(status) {
    return status === "bad" ? "var(--red)" : status === "warn" ? "var(--amber)" : "var(--green)";
  }

  function subjectCard(subj, s) {
    const card = el("div", "scard");
    card.style.setProperty("--sc", subj.color);
    let pill, verdict;
    if (s.held === 0) { pill = '<span class="pill warn">no data</span>'; verdict = "Mark some classes to see your buffer."; }
    else if (s.meets) { pill = '<span class="pill ok">safe</span>'; verdict = s.canMiss > 0 ? "You can miss <b>" + s.canMiss + "</b> more in a row." : "Right on the edge — attend the next one."; }
    else { pill = '<span class="pill bad">below</span>'; verdict = "Attend <b>" + s.mustAttend + "</b> in a row to recover."; }

    card.innerHTML =
      '<div class="scard-tag"></div>' +
      '<div class="scard-top"><span class="scard-name">' + esc(subj.name) + '</span>' +
      '<span class="scard-pct">' + (s.held ? s.pct.toFixed(1) + "%" : "—") + '</span></div>' +
      '<div class="scard-sub">' + s.attended + " / " + s.held + " attended · needs " + subj.required + "%</div>" +
      '<div class="scard-bar"><span></span></div>' +
      '<div class="scard-verdict">' + pill + "<span>" + verdict + "</span></div>";
    requestAnimationFrame(() => {
      const bar = $(".scard-bar > span", card);
      bar.style.width = Math.min(100, s.pct).toFixed(1) + "%";
      if (s.status === "bad") bar.style.background = "var(--red)";
    });
    return card;
  }

  /* ============================ Calendar ============================ */
  $("#calPrev").addEventListener("click", () => { closeDay(); calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
  $("#calNext").addEventListener("click", () => { closeDay(); calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });

  function renderCalendar() {
    $("#calTitle").textContent = MONTHS[calCursor.getMonth()] + " " + calCursor.getFullYear();
    const grid = $("#calGrid");
    grid.innerHTML = "";
    const startDow = startOfMonth(calCursor).getDay();
    const daysInMonth = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 0).getDate();
    const todayKey = dateKey(new Date());

    for (let i = 0; i < startDow; i++) grid.appendChild(el("div", "cell empty-cell"));

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(calCursor.getFullYear(), calCursor.getMonth(), day);
      const k = dateKey(d);
      const cell = el("div", "cell");
      if (k === todayKey) cell.classList.add("today");
      if (k === openDateKey) cell.classList.add("selected");
      cell.appendChild(el("span", "d", String(day)));

      const dots = el("div", "cell-dots");
      const rec = state.records[k];
      const scheduled = state.timetable[d.getDay()] || [];
      if (rec && Object.keys(rec).length) {
        const order = { present: 0, absent: 1, cancelled: 2 };
        Object.values(rec).sort((a, b) => order[a] - order[b]).slice(0, 4).forEach((st) => dots.appendChild(el("i", "dot " + st)));
      } else if (scheduled.length) {
        scheduled.slice(0, 4).forEach(() => dots.appendChild(el("i", "dot scheduled")));
      }
      cell.appendChild(dots);
      cell.addEventListener("click", () => { openDateKey === k ? closeDay() : selectDay(k); });
      grid.appendChild(cell);
    }
  }

  /* ============================ Inline day panel ============================ */
  function selectDay(k) { openDateKey = k; renderCalendar(); renderDayPanel(); }
  function closeDay() {
    openDateKey = null;
    const panel = $("#dayPanel");
    if (panel) panel.hidden = true;
    renderCalendar();
    renderDash();
  }

  function renderDayPanel() {
    const panel = $("#dayPanel");
    const d = keyToDate(openDateKey);
    panel.innerHTML = "";
    panel.hidden = false;

    const head = el("div", "day-panel-head");
    head.appendChild(el("h3", null, DAYS_SHORT[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()]));
    const close = el("button", "sq-btn", "✕");
    close.addEventListener("click", closeDay);
    head.appendChild(close);
    panel.appendChild(head);

    const list = el("div", "day-classes");
    const rec = state.records[openDateKey] || {};
    const scheduled = state.timetable[d.getDay()] || [];
    const ids = Array.from(new Set([...scheduled, ...Object.keys(rec)])).filter(subjectById);
    if (!ids.length) {
      list.appendChild(el("div", "sheet-empty", state.subjects.length ? "No classes scheduled — add one below." : "Add subjects first (Subjects tab)."));
    }
    ids.forEach((id) => list.appendChild(classRow(id, rec[id])));
    panel.appendChild(list);

    // add-row for extra classes
    const remaining = state.subjects.filter((s) => !ids.includes(s.id));
    const add = el("div", "day-add");
    const sel = el("select");
    if (!remaining.length) { sel.innerHTML = '<option value="">All subjects added</option>'; sel.disabled = true; }
    else remaining.forEach((s) => { const o = el("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
    add.appendChild(sel);
    const addBtn = el("button", "chip-btn", "+ Add");
    addBtn.addEventListener("click", () => { if (sel.value) setRecord(sel.value, "present"); });
    add.appendChild(addBtn);
    panel.appendChild(add);

    if (panel.scrollIntoView) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function classRow(id, current) {
    const subj = subjectById(id);
    const row = el("div", "sclass");
    const dot = el("span", "cdot"); dot.style.background = subj.color;
    row.appendChild(dot);
    row.appendChild(el("span", "scn", esc(subj.name)));

    const seg = el("div", "seg");
    [["P", "present", "p"], ["A", "absent", "a"], ["C", "cancelled", "c"]].forEach(([label, val, c]) => {
      const b = el("button", "seg-btn " + c + (current === val ? " sel" : ""), label);
      b.addEventListener("click", () => setRecord(id, current === val ? null : val));
      seg.appendChild(b);
    });
    row.appendChild(seg);
    return row;
  }

  function setRecord(id, val) {
    if (!state.records[openDateKey]) state.records[openDateKey] = {};
    if (val === null) delete state.records[openDateKey][id];
    else state.records[openDateKey][id] = val;
    if (!Object.keys(state.records[openDateKey]).length) delete state.records[openDateKey];
    save();
    renderCalendar();   // refresh dots, keep selection highlight
    renderDayPanel();   // refresh the panel in place
  }

  /* ============================ Timetable ============================ */
  function renderTimetable() {
    const wrap = $("#ttDays");
    wrap.innerHTML = "";
    if (!state.subjects.length) {
      wrap.appendChild(el("div", "sheet-empty", "Add subjects first, then build your week."));
      return;
    }
    for (let dow = 1; dow <= 6; dow++) addTTDay(wrap, dow); // Mon..Sat
    addTTDay(wrap, 0); // Sunday last
  }
  function addTTDay(wrap, dow) {
    const card = el("div", "tt-day");
    card.appendChild(el("h3", null, DAYS[dow]));
    const list = el("div", "tt-classes");
    const items = state.timetable[dow] || [];
    if (!items.length) list.appendChild(el("span", "tt-empty", "No classes"));
    items.forEach((id, idx) => {
      const subj = subjectById(id);
      if (!subj) return;
      const chip = el("span", "tt-chip");
      const dot = el("span", "cdot"); dot.style.background = subj.color; chip.appendChild(dot);
      chip.appendChild(document.createTextNode(subj.name));
      const x = el("span", "x", "✕");
      x.addEventListener("click", () => { state.timetable[dow].splice(idx, 1); save(); renderTimetable(); });
      chip.appendChild(x);
      list.appendChild(chip);
    });
    card.appendChild(list);

    const add = el("div", "tt-add");
    const sel = el("select");
    state.subjects.forEach((s) => { const o = el("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
    add.appendChild(sel);
    const btn = el("button", "ghost-btn", "+ Add");
    btn.addEventListener("click", () => { if (sel.value) { state.timetable[dow].push(sel.value); save(); renderTimetable(); } });
    add.appendChild(btn);
    card.appendChild(add);
    wrap.appendChild(card);
  }

  /* ============================ Subjects ============================ */
  $("#subjForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#subjName").value.trim();
    let req = parseInt($("#subjReq").value, 10);
    if (!name) return;
    if (!Number.isFinite(req) || req < 1 || req > 100) req = 75;
    const color = PALETTE[state.subjects.length % PALETTE.length];
    state.subjects.push({ id: uid(), name, color, required: req });
    save();
    $("#subjName").value = "";
    $("#subjReq").value = "75";
    renderSubjects();
  });

  function renderSubjects() {
    const list = $("#subjList");
    list.innerHTML = "";
    if (!state.subjects.length) { list.appendChild(el("div", "sheet-empty", "No subjects yet. Add one above.")); return; }
    state.subjects.forEach((subj) => {
      const item = el("div", "subj-item");
      const dot = el("span", "cdot"); dot.style.background = subj.color; item.appendChild(dot);
      item.appendChild(el("span", "sname", esc(subj.name)));
      item.appendChild(el("span", "sreq", subj.required + "%"));
      const del = el("span", "del", "🗑");
      del.title = "Delete subject";
      del.addEventListener("click", () => deleteSubject(subj.id));
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function deleteSubject(id) {
    if (!confirm("Delete this subject? Its timetable slots and marks will be removed.")) return;
    state.subjects = state.subjects.filter((s) => s.id !== id);
    Object.keys(state.timetable).forEach((dow) => { state.timetable[dow] = state.timetable[dow].filter((x) => x !== id); });
    Object.keys(state.records).forEach((k) => {
      delete state.records[k][id];
      if (!Object.keys(state.records[k]).length) delete state.records[k];
    });
    save();
    renderSubjects();
  }

  /* ============================ Calculator ============================ */
  $$(".preset").forEach((b) => b.addEventListener("click", () => {
    $("#cTarget").value = b.dataset.t;
    $$(".preset").forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active");
  }));
  $("#cTarget").addEventListener("input", () => {
    $$(".preset").forEach((b) => b.classList.toggle("is-active", b.dataset.t === $("#cTarget").value));
  });
  $("#calcBtn").addEventListener("click", runCalc);
  ["cAttended", "cTotal", "cRemaining", "cTarget"].forEach((id) =>
    $("#" + id).addEventListener("keydown", (e) => { if (e.key === "Enter") runCalc(); }));

  function numv(id) { const v = parseInt($("#" + id).value, 10); return Number.isFinite(v) ? v : null; }

  function runCalc() {
    const out = $("#calcResult");
    const a = numv("cAttended"), t = numv("cTotal"), r = numv("cRemaining"), tg = numv("cTarget");
    const fail = (m) => { out.innerHTML = '<div class="err">' + m + "</div>"; };

    if (a === null || t === null) return fail("Enter both attended and total classes.");
    if (t <= 0) return fail("Total classes must be greater than 0.");
    if (a < 0 || t < 0) return fail("Numbers can't be negative.");
    if (a > t) return fail("Attended can't exceed total held.");
    if (tg === null || tg <= 0 || tg > 100) return fail("Target must be between 1 and 100.");
    if (r !== null && r < 0) return fail("Classes left can't be negative.");

    const s = computeStats(a, t, tg);
    let html = '<div class="res-block">';

    if (r !== null && r > 0) {
      const ft = t + r;
      const mustAttend = Math.max(0, Math.ceil((tg / 100) * ft - a - 1e-9));
      const canMiss = r - mustAttend;
      if (canMiss < 0) {
        const best = ((a + r) / ft) * 100;
        html += banner("bad", "🚫", "Target out of reach this sem.", "Even attending all " + r + " left, you'd top out at " + best.toFixed(1) + "%.");
        html += headline(r, "classes left — attend them all", "Then talk to your dept about condonation.");
      } else {
        const fin = ((a + mustAttend) / ft) * 100;
        html += banner(canMiss > 0 ? "ok" : "warn", canMiss > 0 ? "✅" : "⚠️",
          canMiss > 0 ? "You've got room." : "Zero room to spare.",
          canMiss > 0 ? "Plan it out and stay at/above " + tg + "%." : "Attend every remaining class.");
        html += headline(canMiss, canMiss === 1 ? "class you can still miss" : "classes you can still miss", "out of " + r + " left this semester.");
        html += '<ul class="calc-tips">' +
          tipLi("📌", "Attend at least <b>" + mustAttend + "</b> of the " + r + " remaining.") +
          tipLi("🎯", "Stick to it and finish around <b>" + fin.toFixed(1) + "%</b>.") +
          tipLi("📅", "Spread your misses out — don't burn them in one week.") + "</ul>";
      }
    } else {
      html += currentLine(s.pct, tg);
      if (s.meets) {
        html += banner(s.canMiss > 0 ? "ok" : "warn", s.canMiss > 0 ? "✅" : "⚠️",
          s.canMiss > 0 ? "You're safe." : "On the edge.",
          "You currently meet " + tg + "%.");
        html += headline(s.canMiss, s.canMiss === 1 ? "class you can miss now" : "classes you can miss now",
          s.canMiss > 0 ? "Skip more in a row and you drop below " + tg + "%." : "Attend the next one to build a buffer.");
      } else {
        html += banner("bad", "⚠️", "Below the line.", "You're under " + tg + "%.");
        html += headline(s.mustAttend, s.mustAttend === 1 ? "class to attend (no misses)" : "classes to attend in a row",
          "Attend that many straight to reach " + tg + "%.");
      }
    }
    html += "</div>";
    out.innerHTML = html;
    if (out.scrollIntoView) out.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function currentLine(pct, tg) {
    const cls = pct >= tg ? "ok" : "bad";
    return '<div class="banner ' + cls + '"><span class="emoji">📊</span><div><div class="bt">' +
      pct.toFixed(2) + '% right now</div><div class="bs">Target: ' + tg + "%</div></div></div>";
  }
  function banner(type, emoji, title, sub) {
    return '<div class="banner ' + type + '"><span class="emoji">' + emoji + '</span><div><div class="bt">' +
      title + '</div><div class="bs">' + sub + "</div></div></div>";
  }
  function headline(num, desc, sub) {
    return '<div class="headline"><div class="num">' + num + '</div><div class="desc">' + desc + "</div>" +
      (sub ? '<div class="desc" style="margin-top:8px">' + sub + "</div>" : "") + "</div>";
  }
  function tipLi(ic, txt) { return "<li><span>" + ic + "</span><span>" + txt + "</span></li>"; }

  /* ============================ Boot ============================ */
  renderDash();
})();
