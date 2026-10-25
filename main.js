/* Utilidades compartidas y comportamiento general */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  window.U = {
    reduce,
    $: (s, r) => (r || document).querySelector(s),
    $$: (s, r) => Array.from((r || document).querySelectorAll(s)),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    svg(tag, attrs, parent) {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(el);
      return el;
    },
    /* Pulsador momentáneo: mantiene la señal activa mientras se presiona (mínimo 140 ms). */
    pushButton(el, setter) {
      let downAt = 0, timer = null;
      const on = () => { clearTimeout(timer); downAt = performance.now(); el.classList.add('down'); setter(true); };
      const off = () => {
        const wait = Math.max(0, 140 - (performance.now() - downAt));
        clearTimeout(timer);
        timer = setTimeout(() => { el.classList.remove('down'); setter(false); }, wait);
      };
      el.addEventListener('pointerdown', e => { e.preventDefault(); on(); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => { if (el.classList.contains('down')) off(); }));
      el.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); on(); } });
      el.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') off(); });
    },
    /* Selector de velocidad: devuelve una función con el valor actual. */
    speed(root, cb) {
      const btns = U.$$('[data-speed]', root);
      btns.forEach(b => b.addEventListener('click', () => {
        btns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
        cb(+b.dataset.speed);
      }));
    },
    leds(container, defs) {
      const map = {};
      defs.forEach(d => {
        const el = document.createElement('div');
        el.className = 'led';
        if (d.color) el.style.setProperty('--c', d.color);
        el.innerHTML = '<span>' + d.label + '</span>' + (d.sub ? '<small>' + d.sub + '</small>' : '');
        container.appendChild(el);
        map[d.id] = el;
      });
      return (id, v) => { if (map[id]) map[id].classList.toggle('on', !!v); };
    }
  };

  /* Aparición suave al hacer scroll */
  const rv = U.$$('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
    rv.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  } else rv.forEach(el => el.classList.add('in'));

  /* Pestañas */
  U.$$('[data-tabs]').forEach(box => {
    const tabs = U.$$('.tab', box), panels = U.$$('.tabpanel', box);
    tabs.forEach((t, i) => t.addEventListener('click', () => {
      tabs.forEach((x, j) => { x.setAttribute('aria-selected', i === j ? 'true' : 'false'); panels[j].classList.toggle('on', i === j); });
    }));
  });

  /* Visor de imágenes */
  const lb = U.$('#lb'), lbImg = U.$('img', lb), lbCap = U.$('p', lb);
  let group = [], idx = 0;
  function show(i) {
    idx = (i + group.length) % group.length;
    const el = group[idx];
    const img = el.tagName === 'IMG' ? el : U.$('img', el);
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = el.dataset.cap || img.alt;
    U.$('.pv', lb).style.display = U.$('.nx', lb).style.display = group.length > 1 ? '' : 'none';
  }
  function open(el) {
    group = U.$$('[data-zoom][data-group="' + el.dataset.group + '"]');
    show(group.indexOf(el));
    lb.classList.add('on');
    U.$('.x', lb).focus();
  }
  function close() { lb.classList.remove('on'); }
  U.$$('[data-zoom]').forEach(el => {
    el.addEventListener('click', () => open(el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } });
  });
  U.$('.x', lb).addEventListener('click', close);
  U.$('.pv', lb).addEventListener('click', e => { e.stopPropagation(); show(idx - 1); });
  U.$('.nx', lb).addEventListener('click', e => { e.stopPropagation(); show(idx + 1); });
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  addEventListener('keydown', e => {
    if (!lb.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });

  /* Enlace activo en el menú */
  const links = U.$$('.nav a.lnk');
  const secs = ['proyectos', 'porton', 'guillotina', 'cinta', 'equipo'].map(id => document.getElementById(id));
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => s && so.observe(s));
  }

  /* ---------- Animación del hero: la cinta clasifica sola ---------- */
  const hp = U.$('#heroPieces'), dots = U.$('#beltDots'), rack = U.$('#heroRack'), plate = U.$('#heroPlate');
  if (hp) {
    for (let i = 0; i < 28; i++) U.svg('rect', { x: 34 + i * 20, y: 388, width: 8, height: 4, rx: 2 }, dots);
    dots.setAttribute('class', 'hb');
    const gv = U.svg('g', { fill: '#6F62FF', class: 'vb' });
    hp.parentNode.insertBefore(gv, hp);
    for (let i = 0; i < 16; i++) U.svg('rect', { x: 300, y: 76 + i * 20, width: 4, height: 8, rx: 2 }, gv);
    const SX = 302, BY = 390, DIV = 302;
    let pieces = [], t = 0, last = performance.now(), spawn = 0, n = 0;
    function mk(metal) {
      const g = U.svg('g', {}, hp);
      if (metal) {
        U.svg('rect', { x: -17, y: -17, width: 34, height: 34, rx: 7, fill: '#DDE3F2', stroke: '#17163B', 'stroke-width': 3 }, g);
        U.svg('path', { d: 'M-9 -5h18M-9 3h18', stroke: '#8C97B5', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      } else U.svg('circle', { r: 17, fill: '#FF7A2F', stroke: '#17163B', 'stroke-width': 3 }, g);
      return { g, metal, x: 14, y: BY, st: 'b1', k: 0, sq: 1 };
    }
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt; spawn -= dt;
      if (spawn <= 0) { pieces.push(mk(n++ % 3 === 1)); spawn = 2.1; }
      let pushing = false, pressing = 0;
      pieces.forEach(p => {
        if (p.st === 'b1') {
          p.x += 120 * dt;
          if (p.metal && p.x >= DIV) { p.x = DIV; p.st = 'push'; p.k = 0; }
          if (!p.metal && p.x > 520) { p.st = 'bin'; p.k = 0; }
        } else if (p.st === 'push') {
          p.k += dt / .5; pushing = true; p.y = BY - 40 * Math.min(1, p.k);
          if (p.k >= 1) p.st = 'b2';
        } else if (p.st === 'b2') {
          p.y -= 90 * dt;
          if (p.y <= 110) { p.y = 110; p.st = 'press'; p.k = 0; }
        } else if (p.st === 'press') {
          p.k += dt / 1.1; pressing = Math.sin(Math.min(1, p.k) * Math.PI);
          p.sq = 1 - .55 * pressing;
          if (p.k >= 1) { p.st = 'out'; p.sq = .45; }
        } else if (p.st === 'out') { p.y -= 110 * dt; if (p.y < 40) p.dead = true; }
        else if (p.st === 'bin') { p.k += dt / .4; if (p.k >= 1) p.dead = true; }
        const o = p.st === 'bin' ? 1 - p.k : (p.st === 'out' && p.y < 70 ? (p.y - 40) / 30 : 1);
        p.g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') scale(' + p.sq.toFixed(2) + ' 1)');
        p.g.setAttribute('opacity', Math.max(0, o).toFixed(2));
      });
      pieces = pieces.filter(p => { if (p.dead) p.g.remove(); return !p.dead; });
      const rk = pieces.find(p => p.st === 'push');
      rack.setAttribute('y', 420 - (rk ? 40 * Math.min(1, rk.k) : 0));
      plate.setAttribute('x', 232 + 34 * pressing);
      requestAnimationFrame(frame);
    }
    if (reduce) {
      const a = mk(false); a.x = 140; a.g.setAttribute('transform', 'translate(140 390)');
      const b = mk(true); b.g.setAttribute('transform', 'translate(302 250)');
    } else requestAnimationFrame(frame);
  }
})();
