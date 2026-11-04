/* Lentille convergente : trouver la vergence
   Simulation sans dépendance (HTML + CSS + JS).
   Unités du monde : cm. Lentille en x = 0, axe optique en y = 0, y vers le haut.
   Convention : distances positives, image réelle à droite (d_i > 0),
   1/f = 1/d_o + 1/d_i, grandissement m = -d_i / d_o. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Distances focales internes (cm). Ne jamais les afficher.
     ------------------------------------------------------------------ */
  var LENSES = { A: 12.5, B: 25, C: 10, D: 20, E: 8 };

  var INFINITY_TOL = 0.25; // |d_o - f| <= 0.25 cm : image à l'infini

  /* ==================================================================
     PHYSIQUE PURE (aucun accès au DOM : testable avec Node)
     ================================================================== */

  /** Image d'un objet AB par une lentille mince convergente.
   *  f, dObj > 0 (cm) ; hObj > 0 (cm).
   *  Retourne { type: 'real' | 'virtual' | 'infinity', dImg (signé, >0 réel),
   *             xImg (abscisse de A'), m, hImg (signé, >0 vers le haut) } */
  function thinLensImage(f, dObj, hObj) {
    if (Math.abs(dObj - f) <= INFINITY_TOL) {
      return { type: 'infinity', dImg: Infinity, xImg: NaN, m: Infinity, hImg: NaN };
    }
    var dImg = (f * dObj) / (dObj - f);
    var m = -dImg / dObj;
    return {
      type: dImg > 0 ? 'real' : 'virtual',
      dImg: dImg,
      xImg: dImg,          // réelle : à droite (x > 0) ; virtuelle : à gauche (x < 0)
      m: m,
      hImg: m * hObj
    };
  }

  /** Les 3 rayons principaux issus de B, sous forme de segments.
   *  rect = { xmin, xmax, ymin, ymax } : zone visible (cm).
   *  kind : 'incident' | 'refracted' (traits pleins, flèches),
   *         'extension' (prolongement en arrière, pointillés, image virtuelle),
   *         'construction' (alignement F-B pour le rayon 3 quand d_o < f). */
  function buildRays(f, dObj, hObj, rect) {
    var img = thinLensImage(f, dObj, hObj);
    var B = { x: -dObj, y: hObj };
    var O = { x: 0, y: 0 };
    var xEnd = rect.xmax;
    var segs = [];

    // Rayon 1 : parallèle à l'axe, puis passe par F' (f, 0).
    var L1 = { x: 0, y: hObj };
    segs.push({ ray: 1, kind: 'incident', a: B, b: L1 });
    segs.push({ ray: 1, kind: 'refracted', a: L1, b: { x: xEnd, y: hObj - hObj * xEnd / f } });

    // Rayon 2 : passe par le centre optique O sans être dévié.
    segs.push({ ray: 2, kind: 'incident', a: B, b: O });
    segs.push({ ray: 2, kind: 'refracted', a: O, b: { x: xEnd, y: -hObj * xEnd / dObj } });

    // Rayon 3 : sur la droite (F, B), puis ressort parallèle à l'axe.
    // Indéfini si B est à la verticale de F (objet au foyer).
    var L3 = null;
    if (img.type !== 'infinity') {
      L3 = { x: 0, y: hObj * f / (f - dObj) };
      segs.push({ ray: 3, kind: 'incident', a: B, b: L3 });
      segs.push({ ray: 3, kind: 'refracted', a: L3, b: { x: xEnd, y: L3.y } });
      if (dObj < f) {
        segs.push({ ray: 3, kind: 'construction', a: { x: -f, y: 0 }, b: B });
      }
    }

    // Image virtuelle : prolongements en arrière des rayons émergents jusqu'à B'.
    if (img.type === 'virtual') {
      var Bp = { x: img.xImg, y: img.hImg };
      segs.push({ ray: 1, kind: 'extension', a: L1, b: Bp });
      segs.push({ ray: 2, kind: 'extension', a: O, b: Bp });
      segs.push({ ray: 3, kind: 'extension', a: L3, b: Bp });
    }

    return { image: img, B: B, segments: segs };
  }

  /** Nature de l'image, en français. */
  function natureText(img, hObj) {
    if (img.type === 'infinity') return "Pas d'image (image à l'infini)";
    var parts = img.type === 'real' ? ['réelle', 'renversée'] : ['virtuelle', 'droite'];
    var hi = round1(Math.abs(img.hImg));
    var ho = round1(hObj);
    if (hi > ho) parts.push('agrandie');
    else if (hi < ho) parts.push('réduite');
    else parts.push('même taille');
    return parts.join(', ');
  }

  function round1(v) { return Math.round(v * 10) / 10; }

  /** Nombre en cm, une décimale, virgule décimale : 30 -> "30,0 cm". */
  function formatCm(v) {
    return round1(Math.abs(v)).toFixed(1).replace('.', ',') + ' cm';
  }

  /** Découpe le segment [a, b] au rectangle (Liang-Barsky). null si invisible. */
  function clipSegment(a, b, r) {
    var t0 = 0, t1 = 1;
    var dx = b.x - a.x, dy = b.y - a.y;
    var p = [-dx, dx, -dy, dy];
    var q = [a.x - r.xmin, r.xmax - a.x, a.y - r.ymin, r.ymax - a.y];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return null;
      } else {
        var t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
        else { if (t < t0) return null; if (t < t1) t1 = t; }
      }
    }
    return {
      a: { x: a.x + t0 * dx, y: a.y + t0 * dy },
      b: { x: a.x + t1 * dx, y: a.y + t1 * dy }
    };
  }

  var Physics = {
    LENSES: LENSES,
    INFINITY_TOL: INFINITY_TOL,
    thinLensImage: thinLensImage,
    buildRays: buildRays,
    natureText: natureText,
    formatCm: formatCm,
    clipSegment: clipSegment
  };

  // Export pour les tests Node uniquement (aucune variable globale dans le navigateur).
  if (typeof module !== 'undefined' && module.exports) module.exports = Physics;
  if (typeof document === 'undefined') return;

  /* ==================================================================
     INTERFACE
     ================================================================== */

  var HALF_SPAN_WIDE = 70;   // cm visibles de part et d'autre de la lentille
  var HALF_SPAN_NARROW = 45; // idem sur écran étroit (téléphone)
  var NARROW_PX = 600;       // largeur du canevas en dessous de laquelle on resserre
  var LENS_HALF_H = 20;      // demi-hauteur dessinée de la lentille (cm), agrandie si besoin
  var SNAP = 0.5;            // pas d'accrochage (cm)
  var D_MIN = 1;
  var H_MIN = 1;
  var H_MAX = 15;
  var DEFAULTS = { dObj: 30, hObj: 5, showFoci: true };

  var canvas = document.getElementById('scene');
  var ctx = canvas.getContext('2d');
  var lensSelect = document.getElementById('lens-select');
  var fociBox = document.getElementById('show-foci');
  var resetBtn = document.getElementById('reset-btn');
  var ro = {
    dObj: document.getElementById('ro-do'),
    dImg: document.getElementById('ro-di'),
    hObj: document.getElementById('ro-ho'),
    hImg: document.getElementById('ro-hi'),
    nature: document.getElementById('ro-nature')
  };

  var state = {
    lens: lensSelect.value,
    dObj: DEFAULTS.dObj,
    hObj: DEFAULTS.hObj,
    showFoci: fociBox.checked,
    drag: null,     // { mode: 'body' | 'tip', offset, pointerId }
    hover: null     // 'body' | 'tip' | null
  };

  var view = { w: 0, h: 0, dpr: 1, scale: 1, cx: 0, cy: 0, rect: null };
  var theme = {};

  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    var names = ['scene-top', 'scene-bottom', 'grid', 'grid-major', 'axis', 'lens', 'lens-fill',
      'focal-fill', 'focal-stroke', 'label', 'scalebar', 'object', 'handle-fill', 'image',
      'image-virtual', 'ray1', 'ray2', 'ray3', 'badge-bg', 'badge-text', 'font-canvas',
      'canvas-label-size'];
    names.forEach(function (n) { theme[n] = cs.getPropertyValue('--' + n).trim(); });
    if (!theme['font-canvas']) theme['font-canvas'] = 'system-ui, sans-serif';
    theme.labelPx = parseFloat(theme['canvas-label-size']) || 12;
  }

  function snap(v) { return Math.round(v / SNAP) * SNAP; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function focal() { return LENSES[state.lens]; }
  function halfSpan() { return view.w > 0 && view.w < NARROW_PX ? HALF_SPAN_NARROW : HALF_SPAN_WIDE; }
  function dMax() { return halfSpan() - 1; }
  function hMax() {
    var visible = view.rect ? Math.floor((view.rect.ymax - 2) / SNAP) * SNAP : H_MAX;
    return Math.max(H_MIN, Math.min(H_MAX, visible));
  }

  function sx(x) { return view.cx + x * view.scale; }
  function sy(y) { return view.cy - y * view.scale; }
  function wx(px) { return (px - view.cx) / view.scale; }
  function wy(py) { return (view.cy - py) / view.scale; }

  function resize() {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    var dpr = window.devicePixelRatio || 1;
    view.w = w; view.h = h; view.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var span = halfSpan();
    view.scale = w / (2 * span);
    view.cx = w / 2;
    view.cy = h / 2;
    var halfY = (h / 2) / view.scale;
    view.rect = { xmin: -span, xmax: span, ymin: -halfY, ymax: halfY };
    state.hObj = clamp(state.hObj, H_MIN, hMax());
    state.dObj = clamp(state.dObj, D_MIN, dMax());
    readTheme();
    draw();
  }

  /* ---------------- Dessin ---------------- */

  var drawQueued = false;
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(function () { drawQueued = false; draw(); });
  }

  function fontPx(size, weight) {
    return (weight || '600') + ' ' + size + 'px ' + theme['font-canvas'];
  }

  function labelSize() { return theme.labelPx; }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, theme['scene-top']);
    g.addColorStop(1, theme['scene-bottom']);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function drawGrid() {
    var r = view.rect;
    var minorVisible = view.scale >= 4;
    ctx.lineWidth = 1;
    for (var pass = 0; pass < 2; pass++) {
      var major = pass === 1;
      if (!major && !minorVisible) continue;
      ctx.strokeStyle = major ? theme['grid-major'] : theme.grid;
      ctx.beginPath();
      for (var x = Math.ceil(r.xmin); x <= Math.floor(r.xmax); x++) {
        if ((x % 5 === 0) !== major) continue;
        var px = Math.round(sx(x)) + 0.5;
        ctx.moveTo(px, 0); ctx.lineTo(px, view.h);
      }
      for (var y = Math.ceil(r.ymin); y <= Math.floor(r.ymax); y++) {
        if ((y % 5 === 0) !== major) continue;
        var py = Math.round(sy(y)) + 0.5;
        ctx.moveTo(0, py); ctx.lineTo(view.w, py);
      }
      ctx.stroke();
    }
  }

  function drawAxis() {
    ctx.strokeStyle = theme.axis;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(0, sy(0)); ctx.lineTo(view.w, sy(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Barre d'échelle en bas à droite (le bas gauche est occupé par la légende).
  function drawScaleBar() {
    var len = 10 * view.scale;
    var x0 = view.w - 18 - len, y0 = view.h - 18;
    ctx.strokeStyle = theme.scalebar;
    ctx.fillStyle = theme.scalebar;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 5); ctx.lineTo(x0, y0 + 5);
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + len, y0);
    ctx.moveTo(x0 + len, y0 - 5); ctx.lineTo(x0 + len, y0 + 5);
    ctx.stroke();
    ctx.font = fontPx(labelSize(), '700');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('10 cm', x0 + len / 2, y0 - 6);
  }

  function arrowHead(x, y, angle, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size * 0.6, 0);
    ctx.lineTo(-size * 0.6, -size * 0.5);
    ctx.lineTo(-size * 0.6, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawLens(rays) {
    // Demi-hauteur : ~20 cm, mais assez grande pour couvrir les points où les
    // rayons visibles traversent la lentille (sinon ils seraient déviés dans le vide).
    var ymax = view.rect.ymax;
    var need = 0;
    rays.segments.forEach(function (s) {
      if (s.kind === 'refracted' && s.a.x === 0 && Math.abs(s.a.y) < ymax) need = Math.max(need, Math.abs(s.a.y) + 2);
    });
    var halfH = Math.min(Math.max(LENS_HALF_H, need), ymax * 0.92);
    var top = sy(halfH), bottom = sy(-halfH), x = sx(0);
    // Lentille biconvexe mince (les rayons sont déviés dans le plan x = 0)
    var bulge = clamp(view.scale * 1.6, 8, 16); // demi-épaisseur au centre (px)
    ctx.fillStyle = theme['lens-fill'];
    ctx.strokeStyle = theme.lens;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x + 2 * bulge, view.cy, x, bottom);
    ctx.quadraticCurveTo(x - 2 * bulge, view.cy, x, top);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Plan de la lentille, discret
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function axisLabel(text, x, align) {
    ctx.fillStyle = theme.label;
    ctx.font = fontPx(labelSize(), '700');
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, sy(0) + 9);
  }

  /** feetX : abscisses écran des pieds A (et A' si visible), dont l'étiquette
   *  est écrite à gauche du pied. Si un pied est juste à droite d'un foyer,
   *  l'étiquette du foyer passe à gauche du point pour ne pas se chevaucher. */
  function drawFocalPoints(feetX) {
    var f = focal();
    [[-f, 'F'], [f, "F'"]].forEach(function (p) {
      var px = sx(p[0]), py = sy(0);
      ctx.fillStyle = theme['focal-fill'];
      ctx.strokeStyle = theme['focal-stroke'];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      var crowded = feetX.some(function (fx) { return fx - px > 0.5 && fx - px < 24; });
      if (crowded) axisLabel(p[1], px - 7, 'right');
      else axisLabel(p[1], px, 'center'); // centré sous le foyer
    });
  }

  function rayColor(n) { return theme['ray' + n]; }

  function drawRays(rays) {
    var r = view.rect;
    var dashed = rays.segments.filter(function (s) { return s.kind === 'extension' || s.kind === 'construction'; });
    var solid = rays.segments.filter(function (s) { return s.kind === 'incident' || s.kind === 'refracted'; });

    ctx.lineCap = 'round';
    dashed.forEach(function (s) {
      var c = clipSegment(s.a, s.b, r);
      if (!c) return;
      ctx.strokeStyle = rayColor(s.ray);
      ctx.globalAlpha = s.kind === 'construction' ? 0.45 : 0.6;
      ctx.lineWidth = s.kind === 'construction' ? 1.4 : 2;
      ctx.setLineDash(s.kind === 'construction' ? [2, 5] : [8, 6]);
      ctx.beginPath();
      ctx.moveTo(sx(c.a.x), sy(c.a.y)); ctx.lineTo(sx(c.b.x), sy(c.b.y));
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    var head = clamp(view.w / 95, 9, 14);
    solid.forEach(function (s) {
      var c = clipSegment(s.a, s.b, r);
      if (!c) return;
      var x1 = sx(c.a.x), y1 = sy(c.a.y), x2 = sx(c.b.x), y2 = sy(c.b.y);
      ctx.strokeStyle = rayColor(s.ray);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
      var len = Math.hypot(x2 - x1, y2 - y1);
      if (len > 34) {
        arrowHead((x1 + x2) / 2, (y1 + y2) / 2, Math.atan2(y2 - y1, x2 - x1), head, rayColor(s.ray));
      }
    });
    ctx.lineCap = 'butt';
  }

  /** Flèche verticale de (x, 0) à (x, h) en coordonnées du monde. */
  function drawVerticalArrow(x, h, color, dashed) {
    var px = sx(x), y0 = sy(0), y1 = sy(h);
    var dir = h >= 0 ? -1 : 1; // sens écran de la pointe
    var head = clamp(view.w / 80, 10, 18);
    var stemEnd = y1 - dir * head * 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = dashed ? 'butt' : 'round';
    if (dashed) ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(px, y0);
    if (Math.abs(stemEnd - y0) > 1 && (stemEnd - y0) * dir > 0) ctx.lineTo(px, stemEnd);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px, y1);
    ctx.lineTo(px - head * 0.55, y1 - dir * head);
    ctx.lineTo(px + head * 0.55, y1 - dir * head);
    ctx.closePath();
    if (dashed) {
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fill();
    }
  }

  function pointLabel(text, x, y, dx, dy, align, baseline, color) {
    ctx.fillStyle = color || theme.label;
    ctx.font = fontPx(labelSize(), '700');
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, sx(x) + dx, sy(y) + dy);
  }

  function drawObject() {
    var x = -state.dObj, h = state.hObj;
    drawVerticalArrow(x, h, theme.object, false);
    // Poignée de la pointe B
    var active = state.hover === 'tip' || (state.drag && state.drag.mode === 'tip');
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.object;
    ctx.fillStyle = theme['handle-fill'];
    ctx.beginPath();
    ctx.arc(sx(x), sy(h), active ? 8 : 6, 0, 2 * Math.PI);
    ctx.globalAlpha = active ? 1 : 0.9;
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    pointLabel('A', x, 0, -8, 9, 'right', 'top');
    pointLabel('B', x, h, -10, -6, 'right', 'bottom');
  }

  function imageInView(img) {
    var r = view.rect;
    var marginX = 1, marginY = 1;
    return img.xImg > r.xmin + marginX && img.xImg < r.xmax - marginX &&
      img.hImg > r.ymin + marginY && img.hImg < r.ymax - marginY;
  }

  function drawImage(img) {
    var dashed = img.type === 'virtual';
    drawVerticalArrow(img.xImg, img.hImg, dashed ? theme['image-virtual'] : theme.image, dashed);
    var up = img.hImg >= 0;
    pointLabel("A'", img.xImg, 0, -8, up ? 9 : -9, 'right', up ? 'top' : 'bottom');
    pointLabel("B'", img.xImg, img.hImg, 10, up ? -6 : 6, 'left', up ? 'bottom' : 'top');
  }

  function badge(text) {
    var size = labelSize() + 2;
    ctx.font = fontPx(size, '700');
    var padX = 16, padY = 8;
    var tw = ctx.measureText(text).width;
    var w = tw + 2 * padX, h = size + 2 * padY;
    // En bas au centre : les coins sont occupés par les panneaux flottants.
    var x = (view.w - w) / 2, y = view.h - h - 16;
    ctx.fillStyle = theme['badge-bg'];
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.fillStyle = theme['badge-text'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  }

  function draw() {
    if (!view.rect) return;
    var f = focal();
    var rays = buildRays(f, state.dObj, state.hObj, view.rect);
    var img = rays.image;
    var hasImage = img.type !== 'infinity';
    var visible = hasImage && imageInView(img);

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawBackground();

    drawGrid();
    drawAxis();
    drawLens(rays);
    axisLabel('O', sx(0) + 7, 'left');
    if (state.showFoci) {
      var feetX = [sx(-state.dObj)];
      if (visible) feetX.push(sx(img.xImg));
      drawFocalPoints(feetX);
    }
    drawRays(rays);
    drawObject();
    if (visible) drawImage(img);
    drawScaleBar();

    if (!hasImage) badge("Image à l'infini");
    else if (!visible) badge('Image hors du champ');

    updateReadouts(img, visible);
  }

  function updateReadouts(img, visible) {
    ro.dObj.innerHTML = 'd<sub>o</sub> = ' + formatCm(state.dObj);
    ro.hObj.textContent = formatCm(state.hObj);
    if (img.type === 'infinity') {
      ro.dImg.textContent = "Image à l'infini";
      ro.hImg.textContent = "Image à l'infini";
    } else if (!visible) {
      ro.dImg.textContent = 'Image hors du champ';
      ro.hImg.textContent = 'Image hors du champ';
    } else {
      ro.dImg.innerHTML = 'd<sub>i</sub> = ' + formatCm(img.dImg);
      ro.hImg.textContent = formatCm(img.hImg);
    }
    ro.nature.textContent = natureText(img, state.hObj);
  }

  /* ---------------- Interaction ---------------- */

  function pointerPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitTest(p, pointerType) {
    var tol = pointerType === 'touch' ? 22 : 12;
    var ox = sx(-state.dObj), tipY = sy(state.hObj), footY = sy(0);
    if (Math.hypot(p.x - ox, p.y - tipY) <= tol + 2) return 'tip';
    if (Math.abs(p.x - ox) <= tol && p.y >= tipY - tol && p.y <= footY + tol) return 'body';
    return null;
  }

  canvas.addEventListener('pointerdown', function (e) {
    var p = pointerPos(e);
    var hit = hitTest(p, e.pointerType);
    if (!hit) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture facultative */ }
    state.drag = {
      mode: hit,
      pointerId: e.pointerId,
      offset: hit === 'body' ? wx(p.x) - (-state.dObj) : 0
    };
    canvas.style.cursor = 'grabbing';
    requestDraw();
  });

  canvas.addEventListener('pointermove', function (e) {
    var p = pointerPos(e);
    if (state.drag && state.drag.pointerId === e.pointerId) {
      if (state.drag.mode === 'body') {
        var x = wx(p.x) - state.drag.offset;
        state.dObj = clamp(snap(-x), D_MIN, dMax());
      } else {
        state.hObj = clamp(snap(wy(p.y)), H_MIN, hMax());
      }
      requestDraw();
      return;
    }
    var hit = hitTest(p, e.pointerType);
    if (hit !== state.hover) {
      state.hover = hit;
      canvas.style.cursor = hit ? 'grab' : 'default';
      requestDraw();
    }
  });

  function endDrag(e) {
    if (!state.drag || state.drag.pointerId !== e.pointerId) return;
    state.drag = null;
    var hit = hitTest(pointerPos(e), e.pointerType);
    state.hover = e.pointerType === 'touch' ? null : hit;
    canvas.style.cursor = state.hover ? 'grab' : 'default';
    requestDraw();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', function () {
    if (!state.drag && state.hover) {
      state.hover = null;
      canvas.style.cursor = 'default';
      requestDraw();
    }
  });

  // Clavier : flèches gauche/droite = distance, haut/bas = taille.
  canvas.addEventListener('keydown', function (e) {
    var handled = true;
    switch (e.key) {
      case 'ArrowLeft': state.dObj = clamp(state.dObj + SNAP, D_MIN, dMax()); break;
      case 'ArrowRight': state.dObj = clamp(state.dObj - SNAP, D_MIN, dMax()); break;
      case 'ArrowUp': state.hObj = clamp(state.hObj + SNAP, H_MIN, hMax()); break;
      case 'ArrowDown': state.hObj = clamp(state.hObj - SNAP, H_MIN, hMax()); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); requestDraw(); }
  });

  lensSelect.addEventListener('change', function () {
    state.lens = lensSelect.value;
    requestDraw();
  });

  fociBox.addEventListener('change', function () {
    state.showFoci = fociBox.checked;
    requestDraw();
  });

  resetBtn.addEventListener('click', function () {
    state.dObj = DEFAULTS.dObj;
    state.hObj = clamp(DEFAULTS.hObj, H_MIN, hMax());
    state.showFoci = DEFAULTS.showFoci;
    fociBox.checked = DEFAULTS.showFoci;
    requestDraw();
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(function () { resize(); }).observe(canvas);
  }
  window.addEventListener('resize', resize);
  if (window.matchMedia) {
    // Changement d'écran (ex. ordinateur vers projecteur) : nouveau devicePixelRatio.
    var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    if (mq.addEventListener) mq.addEventListener('change', resize);
  }
  resize();
  // Redessiner quand les polices web sont chargées (repli system-ui sinon).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { readTheme(); requestDraw(); });
  }
})();
