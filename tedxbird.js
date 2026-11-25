/* TEDxBird v2: fullscreen night-sky flapper with combo multipliers, power-ups and meteors.
   index.html loads this only while maintenance is ON.
   Controls: click / tap / Space / Up arrow. */
(function () {
  "use strict";

  var H = 600, GROUND = 60, BX = 150, BS = 30, PW = 64, GAP = 175, SPACING = 290;
  var GRAV = 0.5, FLAP = -8, MAXFALL = 11;
  var RED = "#e62b1e", RED_D = "#c4200f", GOLD = "#ffc83d";
  var FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  var PU = {
    shield: { c: "#4cc9f0", t: "S" },
    x2:     { c: GOLD,      t: "x2" },
    blast:  { c: "#ff6b3d", t: "B" },
    slow:   { c: "#b388ff", t: "~" }
  };
  var PUKEYS = ["shield", "x2", "blast", "slow"];
  var PUNAME = { shield: "SHIELD", x2: "DOUBLE POINTS", blast: "BLASTER", slow: "SLOW-MO" };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function hit(b, x, y, w, h) { return b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y; }

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
      '#birdbox .tb-cv{display:block;border-radius:8px;box-shadow:0 0 0 1px #222,0 20px 60px rgba(230,43,30,.15);cursor:pointer}' +
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

    var pipes, items, meteors, comets, bolts, parts, pops;
    var y, vy, score, combo, comboUntil, shield, invulnUntil, x2Until, blastUntil, slowUntil;
    var nextFire, nextMeteor, nextComet, passed, started, over, deadAt = 0, gOff = 0, glyphUntil = 0;
    var last = performance.now();
    var stars = [];
    for (var si = 0; si < 130; si++) {
      var lay = si % 3;
      stars.push({ x: rnd(0, 1300), y: rnd(0, H - GROUND - 20), f: [0.12, 0.25, 0.45][lay], s: [1, 1.5, 2.2][lay], p: rnd(0, 6) });
    }

    function reset() {
      pipes = []; items = []; meteors = []; comets = []; bolts = []; parts = []; pops = [];
      y = H / 2 - BS; vy = 0; score = 0; combo = 0; comboUntil = 0; shield = false; invulnUntil = 0;
      x2Until = 0; blastUntil = 0; slowUntil = 0; nextFire = 0; nextMeteor = 0; nextComet = 0;
      passed = 0; started = false; over = false;
    }

    function mult(now) { return (combo > 0 && now < comboUntil) ? Math.min(8, 1 + Math.floor(combo / 3)) : 1; }
    function pop(t, x, yy, c, now, s) { pops.push({ t: t, x: x, y: yy, c: c, born: now, s: s || 1 }); }
    function burst(x, yy, c, n) {
      for (var i = 0; i < n; i++) {
        var a = rnd(0, 6.283), sp = rnd(1, 5);
        parts.push({ x: x, y: yy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.08, l: 1, d: rnd(0.02, 0.04), c: c, s: rnd(2, 4) });
      }
    }
    function bump(now) {
      var before = mult(now);
      combo++; comboUntil = now + 4000;
      var after = mult(now);
      if (after > before) pop("x" + after + "!", BX + 10, y - 24, "#fff", now, 1.5);
    }
    function add(base, px, py, now, doBump) {
      if (doBump) bump(now);
      var gain = base * mult(now) * (now < x2Until ? 2 : 1);
      score += gain;
      pop("+" + gain, px, py, now < x2Until ? GOLD : "#fff", now, 1);
    }
    function givePU(k, now, px, py) {
      if (k === "shield") shield = true;
      else if (k === "x2") x2Until = now + 8000;
      else if (k === "blast") blastUntil = now + 8000;
      else slowUntil = now + 5000;
      bump(now);
      pop(PUNAME[k], px, py - 22, PU[k].c, now, 1.2);
      burst(px, py, PU[k].c, 16);
    }
    function die(now) {
      over = true; deadAt = now;
      burst(BX + BS / 2, y + BS / 2, "#fff", 26); burst(BX + BS / 2, y + BS / 2, RED, 26);
      if (score > best) { best = score; try { localStorage.setItem("tedxbird-best", String(best)); } catch (e) {} }
    }
    function hurt(now, bounce) {
      if (now < invulnUntil) { if (bounce) { y = H - GROUND - BS - 2; vy = FLAP; } return; }
      if (shield) {
        shield = false; invulnUntil = now + 1200;
        burst(BX + BS / 2, y + BS / 2, PU.shield.c, 22); pop("SHIELD BROKEN", BX + 10, y - 20, PU.shield.c, now, 1.1);
        if (bounce) { y = H - GROUND - BS - 2; vy = FLAP; }
        return;
      }
      die(now);
    }
    function flap() {
      var now = performance.now();
      if (over) { if (now - deadAt > 500) reset(); return; }
      started = true; vy = FLAP;
      burst(BX + 4, y + BS, "#fff", 4);
    }

    function spawnPipe() {
      var gy = rnd(90, H - GROUND - GAP - 90);
      var x = pipes.length ? W + 20 : Math.max(BX + 260, W * 0.6);
      pipes.push({ x: x, gy: gy, passed: false });
      if (Math.random() < 0.7) {
        var cx = x + PW / 2, cy = gy + GAP / 2 + rnd(-35, 35);
        if (Math.random() < 0.2) items.push({ x: cx, y: cy, k: PUKEYS[(Math.random() * PUKEYS.length) | 0], pu: true });
        else items.push({ x: cx, y: cy, k: "star", pu: false });
      }
    }

    /* ---------- update ---------- */
    function fx(dt) {
      for (var i = parts.length - 1; i >= 0; i--) {
        var q = parts[i];
        q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.l -= q.d * dt;
        if (q.l <= 0) parts.splice(i, 1);
      }
    }

    function step(dt, now) {
      if (!over && now < slowUntil) dt *= 0.6;
      var v = over ? 0 : (3 + Math.min(passed, 40) * 0.06) * dt;
      gOff = (gOff + v) % 24;
      for (var si2 = 0; si2 < stars.length; si2++) { var st = stars[si2]; st.x -= v * st.f; if (st.x < 0) st.x = W + rnd(0, 30); }
      for (var pi = pops.length - 1; pi >= 0; pi--) if (now - pops[pi].born > 900) pops.splice(pi, 1);
      fx(dt);
      if (over) return;
      if (!started) { y = H / 2 - BS + Math.sin(now / 300) * 8; return; }
      if (combo && now >= comboUntil) combo = 0;

      vy = Math.min(vy + GRAV * dt, MAXFALL);
      y += vy * dt;
      if (y < 0) { y = 0; vy = 0; }
      if (y + BS > H - GROUND) { hurt(now, true); if (over) return; }
      if (Math.random() < 0.7) parts.push({ x: BX + 4, y: y + BS / 2 + rnd(-3, 3), vx: -v * 0.6, vy: rnd(-0.2, 0.2), g: 0, l: 0.7, d: 0.05, c: "#fff", s: rnd(2, 3.5) });

      var i, b = { x: BX + 4, y: y + 4, w: BS - 8, h: BS - 8 }, bx = BX + BS / 2, by = y + BS / 2;

      /* pillars */
      if (!pipes.length || pipes[pipes.length - 1].x < W - SPACING) spawnPipe();
      for (i = pipes.length - 1; i >= 0; i--) {
        var p = pipes[i];
        p.x -= v;
        if (p.x + PW < -10) { pipes.splice(i, 1); continue; }
        if (!p.passed && p.x + PW < BX) { p.passed = true; passed++; add(10, BX, y - 10, now, false); glyphUntil = now + 350; }
        if (hit(b, p.x, 0, PW, p.gy) || hit(b, p.x, p.gy + GAP, PW, H)) { hurt(now, false); if (over) return; }
      }

      /* stars and power-ups sitting in the gaps */
      for (i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.x -= v;
        if (it.x < -30) { items.splice(i, 1); continue; }
        if (dist(bx, by, it.x, it.y) < BS / 2 + 14) {
          items.splice(i, 1);
          if (it.pu) givePU(it.k, now, it.x, it.y);
          else { add(20, it.x, it.y, now, true); burst(it.x, it.y, GOLD, 10); }
        }
      }

      /* shooting stars: catch them for big points */
      if (now > nextComet) { nextComet = now + rnd(3500, 6500); comets.push({ x: rnd(W * 0.4, W + 80), y: rnd(-40, 120), vx: -rnd(6, 8), vy: rnd(2.2, 3.4) }); }
      for (i = comets.length - 1; i >= 0; i--) {
        var c = comets[i];
        c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.x < -100 || c.y > H - GROUND) { comets.splice(i, 1); continue; }
        if (dist(bx, by, c.x, c.y) < BS / 2 + 14) { comets.splice(i, 1); add(50, c.x, c.y, now, true); burst(c.x, c.y, GOLD, 18); }
      }

      /* meteors: hazards. The blaster shoots them for bonus points */
      if (passed >= 3 && now > nextMeteor) {
        nextMeteor = now + rnd(2600, 4200) / (1 + Math.min(passed, 30) * 0.02);
        meteors.push({ x: rnd(W * 0.45, W + 60), y: -40, vx: -rnd(2.2, 3.6), vy: rnd(3, 4.6), r: rnd(14, 22), rot: 0 });
      }
      for (i = meteors.length - 1; i >= 0; i--) {
        var m = meteors[i];
        m.x += m.vx * dt; m.y += m.vy * dt; m.rot += 0.05 * dt;
        if (m.x < -80) { meteors.splice(i, 1); continue; }
        if (m.y > H - GROUND) { burst(m.x, H - GROUND, "#ff9a3d", 10); meteors.splice(i, 1); continue; }
        if (now >= invulnUntil && dist(bx, by, m.x, m.y) < BS / 2 - 2 + m.r * 0.85) {
          meteors.splice(i, 1); burst(m.x, m.y, "#ff6b3d", 18);
          hurt(now, false); if (over) return;
        }
      }
      if (now < blastUntil && now > nextFire && meteors.length) {
        var tgt = null, td = 1e9, d, k;
        for (k = 0; k < meteors.length; k++) { d = dist(bx, by, meteors[k].x, meteors[k].y); if (meteors[k].x > BX && d < td) { td = d; tgt = meteors[k]; } }
        if (tgt) {
          nextFire = now + 280;
          var a = Math.atan2(tgt.y - by, tgt.x - (BX + BS));
          bolts.push({ x: BX + BS, y: by, vx: Math.cos(a) * 13, vy: Math.sin(a) * 13 });
        }
      }
      for (i = bolts.length - 1; i >= 0; i--) {
        var bt = bolts[i], gone = false;
        bt.x += bt.vx * dt; bt.y += bt.vy * dt;
        for (var j = meteors.length - 1; j >= 0; j--) {
          if (dist(bt.x, bt.y, meteors[j].x, meteors[j].y) < meteors[j].r + 6) {
            add(40, meteors[j].x, meteors[j].y, now, true); burst(meteors[j].x, meteors[j].y, "#ff9a3d", 20);
            meteors.splice(j, 1); gone = true; break;
          }
        }
        if (gone || bt.x > W + 20 || bt.y < -30 || bt.y > H) bolts.splice(i, 1);
      }
    }

    /* ---------- draw ---------- */
    function text(t, x, yy, size, fill, align) {
      g.font = "bold " + size + "px " + FONT; g.textAlign = align || "center"; g.textBaseline = "alphabetic";
      g.lineWidth = size > 20 ? 5 : 3; g.strokeStyle = "#000"; g.fillStyle = fill || "#fff";
      g.strokeText(t, x, yy); g.fillText(t, x, yy);
    }
    function starPath(x, yy, r) {
      g.beginPath();
      for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, yy + Math.sin(a) * rr); }
      g.closePath();
    }

    function draw(now) {
      var i, k;
      g.setTransform(S * D, 0, 0, S * D, 0, 0);

      var gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "#05060d"); gr.addColorStop(0.7, "#1a0d12"); gr.addColorStop(1, "#3a0f0f");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255,255,255,.05)"; g.beginPath(); g.arc(W * 0.82, 110, 70, 0, 6.283); g.fill();
      g.fillStyle = "#fff";
      for (i = 0; i < stars.length; i++) {
        var s = stars[i];
        g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(now / 700 + s.p));
        g.fillRect(s.x, s.y, s.s, s.s);
      }
      g.globalAlpha = 1;

      /* pillars */
      for (i = 0; i < pipes.length; i++) {
        var p = pipes[i];
        g.fillStyle = RED; g.fillRect(p.x, 0, PW, p.gy); g.fillRect(p.x, p.gy + GAP, PW, H);
        g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(p.x + 8, 0, 8, p.gy); g.fillRect(p.x + 8, p.gy + GAP, 8, H);
        g.fillStyle = RED_D; g.fillRect(p.x - 5, p.gy - 26, PW + 10, 26); g.fillRect(p.x - 5, p.gy + GAP, PW + 10, 26);
      }

      /* ground */
      g.fillStyle = "#161616"; g.fillRect(0, H - GROUND, W, GROUND);
      g.fillStyle = RED; g.fillRect(0, H - GROUND, W, 4);
      g.fillStyle = "#2a2a2a";
      for (var gx = -gOff; gx < W; gx += 24) g.fillRect(gx, H - GROUND + 16, 12, 6);

      /* stars + power-ups */
      for (i = 0; i < items.length; i++) {
        var it = items[i], pulse = 1 + 0.1 * Math.sin(now / 180 + it.x);
        if (!it.pu) {
          g.shadowColor = GOLD; g.shadowBlur = 14; g.fillStyle = GOLD; starPath(it.x, it.y, 14 * pulse); g.fill(); g.shadowBlur = 0;
        } else {
          var P = PU[it.k];
          g.shadowColor = P.c; g.shadowBlur = 16; g.fillStyle = P.c; g.beginPath(); g.arc(it.x, it.y, 15 * pulse, 0, 6.283); g.fill(); g.shadowBlur = 0;
          g.fillStyle = "#000"; g.font = "bold 14px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(P.t, it.x, it.y + 1); g.textBaseline = "alphabetic";
        }
      }

      /* shooting stars */
      for (i = 0; i < comets.length; i++) {
        var c = comets[i];
        for (k = 9; k >= 0; k--) {
          g.globalAlpha = (1 - k / 10) * 0.8; g.fillStyle = k ? "#ffe9a8" : "#fff";
          g.beginPath(); g.arc(c.x - c.vx * k * 1.3, c.y - c.vy * k * 1.3, 9 - k * 0.8, 0, 6.283); g.fill();
        }
        g.globalAlpha = 1; g.shadowColor = GOLD; g.shadowBlur = 16; g.fillStyle = GOLD; starPath(c.x, c.y, 12); g.fill(); g.shadowBlur = 0;
      }

      /* meteors */
      for (i = 0; i < meteors.length; i++) {
        var m = meteors[i];
        for (k = 8; k >= 1; k--) {
          g.globalAlpha = (1 - k / 9) * 0.6; g.fillStyle = k % 2 ? "#ff9a3d" : RED;
          g.beginPath(); g.arc(m.x - m.vx * k * 2.2, m.y - m.vy * k * 2.2, m.r * (1 - k / 12), 0, 6.283); g.fill();
        }
        g.globalAlpha = 1; g.fillStyle = "#6b3a26"; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 6.283); g.fill();
        g.fillStyle = "#4a2618"; g.beginPath(); g.arc(m.x + Math.cos(m.rot) * m.r * 0.4, m.y + Math.sin(m.rot) * m.r * 0.4, m.r * 0.25, 0, 6.283); g.fill();
      }

      /* blaster bolts */
      g.strokeStyle = "#ffe08a"; g.lineWidth = 3;
      for (i = 0; i < bolts.length; i++) { g.beginPath(); g.moveTo(bolts[i].x, bolts[i].y); g.lineTo(bolts[i].x - bolts[i].vx * 0.9, bolts[i].y - bolts[i].vy * 0.9); g.stroke(); }

      /* particles */
      for (i = 0; i < parts.length; i++) { var q = parts[i]; g.globalAlpha = Math.max(0, q.l); g.fillStyle = q.c; g.fillRect(q.x, q.y, q.s, q.s); }
      g.globalAlpha = 1;

      /* player: a "?" that flashes "!" when you pass a pillar */
      g.save();
      g.translate(BX + BS / 2, y + BS / 2);
      g.rotate(Math.max(-25, Math.min(70, vy * 5)) * Math.PI / 180);
      if (now < invulnUntil && ((now / 80) | 0) % 2) g.globalAlpha = 0.4;
      if (now < x2Until) { g.shadowColor = GOLD; g.shadowBlur = 18; }
      g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, BS / 2, 0, 6.283); g.fill(); g.shadowBlur = 0;
      g.fillStyle = RED; g.font = "bold 22px " + FONT; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(now < glyphUntil ? "!" : "?", 0, 1);
      if (now < blastUntil) { g.fillStyle = PU.blast.c; g.fillRect(BS / 2 - 2, -3, 12, 6); }
      if (shield) {
        g.strokeStyle = PU.shield.c; g.lineWidth = 3; g.shadowColor = PU.shield.c; g.shadowBlur = 12;
        g.beginPath(); g.arc(0, 0, BS / 2 + 8, 0, 6.283); g.stroke(); g.shadowBlur = 0;
      }
      g.restore(); g.textBaseline = "alphabetic";

      /* floating points */
      for (i = 0; i < pops.length; i++) {
        var o = pops[i], age = (now - o.born) / 900;
        g.globalAlpha = Math.max(0, 1 - age * age);
        text(o.t, o.x, o.y - age * 55, 22 * o.s, o.c);
      }
      g.globalAlpha = 1;

      /* HUD */
      text(String(score), W / 2, 62, 48);
      text("BEST " + best, 24, 30, 14, "#bdbdbd", "left");
      var mm = mult(now);
      if (combo > 0 && now < comboUntil) {
        text("x" + mm, 24, 78, 40, GOLD, "left");
        text("COMBO " + combo, 24, 98, 13, "#fff", "left");
        g.fillStyle = "#222"; g.fillRect(24, 106, 110, 6);
        g.fillStyle = GOLD; g.fillRect(24, 106, 110 * Math.max(0, (comboUntil - now) / 4000), 6);
      }
      var act = [];
      if (shield) act.push(["SHIELD", PU.shield.c, 1]);
      if (now < x2Until) act.push(["DOUBLE POINTS", GOLD, (x2Until - now) / 8000]);
      if (now < blastUntil) act.push(["BLASTER", PU.blast.c, (blastUntil - now) / 8000]);
      if (now < slowUntil) act.push(["SLOW-MO", PU.slow.c, (slowUntil - now) / 5000]);
      for (i = 0; i < act.length; i++) {
        var y0 = 30 + i * 30;
        text(act[i][0], W - 24, y0, 13, act[i][1], "right");
        g.fillStyle = "#222"; g.fillRect(W - 144, y0 + 5, 120, 5);
        g.fillStyle = act[i][1]; g.fillRect(W - 144, y0 + 5, 120 * Math.max(0, act[i][2]), 5);
      }

      if (!started && !over) {
        text("Click, tap or press Space to flap", W / 2, H / 2 + 70, 24);
        text("Grab \u2605 and chain them for x2, x3, x4\u2026", W / 2, H / 2 + 105, 16, GOLD);
        text("Power-ups: Shield \u00b7 x2 \u00b7 Blaster \u00b7 Slow-mo. The Blaster shoots meteors for bonus points.", W / 2, H / 2 + 130, 14, "#bdbdbd");
      }
      if (over) {
        g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, 0, W, H);
        text("GAME OVER", W / 2, H / 2 - 50, 52, RED);
        text("Score " + score + "   \u00b7   Best " + best, W / 2, H / 2 + 5, 26);
        text("Stop fearing the question mark.", W / 2, H / 2 + 45, 18, "#ddd");
        text("Click to play again", W / 2, H / 2 + 85, 20);
      }
    }

    /* ---------- input + loop ---------- */
    function onKey(e) {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); if (!e.repeat) flap(); }
    }
    box.addEventListener("pointerdown", function (e) { e.preventDefault(); flap(); });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", fit);

    function loop(now) {
      if (!box.isConnected) { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", fit); return; }
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
