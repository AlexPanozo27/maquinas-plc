/* Simulador de la guillotina: repite los 7 escalones del informe. */
(function () {
  'use strict';
  const root = U.$('#simGuillotina'); if (!root) return;
  const $ = s => U.$(s, root);

  const setIn = U.leds($('#gtIn'), [
    { id: 'PM', label: 'PM', sub: 'I0.0', color: '#22C55E' },
    { id: 'PP', label: 'PP', sub: 'I0.1', color: '#EF3B3B' },
    { id: 'FC', label: 'FC', sub: 'I0.2', color: '#4B3BFF' },
    { id: 'SC', label: 'SC', sub: 'I0.3', color: '#4B3BFF' }
  ]);
  const setOut = U.leds($('#gtOut'), [
    { id: 'M1', label: 'M1 marcha', color: '#22C55E' },
    { id: 'CTA1', label: 'CTA1', sub: 'Q0.0', color: '#4B3BFF' },
    { id: 'CTA2', label: 'CTA2', sub: 'Q0.1', color: '#4B3BFF' },
    { id: 'GTA', label: 'GTA', sub: 'Q0.2', color: '#FF5B6E' },
    { id: 'FIN10', label: 'FIN10', color: '#FFB800' },
    { id: 'PIL', label: 'PIL', sub: 'Q0.3', color: '#FFB800' }
  ]);

  // ---- estado del PLC ----
  const S = { PM: false, PP: false, FC: false, SC: false, M1: false, CTA1: false, CTA2: false, GTA: false,
    FIN_CORTE: false, FIN10: false, PIL: false, tCorte: 0, cnt: 0, scPrev: false, tOff: 0, tOn: 0, clk: false, tOnFin: false };
  let speed = 1, auto = false, autoT = 0;

  // ---- mundo físico ----
  const ZONE = 340, SC_X = 600, CTA1_V = 90, CTA2_V = 90;
  let blocks = [], pieces = [], bladeY = 0, bladeTarget = 0, prevFin = false;
  const items = U.$('#gtItems'), dots = U.$('#gtBeltDots'), blade = U.$('#gtBlade'), pil = U.$('#gtPil');
  for (let i = 0; i < 17; i++) U.svg('rect', { x: 28 + i * 20, y: 247, width: 8, height: 4, rx: 2 }, dots);
  for (let i = 0; i < 16; i++) U.svg('rect', { x: 408 + i * 20, y: 247, width: 8, height: 4, rx: 2 }, dots);

  function addBlock() {
    if (blocks.some(b => b.x < 130)) return false;
    const g = U.svg('g', {}, items);
    U.svg('rect', { x: -38, y: -24, width: 76, height: 24, rx: 5, fill: '#FFF', stroke: '#17163B', 'stroke-width': 3 }, g);
    U.svg('rect', { x: -38, y: -24, width: 76, height: 7, rx: 3, fill: '#8FD3FF', opacity: .8 }, g);
    blocks.push({ g, x: 50, cut: false });
    return true;
  }
  function addPiece(x) {
    const g = U.svg('g', {}, items);
    U.svg('rect', { x: -23, y: -24, width: 46, height: 24, rx: 5, fill: '#FFF', stroke: '#17163B', 'stroke-width': 3 }, g);
    U.svg('rect', { x: -23, y: -24, width: 46, height: 7, rx: 3, fill: '#8FD3FF', opacity: .8 }, g);
    pieces.push({ g, x, y: 238, st: 'drop', k: 0, sx: x, boxed: false });
  }

  // ---- botones ----
  U.pushButton($('#gtPM'), v => S.PM = v);
  U.pushButton($('#gtPP'), v => S.PP = v);
  $('#gtAdd').addEventListener('click', () => { if (!addBlock()) say('Espera: ya hay material entrando en la cinta.'); });
  $('#gtAuto').addEventListener('click', e => {
    auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); e.currentTarget.classList.toggle('on', auto);
  });
  U.speed($('.controls'), v => speed = v);
  let flash = '', flashUntil = 0;
  function say(t) { flash = t; flashUntil = performance.now() + 3000; }

  // ---- un ciclo de escaneo (mismo orden que los rungs) ----
  function scan(dt) {
    // FC y SC vienen del mundo físico
    S.FC = blocks.some(b => !b.cut && b.x >= ZONE - .5);
    S.SC = pieces.some(p => p.st === 'belt' && Math.abs(p.x - SC_X) <= 12);

    // rung 1
    S.M1 = (S.PM || S.M1) && !S.PP && !S.FIN10;
    // rung 2 y 3
    S.CTA2 = S.M1;
    S.CTA1 = S.M1 && !S.FC && !S.GTA;
    // rung 4
    const inCorte = S.M1 && S.FC;
    S.tCorte = inCorte ? Math.min(3, S.tCorte + dt) : 0;
    S.FIN_CORTE = S.tCorte >= 3;
    S.GTA = S.M1 && S.FC && !S.FIN_CORTE;
    // rung 5: contador CTU con reset por PM
    if (S.PM) S.cnt = 0;
    else if (S.SC && !S.scPrev) S.cnt = Math.min(S.cnt + 1, 99);
    S.scPrev = S.SC;
    S.FIN10 = S.cnt >= 10;
    // rung 6: oscilador (dos TON cruzados de 500 ms)
    if (!S.tOnFin) { S.tOff += dt; if (S.tOff >= .5) S.clk = true; } else { S.tOff = 0; S.clk = false; }
    if (S.clk) { S.tOn += dt; if (S.tOn >= .5) S.tOnFin = true; } else { S.tOn = 0; S.tOnFin = false; }
    // rung 7
    S.PIL = S.FIN10 && S.clk;
  }

  function physics(dt) {
    bladeTarget = S.GTA ? 1 : 0;
    bladeY += Math.sign(bladeTarget - bladeY) * Math.min(Math.abs(bladeTarget - bladeY), dt / .22);
    // la hoja baja a 3 s y termina el corte: el trozo pasa a la cinta de salida
    if (S.FIN_CORTE && !prevFin) {
      const b = blocks.find(b => !b.cut && b.x >= ZONE - .5);
      if (b) { b.cut = true; b.g.remove(); addPiece(ZONE + 40); }
    }
    prevFin = S.FIN_CORTE;
    blocks = blocks.filter(b => !b.cut);
    if (S.CTA1) blocks.forEach(b => b.x = Math.min(ZONE, b.x + CTA1_V * dt));
    pieces.forEach(p => {
      if (p.st === 'drop') {
        p.k += dt / .45; const k = Math.min(1, p.k);
        p.x = p.sx + 90 * k; p.y = 214 + 24 * k * k;
        if (k >= 1) { p.st = 'belt'; p.x = p.sx + 90; p.y = 238; }
      } else if (p.st === 'belt') {
        if (S.CTA2) p.x += CTA2_V * dt;
        if (p.x >= 700) { p.st = 'box'; p.boxed = true; }
      }
    });
  }

  function drawBelts(dt) { /* los puntos de las cintas sugieren el movimiento */
    drawBelts.o1 = ((drawBelts.o1 || 0) + (S.CTA1 ? CTA1_V * dt : 0)) % 340;
    drawBelts.o2 = ((drawBelts.o2 || 0) + (S.CTA2 ? CTA2_V * dt : 0)) % 320;
    const kids = dots.children;
    for (let i = 0; i < kids.length; i++) {
      const x = i < 17 ? 28 + ((i * 20 + drawBelts.o1) % 340) : 408 + (((i - 17) * 20 + drawBelts.o2) % 320);
      kids[i].setAttribute('x', x.toFixed(1));
    }
  }

  const count = $('#gtCount'), timer = $('#gtTimer'), bar = $('#gtBar'), msg = $('#gtMsg');
  function text() {
    if (performance.now() < flashUntil) return flash;
    if (S.FIN10) return 'Lote completo: 10 piezas. El proceso se detuvo y el piloto parpadea. Presiona Marcha para empezar otro lote.';
    if (!S.M1) return blocks.length ? 'Sistema detenido. Presiona Marcha para arrancar las cintas.' : 'Sistema detenido. Pon material y presiona Marcha.';
    if (S.GTA) return 'Cortando: la hoja está abajo ' + S.tCorte.toFixed(1) + ' de 3 s.';
    if (S.FC) return 'El material llegó a la zona de corte. La cinta de entrada se detuvo.';
    if (!blocks.length && !pieces.some(p => p.st !== 'box')) return 'En marcha, sin material. Presiona «Poner material» o activa el automático.';
    return 'En marcha: la cinta de entrada lleva el material hasta la zona de corte. Piezas contadas: ' + S.cnt + '.';
  }

  let last = performance.now();
  function frame(now) {
    const real = Math.min(.05, (now - last) / 1000); last = now;
    const dt = real * speed;
    if (auto) { autoT -= dt; if (autoT <= 0 && addBlock()) autoT = 2.2; }
    const steps = Math.max(1, Math.ceil(dt / .02));
    for (let i = 0; i < steps; i++) { scan(dt / steps); physics(dt / steps); }
    drawBelts(dt);

    blocks.forEach(b => b.g.setAttribute('transform', 'translate(' + b.x.toFixed(1) + ' 238)'));
    pieces.forEach(p => {
      p.g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      if (p.st === 'box') p.g.setAttribute('opacity', 0);
    });
    // el embalaje se vacía cuando arranca un lote nuevo
    if (S.PM) { pieces.filter(p => p.st === 'box').forEach(p => p.g.remove()); pieces = pieces.filter(p => p.st !== 'box'); }
    blade.setAttribute('transform', 'translate(0 ' + (88 + 100 * bladeY).toFixed(1) + ')');
    pil.setAttribute('fill', S.PIL ? '#FFC736' : '#4D4420');
    pil.setAttribute('stroke', S.PIL ? '#17163B' : '#17163B');

    setIn('PM', S.PM); setIn('PP', S.PP); setIn('FC', S.FC); setIn('SC', S.SC);
    setOut('M1', S.M1); setOut('CTA1', S.CTA1); setOut('CTA2', S.CTA2); setOut('GTA', S.GTA); setOut('FIN10', S.FIN10); setOut('PIL', S.PIL);
    count.textContent = Math.min(S.cnt, 10);
    timer.textContent = S.tCorte.toFixed(1);
    bar.style.width = Math.min(100, S.cnt * 10) + '%';
    const m = text(); if (msg.textContent !== m) msg.textContent = m;
    requestAnimationFrame(frame);
  }
  // posición inicial de la hoja arriba
  blade.setAttribute('transform', 'translate(0 88)');
  addBlock();
  requestAnimationFrame(frame);
})();
