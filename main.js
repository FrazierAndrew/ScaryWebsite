/* ============================================================
   Nestwell — main.js
   Everything runs locally in the browser. The "profile" section
   reads harmless browser info (time, screen size, etc.) and never
   sends anything anywhere.
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  /* ---------------- color ramps (depth 0 → 1) ---------------- */
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const ramp = (stops, t) => {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
        const k = (t - t0) / (t1 - t0 || 1), a = hex(c0), b = hex(c1);
        return `rgb(${a.map((v, j) => Math.round(lerp(v, b[j], k))).join(',')})`;
      }
    }
    return `rgb(${hex(stops[stops.length - 1][1]).join(',')})`;
  };
  const BG = [[0, '#faf8f4'], [.2, '#f5f2ec'], [.34, '#e7e2d8'], [.46, '#bdb5a8'], [.54, '#4b433c'], [.62, '#1e1916'], [.78, '#0d0807'], [1, '#030000']];
  const FG = [[0, '#15171c'], [.46, '#26221e'], [.5, '#ece4d9'], [.8, '#c9bfb3'], [1, '#a89a8c']];
  const AC = [[0, '#3557f0'], [.22, '#4560c8'], [.38, '#6a5a86'], [.52, '#9c2b2b'], [.75, '#c8141c'], [1, '#e81010']];

  /* ---------------- copy that changes with stage ---------------- */
  const BRAND = ['Nestwell', 'Nestwell', 'Nestwell', 'Nest well', 'Nest. Well.', "WE'RE HOME"];
  const CTA = ['Get started', 'Get started', 'Get started', 'Get started', 'Get inside', 'Get out'];
  const TITLE = ['Nestwell — The home that knows you', 'Nestwell — The home that knows you', 'Nestwell — The home that knows you',
    'Nestwell — The home that knows', 'Nestwell — The home that knows you\'re here', 'YOU\'RE HOME'];
  const HIDDEN_TITLE = ['Come back soon 👋', 'Come back soon 👋', 'Come back.', 'Come back.', 'I can see you leaving.', 'TURN AROUND'];
  const SOUND_LABEL = ['Play calming ambience', 'Play calming ambience', 'Ambience', 'Ambience', 'Listening', 'It hears you'];
  const CREEP_WORDS = ['help', 'behind you', 'it sees', 'run', 'don\'t', 'wake up', 'it\'s here', 'closer', 'mine'];

  /* ---------------- state ---------------- */
  let sections = [];
  let depth = 0, maxDepth = 0, effDepth = 0, stage = 0;
  let lastY = scrollY, lastDir = 0, scrollUps = 0;
  let dirty = true;
  let camT = 0, camBump = 0, camVisible = false;
  let finT = 0, finVisible = false;
  let scared = false, toastShown = false;
  let foreverHovers = 0;
  const t0 = Date.now();
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, moved: false };
  const ghostPos = { x: mouse.x, y: mouse.y };
  const els = {
    brand: $('#brand-text'), cta: $('#nav-cta'), noise: $('#noise'), desat: $('#desat'),
    ghost: $('#ghost'), toast: $('#toast'), sound: $('#sound'), soundLabel: $('#sound-label'),
    cam: $('#cam'), camTime: $('#cam-time'), camCaption: $('#cam-caption'), nosignal: $('#nosignal'),
    finale: $('#finale'), camSection: $('#cam-section'), eyes: $('#eyes'), scare: $('#scare'),
    favicon: $('#favicon'),
  };

  /* ---------------- returning visitors ---------------- */
  function applyReturning() {
    body.classList.add('returning');
    $('#hero-pill').textContent = 'Resident #40,219';
    $('#hero-title').innerHTML = 'Welcome back.<br>We kept the lights on.';
    $('#hero-lead').textContent = 'We knew you\'d come back. Everyone does. Your room is exactly how you left it, and so is everything standing in it.';
    $('#chip-a').textContent = 'Good evening · All 4 residents are home';
    const rc = $('#resident-count');
    rc.dataset.to = '40219';
    if (rc.dataset.done) rc.textContent = '40,219';
  }
  if (store.get('nw-seen')) applyReturning();

  /* ---------------- measure sections ---------------- */
  function measure() {
    sections = $$('[data-depth]').map(el => {
      const r = el.getBoundingClientRect();
      const a = r.top + scrollY;
      return { el, a, b: a + r.height, d: parseFloat(el.dataset.depth) };
    });
    dirty = true;
  }

  function depthAt(y) {
    let d = 0;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const next = i + 1 < sections.length ? sections[i + 1].d : 1;
      if (y >= s.a && y < s.b) return lerp(s.d, next, (y - s.a) / (s.b - s.a));
      if (y >= s.b) d = next;
    }
    return d;
  }

  /* ---------------- scroll-driven update ---------------- */
  function onScroll() {
    const y = scrollY;
    // direction tracking (for the profile + the "no going back" toast)
    if (Math.abs(y - lastY) > 4) {
      const dir = y > lastY ? 1 : -1;
      if (dir === -1 && lastDir === 1) scrollUps++;
      lastDir = dir;
      lastY = y;
    }

    depth = depthAt(y + innerHeight * 0.6);
    maxDepth = Math.max(maxDepth, depth);
    // Once you've gone deep, the top of the page never fully recovers.
    effDepth = Math.max(depth, maxDepth * 0.3);

    root.style.setProperty('--d', effDepth.toFixed(4));
    root.style.setProperty('--bg', ramp(BG, effDepth));
    root.style.setProperty('--fg', ramp(FG, effDepth));
    root.style.setProperty('--accent', ramp(AC, effDepth));

    // Desaturate the middle of the page, then let the red bleed back through.
    els.desat.style.opacity = (smooth(.18, .55, effDepth) * .85 - smooth(.62, .82, effDepth) * .6).toFixed(3);

    const s = effDepth < .2 ? 0 : effDepth < .36 ? 1 : effDepth < .5 ? 2 : effDepth < .63 ? 3 : effDepth < .8 ? 4 : 5;
    if (s !== stage) setStage(s);

    if (!toastShown && maxDepth > .7 && depth < maxDepth - .08 && lastDir === -1) {
      toastShown = true;
      toast('There\'s no going back.');
    }

    // local progress through the tall camera + finale sections
    const vh = innerHeight;
    const cr = els.camSection.getBoundingClientRect();
    camT = clamp(-cr.top / (cr.height - vh));
    const fr = els.finale.getBoundingClientRect();
    finT = clamp(-fr.top / (fr.height - vh));
    updateFinale();
  }

  function setStage(s) {
    stage = s;
    body.dataset.stage = s;
    els.brand.textContent = BRAND[s];
    els.cta.textContent = CTA[s];
    els.cta.setAttribute('href', s >= 5 ? '#top' : '#pricing');
    if (!document.hidden) document.title = TITLE[s];
    els.soundLabel.textContent = SOUND_LABEL[s];
    body.classList.toggle('ghost-on', s >= 4 && finePointer && !reduceMotion);
    const fav = s >= 4
      ? "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='16' fill='#000'/><ellipse cx='16' cy='16' rx='13' ry='7' fill='#d9cdb0'/><circle cx='16' cy='16' r='5' fill='#c0140f'/><circle cx='16' cy='16' r='2.4' fill='#000'/></svg>"
      : "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='9' fill='#3557f0'/><circle cx='16' cy='16' r='5' fill='#fff'/></svg>";
    els.favicon.href = 'data:image/svg+xml,' + encodeURIComponent(fav);
  }

  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ---------------- tab title when you look away ---------------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.title = HIDDEN_TITLE[stage];
    } else {
      document.title = TITLE[stage];
      // It moves when you aren't watching.
      if (camT > 0.02 && camT < 0.9) camBump = Math.min(.3, camBump + .1);
    }
  });
  document.addEventListener('mouseleave', () => {
    if (camVisible && camT > 0.02 && camT < 0.9) camBump = Math.min(.3, camBump + .05);
  });

  /* ---------------- mouse / ghost cursor ---------------- */
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; }, { passive: true });
  function ghostFrame() {
    if (!body.classList.contains('ghost-on')) return;
    ghostPos.x = lerp(ghostPos.x, mouse.x - 30, 0.035);
    ghostPos.y = lerp(ghostPos.y, mouse.y + 24, 0.035);
    els.ghost.style.transform = `translate(${ghostPos.x}px, ${ghostPos.y}px)`;
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg, ms = 2800) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
  }

  /* ---------------- film grain ---------------- */
  const nctx = els.noise.getContext('2d');
  let nImg;
  function sizeNoise() {
    els.noise.width = Math.ceil(innerWidth / 2);
    els.noise.height = Math.ceil(innerHeight / 2);
    nImg = nctx.createImageData(els.noise.width, els.noise.height);
  }
  sizeNoise();
  addEventListener('resize', sizeNoise);
  let lastNoise = 0;
  function noiseFrame(now) {
    const op = smooth(.32, 1, effDepth) * .14;
    els.noise.style.opacity = op.toFixed(3);
    if (op < .005 || now - lastNoise < 55) return;
    lastNoise = now;
    const d = nImg.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255 | 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    nctx.putImageData(nImg, 0, 0);
  }

  /* ---------------- random flicker + word glitches ---------------- */
  function flickerLoop() {
    if (!reduceMotion && stage >= 4 && Math.random() < (stage === 5 ? .35 : .18)) {
      body.classList.add('flicker');
      setTimeout(() => body.classList.remove('flicker'), rand(60, 160));
    }
    setTimeout(flickerLoop, rand(900, 2600));
  }
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function glitchLoop() {
    if (!reduceMotion && stage >= 1 && Math.random() < .25 + stage * .12) {
      const vis = $$('.g').filter(el => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && !el.dataset.busy;
      });
      if (vis.length) {
        const el = vis[Math.random() * vis.length | 0];
        const orig = el.textContent;
        const words = orig.split(' ');
        const i = Math.random() * words.length | 0;
        const w = CREEP_WORDS[Math.random() * CREEP_WORDS.length | 0];
        el.dataset.busy = '1';
        el.innerHTML = words.map((x, j) => j === i ? `<span class="creep">${esc(w)}</span>` : esc(x)).join(' ');
        setTimeout(() => { el.textContent = orig; delete el.dataset.busy; }, rand(140, 320));
      }
    }
    setTimeout(glitchLoop, rand(1200, 2600) - stage * 150);
  }

  /* ---------------- stats counter ---------------- */
  function countUp(el) {
    const to = parseInt(el.dataset.to, 10);
    const start = performance.now(), dur = reduceMotion ? 1 : 1800;
    const step = now => {
      const k = clamp((now - start) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US');
      if (k < 1) requestAnimationFrame(step); else el.dataset.done = '1';
    };
    requestAnimationFrame(step);
  }

  /* ---------------- pricing hover tracking ---------------- */
  $('#forever').addEventListener('pointerenter', () => { foreverHovers++; });

  /* ---------------- FAQ: the last question answers itself ---------------- */
  const faqLast = $('#faq-last');
  faqLast.querySelector('summary').addEventListener('click', e => {
    if (faqLast.open) { e.preventDefault(); toast('You can\'t close that one.'); }
  });

  /* ---------------- profile terminal ---------------- */
  function osName() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Win/.test(ua)) return 'Windows';
    if (/CrOS/.test(ua)) return 'ChromeOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'an unfamiliar device';
  }
  function browserName() {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'a browser';
  }
  function hourLine() {
    const h = new Date().getHours();
    if (h >= 22 || h < 5) return 'It\'s late. Everyone else in your house is asleep. Aren\'t they?';
    if (h < 12) return 'Good morning. You were up early. We noticed.';
    if (h < 18) return 'Broad daylight. You feel safe right now. That\'s fine.';
    return 'It\'s getting dark outside. You should close the curtains.';
  }
  function fmtDur(ms) {
    const s = Math.round(ms / 1000), m = Math.floor(s / 60);
    return m ? `${m}m ${s % 60}s` : `${s}s`;
  }
  async function runTerminal() {
    const term = $('#terminal');
    let battery = null;
    try { if (navigator.getBattery) battery = await navigator.getBattery(); } catch (e) { /* ignore */ }
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'your time zone'; } })();
    const lines = [
      { t: () => 'Initializing resident profile…', pause: 600 },
      { t: () => `Local time: ${new Date().toLocaleTimeString()} (${tz})` },
      { t: () => `Device: ${osName()} · ${browserName()} · ${screen.width}×${screen.height}${navigator.hardwareConcurrency ? ' · ' + navigator.hardwareConcurrency + ' cores' : ''}` },
      { t: () => `Language: ${navigator.language || 'unknown'}` },
      { t: () => `Time spent on this page: ${fmtDur(Date.now() - t0)}` },
      { t: () => `Times you scrolled back up: ${scrollUps}${scrollUps ? '. Looking for a way out?' : '. Good. Keep going.'}` },
      { t: () => `Times you looked at the Forever plan: ${foreverHovers}${foreverHovers ? '. We saw.' : ''}` },
      ...(battery ? [{ t: () => `Battery: ${Math.round(battery.level * 100)}%${battery.charging ? ' (plugged in — you aren\'t going anywhere)' : ' and falling'}` }] : []),
      { t: () => hourLine(), cls: 'warn', pause: 700 },
      { t: () => (audio.on ? 'Ambient audio: on. You turned it on yourself.' : 'Microphone permission: not required.'), cls: 'warn', pause: 700 },
      { t: () => 'Profile complete. Welcome home, resident #40,219.', cls: 'final' },
    ];
    for (const ln of lines) {
      const row = document.createElement('div');
      row.className = 'ln' + (ln.cls ? ' ' + ln.cls : '');
      term.appendChild(row);
      const text = '> ' + ln.t();
      if (reduceMotion) { row.textContent = text; continue; }
      for (let i = 1; i <= text.length; i++) {
        row.textContent = text.slice(0, i);
        if (i % 2 === 0) audio.tickType();
        await wait(rand(12, 34));
      }
      await wait(ln.pause || 260);
    }
    const c = document.createElement('span');
    c.className = 'cursor'; c.innerHTML = '&nbsp;';
    term.lastChild.appendChild(document.createTextNode(' '));
    term.lastChild.appendChild(c);
  }

  /* ---------------- intersection observers ---------------- */
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      if (el.classList.contains('count')) countUp(el);
      else if (el.id === 'terminal') runTerminal();
      else if (el.id === 'faq-last') setTimeout(() => { el.open = true; }, 1400);
      else el.classList.add('in');
      io.unobserve(el);
    }
  }, { threshold: 0.5 });
  $$('.count, .steps li').forEach(el => io.observe(el));
  io.observe($('#terminal'));
  io.observe(faqLast);

  const visIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.target === els.camSection) camVisible = e.isIntersecting;
    if (e.target === els.finale) finVisible = e.isIntersecting;
  }));
  visIO.observe(els.camSection);
  visIO.observe(els.finale);

  /* ---------------- CCTV hallway ---------------- */
  const cctx = els.cam.getContext('2d');
  const CW = els.cam.width, CH = els.cam.height;
  const CAPTIONS = [
    [0, 'This is a live feed from your hallway.'],
    [.22, 'Is your front door locked? Don\'t get up to check.'],
    [.44, 'It only moves when you look away.'],
    [.64, 'Stop scrolling. Stop scrolling. Stop scrolling.'],
    [.86, 'It isn\'t in the hallway anymore.'],
  ];
  let lastCaption = '';
  const pad2 = n => String(n).padStart(2, '0');

  function drawCam(now) {
    const t = clamp(camT + camBump * smooth(0, .1, camT));
    const c = cctx;
    const vx = CW / 2, vy = 84, bw = 46, bh = 62;
    const bx0 = vx - bw / 2, bx1 = vx + bw / 2, by0 = vy - bh / 2, by1 = vy + bh / 2;

    // corridor
    c.fillStyle = '#0a0d0b'; c.fillRect(0, 0, CW, CH);
    c.fillStyle = '#121814';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(bx0, by0); c.lineTo(bx0, by1); c.lineTo(0, CH); c.fill();
    c.beginPath(); c.moveTo(CW, 0); c.lineTo(bx1, by0); c.lineTo(bx1, by1); c.lineTo(CW, CH); c.fill();
    c.fillStyle = '#181f1a';
    c.beginPath(); c.moveTo(0, CH); c.lineTo(bx0, by1); c.lineTo(bx1, by1); c.lineTo(CW, CH); c.fill();
    c.fillStyle = '#070908';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(bx0, by0); c.lineTo(bx1, by0); c.lineTo(CW, 0); c.fill();
    c.fillStyle = '#1d251f'; c.fillRect(bx0, by0, bw, bh);
    // floorboard lines
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
    for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(vx + i * 6, by1); c.lineTo(vx + i * 60, CH); c.stroke(); }
    // door frames along the walls
    c.strokeStyle = 'rgba(160,190,165,.12)';
    for (const z of [.25, .5, .72]) {
      const xl = lerp(0, bx0, z), xr = lerp(CW, bx1, z);
      const top = lerp(10, by0 + 4, z), bot = lerp(CH, by1, z);
      const w = lerp(26, 4, z);
      c.strokeRect(xl + 2, top, w, bot - top);
      c.strokeRect(xr - w - 2, top, w, bot - top);
    }
    // ceiling light (flickers more as it gets closer)
    const flick = Math.random() < .02 + t * .12 ? .25 : 1;
    const g = c.createRadialGradient(vx, 40, 2, vx, 40, 120);
    g.addColorStop(0, `rgba(210,235,215,${.32 * flick})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, CW, CH);

    // the figure
    const e = Math.pow(t, 2.2);
    const h = lerp(bh * .78, CH * 1.8, e);
    const feet = lerp(by1, CH + h * .6, e);   // keeps the head in frame as it fills the screen
    const sway = Math.sin(now / 900) * lerp(.6, 3, t);
    const fx = vx + sway + lerp(8, 0, smooth(0, .3, t));
    const top = feet - h;
    const sw = h * .19; // shoulder half-width
    c.save();
    c.translate(fx, top);
    c.rotate(smooth(.5, .85, t) * -.12);
    c.fillStyle = '#010201';
    // head
    c.beginPath(); c.ellipse(0, h * .075, h * .055, h * .075, 0, 0, Math.PI * 2); c.fill();
    // body + long arms
    c.beginPath();
    c.moveTo(-h * .03, h * .14);
    c.quadraticCurveTo(-sw, h * .15, -sw * 1.05, h * .26);
    c.lineTo(-sw * 1.25, h * .74);   // left hand, far too low
    c.lineTo(-sw * .95, h * .75);
    c.lineTo(-sw * .78, h * .36);
    c.lineTo(-sw * .55, h);          // legs
    c.lineTo(sw * .55, h);
    c.lineTo(sw * .78, h * .36);
    c.lineTo(sw * .95, h * .75);
    c.lineTo(sw * 1.25, h * .74);
    c.lineTo(sw * 1.05, h * .26);
    c.quadraticCurveTo(sw, h * .15, h * .03, h * .14);
    c.closePath(); c.fill();
    // eyes
    const eyeA = smooth(.1, .6, t) * (Math.random() < .03 ? 0 : 1);
    if (eyeA > 0) {
      c.fillStyle = `rgba(235,255,240,${eyeA})`;
      const er = Math.max(.6, h * .008);
      c.beginPath(); c.arc(-h * .02, h * .07, er, 0, Math.PI * 2); c.arc(h * .02, h * .07, er, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    // tracking glitch: shift a few horizontal slices
    const glitchChance = .04 + t * .35;
    if (Math.random() < glitchChance) {
      for (let i = 0; i < 1 + (t * 4 | 0); i++) {
        const sy = Math.random() * CH | 0, sh = 2 + Math.random() * 14 | 0;
        c.drawImage(els.cam, 0, sy, CW, sh, rand(-12, 12) * (1 + t * 2), sy, CW, sh);
      }
    }
    // grain
    for (let i = 0; i < 420 + t * 900; i++) {
      c.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.25)';
      c.fillRect(Math.random() * CW, Math.random() * CH, 1, 1);
    }
    // rolling bar
    const by = (now / 18) % (CH + 40) - 20;
    c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(0, by, CW, 14);

    // signal loss at the end
    const lost = t > .86;
    if (lost) {
      const img = c.getImageData(0, 0, CW, CH), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 200 | 0; d[i] = d[i + 1] = d[i + 2] = v; }
      c.putImageData(img, 0, 0);
    }
    els.nosignal.classList.toggle('on', lost);

    // HUD
    const n = new Date();
    els.camTime.textContent = `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())} ${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
    let cap = CAPTIONS[0][1];
    for (const [at, txt] of CAPTIONS) if (t >= at) cap = txt;
    if (cap !== lastCaption) { lastCaption = cap; els.camCaption.textContent = cap; }
  }

  /* ---------------- finale ---------------- */
  const fLines = $$('.fl[data-at]');
  const eyeGroups = $$('#eyes .eye');
  const irises = $$('#eyes .iris');
  const IRIS_HOME = [[150, 110], [450, 110]];
  function updateFinale() {
    for (const el of fLines) el.classList.toggle('on', finT >= parseFloat(el.dataset.at));
    const eo = smooth(.48, .66, finT);
    els.eyes.style.opacity = eo.toFixed(3);
    els.eyes.style.setProperty('--eye-scale', lerp(.55, 1.15, smooth(.48, .95, finT)).toFixed(3));
    if (finT > .975 && !scared) triggerScare();
  }
  function eyesFrame(now) {
    if (!finVisible) return;
    const r = els.eyes.getBoundingClientRect();
    let dx, dy;
    if (mouse.moved) {
      dx = (mouse.x - (r.left + r.width / 2)) / (r.width / 2);
      dy = (mouse.y - (r.top + r.height / 2)) / (r.height / 2);
    } else {           // touch devices: drift, then lock onto the viewer
      dx = Math.sin(now / 1700) * .5; dy = Math.cos(now / 2300) * .3;
    }
    dx = clamp(dx, -1, 1); dy = clamp(dy, -1, 1);
    irises.forEach((c, i) => {
      c.setAttribute('cx', (IRIS_HOME[i][0] + dx * 44).toFixed(1));
      c.setAttribute('cy', (IRIS_HOME[i][1] + dy * 18).toFixed(1));
    });
  }
  function blinkLoop() {
    if (finVisible && !reduceMotion) {
      eyeGroups.forEach(g => g.classList.add('shut'));
      setTimeout(() => eyeGroups.forEach(g => g.classList.remove('shut')), 130);
    }
    setTimeout(blinkLoop, rand(1800, 5200));
  }

  /* ---------------- jump scare ---------------- */
  (function buildTeeth() {
    const g = $('#teeth');
    const q = (p0, p1, p2, u) => [
      (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0],
      (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1],
    ];
    const L = [88, 335], R = [312, 335], UP = [200, 420], LO = [200, 520];
    let pts = '';
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = q(L, UP, R, i / N), b = q(L, UP, R, (i + 1) / N);
      const m = q(L, UP, R, (i + .5) / N);
      pts += `<polygon points="${a[0]},${a[1]} ${b[0]},${b[1]} ${m[0]},${m[1] + 18 + (i % 3) * 7}"/>`;
      const c2 = q(L, LO, R, i / N), d2 = q(L, LO, R, (i + 1) / N), m2 = q(L, LO, R, (i + .5) / N);
      if (i > 1 && i < N - 2) pts += `<polygon points="${c2[0]},${c2[1]} ${d2[0]},${d2[1]} ${m2[0]},${m2[1] - 16 - (i % 2) * 8}"/>`;
    }
    g.innerHTML = pts;
  })();

  function triggerScare() {
    scared = true;
    store.set('nw-seen', '1');
    els.scare.classList.add('show');
    audio.scare();
    setTimeout(() => {
      els.scare.classList.remove('show');
      body.classList.add('after');
      applyReturning();
    }, reduceMotion ? 1600 : 720);
  }

  $('#leave').addEventListener('click', () => {
    toast('See you soon.', 2200);
    scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------------- audio (Web Audio, opt-in) ---------------- */
  const audio = {
    ctx: null, on: false, nextBeat: 0, lastType: 0,
    init() {
      const ACtx = window.AudioContext || window.webkitAudioContext;
      if (!ACtx) return false;
      const c = this.ctx = new ACtx();
      this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);

      // gentle major pad that sours as you descend
      this.padGain = c.createGain(); this.padGain.gain.value = 0;
      this.padLP = c.createBiquadFilter(); this.padLP.type = 'lowpass'; this.padLP.frequency.value = 1400;
      this.padGain.connect(this.padLP); this.padLP.connect(this.master);
      this.pad = [261.63, 329.63, 392.0, 523.25].map(f => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = c.createGain(); g.gain.value = .22; o.connect(g); g.connect(this.padGain); o.start(); return o;
      });

      // low drone
      this.droneGain = c.createGain(); this.droneGain.gain.value = 0;
      this.droneLP = c.createBiquadFilter(); this.droneLP.type = 'lowpass'; this.droneLP.frequency.value = 160; this.droneLP.Q.value = 8;
      this.droneGain.connect(this.droneLP); this.droneLP.connect(this.master);
      [41.2, 41.7, 61.7].forEach((f, i) => {
        const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f;
        o.connect(this.droneGain); o.start();
      });
      const lfo = c.createOscillator(); lfo.frequency.value = .07;
      const lg = c.createGain(); lg.gain.value = 70; lfo.connect(lg); lg.connect(this.droneLP.frequency); lfo.start();

      // breathy noise
      const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const n = c.createBufferSource(); n.buffer = buf; n.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = .8;
      const nl = c.createOscillator(); nl.frequency.value = .18;
      const nlg = c.createGain(); nlg.gain.value = 300; nl.connect(nlg); nlg.connect(bp.frequency); nl.start();
      this.noiseGain = c.createGain(); this.noiseGain.gain.value = 0;
      n.connect(bp); bp.connect(this.noiseGain); this.noiseGain.connect(this.master); n.start();
      return true;
    },
    toggle() {
      if (!this.ctx && !this.init()) return;
      const now = this.ctx.currentTime;
      if (this.on) {
        this.master.gain.setTargetAtTime(0, now, .25);
        this.on = false;
      } else {
        this.ctx.resume();
        this.master.gain.setTargetAtTime(.9, now, .8);
        this.on = true;
        this.update(effDepth);
      }
      els.sound.setAttribute('aria-pressed', String(this.on));
    },
    update(d) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.padGain.gain.setTargetAtTime(lerp(.06, 0, smooth(.45, .78, d)), now, .6);
      this.pad[1].detune.setTargetAtTime(-100 * smooth(.2, .5, d), now, .8);   // major → minor
      this.pad[2].detune.setTargetAtTime(-100 * smooth(.34, .58, d), now, .8); // → diminished
      this.pad[3].detune.setTargetAtTime(-40 * smooth(.3, .6, d), now, .8);    // sour octave
      this.padLP.frequency.setTargetAtTime(lerp(1400, 350, d), now, .6);
      this.droneGain.gain.setTargetAtTime(smooth(.32, .9, d) * .11, now, .8);
      this.noiseGain.gain.setTargetAtTime(smooth(.55, 1, d) * .05, now, .8);
    },
    tick(d) {
      if (!this.on || d < .7) return;
      const now = this.ctx.currentTime;
      if (now < this.nextBeat) return;
      const interval = lerp(1.25, .5, smooth(.7, 1, d));
      this.beat(now + .03, .45); this.beat(now + .03 + interval * .28, .3);
      this.nextBeat = now + interval;
    },
    beat(at, vol) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(68, at); o.frequency.exponentialRampToValueAtTime(34, at + .16);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + .012); g.gain.exponentialRampToValueAtTime(.001, at + .26);
      o.connect(g); g.connect(this.master); o.start(at); o.stop(at + .3);
    },
    tickType() {
      if (!this.on) return;
      const c = this.ctx, now = c.currentTime;
      if (now - this.lastType < .03) return;
      this.lastType = now;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
      const g = c.createGain(); g.gain.setValueAtTime(.05, now); g.gain.exponentialRampToValueAtTime(.001, now + .025);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(now, Math.random()); s.stop(now + .03);
    },
    scare() {
      if (!this.on) return;
      const c = this.ctx, now = c.currentTime;
      const g = c.createGain(); g.connect(this.master);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.9, now + .015); g.gain.exponentialRampToValueAtTime(.001, now + 1.6);
      [233, 247, 311, 349, 466, 494, 740, 784].forEach(f => {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.frequency.exponentialRampToValueAtTime(f * .7, now + 1.5);
        const og = c.createGain(); og.gain.value = .07; o.connect(og); og.connect(g); o.start(now); o.stop(now + 1.7);
      });
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const sg = c.createGain(); sg.gain.value = .5; s.connect(sg); sg.connect(g); s.start(now); s.stop(now + 1.6);
    },
  };
  els.sound.addEventListener('click', () => audio.toggle());

  /* ---------------- main loop ---------------- */
  let lastAudioUpdate = 0;
  function frame(now) {
    if (dirty) { dirty = false; onScroll(); }
    ghostFrame();
    noiseFrame(now);
    if (camVisible) drawCam(now);
    eyesFrame(now);
    if (audio.on && now - lastAudioUpdate > 200) { lastAudioUpdate = now; audio.update(effDepth); }
    audio.tick(effDepth);
    requestAnimationFrame(frame);
  }

  measure();
  setStage(0);
  requestAnimationFrame(frame);
  flickerLoop();
  glitchLoop();
  blinkLoop();
})();
