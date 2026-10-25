/* Simulador de la cinta: las dos máquinas de estados del código C++ (metal y compactadora) corren a la vez. */
(function () {
  'use strict';
  const root = U.$('#simCinta'); if (!root) return;
  const $ = s => U.$(s, root);

  // ---- constantes del informe (en ms) ----
  const T_RETARDO = 700, T_SERVO = 600, T_AVANCE = 1500, T_PAUSA = 300, T_RETRO = 1500, PASOS = 1000;
  // ---- geometría del dibujo ----
  const B1_Y = 330, IND_X = 190, XD = 274, V1 = 120, V2 = 70, STOP_Y = 104, IR_Y = 117, BIN_X = 648, ROW = 34;
  const PLATE_X0 = 180, PLATE_X1 = 256, B2_RIGHT = 288;

  const MS = ['M_ESPERA', 'M_RETARDO', 'M_SERVO_IDA', 'M_SERVO_VUELTA', 'M_LIBRE'];
  const PS = ['P_ESPERA', 'P_AVANCE', 'P_PAUSA', 'P_RETROCESO', 'P_LIBRE'];
  const mk = (box, names) => names.map(n => { const c = document.createElement('span'); c.className = 'chip'; c.textContent = n; box.appendChild(c); return c; });
  const chipsM = mk($('#ctChipsM'), MS), chipsP = mk($('#ctChipsP'), PS);

  const setLed = U.leds($('#ctLeds'), [
    { id: 'ind', label: 'Inductivo', sub: 'D2', color: '#4B3BFF' },
    { id: 'ir', label: 'Infrarrojo', sub: 'D3', color: '#4B3BFF' },
    { id: 'b1', label: 'Banda 1', sub: 'D4', color: '#22C55E' },
    { id: 'b2', label: 'Banda 2', sub: 'D5', color: '#22C55E' },
    { id: 'servo', label: 'Servo 180°', sub: 'D8', color: '#FF5B6E' },
    { id: 'en', label: 'Driver on', sub: 'D9', color: '#FFB800' }
  ]);

  // ---- estado ----
  let m, p, tM, tP, pasos, servo, plateProg, pieces, n, speed = 1, auto = false, autoT = 0, spawnId = 0;
  const gP = $('#ctPieces'), plate = $('#ctPlate'), rack = $('#ctRack'), servoTxt = $('#ctServoTxt');
  const indLed = $('#ctIndLed'), irLed = $('#ctIrLed');
  const dotsH = $('#ctDotsH'), dotsV = $('#ctDotsV');
  let o1 = 0, o2 = 0, B1 = true, B2 = true, EN = false, IND = false, IR = false;

  for (let i = 0; i < 31; i++) U.svg('rect', { x: 26 + i * 20, y: 328, width: 8, height: 4, rx: 2 }, dotsH);
  for (let i = 0; i < 13; i++) U.svg('rect', { x: 272, y: 300 - i * 20, width: 4, height: 8, rx: 2 }, dotsV);

  function reset() {
    gP.innerHTML = '';
    m = 0; p = 0; tM = 0; tP = 0; pasos = 0; servo = 0; plateProg = 0; pieces = [];
    n = { metal: 0, plast: 0, comp: 0 };
    B1 = true; B2 = true; EN = false; autoT = 0;
  }
  reset();

  function spawn(metal) {
    if (pieces.some(q => q.st === 'b1' && q.x < 70)) { say('Espera un momento: ya hay una pieza entrando.'); return; }
    const g = U.svg('g', {}, gP);
    if (metal) {
      U.svg('rect', { x: -14, y: -14, width: 28, height: 28, rx: 6, fill: '#DDE3F2', stroke: '#17163B', 'stroke-width': 3 }, g);
      U.svg('path', { d: 'M-7 -3h14M-7 4h14', stroke: '#8C97B5', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    } else U.svg('circle', { r: 14, fill: '#FF7A2F', stroke: '#17163B', 'stroke-width': 3 }, g);
    pieces.push({ g, metal, x: 30, y: B1_Y, st: 'b1', w: 28, done: false, k: 0, id: ++spawnId });
  }

  U.pushButton($('#ctMetal'), v => { if (v) spawn(true); });
  U.pushButton($('#ctPlast'), v => { if (v) spawn(false); });
  $('#ctAuto').addEventListener('click', e => {
    auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); e.currentTarget.classList.toggle('on', auto);
  });
  $('#ctReset').addEventListener('click', reset);
  U.speed($('.controls'), v => speed = v);
  let flash = '', flashUntil = 0;
  function say(t) { flash = t; flashUntil = performance.now() + 2600; }

  const frontB2 = () => pieces.filter(q => q.st === 'b2').sort((a, b) => a.y - b.y)[0];

  function step(dt) {
    const ms = dt * 1000;
    // --- sensores ---
    IND = pieces.some(q => q.metal && q.st === 'b1' && q.x >= IND_X && q.x <= IND_X + 12);
    IR = pieces.some(q => q.st === 'b2' && q.y - 14 <= IR_Y && q.y + 14 >= IR_Y);

    // --- máquina del metal ---
    switch (m) {
      case 0: if (IND) { tM = 0; m = 1; } break;
      case 1: tM += ms; if (tM >= T_RETARDO) { B1 = false; tM = 0; m = 2; } break;
      case 2: tM += ms; servo = Math.min(180, 180 * tM / T_SERVO); if (tM >= T_SERVO) { servo = 180; tM = 0; m = 3; } break;
      case 3: tM += ms; servo = Math.max(0, 180 * (1 - tM / T_SERVO)); if (tM >= T_SERVO) { servo = 0; B1 = true; m = 4; } break;
      case 4: if (!IND) m = 0; break;
    }

    // --- máquina de la compactadora ---
    switch (p) {
      case 0: if (IR) { EN = true; pasos = 0; tP = 0; p = 1; } break;
      case 1: tP += ms; pasos = Math.min(PASOS, PASOS * tP / T_AVANCE); plateProg = pasos / PASOS;
        if (tP >= T_AVANCE) { pasos = PASOS; plateProg = 1; tP = 0; p = 2; } break;
      case 2: tP += ms; if (tP >= T_PAUSA) { tP = 0; pasos = PASOS; p = 3; } break;
      case 3: tP += ms; pasos = Math.max(0, PASOS * (1 - tP / T_RETRO)); plateProg = pasos / PASOS;
        if (tP >= T_RETRO) { pasos = 0; plateProg = 0; EN = false; p = 4; n.comp++;
          const f = frontB2(); if (f) f.done = true; } break;
      case 4: if (!IR) p = 0; break;
    }

    // --- piezas ---
    const pushP = servo / 180;
    const sorted = pieces.filter(q => q.st === 'b2').sort((a, b) => a.y - b.y);
    pieces.forEach(q => {
      if (q.st === 'b1') {
        if (m === 2 && Math.abs(q.x - XD) <= 22) { q.st = 'push'; }
        else if (B1) {
          q.x += V1 * dt;
          if (q.x >= BIN_X) {
            q.st = 'bin'; q.k = 0;
            if (q.metal) say('Una pieza de metal pasó sin desviarse: llegó cuando la máquina estaba ocupada. Por eso deben ir separadas.');
            else n.plast++;
          }
        }
      }
      if (q.st === 'push') {
        q.y = Math.min(q.y, B1_Y - 40 * pushP);
        q.x += (XD - q.x) * Math.min(1, dt * 10);
        if (m !== 2) {
          q.st = 'b2'; q.x = XD;
          if (q.metal) n.metal++; else say('Una pieza de plástico estaba frente al desvío y se fue con el metal.');
        }
      } else if (q.st === 'b2') {
        const idx = sorted.indexOf(q);
        let limit = STOP_Y;
        if (idx > 0) limit = sorted[idx - 1].y + ROW;
        if (q.done) { q.y -= V2 * 1.3 * dt; if (q.y < 54) { q.st = 'out'; q.k = 0; } }
        else { q.y = Math.max(limit, q.y - V2 * dt); }
        // compactación: la placa empuja a la pieza que está en el tope
        if (!q.done && Math.abs(q.y - STOP_Y) < 2) {
          const tip = PLATE_X0 + 22 + (PLATE_X1 - PLATE_X0) * plateProg;
          const left = Math.max(B2_RIGHT - 28, tip);
          q.w = Math.max(10, Math.min(q.w, B2_RIGHT - left));
        }
        if (q.w < 28) q.x = B2_RIGHT - q.w / 2;
      } else if (q.st === 'bin' || q.st === 'out') { q.k += dt / .4; if (q.k >= 1) q.dead = true; }
    });
    pieces = pieces.filter(q => { if (q.dead) q.g.remove(); return !q.dead; });

    // movimiento de los puntos de las bandas
    o1 = (o1 + (B1 ? V1 * dt : 0)) % 620; o2 = (o2 + V2 * dt) % 260;
  }

  function draw() {
    pieces.forEach(q => {
      const o = (q.st === 'bin' || q.st === 'out') ? 1 - q.k : 1;
      q.g.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ') scale(' + (q.w / 28).toFixed(3) + ' 1)');
      q.g.setAttribute('opacity', o.toFixed(2));
    });
    const kh = dotsH.children, kv = dotsV.children;
    for (let i = 0; i < kh.length; i++) kh[i].setAttribute('x', (26 + ((i * 20 + o1) % 620)).toFixed(1));
    for (let i = 0; i < kv.length; i++) kv[i].setAttribute('y', (300 - ((i * 20 + o2) % 260) + 12).toFixed(1));
    plate.setAttribute('x', (PLATE_X0 + (PLATE_X1 - PLATE_X0) * plateProg).toFixed(1));
    const tipY = 360 - 56 * (servo / 180);
    rack.setAttribute('y', tipY.toFixed(1)); rack.setAttribute('height', (400 - tipY).toFixed(1));
    servoTxt.textContent = 'Servo ' + Math.round(servo) + '°';
    indLed.setAttribute('fill', IND ? '#22C55E' : '#17163B');
    irLed.setAttribute('fill', IR ? '#22C55E' : '#17163B');

    chipsM.forEach((c, i) => c.classList.toggle('on', i === m));
    chipsP.forEach((c, i) => c.classList.toggle('on', i === p));
    setLed('ind', IND); setLed('ir', IR); setLed('b1', B1); setLed('b2', true); setLed('servo', servo > 90); setLed('en', EN);
    $('#ctMetalN').textContent = n.metal; $('#ctPlastN').textContent = n.plast; $('#ctCompN').textContent = n.comp;
    $('#ctSteps').textContent = Math.round(pasos);
    $('#ctBar').style.width = (pasos / PASOS * 100) + '%';
    const t = text(); const msg = $('#ctMsg'); if (msg.textContent !== t) msg.textContent = t;
  }

  function text() {
    if (performance.now() < flashUntil) return flash;
    const a = ['Banda 1 en marcha. Suelta una pieza de metal o de plástico.',
      'Metal detectado: la banda sigue 0,7 s para que la pieza llegue al desvío.',
      'Banda 1 detenida: el servo empuja la pieza hacia la banda 2.',
      'El servo vuelve a 0° y la banda 1 arranca otra vez.',
      'Esperando que el sensor inductivo quede libre para no contar dos veces la pieza.'][m];
    const b = ['', ' Compactadora: avanzando 4 cm (' + Math.round(pasos) + ' pasos).', ' Compactadora: pausa de 0,3 s con la pieza aplastada.',
      ' Compactadora: retrocediendo.', ' Compactadora: lista, esperando que salga la pieza.'][p];
    return a + b;
  }

  let last = performance.now();
  function frame(now) {
    const real = Math.min(.05, (now - last) / 1000); last = now;
    const dt = real * speed;
    if (auto) { autoT -= dt; if (autoT <= 0) { spawn(Math.random() < .55); autoT = 3.2; } }
    const steps = Math.max(1, Math.ceil(dt / .02));
    for (let i = 0; i < steps; i++) step(dt / steps);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
