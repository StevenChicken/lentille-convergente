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
  var LEGEND_MIN_STAGE_H = 560; // en dessous, la légende flottante est repliée
  var SNAP = 0.5;            // pas d'accrochage (cm)
  var D_MIN = 1;
  var H_MIN = 1;
  var H_MAX = 15;
  var TOUCH_TARGET = 48;     // zone de saisie au doigt / stylet (px CSS, invisible)
  var DEFAULTS = { dObj: 30, hObj: 5, showFoci: true };
  var PAN_LIMIT = 200;       // défilement horizontal de la vue : centre entre -200 et +200 cm

  /* Photo du banc d'optique (fond facultatif), dessinée sous la grille.
     Coordonnées continues de l'image (bord gauche du pixel 0 = 0) :
     lensX, axisY = centre du verre de la lentille (pixels 756..781 en x,
     459..600 en y : centre 768,5 + 0,5 et 529,5 + 0,5) ;
     pxPerCm = (lensX - axe de la flèche de la lampe, 182,98 + 0,5) / 30 cm,
     pour que la flèche de la lampe tombe sous l'objet AB à d_o = 30 cm.
     enabled : mettre false pour masquer la case « Afficher le banc d'optique »
     (par ex. si banc_optique.jpg est retiré du dossier du site). */
  var BENCH = {
    enabled: true,
    src: 'banc_optique.jpg',
    imgW: 1536, imgH: 1024,
    lensX: 769.0, axisY: 530.0,
    pxPerCm: (769.0 - 183.48) / 30, // = 19,517 px par cm
    feather: 0.08                   // fondu des bords (part de la largeur)
  };

  var canvas = document.getElementById('scene');
  var ctx = canvas.getContext('2d');
  var lensSelect = document.getElementById('lens-select');
  var fociBox = document.getElementById('show-foci');
  var resetBtn = document.getElementById('reset-btn');
  var legend = document.getElementById('legend');
  var model = document.getElementById('model');
  var modelBox = document.getElementById('show-model');
  var benchBox = document.getElementById('show-bench');
  var quantBox = document.getElementById('show-quantities');
  var panRange = document.getElementById('pan-range');
  var benchImg = null;       // chargée seulement à la première activation
  var benchReady = false;
  var modelNote = document.getElementById('model-note');
  var sideStack = document.querySelector('.side-stack');
  // Blocs qui peuvent flotter sur la scène (position absolue sur grand écran).
  var floatingPanels = Array.prototype.slice.call(document.querySelectorAll('.panel-controls, .side-stack, .panel-legend'));
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
    showBench: false,
    showQuantities: false,
    drag: null,     // { mode: 'body' | 'tip', offset, pointerId }
    hover: null,    // 'body' | 'tip' | null
    legendTouched: false,
    modelTouched: false
  };

  // panX : abscisse (cm) du centre de la vue ; 0 = lentille au centre.
  var view = { w: 0, h: 0, dpr: 1, scale: 1, cx: 0, cy: 0, rect: null, panX: 0 };
  var theme = {};
  var K = 1; // facteur d'épaisseur : 1 pour des étiquettes de 16 px

  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    var names = ['scene-top', 'scene-bottom', 'grid', 'grid-major', 'axis', 'lens', 'lens-fill',
      'focal-fill', 'focal-stroke', 'label', 'scalebar', 'object', 'handle-fill', 'image',
      'image-virtual', 'ray1', 'ray2', 'ray3', 'badge-bg', 'badge-text', 'font-canvas', 'label-halo',
      'q-do', 'q-di', 'q-f', 'q-ho', 'q-hi'];
    names.forEach(function (n) { theme[n] = cs.getPropertyValue('--' + n).trim(); });
    if (!theme['font-canvas']) theme['font-canvas'] = 'system-ui, sans-serif';
    // --canvas-label-size peut contenir clamp(...) : on lit la valeur calculée sur le canevas.
    theme.labelPx = parseFloat(getComputedStyle(canvas).fontSize) || 16;
    var bo = parseFloat(cs.getPropertyValue('--bench-opacity'));
    theme.benchOpacity = isNaN(bo) ? 0.3 : bo;
    K = Math.max(0.85, theme.labelPx / 16);
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

  function sx(x) { return view.cx + (x - view.panX) * view.scale; }
  function sy(y) { return view.cy - y * view.scale; }
  function wx(px) { return (px - view.cx) / view.scale + view.panX; }

  /** Zone visible (cm) pour le décalage courant. */
  function updateRect() {
    var span = halfSpan(), halfY = (view.h / 2) / view.scale;
    view.rect = { xmin: view.panX - span, xmax: view.panX + span, ymin: -halfY, ymax: halfY };
  }

  /** Fait défiler la vue (cm) ; met à jour la barre « Faire défiler la vue ». */
  function setPan(x) {
    view.panX = clamp(Math.round(x), -PAN_LIMIT, PAN_LIMIT);
    if (panRange && +panRange.value !== view.panX) panRange.value = view.panX;
    updateRect();
    requestDraw();
  }
  function wy(py) { return (view.cy - py) / view.scale; }

  function isFloating(el) { return getComputedStyle(el).position === 'absolute'; }

  /** Légende et modèle repliés automatiquement quand la place manque
   *  (sauf si l'élève a lui-même ouvert ou fermé le panneau). */
  function updateCollapsibles() {
    var stacked = window.matchMedia && window.matchMedia('(max-width: 800px)').matches;
    var legendAuto = legend && !state.legendTouched;
    var modelAuto = model && !model.hidden && !state.modelTouched && !cover.collapsed;
    if (stacked) {
      if (legendAuto) legend.open = true;
      if (modelAuto) model.open = true;
      return;
    }
    var ws = sideStack.parentNode.getBoundingClientRect();
    if (isFloating(sideStack)) {
      ws = canvas.getBoundingClientRect(); // ne pas recouvrir la barre de défilement sous la scène
      // Panneaux flottants : légende selon la hauteur de la scène ; le modèle reste
      // au-dessus de la barre d'échelle, sinon il est replié.
      if (legendAuto) legend.open = view.h >= LEGEND_MIN_STAGE_H;
      if (modelAuto) {
        model.open = true;
        // La barre d'échelle se décale à gauche du panneau : il peut descendre jusqu'au bas de la scène.
        var gapPx = parseFloat(getComputedStyle(sideStack).top) || 10;
        if (sideStack.getBoundingClientRect().bottom > ws.bottom - gapPx) model.open = false;
      }
    } else {
      // Colonne de droite (écran étroit ou bas) : on ouvre ce qui tient, la légende cède en premier.
      if (legendAuto) legend.open = true;
      if (modelAuto) model.open = true;
      var bottom = function (el) { return el.getBoundingClientRect().bottom; };
      if (legendAuto && bottom(legend) > ws.bottom - 2) legend.open = false;
      if (modelAuto && bottom(legend) > ws.bottom - 2) model.open = false;
    }
  }

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
    updateRect();
    state.hObj = clamp(state.hObj, H_MIN, hMax());
    state.dObj = clamp(state.dObj, D_MIN, dMax());
    readTheme();
    updateCollapsibles();
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

  /** Rectangles (px CSS, repère du canevas) des panneaux qui flottent sur la scène. */
  function panelObstacles() {
    var c = canvas.getBoundingClientRect();
    var out = [];
    floatingPanels.forEach(function (el) {
      if (!isFloating(el)) return;
      var r = el.getBoundingClientRect();
      out.push({ x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top });
    });
    return out;
  }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, theme['scene-top']);
    g.addColorStop(1, theme['scene-bottom']);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  /** Photo du banc : le point (lensX, axisY) de l'image tombe sur le centre O,
   *  échelle = (px écran par cm) / (px image par cm). */
  function drawBench() {
    if (!BENCH.enabled || !state.showBench || !benchReady) return;
    var w = BENCH.imgW || benchImg.naturalWidth, h = BENCH.imgH || benchImg.naturalHeight;
    var k = view.scale / BENCH.pxPerCm;
    ctx.save();
    ctx.globalAlpha = theme.benchOpacity;
    ctx.drawImage(benchFeathered || benchImg, sx(0) - BENCH.lensX * k, sy(0) - BENCH.axisY * k, w * k, h * k);
    ctx.restore();
  }

  /** Copie de la photo avec les 4 bords en fondu (masque alpha), préparée une fois. */
  var benchFeathered = null;
  function featherBench() {
    var w = BENCH.imgW || benchImg.naturalWidth, h = BENCH.imgH || benchImg.naturalHeight;
    var off = document.createElement('canvas');
    off.width = w; off.height = h;
    var c = off.getContext('2d');
    c.drawImage(benchImg, 0, 0, w, h);
    var f = BENCH.feather * w;               // même largeur de fondu sur les 4 côtés
    c.globalCompositeOperation = 'destination-in';
    var gx = c.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)');
    gx.addColorStop(f / w, 'rgba(0,0,0,1)');
    gx.addColorStop(1 - f / w, 'rgba(0,0,0,1)');
    gx.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gx; c.fillRect(0, 0, w, h);
    var gy = c.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(f / h, 'rgba(0,0,0,1)');
    gy.addColorStop(1 - f / h, 'rgba(0,0,0,1)');
    gy.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gy; c.fillRect(0, 0, w, h);
    benchFeathered = off;
  }

  function loadBench() {
    if (benchImg || !BENCH.enabled) return;
    benchImg = new Image();
    benchImg.onload = function () {
      try { featherBench(); } catch (e) { benchFeathered = null; } // repli : photo sans fondu
      benchReady = true; requestDraw();
    };
    benchImg.onerror = function () {
      if (window.console) console.warn('Image du banc introuvable : ' + BENCH.src);
    };
    benchImg.src = BENCH.src;
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
    ctx.lineWidth = 1.5 * K;
    ctx.setLineDash([7 * K, 6 * K]);
    ctx.beginPath();
    ctx.moveTo(0, sy(0)); ctx.lineTo(view.w, sy(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Barre d'échelle en bas à droite (le bas gauche est occupé par la légende).
  // Bord droit disponible pour la barre d'échelle : à gauche des panneaux qui descendent en bas à droite.
  var scaleBarRight = 0;
  function computeScaleBarRight(obstacles) {
    var m = 18 * K, right = view.w - m, zoneTop = view.h - 4 * labelSize();
    obstacles.forEach(function (o) {
      if (o.y1 > zoneTop && o.x1 > view.w / 2) right = Math.min(right, o.x0 - m);
    });
    scaleBarRight = right;
  }

  function scaleBarRect() {
    var len = 10 * view.scale, m = 18 * K, t = 5 * K;
    var x0 = (scaleBarRight || view.w - m) - len, y0 = view.h - m;
    return { x0: x0 - labelSize(), y0: y0 - t - 2 - labelSize(), x1: x0 + len + labelSize(), y1: y0 + t };
  }

  function drawScaleBar() {
    var len = 10 * view.scale;
    var m = 18 * K;
    var x0 = (scaleBarRight || view.w - m) - len, y0 = view.h - m;
    var t = 5 * K;
    ctx.strokeStyle = theme.scalebar;
    ctx.fillStyle = theme.scalebar;
    ctx.lineWidth = 2 * K;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - t); ctx.lineTo(x0, y0 + t);
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + len, y0);
    ctx.moveTo(x0 + len, y0 - t); ctx.lineTo(x0 + len, y0 + t);
    ctx.stroke();
    ctx.font = fontPx(labelSize(), '700');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    haloText('10 cm', x0 + len / 2, y0 - t - 2);
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

  function lensBulge() { return clamp(view.scale * 1.6, 8 * K, 18 * K); }

  /** Demi-hauteur dessinée de la lentille (cm).
   *  ~20 cm, agrandie pour couvrir les points où les rayons visibles traversent
   *  la lentille, puis réduite si un panneau flottant ou le badge la recouvrirait. */
  function lensHalfHeight(rays, obstacles) {
    var ymax = view.rect.ymax;
    var need = 0;
    rays.segments.forEach(function (s) {
      if (s.kind === 'refracted' && s.a.x === 0 && Math.abs(s.a.y) < ymax) need = Math.max(need, Math.abs(s.a.y) + 2);
    });
    var halfPx = Math.min(Math.max(LENS_HALF_H, need), ymax * 0.92) * view.scale;
    var x = sx(0), bulge = lensBulge() + 6;
    var margin = 8 * K;
    obstacles.forEach(function (o) {
      if (o.x1 < x - bulge || o.x0 > x + bulge) return; // pas dans la colonne de la lentille
      if (o.y1 <= view.cy) halfPx = Math.min(halfPx, view.cy - o.y1 - margin);
      else if (o.y0 >= view.cy) halfPx = Math.min(halfPx, o.y0 - view.cy - margin);
    });
    return Math.max(halfPx, 30 * K) / view.scale;
  }

  function drawLens(halfH) {
    var top = sy(halfH), bottom = sy(-halfH), x = sx(0);
    // Lentille biconvexe mince (les rayons sont déviés dans le plan x = 0)
    var bulge = lensBulge();
    ctx.fillStyle = theme['lens-fill'];
    ctx.strokeStyle = theme.lens;
    ctx.lineWidth = 2 * K;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x + 2 * bulge, view.cy, x, bottom);
    ctx.quadraticCurveTo(x - 2 * bulge, view.cy, x, top);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Plan de la lentille, discret
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1 * K;
    ctx.beginPath();
    ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return { x0: x - bulge, y0: top, x1: x + bulge, y1: bottom };
  }

  /** Texte avec un halo clair dessous : reste lisible quand un rayon le traverse. */
  function haloText(text, x, y) {
    ctx.save();
    ctx.strokeStyle = theme['label-halo'] || '#ffffff';
    ctx.lineWidth = 4 * K;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.restore();
    ctx.fillText(text, x, y);
  }

  function axisLabel(text, x, align, dy) {
    ctx.fillStyle = theme.label;
    ctx.font = fontPx(labelSize(), '700');
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    haloText(text, x, sy(0) + (dy || 9 * K));
  }

  /** feetX : abscisses écran des pieds A (et A' si visible), dont l'étiquette
   *  est écrite à gauche du pied. Si un pied est juste à droite d'un foyer,
   *  l'étiquette du foyer passe à gauche du point pour ne pas se chevaucher. */
  function drawFocalPoints(feetX) {
    var f = focal();
    var rad = 6.5 * K;
    [[-f, 'F'], [f, "F'"]].forEach(function (p) {
      var px = sx(p[0]), py = sy(0);
      ctx.fillStyle = theme['focal-fill'];
      ctx.strokeStyle = theme['focal-stroke'];
      ctx.lineWidth = 1.5 * K;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      var crowded = feetX.some(function (fx) { return fx - px > 0.5 && fx - px < 2.4 * labelSize(); });
      if (crowded) axisLabel(p[1], px - rad - 2, 'right');
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
      var construction = s.kind === 'construction';
      ctx.strokeStyle = rayColor(s.ray);
      // Prolongements : même couleur et épaisseur que les rayons, en tirets.
      ctx.globalAlpha = construction ? 0.7 : 1;
      ctx.lineWidth = (construction ? 1.4 : 2) * K; // rayons fins : flèches AB et A'B' bien plus épaisses
      ctx.setLineDash(construction ? [4 * K, 5 * K] : [10 * K, 7 * K]);
      ctx.beginPath();
      ctx.moveTo(sx(c.a.x), sy(c.a.y)); ctx.lineTo(sx(c.b.x), sy(c.b.y));
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    var head = Math.min(12 * K, view.w / 45);
    // Flèches des rayons incidents décalées le long du segment : elles ne s'empilent pas près de B.
    var frac = { 1: 0.5, 2: 0.3, 3: 0.7 };
    solid.forEach(function (s) {
      var c = clipSegment(s.a, s.b, r);
      if (!c) return;
      var x1 = sx(c.a.x), y1 = sy(c.a.y), x2 = sx(c.b.x), y2 = sy(c.b.y);
      ctx.strokeStyle = rayColor(s.ray);
      ctx.lineWidth = 2 * K;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
      var len = Math.hypot(x2 - x1, y2 - y1);
      var hd = Math.min(head, len / 3); // pas de flèches empilées sur les segments courts
      if (hd >= 7) {
        var t = s.kind === 'incident' ? frac[s.ray] : 0.5;
        arrowHead(x1 + t * (x2 - x1), y1 + t * (y2 - y1), Math.atan2(y2 - y1, x2 - x1), hd, rayColor(s.ray));
      }
    });
    ctx.lineCap = 'butt';
  }

  /** Flèche verticale de (x, 0) à (x, h) en coordonnées du monde. */
  function drawVerticalArrow(x, h, color, dashed) {
    var px = sx(x), y0 = sy(0), y1 = sy(h);
    var dir = h >= 0 ? -1 : 1; // sens écran de la pointe
    var len = Math.abs(y1 - y0);
    // Tête bornée par la longueur de la flèche, mais toujours visible sur une petite scène.
    var head = Math.min(19 * K, Math.max(0.4 * len, Math.min(9, 0.8 * len)));
    var stemEnd = y1 - dir * head * 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5.5 * K; // flèches objet / image : au moins 2,5 fois l'épaisseur des rayons
    ctx.lineCap = dashed ? 'butt' : 'round';
    if (dashed) ctx.setLineDash([8 * K, 6 * K]);
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
    ctx.fill();
  }

  /** Écrit une étiquette et renvoie son rectangle (px CSS). */
  function pointLabel(text, x, y, dx, dy, align, baseline) {
    ctx.fillStyle = theme.label;
    ctx.font = fontPx(labelSize(), '700');
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    var px = sx(x) + dx, py = sy(y) + dy;
    haloText(text, px, py);
    var w = ctx.measureText(text).width, h = labelSize();
    var x0 = align === 'right' ? px - w : align === 'center' ? px - w / 2 : px;
    var y0 = baseline === 'bottom' ? py - h : baseline === 'middle' ? py - h / 2 : py;
    return { x0: x0, y0: y0, x1: x0 + w, y1: y0 + h };
  }

  function union(a, b) {
    return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
  }

  function drawObject() {
    var x = -state.dObj, h = state.hObj;
    drawVerticalArrow(x, h, theme.object, false);
    // Poignée de la pointe B
    var active = state.hover === 'tip' || (state.drag && state.drag.mode === 'tip');
    // Poignée plus petite si la flèche est courte, pour laisser voir sa pointe.
    var rad = Math.max(4, Math.min((active ? 9 : 7) * K, 0.28 * Math.abs(sy(h) - sy(0))));
    ctx.lineWidth = 2.5 * K;
    ctx.strokeStyle = theme.object;
    ctx.fillStyle = theme['handle-fill'];
    ctx.beginPath();
    ctx.arc(sx(x), sy(h), rad, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    var box = { x0: sx(x) - rad, y0: sy(h) - rad, x1: sx(x) + rad, y1: sy(0) };
    box = union(box, pointLabel('A', x, 0, -9 * K, 9 * K, 'right', 'top'));
    box = union(box, pointLabel('B', x, h, -11 * K, -6 * K, 'right', 'bottom'));
    return box;
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
    var hw = 10 * K;
    var box = { x0: sx(img.xImg) - hw, y0: Math.min(sy(0), sy(img.hImg)), x1: sx(img.xImg) + hw, y1: Math.max(sy(0), sy(img.hImg)) };
    box = union(box, pointLabel("A'", img.xImg, 0, -9 * K, up ? 9 * K : -9 * K, 'right', up ? 'top' : 'bottom'));
    box = union(box, pointLabel("B'", img.xImg, img.hImg, 11 * K, up ? -6 * K : 6 * K, 'left', up ? 'bottom' : 'top'));
    return box;
  }

  function overlaps(a, b) { return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1; }


  /* ---------------- Grandeurs : cotes de d_o, d_i, f, h_o, h_i ----------------
     Case « Afficher les grandeurs ». Les traits sont dessinés sous les rayons,
     les étiquettes (avec halo) au-dessus de tout. Niveaux sous l'axe : d_o au
     niveau 1 ; d_i au niveau 1 (image réelle, à droite) ou 2 (virtuelle, à
     gauche, sous d_o) ; f au premier niveau libre à droite. */

  function qColor(name) { return theme['q-' + name] || theme.label; }

  /** Hauteur (y écran) du niveau n de cotes sous l'axe. */
  function coteLevelY(n) {
    var L = labelSize();
    return sy(0) + 17 * K + 1.5 * L + (n - 1) * (1.3 * L + 6 * K);
  }

  /** Symbole en italique + indice (+ texte facultatif), centré verticalement sur y. */
  function symbolParts(main, sub, extra) {
    var L = labelSize();
    var parts = [{ t: main, font: 'italic 700 ' + (0.95 * L) + 'px ' + theme['font-canvas'], dy: 0 }];
    if (sub) parts.push({ t: sub, font: '700 ' + (0.66 * L) + 'px ' + theme['font-canvas'], dy: 0.3 * L });
    if (extra) parts.push({ t: extra, font: '600 ' + (0.72 * L) + 'px ' + theme['font-canvas'], dy: 0.05 * L });
    var w = 0;
    parts.forEach(function (p) { ctx.font = p.font; p.w = ctx.measureText(p.t).width; w += p.w; });
    if (extra) w += 0.25 * L; // espace avant le texte ajouté
    return { parts: parts, w: w, h: L };
  }

  function drawSymbol(sym, x, y, color, align) {
    var x0 = align === 'right' ? x - sym.w : align === 'left' ? x : x - sym.w / 2;
    var cx = x0;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    sym.parts.forEach(function (p, i) {
      if (i === 2) cx += 0.25 * labelSize();
      ctx.font = p.font;
      haloText(p.t, cx, y + p.dy);
      cx += p.w;
    });
    return { x0: x0, y0: y - sym.h / 2, x1: x0 + sym.w, y1: y + sym.h / 2 + 0.3 * labelSize() };
  }

  /** Trait de cote avec flèches aux deux bouts (ou petits traits si trop court). */
  function coteLine(xa, ya, xb, yb, color, dashed) {
    var head = 9 * K;
    var len = Math.hypot(xb - xa, yb - ya);
    var ang = Math.atan2(yb - ya, xb - xa);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * K;
    if (dashed) ctx.setLineDash([6 * K, 4 * K]);
    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    ctx.setLineDash([]);
    if (len >= 2.6 * head) {
      // pointes exactement sur les extrémités
      arrowHead(xa + Math.cos(ang) * 0.6 * head, ya + Math.sin(ang) * 0.6 * head, ang + Math.PI, head, color);
      arrowHead(xb - Math.cos(ang) * 0.6 * head, yb - Math.sin(ang) * 0.6 * head, ang, head, color);
    } else {
      var t = 5 * K, nx = -Math.sin(ang), ny = Math.cos(ang);
      ctx.beginPath();
      ctx.moveTo(xa - nx * t, ya - ny * t); ctx.lineTo(xa + nx * t, ya + ny * t);
      ctx.moveTo(xb - nx * t, yb - ny * t); ctx.lineTo(xb + nx * t, yb + ny * t);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Ligne de rappel fine (pointillés) entre un point du schéma et sa cote. */
  function extLine(xa, ya, xb, yb, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1 * K;
    ctx.setLineDash([3 * K, 3 * K]);
    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke();
    ctx.restore();
  }

  /** Calcule les cotes à dessiner (coordonnées écran) pour l'état courant. */
  function quantityCotes(img, visible) {
    var list = [];
    var xO = sx(0), y0 = sy(0), xA = sx(-state.dObj), yB = sy(state.hObj);
    var realShown = visible && img.type === 'real';
    var virtShown = visible && img.type === 'virtual';
    var gap = 18 * K; // écart entre la flèche et sa cote verticale
    list.push({ name: 'do', kind: 'h', x0: xA, x1: xO, y: coteLevelY(1), sym: ['d', 'o'], outside: -1 });
    if (visible) {
      var xI = sx(img.xImg), yBi = sy(img.hImg);
      if (realShown) list.push({ name: 'di', kind: 'h', x0: xO, x1: xI, y: coteLevelY(1), sym: ['d', 'i'], outside: 1 });
      else list.push({ name: 'di', kind: 'h', x0: xI, x1: xO, y: coteLevelY(2), sym: ['d', 'i', '(< 0)'], dashed: true, outside: -1 });
      // Image réelle : cote à droite de A'B' (l'étiquette B' est sous la pointe) ;
      // image virtuelle : à gauche (les prolongements arrivent par la droite).
      var side = realShown ? 1 : -1;
      list.push({ name: 'hi', kind: 'v', x: xI + side * gap, xPoint: xI, y0: y0, y1: yBi, sym: ['h', 'i'], dashed: virtShown, side: side });
    }
    if (state.showFoci) {
      var lvl = realShown ? 2 : 1;
      list.push({ name: 'f', kind: 'h', x0: xO, x1: sx(focal()), y: coteLevelY(lvl), sym: ['f', ''], outside: 1, vergence: true });
    }
    list.push({ name: 'ho', kind: 'v', x: xA - gap, xPoint: xA, y0: y0, y1: yB, sym: ['h', 'o'], side: -1 });
    return list;
  }

  function drawQuantityLines(cotes) {
    var y0 = sy(0);
    cotes.forEach(function (c) {
      var col = qColor(c.name === 'f' ? 'f' : c.name);
      if (c.kind === 'h') {
        extLine(c.x0, y0 + 4 * K, c.x0, c.y + 5 * K, col);
        extLine(c.x1, y0 + 4 * K, c.x1, c.y + 5 * K, col);
        coteLine(c.x0, c.y, c.x1, c.y, col, c.dashed);
      } else {
        extLine(c.xPoint, c.y1, c.x + c.side * 5 * K, c.y1, col); // rappel depuis la pointe B ou B'
        coteLine(c.x, c.y0, c.x, c.y1, col, c.dashed);
      }
    });
  }

  function drawQuantityLabels(cotes) {
    var L = labelSize();
    cotes.forEach(function (c) {
      var col = qColor(c.name);
      var sym = symbolParts(c.sym[0], c.sym[1], c.sym[2]);
      if (c.kind === 'h') {
        var len = Math.abs(c.x1 - c.x0);
        if (len >= sym.w + 4 * 9 * K) {
          c.label = drawSymbol(sym, (c.x0 + c.x1) / 2, c.y, col, 'center');
        } else if (c.outside < 0) {
          c.label = drawSymbol(sym, Math.min(c.x0, c.x1) - 6 * K, c.y, col, 'right');
        } else {
          c.label = drawSymbol(sym, Math.max(c.x0, c.x1) + 6 * K, c.y, col, 'left');
        }
        if (c.vergence) {
          // « V = 1/f » juste après la cote de f (V n'est pas une longueur)
          var vx = Math.max(c.x1, c.label ? c.label.x1 : c.x1) + 10 * K;
          var v = symbolParts('V', '', '= 1/f');
          drawSymbol(v, vx, c.y, col, 'left');
        }
      } else {
        c.label = drawSymbol(sym, c.x + c.side * 6 * K, (c.y0 + c.y1) / 2, col, c.side > 0 ? 'left' : 'right');
      }
    });
  }

  /** Rectangle du badge, calculé avant de dessiner la lentille : en bas au centre,
   *  ou en haut au centre s'il toucherait la barre d'échelle ou un panneau. */
  function badgeRect(text, obstacles, shortText) {
    var size = labelSize() + 2;
    ctx.font = fontPx(size, '700');
    var padX = 16 * K, padY = 8 * K, m = 16 * K;
    // Texte court si le texte complet ne tient pas (téléphone).
    if (shortText && ctx.measureText(text).width + 2 * padX > view.w - 2 * m) text = shortText;
    var w = ctx.measureText(text).width + 2 * padX, h = size + 2 * padY;
    var x = (view.w - w) / 2;
    var avoid = obstacles.concat([scaleBarRect()]);
    var candidates = [view.h - h - m, m];
    for (var i = 0; i < candidates.length; i++) {
      var r = { x0: x, y0: candidates[i], x1: x + w, y1: candidates[i] + h, text: text, size: size };
      if (!avoid.some(function (o) { return overlaps(o, r); })) return r;
    }
    return { x0: x, y0: candidates[0], x1: x + w, y1: candidates[0] + h, text: text, size: size };
  }

  function drawBadge(b) {
    var w = b.x1 - b.x0, h = b.y1 - b.y0;
    ctx.fillStyle = theme['badge-bg'];
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x0, b.y0, w, h, h / 2); else ctx.rect(b.x0, b.y0, w, h);
    ctx.fill();
    ctx.fillStyle = theme['badge-text'];
    ctx.font = fontPx(b.size, '700');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, b.x0 + w / 2, b.y0 + h / 2 + 1);
  }

  /** Décalage de la vue (cm) qui montre l'image, avec la lentille si possible.
   *  null si l'image est trop loin, ou trop haute pour l'écran (le défilement est horizontal). */
  function panTarget(img) {
    if (img.type === 'infinity' || Math.abs(img.hImg) >= view.rect.ymax - 1) return null;
    var span = halfSpan(), x = img.xImg;
    // Lentille et image ensemble si possible ; sinon l'image un peu du côté de la lentille,
    // loin des panneaux Mesures / Modèle (à droite).
    var t = Math.abs(x) < 2 * span - 8 ? x / 2 : x + (x > 0 ? 1 : -1) * 0.15 * span;
    t = clamp(Math.round(t), -PAN_LIMIT, PAN_LIMIT);
    return Math.abs(x - t) < span - 2 ? t : null;
  }

  var badge = null; // badge courant (cliquable s'il porte une cible de défilement)

  function draw() {
    if (!view.rect) return;
    var f = focal();
    var rays = buildRays(f, state.dObj, state.hObj, view.rect);
    var img = rays.image;
    var hasImage = img.type !== 'infinity';
    var visible = hasImage && imageInView(img);

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawBackground();
    drawBench();

    var obstacles = panelObstacles();
    computeScaleBarRight(obstacles);
    badge = null;
    if (!hasImage) badge = badgeRect("Image à l'infini", obstacles);
    else if (!visible) {
      var target = panTarget(img);
      if (target === null) badge = badgeRect('Image hors du champ', obstacles);
      else {
        var right = img.xImg > view.panX;
        badge = badgeRect('Image hors du champ : faites défiler vers la ' + (right ? 'droite →' : 'gauche ←'),
          obstacles, right ? 'Image hors du champ →' : '← Image hors du champ');
        badge.target = target;
      }
    }
    if (badge) obstacles.push(badge);

    drawGrid();
    drawAxis();
    var lensBox = drawLens(lensHalfHeight(rays, obstacles));
    var cotes = state.showQuantities ? quantityCotes(img, visible) : [];
    var isH = function (c) { return c.kind === 'h'; };
    drawQuantityLines(cotes.filter(isH));   // cotes horizontales sous les rayons
    drawRays(rays);
    // Cotes verticales au-dessus des rayons : la pointe de h_i reste visible
    // sur le rayon 3, qui passe exactement par B'.
    drawQuantityLines(cotes.filter(function (c) { return !isH(c); }));
    // Foyers et O après les rayons : points et étiquettes (avec halo) restent au-dessus.
    if (state.showFoci) {
      var feetX = [sx(-state.dObj)];
      if (visible) feetX.push(sx(img.xImg));
      drawFocalPoints(feetX);
    }
    axisLabel('O', sx(0) + 10 * K, 'left', 11 * K); // en bas à droite du centre optique
    var objBox = drawObject();
    var imgBox = visible ? drawImage(img) : null;
    drawQuantityLabels(cotes);  // étiquettes au-dessus de tout (avec halo)
    drawScaleBar();
    if (badge) drawBadge(badge);

    ghostPanels([objBox, imgBox]);

    // Géométrie exposée pour les tests de mise en page (aucun effet visible).
    canvas.setAttribute('data-geom', JSON.stringify({ lens: lensBox, object: objBox, image: imgBox, badge: badge,
      panX: view.panX, scale: view.scale, cx: view.cx, cy: view.cy,
      cotes: cotes.map(function (c) {
        return c.kind === 'h' ? { name: c.name, x0: c.x0, x1: c.x1, y: c.y, dashed: !!c.dashed }
                              : { name: c.name, x: c.x, xPoint: c.xPoint, y0: c.y0, y1: c.y1, dashed: !!c.dashed };
      }) }));

    updateReadouts(img, visible);
  }

  function relRect(el) {
    var c = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top };
  }

  function hitsAny(rect, boxes) {
    return !!rect && boxes.some(function (b) { return b && overlaps(rect, b); });
  }

  /** Réglages et légende flottants : presque transparents s'ils recouvrent l'objet
   *  ou l'image (opaques au survol). Les Mesures ne s'estompent jamais. */
  function ghostPanels(boxes) {
    floatingPanels.forEach(function (el) {
      if (el === sideStack) { el.classList.remove('is-ghost'); return; }
      el.classList.toggle('is-ghost', isFloating(el) && hitsAny(relRect(el), boxes));
    });
    handleModelCover(boxes);
  }

  /** Modèle flottant au-dessus de l'objet ou de l'image : on le replie sur son titre
   *  (sauf si l'élève l'a rouvert pendant ce temps), et on le rouvre quand la place
   *  redevient libre. S'il gêne encore une fois replié, seul le Modèle s'estompe. */
  var cover = { collapsed: false, openRect: null, forcedOpen: false };
  function handleModelCover(boxes) {
    if (!model || model.hidden || !isFloating(sideStack)) {
      cover.collapsed = false; cover.forcedOpen = false; cover.openRect = null;
      if (model) model.classList.remove('is-ghost');
      return;
    }
    var rect = relRect(model);
    var ghost = false;
    if (cover.collapsed) {
      if (model.open) {
        // L'élève l'a rouvert pendant que l'image est dessous : on le laisse, estompé.
        cover.collapsed = false; cover.forcedOpen = true;
        ghost = hitsAny(rect, boxes);
      } else if (hitsAny(cover.openRect, boxes)) {
        ghost = hitsAny(rect, boxes);           // toujours sous le titre replié ?
      } else {
        cover.collapsed = false; cover.openRect = null;
        model.open = true;                       // place libre : on rouvre
        updateCollapsibles();                    // ... sauf si la hauteur manque
      }
    } else if (model.open) {
      if (hitsAny(rect, boxes)) {
        if (cover.forcedOpen) ghost = true;
        else { cover.collapsed = true; cover.openRect = rect; model.open = false; }
      } else {
        cover.forcedOpen = false;
      }
    }
    model.classList.toggle('is-ghost', ghost);
  }

  function updateReadouts(img, visible) {
    ro.dObj.innerHTML = 'd<sub>o</sub> = ' + formatCm(state.dObj);
    ro.hObj.textContent = formatCm(state.hObj);
    if (img.type === 'infinity') {
      ro.dImg.textContent = "Image à l'infini";
      ro.hImg.textContent = "Image à l'infini";
    } else {
      // Valeurs vraies même si l'image est hors de la vue (on peut la retrouver en faisant défiler).
      ro.dImg.innerHTML = 'd<sub>i</sub> = ' + formatCm(img.dImg);
      ro.hImg.textContent = formatCm(img.hImg);
    }
    ro.nature.textContent = natureText(img, state.hObj);
    if (modelNote) modelNote.classList.toggle('is-active', img.type === 'virtual');
  }

  /* ---------------- Interaction ---------------- */

  function pointerPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Zones de saisie : au moins 48 px au doigt ou au stylet (tableau interactif). */
  function hitTest(p, pointerType) {
    var tol = pointerType === 'mouse' ? 12 * K : Math.max(TOUCH_TARGET / 2, 12 * K);
    var ox = sx(-state.dObj), tipY = sy(state.hObj), footY = sy(0);
    if (Math.abs(p.x - ox) > tol || p.y < tipY - tol || p.y > footY + tol) return null;
    // Haut de la flèche = pointe B ; si l'objet est petit, on partage la zone en deux.
    var split = tipY + Math.min(tol, (footY - tipY) / 2);
    return p.y <= split ? 'tip' : 'body';
  }

  function onBadge(p) {
    return !!(badge && badge.target !== undefined &&
      p.x >= badge.x0 && p.x <= badge.x1 && p.y >= badge.y0 && p.y <= badge.y1);
  }

  canvas.addEventListener('pointerdown', function (e) {
    var p = pointerPos(e);
    var hit = hitTest(p, e.pointerType);
    if (!hit && onBadge(p)) {         // badge « hors du champ » : aller à l'image
      e.preventDefault();
      setPan(badge.target);
      return;
    }
    if (!hit && e.button > 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture facultative */ }
    if (!hit) {
      // Zone vide : glisser fait défiler la vue horizontalement.
      state.drag = { mode: 'pan', pointerId: e.pointerId, startX: p.x, startPan: view.panX };
    } else {
      state.drag = {
        mode: hit,
        pointerId: e.pointerId,
        offset: hit === 'body' ? wx(p.x) - (-state.dObj) : wy(p.y) - state.hObj
      };
    }
    canvas.style.cursor = 'grabbing';
    requestDraw();
  });

  canvas.addEventListener('pointermove', function (e) {
    var p = pointerPos(e);
    if (state.drag && state.drag.pointerId === e.pointerId) {
      if (state.drag.mode === 'pan') {
        setPan(state.drag.startPan - (p.x - state.drag.startX) / view.scale);
        return;
      }
      if (state.drag.mode === 'body') {
        var x = wx(p.x) - state.drag.offset;
        state.dObj = clamp(snap(-x), D_MIN, dMax());
      } else {
        state.hObj = clamp(snap(wy(p.y) - state.drag.offset), H_MIN, hMax());
      }
      requestDraw();
      return;
    }
    var hit = hitTest(p, e.pointerType);
    if (hit !== state.hover) {
      state.hover = hit;
      requestDraw();
    }
    canvas.style.cursor = hit ? 'grab' : onBadge(p) ? 'pointer' : 'default';
  });

  // Pavé tactile (défilement horizontal) ou Maj + molette : fait défiler la vue.
  canvas.addEventListener('wheel', function (e) {
    var dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!dx) return;               // molette verticale seule : la page défile normalement
    e.preventDefault();
    var px = e.deltaMode === 1 ? dx * 16 : dx;
    setPan(view.panX + px / view.scale);
  }, { passive: false });

  if (panRange) {
    panRange.min = -PAN_LIMIT; panRange.max = PAN_LIMIT; panRange.value = 0;
    panRange.addEventListener('input', function () { setPan(+panRange.value); });
  }

  function endDrag(e) {
    if (!state.drag || state.drag.pointerId !== e.pointerId) return;
    state.drag = null;
    var p = pointerPos(e), hit = hitTest(p, e.pointerType);
    state.hover = e.pointerType === 'mouse' ? hit : null;
    canvas.style.cursor = state.hover ? 'grab' : onBadge(p) ? 'pointer' : 'default';
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

  var benchControl = document.getElementById('bench-control');
  if (benchControl) benchControl.hidden = !BENCH.enabled;

  if (quantBox) {
    quantBox.checked = false; // décochée au chargement ; « Réinitialiser » n'y touche pas
    quantBox.addEventListener('change', function () {
      state.showQuantities = quantBox.checked;
      document.body.classList.toggle('show-quantities', state.showQuantities);
      requestDraw();
    });
  }
  if (benchBox && BENCH.enabled) {
    benchBox.checked = false; // décochée au chargement (pas de restauration du navigateur)
    benchBox.addEventListener('change', function () {
      state.showBench = benchBox.checked;
      if (state.showBench) loadBench();
      requestDraw();
    });
  }

  if (modelBox && model) {
    model.hidden = !modelBox.checked;
    modelBox.addEventListener('change', function () {
      model.hidden = !modelBox.checked;
      updateCollapsibles();
      requestDraw();
    });
    model.querySelector('summary').addEventListener('click', function () { state.modelTouched = true; });
    model.addEventListener('toggle', requestDraw);
  }

  fociBox.addEventListener('change', function () {
    state.showFoci = fociBox.checked;
    requestDraw();
  });

  resetBtn.addEventListener('click', function () {
    state.dObj = DEFAULTS.dObj;
    state.hObj = clamp(DEFAULTS.hObj, H_MIN, hMax());
    state.showFoci = DEFAULTS.showFoci;
    fociBox.checked = DEFAULTS.showFoci;
    setPan(0);
    requestDraw();
  });

  if (legend) {
    // Un clic de l'élève sur « Rayons » a priorité sur le repli automatique.
    legend.querySelector('summary').addEventListener('click', function () { state.legendTouched = true; });
    legend.addEventListener('toggle', requestDraw);
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(function () { resize(); }).observe(canvas);
    // Les panneaux changent de taille (polices chargées, légende repliée) : la lentille s'adapte.
    var panelObserver = new ResizeObserver(function () { requestDraw(); });
    floatingPanels.forEach(function (el) { panelObserver.observe(el); });
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
    document.fonts.ready.then(function () { readTheme(); updateCollapsibles(); requestDraw(); });
  }
})();
