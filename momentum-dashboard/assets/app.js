/* Momentum Dashboard — shared site utilities. Read-only: this page never
   submits a form, never calls an API that mutates anything, never places
   an order. It only fetches the JSON files in data/ (written by
   india_momentum_v2's automation/json_export.py after every paper
   trading session) and renders them. */

const PAGES = [
  { href: "index.html", label: "Overview" },
  { href: "holdings.html", label: "Holdings" },
  { href: "trades.html", label: "Trade History" },
  { href: "performance.html", label: "Performance" },
  { href: "benchmark.html", label: "Benchmark" },
  { href: "yield-curve.html", label: "Yield Curve" },
  { href: "statistics.html", label: "Statistics" },
  { href: "report.html", label: "Latest Report" },
  { href: "health.html", label: "System Health" },
];

function renderNav(activeHref) {
  const nav = document.getElementById("nav-tabs");
  if (nav) {
    nav.innerHTML = PAGES.map(
      (p) => `<a href="${p.href}" class="${p.href === activeHref ? "active" : ""}">${p.label}</a>`
    ).join("");
  }
}

async function fetchJSON(name) {
  try {
    const res = await fetch(`data/${name}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function fmtCurrency(v, decimals = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function fmtPct(v, decimals = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${Number(v).toFixed(decimals)}%`;
}

function fmtNum(v, decimals = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(decimals);
}

function signClass(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  return v > 0 ? "pos" : v < 0 ? "neg" : "";
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}

function statusBadge(ok) {
  if (ok === true) return `<span class="badge ok">OK</span>`;
  if (ok === false) return `<span class="badge bad">PROBLEM</span>`;
  return `<span class="badge na">N/A</span>`;
}

function emptyState(msg) {
  return `<div class="empty-state">${msg}</div>`;
}

const CHART_COLORS = { portfolio: "#4f8cff", benchmark: "#f59e0b", cash: "#22c55e", invested: "#a78bfa", red: "#ef4444" };

// Catmull-Rom -> cubic Bezier, so lines read as a smooth curve instead of
// straight segments — the single biggest visual difference between "a
// dashboard" and something that feels alive. Pure math, no library.
function _smoothPath(ctx, pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 2) {
    ctx.lineTo(pts[1][0], pts[1][1]);
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
  }
}

function _nearestPointIndex(pts, mouseX) {
  let best = 0, bestDist = Infinity;
  pts.forEach((p, i) => {
    const d = Math.abs(p[0] - mouseX);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

function simpleLineChart(canvasId, series, opts = {}) {
  /* Dependency-free line chart via <canvas> — no CDN, so the dashboard
     keeps working even if a CDN is ever unreachable. `series` =
     [{label, color, points: [[x,y],...]}]. Smoothed curve, gradient area
     fill under the first series, and a hover crosshair + value tooltip. */
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 260;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length < 2) {
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#8fa0c3";
    ctx.font = "13px sans-serif";
    ctx.fillText(opts.emptyMsg || "Not enough data yet.", 12, h / 2);
    return;
  }

  const xs = allPoints.map((p) => p[0]);
  const ys = allPoints.map((p) => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.1 || 1;
  const padL = 52, padR = 12, padT = 16, padB = 24;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const sx = (x) => padL + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const sy = (y) => padT + plotH - ((y - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad) || 1)) * plotH;

  function render(hoverX) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "#263553";
    ctx.fillStyle = "#8fa0c3";
    ctx.font = "10px sans-serif";
    ctx.lineWidth = 1;
    const nGrid = 4;
    for (let i = 0; i <= nGrid; i++) {
      const yVal = (yMin - yPad) + ((yMax + yPad) - (yMin - yPad)) * (i / nGrid);
      const yPix = sy(yVal);
      ctx.beginPath();
      ctx.moveTo(padL, yPix);
      ctx.lineTo(w - padR, yPix);
      ctx.stroke();
      ctx.fillText(yVal.toFixed(opts.yDecimals ?? 0), 2, yPix + 3);
    }

    series.forEach((s, si) => {
      if (s.points.length < 2) return;
      const pix = s.points.map((p) => [sx(p[0]), sy(p[1])]);

      if (si === 0 && opts.area !== false) {
        const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        grad.addColorStop(0, s.color + "55");
        grad.addColorStop(1, s.color + "02");
        ctx.beginPath();
        _smoothPath(ctx, pix);
        ctx.lineTo(pix[pix.length - 1][0], padT + plotH);
        ctx.lineTo(pix[0][0], padT + plotH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.beginPath();
      _smoothPath(ctx, pix);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();

      if (hoverX !== undefined) {
        const idx = _nearestPointIndex(pix, hoverX);
        const [px, py] = pix[idx];
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.strokeStyle = "#0b1220";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (si === 0) {
          ctx.strokeStyle = "rgba(143,160,195,0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, padT);
          ctx.lineTo(px, padT + plotH);
          ctx.stroke();

          const label = (opts.tooltipLabel ? opts.tooltipLabel(s.points[idx]) :
            `${s.points[idx][1].toFixed(opts.yDecimals ?? 2)}`);
          ctx.font = "11px sans-serif";
          const tw = ctx.measureText(label).width + 14;
          const tx = Math.min(Math.max(px - tw / 2, padL), w - padR - tw);
          ctx.fillStyle = "#16213a";
          ctx.strokeStyle = "#263553";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(tx, 2, tw, 18, 5) : ctx.rect(tx, 2, tw, 18);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#e6ebf5";
          ctx.fillText(label, tx + 7, 15);
        }
      }
    });

    if (opts.legend !== false && series.length > 1) {
      let lx = padL;
      series.forEach((s) => {
        ctx.fillStyle = s.color;
        ctx.fillRect(lx, 2, 10, 10);
        ctx.fillStyle = "#e6ebf5";
        ctx.font = "11px sans-serif";
        ctx.fillText(s.label, lx + 14, 11);
        lx += ctx.measureText(s.label).width + 34;
      });
    }
  }

  render();
  if (!canvas._hoverWired) {
    canvas._hoverWired = true;
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      render(e.clientX - rect.left);
    });
    canvas.addEventListener("mouseleave", () => render());
  }
}

function yieldCurveChart(canvasId, points, opts = {}) {
  /* Maturity on the x-axis, equal spacing per tenor label (the standard
     way a yield curve is actually drawn — a linear time axis would
     compress the whole short end into a sliver next to 30Y). Smooth
     curve + gradient fill, reusing the same math as simpleLineChart. */
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 700;
  const h = canvas.clientHeight || 320;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  const valid = points.filter((p) => p.yield_pct !== null && p.yield_pct !== undefined);
  if (valid.length < 2) {
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#8fa0c3";
    ctx.font = "13px sans-serif";
    ctx.fillText(opts.emptyMsg || "Yield curve data unavailable right now.", 12, h / 2);
    return;
  }

  const ys = valid.map((p) => p.yield_pct);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.25 || 0.5;
  const padL = 46, padR = 16, padT = 20, padB = 32;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const n = points.length;
  const sx = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const sy = (y) => padT + plotH - ((y - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad) || 1)) * plotH;

  function render(hoverIdx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "#263553";
    ctx.fillStyle = "#8fa0c3";
    ctx.font = "10px sans-serif";
    ctx.lineWidth = 1;
    const nGrid = 4;
    for (let i = 0; i <= nGrid; i++) {
      const yVal = (yMin - yPad) + ((yMax + yPad) - (yMin - yPad)) * (i / nGrid);
      const yPix = sy(yVal);
      ctx.beginPath();
      ctx.moveTo(padL, yPix);
      ctx.lineTo(w - padR, yPix);
      ctx.stroke();
      ctx.fillText(yVal.toFixed(2) + "%", 2, yPix + 3);
    }

    ctx.fillStyle = "#8fa0c3";
    ctx.font = "11px sans-serif";
    points.forEach((p, i) => {
      const label = p.maturity;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, sx(i) - tw / 2, h - 8);
    });

    const pix = points.map((p, i) => [sx(i), p.yield_pct !== null ? sy(p.yield_pct) : null]);
    const color = opts.color || "#4f8cff";

    const validPix = pix.filter((p) => p[1] !== null);
    if (validPix.length >= 2) {
      const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, color + "50");
      grad.addColorStop(1, color + "02");
      ctx.beginPath();
      _smoothPath(ctx, validPix);
      ctx.lineTo(validPix[validPix.length - 1][0], padT + plotH);
      ctx.lineTo(validPix[0][0], padT + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      _smoothPath(ctx, validPix);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    pix.forEach((p, i) => {
      if (p[1] === null) return;
      const isHover = i === hoverIdx;
      ctx.beginPath();
      ctx.arc(p[0], p[1], isHover ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isHover ? "#fff" : color;
      ctx.fill();
      ctx.strokeStyle = "#0b1220";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    if (hoverIdx !== undefined && pix[hoverIdx] && pix[hoverIdx][1] !== null) {
      const [px, py] = pix[hoverIdx];
      const p = points[hoverIdx];
      ctx.strokeStyle = "rgba(143,160,195,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();

      const changeStr = p.change_bps !== null && p.change_bps !== undefined
        ? ` (${p.change_bps > 0 ? "+" : ""}${p.change_bps} bps)` : "";
      const label = `${p.maturity}: ${p.yield_pct.toFixed(2)}%${changeStr}`;
      ctx.font = "12px sans-serif";
      const tw = ctx.measureText(label).width + 16;
      const tx = Math.min(Math.max(px - tw / 2, padL), w - padR - tw);
      const ty = Math.max(py - 34, padT);
      ctx.fillStyle = "#16213a";
      ctx.strokeStyle = "#263553";
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(tx, ty, tw, 22, 6) : ctx.rect(tx, ty, tw, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e6ebf5";
      ctx.fillText(label, tx + 8, ty + 15);
    }
  }

  render();
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let best = 0, bestDist = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(sx(i) - mouseX);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    render(best);
  });
  canvas.addEventListener("mouseleave", () => render());
}

function seriesFromDict(dict) {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([k, v]) => [new Date(k).getTime(), v])
    .sort((a, b) => a[0] - b[0]);
}
