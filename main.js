const HEX_VERTS = [
  [50, 3],
  [92, 27],
  [92, 73],
  [50, 97],
  [8, 73],
  [8, 27],
];

const ROTATION_PERIOD_MS = 8000;
const MIN_LINE_WIDTH = 120;
const LITE_MEDIA_QUERY = '(max-width: 767px), (hover: none) and (pointer: coarse)';

initThemeToggle();
initEditorial();

function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  const label = btn.querySelector('.theme-label');
  const html = document.documentElement;

  const saved = localStorage.getItem('nd-theme') || 'dark';
  apply(saved);

  btn.addEventListener('click', () => {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    localStorage.setItem('nd-theme', next);
    window.dispatchEvent(new CustomEvent('themechange'));
  });

  function apply(theme) {
    html.dataset.theme = theme;
    if (label) {
      label.textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
    }
  }
}

function initEditorial() {
  const html = document.documentElement;
  const liteMql = window.matchMedia(LITE_MEDIA_QUERY);

  // Phones and coarse-pointer devices (iPhone, iPad in hand-held orientation,
  // Android) can't afford per-frame canvas re-typesetting without risking a
  // renderer crash. Fall back to the original flow with a CSS-only hex spin.
  if (liteMql.matches) {
    html.classList.add('editorial-lite');
    return;
  }

  import('@chenglou/pretext').then((pretext) => {
    initEditorialEngine(pretext);
  });
}

function initEditorialEngine(pretext) {
  const { clearCache, layoutNextLineRange, materializeLineRange, prepareWithSegments } = pretext;

  const html = document.documentElement;
  const stage = document.querySelector('.editorial-stage');
  const canvas = document.querySelector('.article-canvas');
  const source = document.querySelector('.editorial-source');
  const wire = document.querySelector('.cube-wire');

  if (!(stage instanceof HTMLElement)) return;
  if (!(canvas instanceof HTMLCanvasElement)) return;
  if (!(source instanceof HTMLElement)) return;
  if (!(wire instanceof SVGElement)) return;

  const paragraphs = Array.from(source.querySelectorAll('p'));
  if (!paragraphs.length) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const startTime = performance.now();
  const preparedState = {
    key: '',
    items: [],
  };

  let rafId = 0;
  let renderPending = false;
  let stageVisible = false;
  let stageInView = true;

  stage.style.display = 'block';
  stage.style.visibility = 'hidden';

  const resizeObserver = new ResizeObserver(() => {
    requestRender();
  });

  resizeObserver.observe(stage);
  source.parentElement && resizeObserver.observe(source.parentElement);

  // Pause the animation when the stage isn't visible — on long pages this
  // avoids burning battery and layout work on off-screen content.
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        stageInView = visible;
        if (visible) {
          requestRender();
        } else if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(stage);
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      preparedState.key = '';
      requestRender();
    });
  }

  if (document.fonts?.addEventListener) {
    document.fonts.addEventListener('loadingdone', () => {
      preparedState.key = '';
      requestRender();
    });
  }

  window.addEventListener('resize', requestRender, { passive: true });
  window.addEventListener('themechange', requestRender);
  reduce.addEventListener('change', () => {
    if (reduce.matches && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    requestRender();
  });

  requestRender();

  function requestRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame((now) => {
      renderPending = false;
      render(now);
    });
  }

  function loop(now) {
    rafId = 0;
    render(now);
    if (!reduce.matches && stageInView) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function render(now) {
    const stageWidth = stage.clientWidth;
    if (!stageWidth) return;

    const typography = getTypography(paragraphs[0]);
    ensurePrepared(paragraphs, typography, preparedState, {
      clearCache,
      prepareWithSegments,
    });

    const motion = getMotion(now, startTime, reduce.matches);
    const stageRect = stage.getBoundingClientRect();
    const localHex = getLocalHexPoints(wire, stageRect, motion);
    const layout = layoutParagraphs(
      preparedState.items,
      localHex,
      stageWidth,
      typography.lineHeight,
      typography.paragraphGap,
      { layoutNextLineRange, materializeLineRange }
    );

    applyWireTransform(wire, motion, reduce.matches);
    paintCanvas(ctx, canvas, stage, layout, stageWidth, typography);

    if (!stageVisible) {
      html.classList.add('editorial-ready');
      stage.style.visibility = '';
      stage.style.display = '';
      stageVisible = true;
    }

    if (!reduce.matches && stageInView && !rafId) {
      rafId = requestAnimationFrame(loop);
    }
  }
}

function getTypography(sampleParagraph) {
  const style = getComputedStyle(sampleParagraph);
  const fontSize = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.6;
  const paragraphGap = parseFloat(style.marginBottom) || lineHeight;

  return {
    font: buildCanvasFont(style),
    color: style.color,
    lineHeight,
    paragraphGap,
  };
}

function buildCanvasFont(style) {
  return [
    style.fontStyle,
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
  ]
    .filter(Boolean)
    .join(' ');
}

