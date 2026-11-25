/* TEDxBird v4: side-scrolling meteor shooter. Your ship faces right, meteors come from the right.
   No upgrade caps: the further you get, the faster and tougher the meteors, and the stronger you can become.
   A boss fight starts every few levels (see BOSS_EVERY). Power-ups are rarer (see DROP_SCALE).
   Move: WASD / arrows, or press and drag. Auto-fire. Loaded by index.html only while maintenance is ON. */
(function () {
  "use strict";
  var H = 600, RED = "#e62b1e", GOLD = "#ffc83d", FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  var KIND = {
    power:  { c: "#ff4d4d", t: "P",  n: "POWER UP",  w: 5 },
    speed:  { c: "#4cc9f0", t: "V",  n: "SPEED UP",  w: 4 },
    pierce: { c: "#b388ff", t: "X",  n: "PIERCE UP", w: 4 },
    drone:  { c: "#7cf2a2", t: "D",  n: "DRONE +1",  w: 3 },
    shield: { c: "#4ca6ff", t: "H",  n: "SHIELD",    w: 3 },
    bomb:   { c: "#ff9a3d", t: "B",  n: "METEOR BOMB", w: 2 },
    x2:     { c: GOLD,      t: "x2", n: "DOUBLE POINTS", w: 2 },
    magnet: { c: "#e6e6e6", t: "M",  n: "MAGNET",    w: 2 },
    frenzy: { c: "#ff7ad9", t: "F",  n: "FRENZY",    w: 2 },
    freeze: { c: "#a0e7ff", t: "Z",  n: "FREEZE",    w: 2 },
    life:   { c: "#ff6b9d", t: "L",  n: "EXTRA LIFE", w: 1 }
  };
  var BAG = []; Object.keys(KIND).forEach(function (k) { for (var i = 0; i < KIND[k].w; i++) BAG.push(k); });

  /* Tuning knobs */
  var DROP_SCALE = 0.5;                       // multiplies every meteor's power-up drop chance (1 = the old rate)
  var BOSS_EVERY = 5;                         // a boss arrives each time you reach a multiple of this level
  var BOSS_HP_BASE = 120, BOSS_HP_LEVEL = 26; // boss health = base + level * per-level
  var BOSSES = [
    { n: "DOUBT",        c: "#b388ff" },
    { n: "FEAR",         c: "#ff4d4d" },
    { n: "HESITATION",   c: "#4cc9f0" },
    { n: "COMFORT ZONE", c: "#7cf2a2" },
    { n: "IMPOSTER",     c: "#ff9a3d" }
  ];

  /* Leaderboard lives in Supabase: run tedxbird-leaderboard.sql once in the SQL editor.
     The publishable key is meant to be public; it is the same one index.html uses. */
  var SB_URL = "https://fdiounclxvaescxfkcnt.supabase.co";
  var SB_KEY = "sb_publishable_pTmK9ZuSQHh915Ke4IAhIA_ib2ip80H";
  var BOARD_SIZE = 100, NAME_MAX = 20;

  /* r = radius, hp = base health, hl = extra health per level, sp = speed multiplier, drop = drop chance */
  var TY = {
    rock0: { r: 16, hp: 1,  hl: 0.25, pts: 10,  sp: 1,   drop: 0.08, c: "#6b3a26", tc: "#ff9a3d" },
    rock1: { r: 26, hp: 3,  hl: 0.6,  pts: 30,  sp: 1,   drop: 0.16, c: "#6b3a26", tc: "#ff9a3d" },
    rock2: { r: 40, hp: 8,  hl: 1.4,  pts: 80,  sp: 0.9, drop: 0.4,  c: "#7a4630", tc: "#ff9a3d" },
    dart:  { r: 12, hp: 1,  hl: 0.1,  pts: 25,  sp: 2.6, drop: 0.1,  c: "#dff6ff", tc: "#4cc9f0" },
    heavy: { r: 46, hp: 14, hl: 2,    pts: 150, sp: 0.55, drop: 0.7, c: "#6c7480", tc: "#9aa5b1" },
    gold:  { r: 24, hp: 5,  hl: 0.6,  pts: 120, sp: 0.9, drop: 1,    c: GOLD,      tc: GOLD },   // drop >= 1 means a guaranteed number of drops
    bomb:  { r: 22, hp: 3,  hl: 0.4,  pts: 60,  sp: 1,   drop: 0.2,  c: "#c4200f", tc: "#ff6b3d" },
    wave:  { r: 18, hp: 2,  hl: 0.3,  pts: 50,  sp: 1.1, drop: 0.2,  c: "#8e5bd9", tc: "#b388ff" }
  };

  function sb(path, opts) {   // tiny Supabase REST helper (resolves to parsed JSON, rejects on any error)
    return Promise.resolve().then(function () {
      opts = opts || {}; opts.headers = { apikey: SB_KEY, "Content-Type": "application/json" };
      return fetch(SB_URL + "/rest/v1/" + path, opts);
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && (j.message || j.hint)) || "Request failed");
        return j;
      });
    });
  }
  function cleanName(s) { return String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, NAME_MAX); }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  function addCss() {
    if (document.getElementById("tb-css")) return;
    var s = document.createElement("style"); s.id = "tb-css";
    s.textContent =
      '#birdbox{position:fixed;inset:0;z-index:60;background:#05060d;color:#fff;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none;font-family:' + FONT + '}' +
      '#birdbox .tb-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 22px;flex:none}' +
      '#birdbox .tb-logo{font-weight:800;font-size:20px;letter-spacing:-.02em}#birdbox .tb-logo b{color:' + RED + '}' +
      '#birdbox .tb-msg{color:#bdbdbd;font-size:14px;text-align:right}#birdbox .tb-msg b{color:#fff}' +
      '#birdbox .tb-msg a{color:#fff;font-weight:700;text-decoration:none}#birdbox .tb-msg a:hover{color:' + GOLD + '}' +
      '#birdbox .tb-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 12px 12px}' +
      '#birdbox .tb-cv{display:block;border-radius:8px;box-shadow:0 0 0 1px #222,0 20px 60px rgba(230,43,30,.15);cursor:crosshair}' +
      /* leaderboard: an HTML layer over the canvas */
      '#birdbox .tb-ui{position:absolute;inset:0;z-index:2;display:none;align-items:center;justify-content:center;padding:14px;background:rgba(5,6,13,.8)}' +
      '#birdbox .tb-ui.on{display:flex}' +
      '#birdbox .tb-card{display:flex;flex-direction:column;gap:10px;width:min(460px,100%);max-height:100%;box-sizing:border-box;padding:20px;background:#0d0f1a;border:1px solid #2a2d3d;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.6)}' +
      '#birdbox .tb-h{font-weight:800;font-size:26px;letter-spacing:-.02em;text-align:center;color:' + RED + '}' +
      '#birdbox .tb-sc{font-weight:800;font-size:46px;line-height:1;text-align:center}' +
      '#birdbox .tb-sub{color:#bdbdbd;font-size:14px;text-align:center}' +
      '#birdbox .tb-note{font-size:14px;text-align:center;color:#ff8a80}#birdbox .tb-note.ok{color:' + GOLD + '}' +
      '#birdbox .tb-form{display:flex;gap:8px}' +
      '#birdbox .tb-in{flex:1;min-width:0;box-sizing:border-box;padding:12px 14px;font:700 16px ' + FONT + ';color:#fff;background:#05060d;border:2px solid #2a2d3d;border-radius:6px;user-select:text;-webkit-user-select:text}' +
      '#birdbox .tb-in:focus{outline:none;border-color:' + RED + '}' +
      '#birdbox .tb-b{padding:12px 18px;font:700 15px ' + FONT + ';color:#fff;background:' + RED + ';border:2px solid ' + RED + ';border-radius:6px;cursor:pointer}' +
      '#birdbox .tb-b:hover{filter:brightness(1.12)}#birdbox .tb-b[disabled]{opacity:.55;cursor:default}' +
      '#birdbox .tb-b.ghost{color:#bdbdbd;background:transparent;border-color:#2a2d3d}' +
      '#birdbox .tb-list{flex:1;min-height:120px;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;border:1px solid #1c1f2e;border-radius:6px}' +
      '#birdbox .tb-row{display:flex;gap:10px;align-items:baseline;padding:7px 12px;border-bottom:1px solid #1c1f2e;font-size:15px}' +
      '#birdbox .tb-row .rk{width:32px;flex:none;color:#8a8fa3}' +
      '#birdbox .tb-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#birdbox .tb-row .pt{flex:none;font-weight:800;font-variant-numeric:tabular-nums}' +
      '#birdbox .tb-row.r1 .nm,#birdbox .tb-row.r1 .pt{color:' + GOLD + '}#birdbox .tb-row.r2 .nm,#birdbox .tb-row.r2 .pt{color:#dfe3ea}#birdbox .tb-row.r3 .nm,#birdbox .tb-row.r3 .pt{color:#e0a36b}' +
      '#birdbox .tb-row.me{background:rgba(230,43,30,.2)}' +
      '#birdbox .tb-empty{padding:26px 12px;text-align:center;color:#bdbdbd;font-size:14px}' +
      '#birdbox .tb-lbbtn{position:absolute;right:28px;bottom:26px;z-index:1;padding:8px 14px;font:700 13px ' + FONT + ';color:#fff;background:rgba(0,0,0,.55);border:1px solid #444;border-radius:6px;cursor:pointer}' +
      '#birdbox .tb-lbbtn:hover{border-color:' + RED + '}' +
      '@media(max-width:560px){#birdbox .tb-msg{display:none}}';
    document.head.appendChild(s);
  }

  /* opts.home: true when the game runs on its own page (/play) instead of replacing the site during maintenance */
  function mount(box, opts) {
    opts = opts || {};
    addCss();
    box.innerHTML =
      '<div class="tb-top"><div class="tb-logo">TED<b>x</b>MSAUniversity</div>' +
      (opts.home ? '<div class="tb-msg"><a href="/">&larr; Back to the website</a></div>'
                 : '<div class="tb-msg">The website is getting an update. Play <b>TEDxBird</b> while you wait.</div>') + '</div>' +
      '<div class="tb-stage"><canvas class="tb-cv"></canvas><div class="tb-ui"></div>' +
      '<button class="tb-lbbtn" type="button">Leaderboard</button></div>';
    var stage = box.querySelector(".tb-stage"), cv = box.querySelector("canvas"), g = cv.getContext("2d");
    if (!g) return;

    /* fullscreen sizing: height is always 600 units, width follows the screen */
    var W = 800, S = 1, D = 1;
    function fit() {
      var aw = Math.max(200, stage.clientWidth - 24), ah = Math.max(200, stage.clientHeight - 12);
      D = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(360, Math.min(1300, Math.round(H * aw / ah)));
      S = Math.min(aw / W, ah / H);
      cv.style.width = Math.floor(W * S) + "px"; cv.style.height = Math.floor(H * S) + "px";
      cv.width = Math.floor(W * S * D); cv.height = Math.floor(H * S * D);
    }
    fit();

    var best = 0;
    try { best = +localStorage.getItem("tedxbird-best") || 0; } catch (e) {}

    var meteors, shots, drops, parts, pops, keys = {}, tgt = null, pressed = false;
    var ebul, boss, bossAt, bossN, warnUntil;   // boss fight: enemy bullets, the boss, next boss level, bosses spawned, warning timer
    /* leaderboard panel state (the panel itself is HTML, see "leaderboard panel" below) */
    var ui = box.querySelector(".tb-ui"), lbBtn = box.querySelector(".tb-lbbtn");
    var panel = "", shownOver = false, lbShown = true, sending = false, notice = "", noticeOk = false;
    var board = null, boardState = "", panelScore = 0, myName = "";
    try { myName = cleanName(localStorage.getItem("tedxbird-name")); } catch (e) {}
    var px, py, lives, power, spd, pierce, drones, shield, invulnUntil, score, combo, comboUntil, level;
    var x2Until, frenzyUntil, freezeUntil, magnetUntil, flashUntil, nextShot, nextSpawn, started, over, deadAt = 0, shake;
    var last = performance.now(), stars = [];
    for (var si = 0; si < 140; si++) { var lay = si % 3; stars.push({ x: rnd(0, 1300), y: rnd(0, H), f: [0.4, 0.9, 1.6][lay], s: [1, 1.5, 2.2][lay], p: rnd(0, 6) }); }

    function reset() {
      meteors = []; shots = []; drops = []; parts = []; pops = [];
      ebul = []; boss = null; bossAt = BOSS_EVERY; bossN = 0; warnUntil = 0;
      panel = ""; shownOver = false; sending = false; notice = ""; renderUi();
      px = 110; py = H / 2; lives = 3; power = 1; spd = 0; pierce = 0; drones = 0; shield = false;
      invulnUntil = 0; score = 0; combo = 0; comboUntil = 0; level = 1;
      x2Until = 0; frenzyUntil = 0; freezeUntil = 0; magnetUntil = 0; flashUntil = 0;
      nextShot = 0; nextSpawn = 0; started = false; over = false; shake = 0;
    }
    function mult(now) { return (combo > 0 && now < comboUntil) ? 1 + Math.floor(combo / 5) : 1; }   // no cap
    function pop(t, x, y, c, now, s) { pops.push({ t: t, x: x, y: y, c: c, born: now, s: s || 1 }); }
    function burst(x, y, c, n) {
      for (var i = 0; i < n; i++) { var a = rnd(0, 6.283), sp = rnd(1, 5); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 1, d: rnd(0.02, 0.045), c: c, s: rnd(2, 4) }); }
    }
    function bump(now) {
      var before = mult(now); combo++; comboUntil = now + 2500;
      if (mult(now) > before) pop("x" + mult(now) + "!", px + 20, py - 40, "#fff", now, 1.5);
    }

    function spawn(t, x, y, vx, vy) {
      var T = TY[t], hp = T.hp + Math.floor(level * T.hl);
      var sp = rnd(1.6, 2.6) * (1 + level * 0.07) * T.sp;   // faster as your level (score) grows
      meteors.push({ t: t, x: x, y: y, vx: vx == null ? -sp : vx, vy: vy == null ? rnd(-0.8, 0.8) : vy, r: T.r, hp: hp, max: hp, rot: rnd(0, 6), flash: 0, ph: rnd(0, 6) });
    }
    function pickType() {
      var r = Math.random();
      if (level >= 2 && r < 0.05) return "gold";
      if (level >= 3 && r < 0.12) return "bomb";
      if (level >= 2 && r < 0.22) return "dart";
      if (level >= 3 && r < 0.32) return "wave";
      if (level >= 4 && r < 0.40) return "heavy";
      var q = Math.random();
      return (level >= 2 && q < Math.min(0.3, 0.08 + level * 0.02)) ? "rock2" : (q < 0.55 ? "rock1" : "rock0");
    }

    function kill(m, now, award, nosplit) {
      var i = meteors.indexOf(m); if (i < 0) return;
      meteors.splice(i, 1);
      var T = TY[m.t];
      burst(m.x, m.y, T.tc, 8 + (m.r >> 2)); burst(m.x, m.y, "#fff", 4);
      if (!nosplit && (m.t === "rock1" || m.t === "rock2")) {
        var ct = m.t === "rock2" ? "rock1" : "rock0";
        for (var k = 0; k < 2; k++) spawn(ct, m.x + (k ? 14 : -14), m.y, -rnd(1.2, 2.4) * (1 + level * 0.07), (k ? 1 : -1) * rnd(0.8, 1.6));
      }
      if (!nosplit && m.t === "bomb") {            // volatile meteor: chain explosion
        burst(m.x, m.y, "#ff6b3d", 30); shake = 8;
        meteors.slice().forEach(function (o) {
          if (dist(o.x, o.y, m.x, m.y) < 140 && meteors.indexOf(o) >= 0) { o.hp -= 4; o.flash = now + 70; if (o.hp <= 0) kill(o, now, true, false); }
        });
      }
      if (!award) return;
      bump(now);
      var gain = T.pts * mult(now) * (now < x2Until ? 2 : 1);
      score += gain; pop("+" + gain, m.x, m.y, now < x2Until ? GOLD : "#fff", now, 0.8 + m.r / 50);
      var nd = T.drop >= 1 ? T.drop : (Math.random() < T.drop * DROP_SCALE ? 1 : 0);
      for (var d = 0; d < nd; d++) drops.push({ x: m.x + d * 22, y: m.y, k: BAG[(Math.random() * BAG.length) | 0], vx: -1.2 + rnd(-0.3, 0.3), vy: rnd(-0.5, 0.5) });
    }

    function applyDrop(k, now, x, y) {
      var P = KIND[k];
      if (k === "power") power++; else if (k === "speed") spd++; else if (k === "pierce") pierce++;
      else if (k === "drone") drones++; else if (k === "life") lives++; else if (k === "shield") shield = true;
      else if (k === "x2") x2Until = now + 10000; else if (k === "frenzy") frenzyUntil = now + 8000;
      else if (k === "freeze") freezeUntil = now + 6000; else if (k === "magnet") magnetUntil = now + 10000;
      else {
        meteors.slice().forEach(function (m) { kill(m, now, true, true); }); ebul = []; shake = 14; flashUntil = now + 160;
        if (boss) { boss.hp -= boss.max * 0.12; boss.flash = now + 120; if (boss.hp <= 0) killBoss(now); }   // a bomb hurts a boss, it doesn't delete it
      }
      pop(P.n, x, y - 22, P.c, now, 1.1); burst(x, y, P.c, 16);
    }

    /* ---------- boss fights ---------- */
    function bossName(n) {
      var c = Math.floor((n - 1) / BOSSES.length);
      return BOSSES[(n - 1) % BOSSES.length].n + (c ? " " + (c + 1) : "");
    }
    function bossPhase() { var r = boss.hp / boss.max; return r > 0.66 ? 1 : (r > 0.33 ? 2 : 3); }
    function ebullet(x, y, a, sp) { ebul.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7 }); }
    function spawnBoss(now) {
      var n = ++bossN, hp = Math.round(BOSS_HP_BASE + level * BOSS_HP_LEVEL);
      boss = { n: n, name: bossName(n), c: BOSSES[(n - 1) % BOSSES.length].c, x: W + 110, y: H / 2, r: 68, hp: hp, max: hp, ph: 0, state: "enter", next: 0, atk: 0, flash: 0 };
    }
    /* phase 1: aimed triple shot. phase 2: aimed fan, alternating with a pair of darts. phase 3: rotating ring, alternating with a fast triple */
    function bossAttack(ph) {
      var b = boss, k, n, off, a0 = Math.atan2(py - b.y, px - b.x), sp = Math.min(7, 3.4 + level * 0.12), mx = b.x - b.r * 0.6;
      if (ph === 1) { for (k = -1; k <= 1; k++) ebullet(mx, b.y, a0 + k * 0.22, sp); }
      else if (ph === 2) {
        if (b.atk % 2) { for (k = -2; k <= 2; k++) ebullet(mx, b.y, a0 + k * 0.2, sp); }
        else { spawn("dart", b.x - b.r, b.y - 36); spawn("dart", b.x - b.r, b.y + 36); }
      } else if (b.atk % 2) {
        n = 14; off = rnd(0, 6.283);
        for (k = 0; k < n; k++) ebullet(b.x, b.y, off + k * 6.283 / n, sp * 0.8);
      } else { for (k = -1; k <= 1; k++) ebullet(mx, b.y, a0 + k * 0.12, sp * 1.25); }
    }
    function killBoss(now) {
      var b = boss, i, gain = (400 + 150 * level) * (now < x2Until ? 2 : 1);
      boss = null; ebul = [];
      burst(b.x, b.y, "#fff", 50); burst(b.x, b.y, b.c, 60); burst(b.x, b.y, GOLD, 30);
      meteors.slice().forEach(function (m) { kill(m, now, false, true); });   // clear the leftover minions
      shake = 18; flashUntil = now + 220;
      bossAt = (Math.floor(level / BOSS_EVERY) + 1) * BOSS_EVERY;
      score += gain; pop("BOSS DOWN  +" + gain, b.x - 60, b.y, GOLD, now, 1.3);
      for (i = 0; i < 2; i++) drops.push({ x: b.x - 30 + i * 60, y: b.y + (i ? 40 : -40), k: BAG[(Math.random() * BAG.length) | 0], vx: -1.2, vy: rnd(-0.5, 0.5) });
    }

    function die(now) {
      over = true; deadAt = now; burst(px, py, "#fff", 30); burst(px, py, RED, 30);
      if (score > best) { best = score; try { localStorage.setItem("tedxbird-best", String(best)); } catch (e) {} }
    }
    function hurt(now) {
      if (now < invulnUntil) return;
      shake = 10;
      if (shield) { shield = false; invulnUntil = now + 1000; burst(px, py, KIND.shield.c, 22); pop("SHIELD BROKEN", px, py - 30, KIND.shield.c, now, 1); return; }
      lives--; invulnUntil = now + 1800; burst(px, py, RED, 18);
      if (lives <= 0) die(now);
    }
    function act() {
      if (over) {
        if (!shownOver || panel === "name") return;   // let the player finish the name prompt first
        closePanel(); reset(); return;
      }
      if (panel) closePanel();
      started = true;
    }

    /* ---------- leaderboard panel (an HTML layer over the canvas) ---------- */
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function put(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
    function btn(label, cls, fn) { var b = el("button", "tb-b" + (cls ? " " + cls : ""), label); b.type = "button"; b.addEventListener("click", fn); return b; }
    function inUi(t) { return !!(t && t.closest && t.closest(".tb-ui, .tb-lbbtn")); }   // clicks and keys inside the panel must not drive the game
    function anyKey() { for (var k in keys) if (keys[k]) return true; return pressed; }

    function loadBoard() {
      boardState = "loading"; renderUi();
      return sb("tedxbird_scores?select=name,score&order=score.desc,updated_at.asc&limit=" + BOARD_SIZE).then(function (rows) {
        board = Array.isArray(rows) ? rows : []; boardState = "ok"; renderUi();
      }, function () { boardState = "error"; renderUi(); });
    }
    function openPanel(p) {
      panel = p; panelScore = score; notice = ""; noticeOk = false;
      if (p === "board") loadBoard(); else renderUi();
    }
    function closePanel() { panel = ""; renderUi(); }
    function submit(raw) {
      var n = cleanName(raw);
      if (sending) return;
      if (!n) { notice = "Please type a name."; noticeOk = false; renderUi(); return; }
      myName = n; sending = true; notice = ""; renderUi();
      sb("rpc/submit_tedxbird_score", { method: "POST", body: JSON.stringify({ p_name: n, p_score: panelScore }) }).then(function (r) {
        try { localStorage.setItem("tedxbird-name", n); } catch (e) {}
        sending = false;
        var rank = r && r.rank, best = r && r.best;
        notice = !rank ? "Score saved." : (best > panelScore ? "Your best is still " + best + " (#" + rank + ")." : "New best! You are #" + rank + ".");
        noticeOk = true; panel = "board"; loadBoard();
      }, function () { sending = false; notice = "Could not send your score. Check your connection and try again."; noticeOk = false; renderUi(); });
    }
    function renderUi() {
      ui.textContent = ""; ui.className = "tb-ui" + (panel ? " on" : "");
      if (!panel) return;
      var card = el("div", "tb-card"), inp = null;
      if (panel === "name") {
        var form = el("form", "tb-form"), go = el("button", "tb-b", sending ? "Sending…" : "Submit score");
        inp = el("input", "tb-in"); inp.type = "text"; inp.maxLength = NAME_MAX; inp.placeholder = "Your name"; inp.value = myName; inp.disabled = sending;
        inp.setAttribute("autocomplete", "off"); inp.setAttribute("aria-label", "Your name");
        go.type = "submit"; go.disabled = sending;
        form.addEventListener("submit", function (e) { e.preventDefault(); submit(inp.value); });
        put(form, inp, go);
        put(card, el("div", "tb-h", "GAME OVER"), el("div", "tb-sc", String(panelScore)), el("div", "tb-sub", "Add your name to the leaderboard"), form,
          notice ? el("div", "tb-note" + (noticeOk ? " ok" : ""), notice) : null,
          sending ? null : btn("Skip", "ghost", function () { openPanel("board"); }));
      } else {
        var list = el("div", "tb-list");
        if (boardState === "error") {
          var retry = btn("Try again", "", loadBoard); retry.style.marginTop = "12px";
          put(list, put(el("div", "tb-empty", "Could not load the leaderboard."), retry));
        } else if (boardState !== "ok") put(list, el("div", "tb-empty", "Loading…"));
        else if (!board.length) put(list, el("div", "tb-empty", "No scores yet. Be the first!"));
        else board.forEach(function (r, i) {
          var nm = String(r.name == null ? "" : r.name), me = !!myName && nm.toLowerCase() === myName.toLowerCase();
          put(list, put(el("div", "tb-row" + (i < 3 ? " r" + (i + 1) : "") + (me ? " me" : "")),
            el("span", "rk", String(i + 1)), el("span", "nm", nm), el("span", "pt", Number(r.score).toLocaleString("en-US"))));
        });
        put(card, el("div", "tb-h", "LEADERBOARD"), el("div", "tb-sub", "Top " + BOARD_SIZE + " players"),
          notice ? el("div", "tb-note" + (noticeOk ? " ok" : ""), notice) : null, list,
          btn(over ? "Play again" : "Close", "", function () { closePanel(); if (over) reset(); }));
      }
      ui.appendChild(card);
      if (inp && !sending && !anyKey()) inp.focus();   // don't steal focus while the player is still holding a game key
    }
    function syncUi(now) {
      if (over && !shownOver && now - deadAt > 900) { shownOver = true; openPanel(score > 0 ? "name" : "board"); }
      var want = !started && !over && !panel;
      if (want !== lbShown) { lbShown = want; lbBtn.style.display = want ? "" : "none"; }
    }
    lbBtn.addEventListener("click", function () { if (!over) openPanel("board"); });

    /* ---------- update ---------- */
    function step(dt, now) {
      var i, k, m, b;
      for (i = 0; i < stars.length; i++) { var st = stars[i]; st.x -= st.f * dt * (over ? 0.2 : 1); if (st.x < 0) { st.x = W; st.y = rnd(0, H); } }
      for (i = pops.length - 1; i >= 0; i--) if (now - pops[i].born > 900) pops.splice(i, 1);
      for (i = parts.length - 1; i >= 0; i--) { var q = parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.l -= q.d * dt; if (q.l <= 0) parts.splice(i, 1); }
      shake = Math.max(0, shake - 0.6 * dt);
      if (over) return;

      var ms = 4.2 + 6 * (1 - Math.pow(0.88, spd)), dx = 0, dy = 0;   // speed upgrades keep helping, but stay controllable
      if (keys.ArrowLeft || keys.KeyA) dx--; if (keys.ArrowRight || keys.KeyD) dx++;
      if (keys.ArrowUp || keys.KeyW) dy--; if (keys.ArrowDown || keys.KeyS) dy++;
      if (dx || dy) { var l = Math.sqrt(dx * dx + dy * dy); px += dx / l * ms * dt; py += dy / l * ms * dt; }
      else if (tgt) { var ddx = tgt.x - px, ddy = tgt.y - py, d = Math.sqrt(ddx * ddx + ddy * ddy); if (d > 1) { var sp = Math.min(d, (ms + 3) * dt); px += ddx / d * sp; py += ddy / d * sp; } }
      px = Math.max(24, Math.min(W - 24, px)); py = Math.max(24, Math.min(H - 24, py));
      parts.push({ x: px - 14, y: py + rnd(-3, 3), vx: rnd(-2.5, -1), vy: rnd(-0.3, 0.3), l: 0.8, d: 0.07, c: spd > 2 ? "#4cc9f0" : "#ff9a3d", s: rnd(2, 3.5) });
      if (!started) return;

      /* level follows score: more score = faster, tougher, more meteors (no limit) */
      var lv = 1 + Math.floor(Math.sqrt(score / 50));
      if (lv > level) { level = lv; pop("LEVEL " + level, W / 2, H / 2, GOLD, now, 2); }
      /* boss fights: a warning, then a boss each time you reach a multiple of BOSS_EVERY */
      if (!boss && !warnUntil && level >= bossAt) warnUntil = now + 2200;
      if (warnUntil && now >= warnUntil) { warnUntil = 0; spawnBoss(now); }
      if (now > nextSpawn) { nextSpawn = now + Math.max(150, 950 - level * 45) * rnd(0.7, 1.3) * ((boss || warnUntil) ? 2.5 : 1); spawn(pickType(), W + 60, rnd(40, H - 40)); }

      /* auto-fire to the right */
      if (now > nextShot) {
        nextShot = now + Math.max(45, 260 * Math.pow(0.9, spd)) / (now < frenzyUntil ? 2 : 1);
        var n = 1 + ((power - 1) >> 1), dmg = 1 + Math.floor(power / 3), step2 = Math.min(0.13, 1.1 / n);
        for (k = 0; k < n; k++) { var o = k - (n - 1) / 2, a = o * step2; shots.push({ x: px + 18, y: py + o * 7, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, dmg: dmg, left: 1 + pierce, hits: [] }); }
        for (k = 0; k < drones; k++) { var dd = droneAt(k); shots.push({ x: dd.x + 6, y: dd.y, vx: 11, vy: 0, dmg: dmg, left: 1 + pierce, hits: [] }); }
      }

      /* meteors */
      var fz = now < freezeUntil ? 0.45 : 1;
      for (i = meteors.length - 1; i >= 0; i--) {
        m = meteors[i];
        if (m.t === "wave") { m.ph += 0.06 * dt * fz; m.vy = Math.cos(m.ph) * 2.4; }
        m.x += m.vx * dt * fz; m.y += m.vy * dt * fz; m.rot += 0.04 * dt;
        if (m.y < m.r) m.vy = Math.abs(m.vy); else if (m.y > H - m.r) m.vy = -Math.abs(m.vy);
        if (m.x < -m.r - 40) { meteors.splice(i, 1); continue; }
        if (now >= invulnUntil && dist(px, py, m.x, m.y) < 12 + m.r * 0.85) { kill(m, now, false, true); hurt(now); if (over) return; }
      }

      /* boss + its bullets (freeze slows both) */
      if (boss) {
        var bo = boss, bph = bossPhase();
        if (bo.state === "enter") {
          bo.x -= 2.4 * dt * fz;
          if (bo.x <= W - 120) { bo.state = "fight"; bo.next = now + 900; }
        } else {
          bo.x += (W - 120 - bo.x) * Math.min(1, 0.1 * dt);
          bo.ph += 0.025 * dt * fz;
          var track = bph === 1 ? 0 : (bph === 2 ? 0.35 : 0.6);      // later phases chase the player more
          var ty = (1 - track) * (H / 2 + Math.sin(bo.ph) * (H / 2 - bo.r - 30)) + track * py;
          ty = Math.max(bo.r + 10, Math.min(H - bo.r - 10, ty));
          var bv = (1.4 + 0.5 * bph + level * 0.04) * dt * fz;
          bo.y += Math.max(-bv, Math.min(bv, ty - bo.y));
          if (now >= bo.next) { bo.atk++; bo.next = now + Math.max(650, (1700 - bph * 200) * (1 - Math.min(0.35, level * 0.015))); bossAttack(bph); }
          else if (fz < 1) bo.next += dt * 16.667 * (1 - fz);
        }
        if (now >= invulnUntil && dist(px, py, bo.x, bo.y) < 12 + bo.r * 0.9) { hurt(now); if (over) return; }
      }
      for (i = ebul.length - 1; i >= 0; i--) {
        var eb = ebul[i];
        eb.x += eb.vx * dt * fz; eb.y += eb.vy * dt * fz;
        if (eb.x < -30 || eb.x > W + 30 || eb.y < -30 || eb.y > H + 30) { ebul.splice(i, 1); continue; }
        if (now >= invulnUntil && dist(px, py, eb.x, eb.y) < 9 + eb.r) { ebul.splice(i, 1); hurt(now); if (over) return; }
      }

      /* bolts */
      for (i = shots.length - 1; i >= 0; i--) {
        b = shots[i]; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x > W + 20 || b.y < -20 || b.y > H + 20) { shots.splice(i, 1); continue; }
        var list = meteors.slice(), gone = false;
        for (k = 0; k < list.length; k++) {
          m = list[k];
          if (b.hits.indexOf(m) >= 0 || dist(b.x, b.y, m.x, m.y) > m.r + 5) continue;
          b.hits.push(m); m.hp -= b.dmg; m.flash = now + 70; burst(b.x, b.y, "#ffe08a", 3);
          if (m.hp <= 0) kill(m, now, true, false);
          if (--b.left <= 0) { gone = true; break; }
        }
        if (!gone && boss && b.hits.indexOf(boss) < 0 && dist(b.x, b.y, boss.x, boss.y) < boss.r + 5) {
          b.hits.push(boss); boss.hp -= b.dmg; boss.flash = now + 70; burst(b.x, b.y, "#ffe08a", 3);
          if (boss.hp <= 0) killBoss(now);
          if (--b.left <= 0) gone = true;
        }
        if (gone) shots.splice(i, 1);
      }

      /* drops (magnet pulls them in) */
      for (i = drops.length - 1; i >= 0; i--) {
        var dr = drops[i];
        if (now < magnetUntil) { var mx = px - dr.x, my = py - dr.y, md = Math.sqrt(mx * mx + my * my) || 1; dr.x += mx / md * 6 * dt; dr.y += my / md * 6 * dt; }
        else { dr.x += dr.vx * dt; dr.y += dr.vy * dt; }
        if (dr.x < -30 || dr.y < -30 || dr.y > H + 30) { drops.splice(i, 1); continue; }
        if (dist(px, py, dr.x, dr.y) < 30) { drops.splice(i, 1); applyDrop(dr.k, now, dr.x, dr.y); }
      }
      if (combo && now >= comboUntil) combo = 0;
    }
    function droneAt(k) { var side = k % 2 ? 1 : -1, j = k >> 1; return { x: px - 8 - 14 * ((j / 12) | 0), y: py + side * (j % 12 + 1) * 20 }; }

    /* ---------- draw ---------- */
    function text(t, x, y, size, fill, align) {
      g.font = "bold " + size + "px " + FONT; g.textAlign = align || "center"; g.textBaseline = "alphabetic";
      g.lineWidth = size > 20 ? 5 : 3; g.strokeStyle = "#000"; g.fillStyle = fill || "#fff"; g.strokeText(t, x, y); g.fillText(t, x, y);
    }
    function circ(x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }

    function draw(now) {
      var i, k;
      g.setTransform(S * D, 0, 0, S * D, 0, 0);
      var gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, "#05060d"); gr.addColorStop(0.7, "#140b14"); gr.addColorStop(1, "#2e0d10");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = "#fff";
      for (i = 0; i < stars.length; i++) { var s = stars[i]; g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(now / 700 + s.p)); g.fillRect(s.x, s.y, s.s, s.s); }
      g.globalAlpha = 1;
      if (shake > 0) g.translate(rnd(-shake, shake), rnd(-shake, shake));

      /* meteors: each type has its own look */
      for (i = 0; i < meteors.length; i++) {
        var m = meteors[i], T = TY[m.t], tl = m.t === "dart" ? 4.5 : 2.6;
        for (k = 7; k >= 1; k--) { g.globalAlpha = (1 - k / 8) * 0.55; circ(m.x - m.vx * k * tl, m.y - m.vy * k * tl, m.r * (1 - k / 11), k % 2 ? T.tc : RED); }
        g.globalAlpha = 1;
        if (m.t === "gold" || m.t === "bomb") { g.shadowColor = T.tc; g.shadowBlur = m.t === "bomb" ? 10 + 10 * Math.abs(Math.sin(now / 120)) : 18; }
        circ(m.x, m.y, m.r, now < m.flash ? "#fff" : T.c); g.shadowBlur = 0;
        g.fillStyle = "rgba(0,0,0,.28)";
        g.beginPath(); g.arc(m.x + Math.cos(m.rot) * m.r * 0.42, m.y + Math.sin(m.rot) * m.r * 0.42, m.r * 0.26, 0, 6.283); g.fill();
        if (m.t === "heavy") { g.strokeStyle = "#3b414a"; g.lineWidth = 4; g.beginPath(); g.arc(m.x, m.y, m.r * 0.65, 0, 6.283); g.stroke(); }
        if (m.t === "wave") { g.strokeStyle = "#e0ccff"; g.lineWidth = 2; g.beginPath(); g.arc(m.x, m.y, m.r + 4, 0, 6.283); g.stroke(); }
        if (m.t === "bomb") text("!", m.x, m.y + 7, 20, "#fff");
        if (m.t === "gold") text("\u2605", m.x, m.y + 6, 18, "#7a5200");
        if (m.hp < m.max && m.r > 20) { g.fillStyle = "#222"; g.fillRect(m.x - m.r, m.y - m.r - 10, m.r * 2, 4); g.fillStyle = RED; g.fillRect(m.x - m.r, m.y - m.r - 10, m.r * 2 * Math.max(0, m.hp / m.max), 4); }
      }

      /* boss: dark disc, coloured ring, spinning spikes and a big question mark */
      if (boss) {
        var bo = boss, fl = now < bo.flash;
        g.save(); g.translate(bo.x, bo.y);
        g.shadowColor = bo.c; g.shadowBlur = 26; g.fillStyle = fl ? "#fff" : bo.c;
        for (k = 0; k < 8; k++) {
          var sa = bo.ph * 1.5 + k * Math.PI / 4;
          g.beginPath(); g.moveTo(Math.cos(sa - 0.16) * bo.r * 0.9, Math.sin(sa - 0.16) * bo.r * 0.9);
          g.lineTo(Math.cos(sa) * bo.r * 1.22, Math.sin(sa) * bo.r * 1.22);
          g.lineTo(Math.cos(sa + 0.16) * bo.r * 0.9, Math.sin(sa + 0.16) * bo.r * 0.9); g.closePath(); g.fill();
        }
        circ(0, 0, bo.r, fl ? "#fff" : "#1a0d14"); g.shadowBlur = 0;
        g.lineWidth = 7; g.strokeStyle = fl ? "#fff" : bo.c; g.beginPath(); g.arc(0, 0, bo.r - 4, 0, 6.283); g.stroke();
        circ(0, 0, bo.r * 0.55, fl ? "#ddd" : "rgba(255,255,255,.08)");
        text("?", 0, bo.r * 0.32, bo.r, fl ? "#000" : bo.c);
        g.restore();
      }

      /* drops */
      for (i = 0; i < drops.length; i++) {
        var dr = drops[i], P = KIND[dr.k], pl = 1 + 0.1 * Math.sin(now / 160 + dr.y);
        g.shadowColor = P.c; g.shadowBlur = 16; circ(dr.x, dr.y, 16 * pl, P.c); g.shadowBlur = 0;
        g.fillStyle = "#000"; g.font = "bold 15px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(P.t, dr.x, dr.y + 1); g.textBaseline = "alphabetic";
      }

      /* boss bullets */
      for (i = 0; i < ebul.length; i++) {
        var eb = ebul[i];
        g.shadowColor = "#ff3d6e"; g.shadowBlur = 12; circ(eb.x, eb.y, eb.r, "#ff3d6e"); g.shadowBlur = 0; circ(eb.x, eb.y, eb.r * 0.45, "#fff");
      }

      /* bolts (little "!" strokes) */
      g.lineCap = "round";
      for (i = 0; i < shots.length; i++) {
        var b = shots[i];
        g.strokeStyle = b.dmg >= 3 ? GOLD : b.dmg === 2 ? "#ff9a3d" : "#ff4d4d"; g.lineWidth = 4;
        g.beginPath(); g.moveTo(b.x - b.vx * 0.9, b.y - b.vy * 0.9); g.lineTo(b.x, b.y); g.stroke(); circ(b.x, b.y, 2.5, "#fff");
      }
      g.lineCap = "butt";
      for (i = 0; i < parts.length; i++) { var q = parts[i]; g.globalAlpha = Math.max(0, q.l); g.fillStyle = q.c; g.fillRect(q.x, q.y, q.s, q.s); }
      g.globalAlpha = 1;

      if (!over) {
        for (k = 0; k < drones; k++) { var dd = droneAt(k); g.shadowColor = KIND.drone.c; g.shadowBlur = 8; circ(dd.x, dd.y, 6, KIND.drone.c); g.shadowBlur = 0; }
        g.save(); g.translate(px, py);
        if (now < invulnUntil && ((now / 80) | 0) % 2) g.globalAlpha = 0.4;
        if (now < x2Until) { g.shadowColor = GOLD; g.shadowBlur = 18; }
        g.fillStyle = "#fff"; g.beginPath(); g.moveTo(18, 0); g.lineTo(-13, 14); g.lineTo(-7, 0); g.lineTo(-13, -14); g.closePath(); g.fill(); g.shadowBlur = 0;
        circ(-2, 0, 6, RED);
        g.fillStyle = "#fff"; g.font = "bold 10px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", -2, 1);
        if (shield) { g.strokeStyle = KIND.shield.c; g.lineWidth = 3; g.shadowColor = KIND.shield.c; g.shadowBlur = 12; g.beginPath(); g.arc(0, 0, 27, 0, 6.283); g.stroke(); g.shadowBlur = 0; }
        g.restore(); g.textBaseline = "alphabetic";
      }

      for (i = 0; i < pops.length; i++) { var o = pops[i], age = (now - o.born) / 900; g.globalAlpha = Math.max(0, 1 - age * age); text(o.t, o.x, o.y - age * 55, 22 * o.s, o.c); }
      g.globalAlpha = 1; g.setTransform(S * D, 0, 0, S * D, 0, 0);
      if (now < flashUntil) { g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(0, 0, W, H); }

      /* HUD */
      text(String(score), W / 2, 56, 46); text("LEVEL " + level, W / 2, 78, 14, "#bdbdbd"); text("BEST " + best, 24, 30, 14, "#bdbdbd", "left");
      if (combo > 0 && now < comboUntil) {
        text("x" + mult(now), 24, 76, 38, GOLD, "left"); text("COMBO " + combo, 24, 96, 13, "#fff", "left");
        g.fillStyle = "#222"; g.fillRect(24, 104, 110, 6); g.fillStyle = GOLD; g.fillRect(24, 104, 110 * Math.max(0, (comboUntil - now) / 2500), 6);
      }
      var hearts = ""; if (lives <= 5) for (i = 0; i < lives; i++) hearts += "\u2665 "; else hearts = "\u2665 \u00d7" + lives;
      text(hearts, W - 24, 38, 26, RED, "right");
      var y0 = 58; if (shield) { text("SHIELD", W - 24, y0, 13, KIND.shield.c, "right"); y0 += 20; }
      var tm = [["DOUBLE POINTS", x2Until, 10000, GOLD], ["FRENZY", frenzyUntil, 8000, KIND.frenzy.c], ["FREEZE", freezeUntil, 6000, KIND.freeze.c], ["MAGNET", magnetUntil, 10000, KIND.magnet.c]];
      for (i = 0; i < tm.length; i++) if (now < tm[i][1]) {
        text(tm[i][0], W - 24, y0, 13, tm[i][3], "right");
        g.fillStyle = "#222"; g.fillRect(W - 144, y0 + 5, 120, 5); g.fillStyle = tm[i][3]; g.fillRect(W - 144, y0 + 5, 120 * Math.max(0, (tm[i][1] - now) / tm[i][2]), 5); y0 += 28;
      }
      text("POWER " + power + "    SPEED " + spd + "    PIERCE " + pierce + "    DRONES " + drones, 24, H - 16, 14, "#fff", "left");
      if (boss) {
        var bw = Math.min(420, W - 80), bx = (W - bw) / 2, by = H - 46;
        text(boss.name, W / 2, by - 8, 15, boss.c);
        g.fillStyle = "#222"; g.fillRect(bx, by, bw, 8);
        g.fillStyle = boss.c; g.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.max), 8);
        g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(bx + bw / 3 - 1, by, 2, 8); g.fillRect(bx + bw * 2 / 3 - 1, by, 2, 8);   // phase marks
      }
      if (warnUntil && now < warnUntil) {
        if (((now / 220) | 0) % 2) text("WARNING", W / 2, H / 2 - 24, 56, RED);
        text(bossName(bossN + 1) + " APPROACHES", W / 2, H / 2 + 14, 22, "#fff");
      }

      if (!started && !over) {
        text("Move: WASD / arrows, or press and drag", W / 2, H / 2 - 20, 24);
        text("Your ship auto-fires to the right. Blast the meteors before they hit you.", W / 2, H / 2 + 12, 16, GOLD);
        text("Drops:  P power \u00b7 V speed \u00b7 X pierce \u00b7 D drone \u00b7 H shield \u00b7 B bomb \u00b7 L life", W / 2, H / 2 + 40, 15, "#bdbdbd");
        text("M magnet \u00b7 F frenzy \u00b7 Z freeze \u00b7 x2 points.  Upgrades never cap, and neither do the meteors.", W / 2, H / 2 + 62, 15, "#bdbdbd");
        text("Every " + BOSS_EVERY + " levels a boss attacks. Dodge its shots and bring it down.", W / 2, H / 2 + 84, 15, GOLD);
        text("Click, tap or press any key to start", W / 2, H / 2 + 112, 20);
      }
      if (over) {
        g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, 0, W, H);
        text("GAME OVER", W / 2, H / 2 - 50, 52, RED);
        text("Score " + score + "   \u00b7   Best " + best + "   \u00b7   Level " + level, W / 2, H / 2 + 5, 24);
        text("Stop fearing the question mark.", W / 2, H / 2 + 45, 18, "#ddd");
        text("Click or press Space to play again", W / 2, H / 2 + 85, 20);
      }
    }

    /* ---------- input + loop ---------- */
    var MOVE = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, KeyA: 1, KeyD: 1, KeyW: 1, KeyS: 1, Space: 1 };
    function onKeyDown(e) { if (inUi(e.target)) return; if (MOVE[e.code]) e.preventDefault(); keys[e.code] = true; if (!over || e.code === "Space" || e.code === "Enter") act(); }
    function onKeyUp(e) { keys[e.code] = false; }
    function onBlur() { keys = {}; pressed = false; tgt = null; }
    function setTarget(e) { var r = cv.getBoundingClientRect(); tgt = { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
    box.addEventListener("pointerdown", function (e) { if (inUi(e.target)) return; e.preventDefault(); pressed = true; act(); setTarget(e); });
    box.addEventListener("pointermove", function (e) { if (pressed) setTarget(e); });
    box.addEventListener("pointerup", function () { pressed = false; tgt = null; });
    box.addEventListener("pointercancel", function () { pressed = false; tgt = null; });
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur); window.addEventListener("resize", fit);

    function loop(now) {
      if (!box.isConnected) {
        window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur); window.removeEventListener("resize", fit); return;
      }
      var dt = Math.min((now - last) / 16.667, 3); last = now;
      step(dt, now); draw(now); syncUi(now); requestAnimationFrame(loop);
    }
    reset(); requestAnimationFrame(loop);
  }

  window.TedxBird = { mount: mount };
})();
