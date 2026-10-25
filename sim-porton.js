/* Simulador del portón: la lógica repite, escalón por escalón, el programa en escalera del informe. */
(function () {
  'use strict';
  const root = U.$('#simPorton'); if (!root) return;
  const $ = s => U.$(s, root);

  const setIn = U.leds($('#pgIn'), [
    { id: 'P', label: 'P', sub: 'I0.0', color: '#22C55E' },
    { id: 'E', label: 'Emerg.', sub: 'I0.1', color: '#EF3B3B' },
    { id: 'FCA', label: 'FCA', sub: 'I0.2', color: '#4B3BFF' },
    { id: 'FCC', label: 'FCC', sub: 'I0.3', color: '#4B3BFF' },
    { id: 'R', label: 'Reset', sub: 'I0.4', color: '#FFB800' }
  ]);
  const setOut = U.leds($('#pgOut'), [
    { id: 'ab', label: 'Abre', sub: 'Q0.0', color: '#4B3BFF' },
    { id: 'ce', label: 'Cierra', sub: 'Q0.1', color: '#4B3BFF' },
    { id: 'lv', label: 'Verde', sub: 'Q0.2', color: '#22C55E' },
    { id: 'lr', label: 'Rojo', sub: 'Q0.3', color: '#EF3B3B' },
    { id: 'la', label: 'Amarillo', sub: 'D9', color: '#FFB800' }
  ]);

  const chipsBox = $('#pgChips'), chips = [];
  for (let i = 0; i < 7; i++) {
    const c = document.createElement('span');
    c.className = 'chip' + (i === 5 ? ' red' : '');
    c.textContent = 'E' + i;
    chipsBox.appendChild(c); chips.push(c);
  }

  const S = { P: false, E: false, R: false, E0: true, E1: false, E2: false, E3: false, E4: false, E5: false, E6: false, tim: 0, pos: 0 };
  let speed = 1, flash = '', flashUntil = 0;

  U.pushButton($('#pgP'), v => S.P = v);
  U.pushButton($('#pgE'), v => { S.E = v; if (v && S.E0) say('En reposo la emergencia no hace nada: no hay movimiento que detener.'); });
  U.pushButton($('#pgR'), v => { S.R = v; if (v && !S.E5) say('El Reset solo funciona después de una emergencia.'); });
  U.speed($('.controls'), v => speed = v);

  function say(t) { flash = t; flashUntil = performance.now() + 3200; }

  function scan(dt) {
    const FCC = S.pos <= 0.001, FCA = S.pos >= 0.999;
    S.FCC = FCC; S.FCA = FCA;
    S.E1 = ((S.E0 && S.P && FCC) || S.E1) && !S.E2 && !S.E5;
    S.E2 = ((S.E1 && FCA) || S.E2) && !S.E3 && !S.E4 && !S.E5;
    S.tim = S.E2 ? S.tim + dt : 0;
    const auto = S.tim >= 30;
    S.E3 = ((S.E2 && auto) || S.E3) && !FCC && !S.E5;
    S.E4 = ((S.E2 && S.P && FCA) || S.E4) && !FCC && !S.E5;
    S.E5 = ((S.E1 && S.E) || (S.E2 && S.E) || (S.E3 && S.E) || (S.E4 && S.E) || S.E5) && !S.E6;
    S.E6 = (S.E5 && S.R) || (S.E6 && !FCC);
    S.E0 = !S.E1 && !S.E2 && !S.E3 && !S.E4 && !S.E5 && !S.E6;
    S.ab = S.E1;
    S.ce = S.E3 || S.E4 || S.E6;
    S.lv = S.E2; S.lr = S.E0; S.la = S.E1 || S.E3 || S.E4;
    // motor y final de carrera (3 s de recorrido completo)
    S.pos = U.clamp(S.pos + ((S.ab ? 1 : 0) - (S.ce ? 1 : 0)) * dt / 3, 0, 1);
  }

  const gate = $('#pgGate'), lamps = { r: $('#pgLR'), y: $('#pgLY'), g: $('#pgLG') };
  const off = { r: '#4A2A2F', y: '#4D4420', g: '#1F4A33' }, onc = { r: '#FF4D5E', y: '#FFC736', g: '#2EE27B' };
  const fcc = $('#pgFCC'), fca = $('#pgFCA'), posTxt = $('#pgPos'), tim = $('#pgTim'), msg = $('#pgMsg');

  function stageMsg() {
    if (performance.now() < flashUntil) return flash;
    if (S.E0) return 'E0: portón cerrado, luz roja. Presiona P para abrir.';
    if (S.E1) return 'E1: abriendo. El motor abre y la luz amarilla está encendida.';
    if (S.E2) return 'E2: abierto, luz verde. Se cierra solo en ' + Math.max(0, Math.ceil(30 - S.tim)) + ' s, o presiona P para cerrar ya.';
    if (S.E3) return 'E3: cerrando porque pasaron los 30 s.';
    if (S.E4) return 'E4: cerrando porque presionaste P.';
    if (S.E5) return 'E5: emergencia. Todo está apagado y el portón no se moverá hasta que presiones Reset.';
    return 'E6: Reset. El portón cierra hasta el final de carrera de cerrado y vuelve al inicio.';
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000) * speed; last = now;
    // varias pasadas por cuadro para mantener el escaneo estable a x10
    const steps = Math.max(1, Math.ceil(dt / .02));
    for (let i = 0; i < steps; i++) scan(dt / steps);

    gate.setAttribute('transform', 'translate(' + (110 + 270 * S.pos).toFixed(1) + ' 0)');
    lamps.r.setAttribute('fill', S.lr ? onc.r : off.r);
    lamps.y.setAttribute('fill', S.la ? onc.y : off.y);
    lamps.g.setAttribute('fill', S.lv ? onc.g : off.g);
    fcc.setAttribute('fill', S.FCC ? '#4B3BFF' : '#C7CCDD');
    fca.setAttribute('fill', S.FCA ? '#4B3BFF' : '#C7CCDD');
    posTxt.textContent = 'Apertura ' + Math.round(S.pos * 100) + '%';
    tim.style.width = (U.clamp(S.tim / 30, 0, 1) * 100) + '%';

    setIn('P', S.P); setIn('E', S.E); setIn('R', S.R); setIn('FCA', S.FCA); setIn('FCC', S.FCC);
    setOut('ab', S.ab); setOut('ce', S.ce); setOut('lv', S.lv); setOut('lr', S.lr); setOut('la', S.la);
    for (let i = 0; i < 7; i++) chips[i].classList.toggle('on', S['E' + i]);
    const m = stageMsg(); if (msg.textContent !== m) msg.textContent = m;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
