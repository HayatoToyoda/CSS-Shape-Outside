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

/** 本文再組版の目安間隔（~12 fps）。 */
const LAYOUT_MIN_GAP_MS = 1000 / 12;
const LAYOUT_ANGLE_RAD = 0.028;
const LAYOUT_DRIFT_PX = 1.2;

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

  // Phones and coarse-pointer devices: fall back to CSS-only hex
  // (full editorial projection is skipped).
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
  const linesHost = document.querySelector('.article-lines');
  const source = document.querySelector('.editorial-source');
  const wire = document.querySelector('.cube-wire');

  if (!(stage instanceof HTMLElement)) return;
  if (!(linesHost instanceof HTMLElement)) return;
  if (!(source instanceof HTMLElement)) return;
  if (!(wire instanceof SVGElement)) return;

  const paragraphs = Array.from(source.querySelectorAll('p'));
  if (!paragraphs.length) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const startTime = performance.now();
  const preparedState = {
    key: '',
    items: [],
  };

  const linePool = [];
  /** @type {Array<{ text: string; y: number; width: number; lineHeight: number; color: string; font: string }> | null} */
  let previousProjection = null;

  let rafId = 0;
  let renderPending = false;
  let stageVisible = false;
  let stageInView = true;
  let firstLineProjectDone = false;
  let forceLayout = true;

  let lastLayoutAt = 0;
  const lastSampleMotion = { angle: Number.NaN, dx: 0, dy: 0 };

  stage.style.display = 'block';
  stage.style.visibility = 'hidden';

  const requestResize = () => {
    forceLayout = true;
    requestRender();
  };

  const resizeObserver = new ResizeObserver(() => {
    requestResize();
  });

  resizeObserver.observe(stage);
  source.parentElement && resizeObserver.observe(source.parentElement);

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
      forceLayout = true;
      requestRender();
    });
  }

  if (document.fonts?.addEventListener) {
    document.fonts.addEventListener('loadingdone', () => {
      preparedState.key = '';
      forceLayout = true;
      requestRender();
    });
  }

  window.addEventListener('resize', requestResize, { passive: true });
  window.addEventListener('scroll', requestResize, { passive: true });
  window.addEventListener('themechange', requestResize);
  reduce.addEventListener('change', () => {
    if (reduce.matches && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    forceLayout = true;
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

  function shouldRunLayout(now, motion) {
    if (forceLayout) return true;
    if (!firstLineProjectDone) return true;
    if (now - lastLayoutAt >= LAYOUT_MIN_GAP_MS) return true;
    if (!Number.isFinite(lastSampleMotion.angle)) return true;
    if (Math.abs(motion.angle - lastSampleMotion.angle) > LAYOUT_ANGLE_RAD) return true;
    if (Math.abs(motion.driftX - lastSampleMotion.dx) > LAYOUT_DRIFT_PX) return true;
    if (Math.abs(motion.driftY - lastSampleMotion.dy) > LAYOUT_DRIFT_PX) return true;
    return false;
  }

  function render(now) {
    const stageWidth = stage.clientWidth;
    if (!stageWidth) return;

    const motion = getMotion(now, startTime, reduce.matches);
    applyWireTransform(wire, motion, reduce.matches);

    if (shouldRunLayout(now, motion)) {
      const typography = getTypography(paragraphs[0]);
      ensurePrepared(paragraphs, typography, preparedState, {
        clearCache,
        prepareWithSegments,
      });

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

      previousProjection = projectLines(
        linesHost,
        stage,
        layout,
        typography,
        previousProjection,
        linePool
      );
      firstLineProjectDone = true;
      lastLayoutAt = now;
      lastSampleMotion.angle = motion.angle;
      lastSampleMotion.dx = motion.driftX;
      lastSampleMotion.dy = motion.driftY;
      forceLayout = false;
    }

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
  return [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily]
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

/**
 * @param {Array<{ prepared: unknown }>} preparedParagraphs
 * @param {number} paragraphGap
 */
function layoutParagraphs(preparedParagraphs, localHex, stageWidth, lineHeight, paragraphGap, pretext) {
  const items = [];
  let y = 0;

  for (let i = 0; i < preparedParagraphs.length; i++) {
    const lines = layoutParagraph(
      preparedParagraphs[i].prepared,
      localHex,
      stageWidth,
      y,
      lineHeight,
      i,
      pretext
    );
    for (const line of lines) {
      items.push(line);
    }
    y = lines.length ? lines[lines.length - 1].y + lineHeight : y + lineHeight;
    if (i < preparedParagraphs.length - 1) {
      y += paragraphGap;
    }
  }

  return {
    items,
    height: Math.max(y, lineHeight),
  };
}

/**
 * @param {number} paragraphIndex
 */
function layoutParagraph(
  prepared,
  localHex,
  stageWidth,
  startY,
  lineHeight,
  paragraphIndex,
  pretext
) {
  const lines = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  let y = startY;
  let lineIndex = 0;

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
      width: maxWidth,
      lineHeight,
      paragraphIndex,
      lineIndex: lineIndex++,
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
  let leftX = Number.POSITIVE_INFINITY;

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

/**
 * @returns {Array<{ text: string; y: number; width: number; lineHeight: number; color: string; font: string }> | null}
 */
function projectLines(host, stage, layout, typography, previous, pool) {
  const { items, height } = layout;
  if (!host || !stage) {
    return null;
  }

  host.style.minHeight = `${height}px`;
  stage.style.minHeight = `${height}px`;
  stage.style.height = `${height}px`;

  while (pool.length < items.length) {
    const el = document.createElement('span');
    el.className = 'article-line';
    host.appendChild(el);
    pool.push(el);
  }

  for (let i = items.length; i < pool.length; i++) {
    const el = pool[i];
    el.style.display = 'none';
    el.textContent = '';
  }

  const nextPrev = new Array(items.length);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const el = pool[i];
    const prev = previous && previous[i];
    const equal = lineProjectionEqual(prev, item, typography);

    el.style.display = 'block';
    if (!equal) {
      el.style.top = `${item.y}px`;
      el.style.width = `${item.width}px`;
      el.style.height = `${item.lineHeight}px`;
      el.style.lineHeight = `${item.lineHeight}px`;
      el.style.font = typography.font;
      el.style.color = typography.color;
      el.textContent = item.text;
    }
    nextPrev[i] = {
      text: item.text,
      y: item.y,
      width: item.width,
      lineHeight: item.lineHeight,
      color: typography.color,
      font: typography.font,
    };
  }

  return nextPrev;
}

/**
 * @param {{ text: string; y: number; width: number; lineHeight: number; color: string; font: string } | undefined} prev
 * @param {{ text: string; y: number; width: number; lineHeight: number; paragraphIndex: number; lineIndex: number }} item
 * @param {{ color: string; font: string }} typography
 */
function lineProjectionEqual(prev, item, typography) {
  if (!prev) return false;
  return (
    prev.text === item.text &&
    prev.y === item.y &&
    prev.width === item.width &&
    prev.lineHeight === item.lineHeight &&
    prev.color === typography.color &&
    prev.font === typography.font
  );
}
