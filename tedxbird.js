/* TEDxBird v3: "Starfall" meteor shooter. Fullscreen, auto-fire, move in all directions.
   index.html loads this only while maintenance is ON.
   Move: WASD / arrow keys, or press and drag (mouse / touch). */
(function () {
  "use strict";

  var H = 600;
  var RED = "#e62b1e", GOLD = "#ffc83d";
  var FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  var KIND = {
    power:  { c: "#ff4d4d", t: "P",  n: "POWER UP" },
    speed:  { c: "#4cc9f0", t: "V",  n: "SPEED UP" },
    pierce: { c: "#b388ff", t: "X",  n: "PIERCE UP" },
    shield: { c: "#4ca6ff", t: "H",  n: "SHIELD" },
    bomb:   { c: "#ff9a3d", t: "B",  n: "METEOR BOMB" },
    x2:     { c: GOLD,      t: "x2", n: "DOUBLE POINTS" }
  };
  var BAG = ["power", "power", "power", "power", "power", "speed", "speed", "speed", "speed", "pierce", "pierce", "pierce", "pierce",
             "shield", "shield", "shield", "bomb", "bomb", "x2", "x2"];
  var R = [16, 26, 40], HP = [1, 3, 8], PTS = [10, 30, 80], DROP = [0.08, 0.16, 0.45], HPLV = [0.2, 0.5, 1.2];
  var MAXP = 7, MAXS = 5, MAXX = 4;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  function addCss() {
    if (document.getElementById("tb-css")) return;
    var s = document.createElement("style");
    s.id = "tb-css";
    s.textContent =
      '#birdbox{position:fixed;inset:0;z-index:60;background:#05060d;color:#fff;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none;font-family:' + FONT + '}' +
      '#birdbox .tb-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 22px;flex:none}' +
      '#birdbox .tb-logo{font-weight:800;font-size:20px;letter-spacing:-.02em}' +
      '#birdbox .tb-logo b{color:' + RED + '}' +
      '#birdbox .tb-msg{color:#bdbdbd;font-size:14px;text-align:right}' +
      '#birdbox .tb-msg b{color:#fff}' +
      '#birdbox .tb-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 12px 12px}' +
      '#birdbox .tb-cv{display:block;border-radius:8px;box-shadow:0 0 0 1px #222,0 20px 60px rgba(230,43,30,.15);cursor:crosshair}' +
      '@media(max-width:560px){#birdbox .tb-msg{display:none}}';
    document.head.appendChild(s);
  }

  function mount(box) {
    addCss();
    box.innerHTML =
      '<div class="tb-top"><div class="tb-logo">TED<b>x</b>MSAUniversity</div>' +
      '<div class="tb-msg">The website is getting an update. Play <b>TEDxBird</b> while you wait.</div></div>' +
      '<div class="tb-stage"><canvas class="tb-cv"></canvas></div>';

    var stage = box.querySelector(".tb-stage"), cv = box.querySelector("canvas"), g = cv.getContext("2d");
    if (!g) return;

    /* ---------- fullscreen sizing: height is always 600 units, width follows the screen ---------- */
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

    /* ---------- state ---------- */
    var best = 0;
    try { best = +localStorage.getItem("tedxbird-best") || 0; } catch (e) {}

    var meteors, shots, drops, parts, pops, keys = {}, tgt = null, pressed = false;
    var px, py, lives, power, spd, pierce, shield, invulnUntil, x2Until, score, combo, comboUntil;
    var nextShot, nextSpawn, level, startAt, started, over, deadAt = 0, shake, flashUntil = 0;
    var last = performance.now(), stars = [];
    for (var si = 0; si < 140; si++) {
      var lay = si % 3;
      stars.push({ x: rnd(0, 1300), y: rnd(0, H), f: [0.4, 0.9, 1.6][lay], s: [1, 1.5, 2.2][lay], p: rnd(0, 6) });
    }

    function reset() {
      meteors = []; shots = []; drops = []; parts = []; pops = [];
      px = W / 2; py = H - 110; lives = 3; power = 1; spd = 0; pierce = 0; shield = false;
      invulnUntil = 0; x2Until = 0; score = 0; combo = 0; comboUntil = 0;
      nextShot = 0; nextSpawn = 0; level = 1; startAt = 0; started = false; over = false; shake = 0;
    }

    function mult(now) { return (combo > 0 && now < comboUntil) ? Math.min(8, 1 + Math.floor(combo / 5)) : 1; }
    function pop(t, x, y, c, now, s) { pops.push({ t: t, x: x, y: y, c: c, born: now, s: s || 1 }); }
    function burst(x, y, c, n) {
      for (var i = 0; i < n; i++) {
        var a = rnd(0, 6.283), sp = rnd(1, 5);
        parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 1, d: rnd(0.02, 0.045), c: c, s: rnd(2, 4) });
      }
    }
    function bump(now) {
      var before = mult(now);
      combo++; comboUntil = now + 2500;
      var after = mult(now);
      if (after > before) pop("x" + after + "!", px, py - 40, "#fff", now, 1.5);
    }

    function spawnMeteor(size, x, y, vx) {
      var hp = HP[size] + Math.floor(level * HPLV[size]);
      meteors.push({ x: x, y: y, vx: vx == null ? rnd(-1, 1) : vx, vy: rnd(1.3, 2.3) + level * 0.1 + (2 - size) * 0.2,
        size: size, r: R[size], hp: hp, max: hp, rot: rnd(0, 6), flash: 0 });
    }

    function kill(m, now, award, nosplit) {
      var i = meteors.indexOf(m);
      if (i >= 0) meteors.splice(i, 1);
      burst(m.x, m.y, "#ff9a3d", 8 + m.size * 8); burst(m.x, m.y, "#fff", 4);
      if (m.size > 0 && !nosplit) for (var k = 0; k < 2; k++) spawnMeteor(m.size - 1, m.x + (k ? 14 : -14), m.y, (k ? 1 : -1) * rnd(0.6, 1.4));
      if (!award) return;
      bump(now);
      var gain = PTS[m.size] * mult(now) * (now < x2Until ? 2 : 1);
      score += gain;
      pop("+" + gain, m.x, m.y, now < x2Until ? GOLD : "#fff", now, 0.8 + m.size * 0.3);
      if (Math.random() < DROP[m.size]) drops.push({ x: m.x, y: m.y, k: BAG[(Math.random() * BAG.length) | 0], vx: rnd(-0.5, 0.5) });
    }

    function applyDrop(k, now, x, y) {
      var P = KIND[k], maxed = false;
      if (k === "power") { if (power < MAXP) power++; else maxed = true; }
      else if (k === "speed") { if (spd < MAXS) spd++; else maxed = true; }
      else if (k === "pierce") { if (pierce < MAXX) pierce++; else maxed = true; }
      else if (k === "shield") shield = true;
      else if (k === "x2") x2Until = now + 10000;
      else { meteors.slice().forEach(function (m) { kill(m, now, true, true); }); shake = 14; flashUntil = now + 160; }
      if (maxed) { score += 100; pop("MAX +100", x, y - 20, P.c, now, 1); }
      else pop(P.n, x, y - 22, P.c, now, 1.1);
      burst(x, y, P.c, 16);
    }

    function die(now) {
      over = true; deadAt = now;
      burst(px, py, "#fff", 30); burst(px, py, RED, 30);
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
      var now = performance.now();
      if (over) { if (now - deadAt > 500) reset(); return; }
      if (!started) { started = true; startAt = now; }
    }

    /* ---------- update ---------- */
    function step(dt, now) {
      var i, k, m, b;
      for (i = 0; i < stars.length; i++) { var st = stars[i]; st.y += st.f * dt * (over ? 0.2 : 1); if (st.y > H) { st.y = 0; st.x = rnd(0, W); } }
      for (i = pops.length - 1; i >= 0; i--) if (now - pops[i].born > 900) pops.splice(i, 1);
      for (i = parts.length - 1; i >= 0; i--) { var q = parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.l -= q.d * dt; if (q.l <= 0) parts.splice(i, 1); }
      shake = Math.max(0, shake - 0.6 * dt);
      if (over) return;

      /* movement */
      var ms = 4.2 + spd * 0.7, dx = 0, dy = 0;
      if (keys.ArrowLeft || keys.KeyA) dx--; if (keys.ArrowRight || keys.KeyD) dx++;
      if (keys.ArrowUp || keys.KeyW) dy--; if (keys.ArrowDown || keys.KeyS) dy++;
      if (dx || dy) { var l = Math.sqrt(dx * dx + dy * dy); px += dx / l * ms * dt; py += dy / l * ms * dt; }
      else if (tgt) { var ddx = tgt.x - px, ddy = tgt.y - py, d = Math.sqrt(ddx * ddx + ddy * ddy); if (d > 1) { var sp = Math.min(d, (ms + 3) * dt); px += ddx / d * sp; py += ddy / d * sp; } }
      px = Math.max(20, Math.min(W - 20, px)); py = Math.max(30, Math.min(H - 30, py));
      parts.push({ x: px + rnd(-3, 3), y: py + 14, vx: rnd(-0.3, 0.3), vy: rnd(1, 2.5), l: 0.8, d: 0.07, c: spd > 2 ? "#4cc9f0" : "#ff9a3d", s: rnd(2, 3.5) });
      if (!started) return;

      /* level + spawning */
      var lv = 1 + Math.floor((now - startAt) / 20000);
      if (lv > level) { level = lv; pop("LEVEL " + level, W / 2, H / 2, GOLD, now, 2); }
      if (now > nextSpawn) {
        nextSpawn = now + Math.max(320, 1000 - level * 60) * rnd(0.7, 1.3);
        var r = Math.random(), sz = (level >= 2 && r < Math.min(0.3, 0.08 + level * 0.03)) ? 2 : (r < 0.55 ? 1 : 0);
        spawnMeteor(sz, rnd(30, W - 30), -50);
      }

      /* auto-fire */
      if (now > nextShot) {
        nextShot = now + 260 - spd * 22;
        var n = 1 + ((power - 1) >> 1), dmg = 1 + Math.floor(power / 3);
        for (k = 0; k < n; k++) {
          var o = k - (n - 1) / 2, a = o * 0.13;
          shots.push({ x: px + o * 9, y: py - 16, vx: Math.sin(a) * 11, vy: -Math.cos(a) * 11, dmg: dmg, left: 1 + pierce, hits: [] });
        }
      }

      /* meteors */
      for (i = meteors.length - 1; i >= 0; i--) {
        m = meteors[i];
        m.x += m.vx * dt; m.y += m.vy * dt; m.rot += 0.04 * dt;
        if (m.x < m.r) m.vx = Math.abs(m.vx); else if (m.x > W - m.r) m.vx = -Math.abs(m.vx);
        if (m.y > H + m.r + 10) { meteors.splice(i, 1); continue; }
        if (now >= invulnUntil && dist(px, py, m.x, m.y) < 11 + m.r * 0.85) {
          kill(m, now, false, true); hurt(now); if (over) return;
        }
      }

      /* bolts */
      for (i = shots.length - 1; i >= 0; i--) {
        b = shots[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < -20 || b.x < -20 || b.x > W + 20) { shots.splice(i, 1); continue; }
        var list = meteors.slice(), removed = false;
        for (k = 0; k < list.length; k++) {
          m = list[k];
          if (b.hits.indexOf(m) >= 0 || dist(b.x, b.y, m.x, m.y) > m.r + 5) continue;
          b.hits.push(m); m.hp -= b.dmg; m.flash = now + 70; burst(b.x, b.y, "#ffe08a", 3);
          if (m.hp <= 0) kill(m, now, true, false);
          if (--b.left <= 0) { removed = true; break; }
        }
        if (removed) shots.splice(i, 1);
      }

      /* drops */
      for (i = drops.length - 1; i >= 0; i--) {
        var dr = drops[i];
        dr.y += 1.4 * dt; dr.x += dr.vx * dt;
        if (dr.y > H + 20) { drops.splice(i, 1); continue; }
        if (dist(px, py, dr.x, dr.y) < 28) { drops.splice(i, 1); applyDrop(dr.k, now, dr.x, dr.y); }
      }
      if (combo && now >= comboUntil) combo = 0;
    }

    /* ---------- draw ---------- */
    function text(t, x, y, size, fill, align) {
      g.font = "bold " + size + "px " + FONT; g.textAlign = align || "center"; g.textBaseline = "alphabetic";
      g.lineWidth = size > 20 ? 5 : 3; g.strokeStyle = "#000"; g.fillStyle = fill || "#fff";
      g.strokeText(t, x, y); g.fillText(t, x, y);
    }

    function draw(now) {
      var i, k;
      g.setTransform(S * D, 0, 0, S * D, 0, 0);
      var gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "#05060d"); gr.addColorStop(0.75, "#140b14"); gr.addColorStop(1, "#2e0d10");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = "#fff";
      for (i = 0; i < stars.length; i++) { var s = stars[i]; g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(now / 700 + s.p)); g.fillRect(s.x, s.y, s.s, s.s); }
      g.globalAlpha = 1;

      if (shake > 0) g.translate(rnd(-shake, shake), rnd(-shake, shake));

      /* meteors */
      for (i = 0; i < meteors.length; i++) {
        var m = meteors[i];
        for (k = 7; k >= 1; k--) {
          g.globalAlpha = (1 - k / 8) * 0.55; g.fillStyle = k % 2 ? "#ff9a3d" : RED;
          g.beginPath(); g.arc(m.x - m.vx * k * 2.6, m.y - m.vy * k * 2.6, m.r * (1 - k / 11), 0, 6.283); g.fill();
        }
        g.globalAlpha = 1; g.fillStyle = now < m.flash ? "#fff" : (m.size === 2 ? "#7a4630" : "#6b3a26");
        g.beginPath(); g.arc(m.x, m.y, m.r, 0, 6.283); g.fill();
        g.fillStyle = "rgba(0,0,0,.28)";
        g.beginPath(); g.arc(m.x + Math.cos(m.rot) * m.r * 0.42, m.y + Math.sin(m.rot) * m.r * 0.42, m.r * 0.26, 0, 6.283); g.fill();
        g.beginPath(); g.arc(m.x + Math.cos(m.rot + 2.4) * m.r * 0.45, m.y + Math.sin(m.rot + 2.4) * m.r * 0.45, m.r * 0.16, 0, 6.283); g.fill();
        if (m.hp < m.max && m.size > 0) {
          g.fillStyle = "#222"; g.fillRect(m.x - m.r, m.y - m.r - 10, m.r * 2, 4);
          g.fillStyle = RED; g.fillRect(m.x - m.r, m.y - m.r - 10, m.r * 2 * Math.max(0, m.hp / m.max), 4);
        }
      }

      /* drops */
      for (i = 0; i < drops.length; i++) {
        var dr = drops[i], P = KIND[dr.k], pulse = 1 + 0.1 * Math.sin(now / 160 + dr.x);
        g.shadowColor = P.c; g.shadowBlur = 16; g.fillStyle = P.c; g.beginPath(); g.arc(dr.x, dr.y, 16 * pulse, 0, 6.283); g.fill(); g.shadowBlur = 0;
        g.fillStyle = "#000"; g.font = "bold 15px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(P.t, dr.x, dr.y + 1); g.textBaseline = "alphabetic";
      }

      /* bolts (little "!" strokes) */
      g.lineCap = "round";
      for (i = 0; i < shots.length; i++) {
        var b = shots[i];
        g.strokeStyle = b.dmg >= 3 ? GOLD : b.dmg === 2 ? "#ff9a3d" : "#ff4d4d"; g.lineWidth = 4;
        g.beginPath(); g.moveTo(b.x - b.vx * 0.9, b.y - b.vy * 0.9); g.lineTo(b.x, b.y); g.stroke();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(b.x, b.y, 2.5, 0, 6.283); g.fill();
      }
      g.lineCap = "butt";

      /* particles */
      for (i = 0; i < parts.length; i++) { var q = parts[i]; g.globalAlpha = Math.max(0, q.l); g.fillStyle = q.c; g.fillRect(q.x, q.y, q.s, q.s); }
      g.globalAlpha = 1;

      /* ship */
      if (!over) {
        g.save(); g.translate(px, py);
        if (now < invulnUntil && ((now / 80) | 0) % 2) g.globalAlpha = 0.4;
        if (now < x2Until) { g.shadowColor = GOLD; g.shadowBlur = 18; }
        g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, -17); g.lineTo(13, 13); g.lineTo(0, 7); g.lineTo(-13, 13); g.closePath(); g.fill(); g.shadowBlur = 0;
        g.fillStyle = RED; g.beginPath(); g.arc(0, 2, 6, 0, 6.283); g.fill();
        g.fillStyle = "#fff"; g.font = "bold 10px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 0, 3);
        if (shield) { g.strokeStyle = KIND.shield.c; g.lineWidth = 3; g.shadowColor = KIND.shield.c; g.shadowBlur = 12; g.beginPath(); g.arc(0, 0, 26, 0, 6.283); g.stroke(); g.shadowBlur = 0; }
        g.restore(); g.textBaseline = "alphabetic";
      }

      /* floating points */
      for (i = 0; i < pops.length; i++) {
        var o = pops[i], age = (now - o.born) / 900;
        g.globalAlpha = Math.max(0, 1 - age * age);
        text(o.t, o.x, o.y - age * 55, 22 * o.s, o.c);
      }
      g.globalAlpha = 1;
      g.setTransform(S * D, 0, 0, S * D, 0, 0);
      if (now < flashUntil) { g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(0, 0, W, H); }

      /* HUD */
      text(String(score), W / 2, 56, 46);
      text("LEVEL " + level, W / 2, 78, 14, "#bdbdbd");
      text("BEST " + best, 24, 30, 14, "#bdbdbd", "left");
      if (combo > 0 && now < comboUntil) {
        text("x" + mult(now), 24, 76, 38, GOLD, "left");
        text("COMBO " + combo, 24, 96, 13, "#fff", "left");
        g.fillStyle = "#222"; g.fillRect(24, 104, 110, 6);
        g.fillStyle = GOLD; g.fillRect(24, 104, 110 * Math.max(0, (comboUntil - now) / 2500), 6);
      }
      var hearts = ""; for (i = 0; i < lives; i++) hearts += "\u2665 ";
      text(hearts, W - 24, 38, 26, RED, "right");
      if (shield) text("SHIELD", W - 24, 58, 13, KIND.shield.c, "right");
      if (now < x2Until) {
        text("DOUBLE POINTS", W - 24, 78, 13, GOLD, "right");
        g.fillStyle = "#222"; g.fillRect(W - 144, 84, 120, 5);
        g.fillStyle = GOLD; g.fillRect(W - 144, 84, 120 * Math.max(0, (x2Until - now) / 10000), 5);
      }
      text("POWER " + power + "/" + MAXP + "    SPEED " + spd + "/" + MAXS + "    PIERCE " + pierce + "/" + MAXX, 24, H - 16, 14, "#fff", "left");

      if (!started && !over) {
        text("Move: WASD / arrows, or press and drag", W / 2, H / 2 - 10, 24);
        text("Your ship auto-fires. Shoot the meteors before they hit you.", W / 2, H / 2 + 24, 16, GOLD);
        text("Drops:  P power  \u00b7  V speed  \u00b7  X pierce  \u00b7  H shield  \u00b7  B bomb  \u00b7  x2 points", W / 2, H / 2 + 52, 15, "#bdbdbd");
        text("Click, tap or press any key to start", W / 2, H / 2 + 92, 20);
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
    var MOVEKEYS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, KeyA: 1, KeyD: 1, KeyW: 1, KeyS: 1, Space: 1 };
    function onKeyDown(e) {
      if (MOVEKEYS[e.code]) e.preventDefault();
      keys[e.code] = true;
      if (over && (e.code === "Space" || e.code === "Enter")) act(); else if (!over) act();
    }
    function onKeyUp(e) { keys[e.code] = false; }
    function onBlur() { keys = {}; pressed = false; tgt = null; }
    function setTarget(e) {
      var r = cv.getBoundingClientRect();
      tgt = { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) - (e.pointerType === "touch" ? 50 : 0) };
    }
    box.addEventListener("pointerdown", function (e) { e.preventDefault(); pressed = true; act(); setTarget(e); });
    box.addEventListener("pointermove", function (e) { if (pressed) setTarget(e); });
    box.addEventListener("pointerup", function () { pressed = false; tgt = null; });
    box.addEventListener("pointercancel", function () { pressed = false; tgt = null; });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", fit);

    function loop(now) {
      if (!box.isConnected) {
        window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur); window.removeEventListener("resize", fit);
        return;
      }
      var dt = Math.min((now - last) / 16.667, 3);
      last = now;
      step(dt, now); draw(now);
      requestAnimationFrame(loop);
    }

    reset();
    requestAnimationFrame(loop);
  }

  window.TedxBird = { mount: mount };
})();
