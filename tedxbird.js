/* TEDxBird: the game shown while the website is in maintenance mode.
   index.html loads this file only when maintenance is ON.
   Controls: tap / click / Space / Up arrow. */
(function () {
  "use strict";

  // ---- tweak these ----
  var GAP = 165;        // gap between pillars (bigger = easier)
  var SPEED = 3;        // how fast pillars move
  var GRAV = 0.5;       // gravity
  var FLAP = -8;        // flap power
  var SPACING = 220;    // distance between pillars
  // ---------------------
  var W = 400, H = 600, GROUND = 60, BX = 100, BS = 30, PW = 60, MAXFALL = 11;
  var RED = "#e62b1e", RED_D = "#c4200f", FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  function addCss() {
    if (document.getElementById("tb-css")) return;
    var s = document.createElement("style");
    s.id = "tb-css";
    s.textContent =
      '#birdbox{position:fixed;inset:0;z-index:60;background:#0a0a0a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:12px;touch-action:none;user-select:none;-webkit-user-select:none;font-family:' + FONT + '}' +
      '#birdbox .tb-top{text-align:center}' +
      '#birdbox .tb-logo{font-weight:800;font-size:22px;letter-spacing:-.02em}' +
      '#birdbox .tb-logo b{color:' + RED + '}' +
      '#birdbox .tb-top p{margin:6px 0 0;color:#bdbdbd;font-size:14px}' +
      '#birdbox .tb-cv{display:block;width:min(calc(100vw - 24px),calc((100vh - 120px)*.6667),400px);width:min(calc(100vw - 24px),calc((100dvh - 120px)*.6667),400px);height:auto;aspect-ratio:2/3;border:1px solid #222;border-radius:6px;cursor:pointer}';
    document.head.appendChild(s);
  }

  function mount(box) {
    addCss();
    box.innerHTML =
      '<div class="tb-top"><div class="tb-logo">TED<b>x</b>MSAUniversity</div>' +
      '<p>The website is getting an update. Play <b>TEDxBird</b> while you wait.</p></div>' +
      '<canvas class="tb-cv"></canvas>';

    var cv = box.querySelector("canvas"), D = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * D; cv.height = H * D;
    var g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(D, 0, 0, D, 0, 0);

    var best = 0;
    try { best = +localStorage.getItem("tedxbird-best") || 0; } catch (e) {}

    var pipes, y, vy, score, started, over, deadAt = 0, gOff = 0, popUntil = 0, last = performance.now();

    function reset() { pipes = []; y = H / 2 - BS; vy = 0; score = 0; started = false; over = false; }

    function flap() {
      var now = performance.now();
      if (over) { if (now - deadAt > 400) reset(); return; }   // short delay so a panic-tap doesn't restart
      started = true; vy = FLAP;
    }

    function die(now) {
      over = true; deadAt = now;
      if (score > best) {
        best = score;
        try { localStorage.setItem("tedxbird-best", String(best)); } catch (e) {}
      }
    }

    function hit(b, x, yy, w, h) { return b.x < x + w && b.x + b.w > x && b.y < yy + h && b.y + b.h > yy; }

    function step(dt, now) {
      if (over) return;
      gOff = (gOff + SPEED * dt) % 24;
      if (!started) return;

      vy = Math.min(vy + GRAV * dt, MAXFALL);
      y += vy * dt;

      if (!pipes.length || pipes[pipes.length - 1].x < W - SPACING)
        pipes.push({ x: W, gy: 80 + Math.random() * (H - GROUND - GAP - 160), passed: false });

      var b = { x: BX + 4, y: y + 4, w: BS - 8, h: BS - 8 };
      for (var i = pipes.length - 1; i >= 0; i--) {
        var p = pipes[i];
        p.x -= SPEED * dt;
        if (p.x + PW < 0) { pipes.splice(i, 1); continue; }
        if (!p.passed && p.x + PW < BX) { p.passed = true; score++; popUntil = now + 350; }
        if (hit(b, p.x, 0, PW, p.gy) || hit(b, p.x, p.gy + GAP, PW, H)) die(now);
      }
      if (y < 0 || y + BS > H - GROUND) die(now);
    }

    function text(t, x, yy, size, fill) {
      g.font = "bold " + size + "px " + FONT;
      g.lineWidth = 5; g.strokeStyle = "#000"; g.fillStyle = fill || "#fff";
      g.strokeText(t, x, yy); g.fillText(t, x, yy);
    }

    function draw(now) {
      g.fillStyle = "#0a0a0a"; g.fillRect(0, 0, W, H);

      // pillars
      for (var i = 0; i < pipes.length; i++) {
        var p = pipes[i];
        g.fillStyle = RED;
        g.fillRect(p.x, 0, PW, p.gy);
        g.fillRect(p.x, p.gy + GAP, PW, H);
        g.fillStyle = RED_D;
        g.fillRect(p.x - 4, p.gy - 24, PW + 8, 24);
        g.fillRect(p.x - 4, p.gy + GAP, PW + 8, 24);
      }

      // ground
      g.fillStyle = "#161616"; g.fillRect(0, H - GROUND, W, GROUND);
      g.fillStyle = RED; g.fillRect(0, H - GROUND, W, 4);
      g.fillStyle = "#2a2a2a";
      for (var x = -gOff; x < W; x += 24) g.fillRect(x, H - GROUND + 16, 12, 6);

      // player: a "?" that flashes "!" when you pass a pillar
      g.save();
      g.translate(BX + BS / 2, y + BS / 2);
      g.rotate(Math.max(-25, Math.min(70, vy * 5)) * Math.PI / 180);
      g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, BS / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = RED; g.font = "bold 22px " + FONT; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(now < popUntil ? "!" : "?", 0, 1);
      g.restore();

      g.textAlign = "center"; g.textBaseline = "alphabetic";
      text(String(score), W / 2, 70, 44);
      if (!started && !over) text("Tap or press Space", W / 2, H / 2 + 60, 22);
      if (over) {
        g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 0, W, H);
        text("GAME OVER", W / 2, H / 2 - 50, 40, RED);
        text("Score " + score + "  ·  Best " + best, W / 2, H / 2 - 5, 22);
        text("Stop fearing the question mark.", W / 2, H / 2 + 35, 16);
        text("Tap to play again", W / 2, H / 2 + 70, 18);
      }
    }

    function onKey(e) {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); if (!e.repeat) flap(); }
    }
    box.addEventListener("pointerdown", function (e) { e.preventDefault(); flap(); });
    window.addEventListener("keydown", onKey);

    function loop(now) {
      if (!box.isConnected) { window.removeEventListener("keydown", onKey); return; }   // board logged in, game removed
      var dt = Math.min((now - last) / 16.667, 3);   // same speed on any monitor
      last = now;
      step(dt, now); draw(now);
      requestAnimationFrame(loop);
    }

    reset();
    requestAnimationFrame(loop);
  }

  window.TedxBird = { mount: mount };
})();