function ensurePrepared(paragraphs, typography, preparedState, pretext) {
  const texts = paragraphs.map((paragraph) =>
    (paragraph.textContent || '').replace(/\s+/g, ' ').trim()
  );
  const key = `${typography.font}__${texts.join('__')}`;
  if (key === preparedState.key) return;

  pretext.clearCache();
  preparedState.key = key;
  preparedState.items = texts.map((text) => ({
    prepared: pretext.prepareWithSegments(text, typography.font),
  }));
}

function getMotion(now, startTime, reduceMotion) {
  if (reduceMotion) {
    return { angle: 0, driftX: 0, driftY: 0 };
  }

  const elapsed = now - startTime;
  const scrollY = window.scrollY || window.pageYOffset || 0;

  return {
    angle: -((elapsed % ROTATION_PERIOD_MS) / ROTATION_PERIOD_MS) * Math.PI * 2,
    driftX: Math.sin(elapsed * 0.00075 + scrollY * 0.0022) * 18,
    driftY:
      Math.cos(elapsed * 0.00055 + scrollY * 0.0018) * 14 +
      Math.sin(scrollY * 0.0034) * 16,
  };
}

function getLocalHexPoints(wire, stageRect, motion) {
  const metrics = getWireMetrics(wire);
  const centerX = metrics.left + metrics.width / 2;
  const centerY = metrics.top + metrics.height / 2;
  const cos = Math.cos(motion.angle);
  const sin = Math.sin(motion.angle);

  return HEX_VERTS.map(([x, y]) => {
    const px = metrics.left + (x / 100) * metrics.width;
    const py = metrics.top + (y / 100) * metrics.height;
    const dx = px - centerX;
    const dy = py - centerY;
    const rx = centerX + cos * dx - sin * dy + motion.driftX;
    const ry = centerY + sin * dx + cos * dy + motion.driftY;
    return [rx - stageRect.left, ry - stageRect.top];
  });
}

function getWireMetrics(wire) {
  const style = getComputedStyle(wire);
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);
  const top = parseFloat(style.top);
  const right = parseFloat(style.right);
  const left = window.innerWidth - right - width;

  return { left, top, width, height };
}

function applyWireTransform(wire, motion, reduceMotion) {
  wire.style.transform = reduceMotion
    ? 'none'
    : `translate3d(${motion.driftX}px, ${motion.driftY}px, 0) rotate(${motion.angle}rad)`;
}

function layoutParagraphs(paragraphs, localHex, stageWidth, lineHeight, paragraphGap, pretext) {
  const items = [];
  let y = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const lines = layoutParagraph(paragraphs[i].prepared, localHex, stageWidth, y, lineHeight, pretext);
    items.push(...lines);
    y = lines.length ? lines[lines.length - 1].y + lineHeight : y + lineHeight;
    if (i < paragraphs.length - 1) {
      y += paragraphGap;
    }
  }

  return {
    items,
    height: Math.max(y, lineHeight),
  };
}

function layoutParagraph(prepared, localHex, stageWidth, startY, lineHeight, pretext) {
  const lines = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let y = startY;

  while (true) {
    const maxWidth = getLineWidth(localHex, stageWidth, y, y + lineHeight);
    const range = pretext.layoutNextLineRange(prepared, cursor, maxWidth);
    if (!range) break;

    if (
      range.start.segmentIndex === range.end.segmentIndex &&
      range.start.graphemeIndex === range.end.graphemeIndex
    ) {
      break;
    }

    const line = pretext.materializeLineRange(prepared, range);
    lines.push({
      text: line.text,
      y,
    });

    cursor = range.end;
    y += lineHeight;
  }

  return lines;
}

function getLineWidth(localHex, stageWidth, yMin, yMax) {
  const leftEdge = leftEdgeForBand(localHex, yMin, yMax);
  if (!Number.isFinite(leftEdge)) {
    return stageWidth;
  }

  const gutter = Math.max(18, stageWidth * 0.025);
  return Math.max(MIN_LINE_WIDTH, Math.min(stageWidth, leftEdge - gutter));
}

function leftEdgeForBand(points, yMin, yMax) {
  const yMid = (yMin + yMax) * 0.5;
  let leftX = Infinity;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const aY = a[1];
    const bY = b[1];

    if (!((aY <= yMid && bY >= yMid) || (bY <= yMid && aY >= yMid))) {
      continue;
    }

    const dy = bY - aY;
    let x;

    if (Math.abs(dy) < 0.001) {
      x = Math.min(a[0], b[0]);
    } else {
      x = a[0] + ((yMid - aY) * (b[0] - a[0])) / dy;
    }

    if (x < leftX) {
      leftX = x;
    }
  }

  return leftX;
}

function paintCanvas(ctx, canvas, stage, layout, stageWidth, typography) {
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(stageWidth * dpr));
  const pixelHeight = Math.max(1, Math.round(layout.height * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  canvas.style.height = `${layout.height}px`;
  stage.style.height = `${layout.height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, stageWidth, layout.height);
  ctx.font = typography.font;
  ctx.fillStyle = typography.color;
  ctx.textBaseline = 'top';

  for (const line of layout.items) {
    ctx.fillText(line.text, 0, line.y);
  }
}
