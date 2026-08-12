/* Momentum Dashboard — shared site utilities. Read-only: this page never
   submits a form, never calls an API that mutates anything, never places
   an order. It only fetches the JSON files in data/ (written by
   india_momentum_v2's automation/json_export.py after every paper
   trading session) and renders them. */

/* Minimal, consistent line-icon set (24x24 viewBox, stroke-based) -
   hand-rolled so the sidebar never depends on an external icon font/CDN.
   Deliberately plain geometric shapes, no cartoon icons. */
const ICONS = {
  overview: '<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z"/>',
  portfolio: '<path d="M3 20V10m6 10V4m6 16V13m6 7V7"/>',
  holdings: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  trades: '<path d="M4 7h13l-3-3m3 3-3 3M20 17H7l3 3m-3-3 3-3"/>',
  performance: '<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>',
  benchmark: '<path d="M3 3v18h18"/><path d="M7 15l3-4 3 2 5-6"/>',
  risk: '<path d="M12 3 3 20h18L12 3Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  statistics: '<path d="M4 20V4"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="7" width="3" height="13"/><rect x="16" y="15" width="3" height="5"/>',
  health: '<path d="M3 12h4l2 8 4-16 2 8h6"/>',
  reports: '<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  yield: '<path d="M4 18c3-8 6 4 9-4s5 2 7-6"/>',
};

const SIDEBAR_PAGES = [
  { href: "index.html", label: "Overview", icon: "overview" },
  { href: "portfolio.html", label: "Portfolio", icon: "portfolio" },
  { href: "holdings.html", label: "Holdings", icon: "holdings" },
  { href: "trades.html", label: "Trades", icon: "trades" },
  { href: "performance.html", label: "Performance", icon: "performance" },
  { href: "benchmark.html", label: "Benchmark", icon: "benchmark" },
  { href: "yield-curve.html", label: "Yield Curve", icon: "yield" },
  { href: "risk.html", label: "Risk", icon: "risk" },
  { href: "statistics.html", label: "Statistics", icon: "statistics" },
  { href: "health.html", label: "Health", icon: "health" },
  { href: "report.html", label: "Reports", icon: "reports" },
  { href: "settings.html", label: "Settings", icon: "settings" },
];

// Kept for old pages mid-migration; new pages call renderShell() directly.
function renderNav(activeHref) { renderShell(activeHref); }

function renderShell(activeHref) {
  const root = document.getElementById("app-root");
  if (!root) return;
  const nav = root.querySelector(".sidebar-nav");
  if (nav) {
    nav.innerHTML = SIDEBAR_PAGES.map((p) => `
      <a href="${p.href}" class="${p.href === activeHref ? "active" : ""}">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.icon] || ""}</svg>
        <span>${p.label}</span>
      </a>`).join("");
  }
  const toggle = root.querySelector(".sidebar-toggle");
  const sidebar = root.querySelector(".sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  }
  updateTopbar();
}

async function updateTopbar() {
  /* Populates the persistent top stats bar (Portfolio Value, Today's
     Return, Benchmark Return, Cash, Exposure, Last Updated, Mode) and the
     mode pill from portfolio.json + health.json - every page shows the
     same live snapshot regardless of what its own main content is about. */
  const [portfolio, health] = await Promise.all([fetchJSON("portfolio.json"), fetchJSON("health.json")]);
  const set = (id, text, cls) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (cls !== undefined) el.className = "stat-value " + cls;
  };

  if (portfolio) {
    set("tb-value", fmtCurrency(portfolio.portfolio_value));
    const bc = portfolio.benchmark_comparison;
    if (bc && bc.available) {
      set("tb-today", portfolio.today_return ? fmtPct(portfolio.today_return.change_pct) : "—",
          portfolio.today_return ? signClass(portfolio.today_return.change_pct) : "");
      set("tb-bench", bc.benchmark_daily_pct !== null ? fmtPct(bc.benchmark_daily_pct) : "—",
          signClass(bc.benchmark_daily_pct));
    } else {
      set("tb-today", portfolio.today_return ? fmtPct(portfolio.today_return.change_pct) : "—",
          portfolio.today_return ? signClass(portfolio.today_return.change_pct) : "");
      set("tb-bench", "—");
    }
    set("tb-cash", fmtCurrency(portfolio.cash));
    const exposure = (portfolio.portfolio_value && portfolio.invested_capital !== null)
      ? (portfolio.invested_capital / portfolio.portfolio_value * 100) : null;
    set("tb-exposure", exposure !== null ? exposure.toFixed(1) + "%" : "—");
    const updatedEl = document.getElementById("tb-updated");
    if (updatedEl) updatedEl.textContent = fmtDate(portfolio.as_of);
  }

  const modeEl = document.getElementById("tb-mode");
  if (modeEl) {
    const mode = (health && health.mode) ? String(health.mode).toUpperCase() : null;
    if (mode === "LIVE") { modeEl.textContent = "LIVE"; modeEl.classList.add("live"); }
    else if (mode === "PAPER") { modeEl.textContent = "PAPER"; modeEl.classList.remove("live"); }
    else { modeEl.textContent = "UNKNOWN"; modeEl.classList.add("live"); }
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

const CHART_COLORS = { portfolio: "#5b8def", benchmark: "#d9a441", cash: "#2fbf71", invested: "#8b8fa8", red: "#f0555c" };
const SECTOR_PALETTE = ["#5b8def", "#2fbf71", "#d9a441", "#8b8fa8", "#f0555c", "#4dd0c9", "#c78de0", "#e08a5e", "#6ea8dc", "#a3c96b"];
// Chart chrome colors, centralized here to match the design tokens in
// style.css (canvas can't read CSS custom properties directly).
const CHART_INK = { grid: "#1c1f26", axisText: "#63676f", tooltipBg: "#101216", tooltipBorder: "#2a2e37", tooltipText: "#e9eaed", pointStroke: "#08090b" };

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
    ctx.fillStyle = "#63676f";
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

    ctx.strokeStyle = CHART_INK.grid;
    ctx.fillStyle = CHART_INK.axisText;
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
        ctx.strokeStyle = "#08090b";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (si === 0) {
          ctx.strokeStyle = "rgba(99,103,111,0.4)";
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
          ctx.fillStyle = "#101216";
          ctx.strokeStyle = "#2a2e37";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(tx, 2, tw, 18, 5) : ctx.rect(tx, 2, tw, 18);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#e9eaed";
          ctx.fillText(label, tx + 7, 15);
        }
      }
    });

    if (opts.legend !== false && series.length > 1) {
      let lx = padL;
      series.forEach((s) => {
        ctx.fillStyle = s.color;
        ctx.fillRect(lx, 2, 10, 10);
        ctx.fillStyle = "#e9eaed";
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
    ctx.fillStyle = "#63676f";
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

    ctx.strokeStyle = CHART_INK.grid;
    ctx.fillStyle = CHART_INK.axisText;
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

    ctx.fillStyle = "#63676f";
    ctx.font = "11px sans-serif";
    points.forEach((p, i) => {
      const label = p.maturity;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, sx(i) - tw / 2, h - 8);
    });

    const pix = points.map((p, i) => [sx(i), p.yield_pct !== null ? sy(p.yield_pct) : null]);
    const color = opts.color || CHART_COLORS.portfolio;

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
      ctx.strokeStyle = "#08090b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    if (hoverIdx !== undefined && pix[hoverIdx] && pix[hoverIdx][1] !== null) {
      const [px, py] = pix[hoverIdx];
      const p = points[hoverIdx];
      ctx.strokeStyle = "rgba(99,103,111,0.4)";
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
      ctx.fillStyle = "#101216";
      ctx.strokeStyle = "#2a2e37";
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(tx, ty, tw, 22, 6) : ctx.rect(tx, ty, tw, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e9eaed";
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

function parseExitReason(reason) {
  /* Turns swing_trader.py's compact machine-readable exit reason strings
     (e.g. "stop_touch(1105.82)", "time_stop(11d)") into a real, honest
     sentence describing what actually happened - no invented narrative,
     just the same mechanical rule spelled out in words. */
  if (!reason) return { label: "Exit", sentence: "No exit reason recorded." };
  let m;
  if ((m = reason.match(/^stop_touch\(([\d.]+)\)$/)))
    return { label: "Stop-loss", sentence: `Stop-loss triggered: price touched the ₹${Number(m[1]).toLocaleString("en-IN")} stop level.` };
  if ((m = reason.match(/^target_touch\(([\d.]+)\)$/)))
    return { label: "Target hit", sentence: `Profit target reached: price touched the ₹${Number(m[1]).toLocaleString("en-IN")} target level.` };
  if ((m = reason.match(/^rsi_overbought\(([\d.]+)\)$/)))
    return { label: "RSI overbought", sentence: `Momentum exhaustion signal: RSI reached ${m[1]}, above the overbought threshold.` };
  if ((m = reason.match(/^roc_breakdown_(\d+)d\(ROC=([+\-\d.]+)%\)$/)))
    return { label: "Momentum breakdown", sentence: `Rate-of-change turned negative for ${m[1]} consecutive day(s) (latest ROC ${m[2]}%) — momentum signal broke down.` };
  if ((m = reason.match(/^time_stop\((\d+)d\)$/)))
    return { label: "Time stop", sentence: `Maximum hold period reached (${m[1]} days) — position closed regardless of price action.` };
  return { label: "Exit", sentence: reason };
}

function entryThesis(h) {
  /* Same discipline for open positions - real signal values from the
     entry-time screen (ROC/RSI/momentum rank), not fabricated commentary. */
  const parts = [];
  if (h.roc_pct !== null && h.roc_pct !== undefined) parts.push(`ROC ${h.roc_pct > 0 ? "+" : ""}${h.roc_pct.toFixed(1)}%`);
  if (h.rsi !== null && h.rsi !== undefined) parts.push(`RSI ${h.rsi.toFixed(1)}`);
  if (h.momentum_rank !== null && h.momentum_rank !== undefined) parts.push(`ranked #${h.momentum_rank} by momentum`);
  if (!parts.length) return "Momentum entry signal (ROC/RSI threshold) triggered at entry.";
  return `Entered on a momentum signal: ${parts.join(", ")}.`;
}

function seriesFromDict(dict) {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([k, v]) => [new Date(k).getTime(), v])
    .sort((a, b) => a[0] - b[0]);
}

// ── Reusable sortable / searchable / paginated table ──────────────────
// columns: [{key, label, format?: (row)=>html, sortVal?: (row)=>number|string, align?: "right"}]
// opts: { searchKeys: [...], pageSize: 15 }
function renderDataTable(containerId, columns, rows, opts = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const pageSize = opts.pageSize || 15;
  const searchKeys = opts.searchKeys || [];
  let state = { sortKey: opts.defaultSort || null, sortDir: opts.defaultSortDir || "desc", query: "", page: 1 };

  container.innerHTML = `
    <div class="table-toolbar">
      ${searchKeys.length ? `<input type="text" class="table-search" placeholder="Search…" id="${containerId}-search">` : ""}
    </div>
    <div class="table-scroll"><table><thead><tr>
      ${columns.map(c => `<th data-key="${c.key}" style="${c.align === "right" ? "text-align:right" : ""}">${c.label}<span class="sort-arrow"></span></th>`).join("")}
    </tr></thead><tbody id="${containerId}-body"></tbody></table></div>
    <div class="table-pagination" id="${containerId}-pagination"></div>`;

  function filteredSorted() {
    let out = rows;
    if (state.query) {
      const q = state.query.toLowerCase();
      out = out.filter(r => searchKeys.some(k => String(r[k] ?? "").toLowerCase().includes(q)));
    }
    if (state.sortKey) {
      const col = columns.find(c => c.key === state.sortKey);
      const getVal = col && col.sortVal ? col.sortVal : (r) => r[state.sortKey];
      out = [...out].sort((a, b) => {
        const av = getVal(a), bv = getVal(b);
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
        return state.sortDir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }

  function render() {
    const data = filteredSorted();
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    state.page = Math.min(state.page, totalPages);
    const pageRows = data.slice((state.page - 1) * pageSize, state.page * pageSize);

    const body = document.getElementById(`${containerId}-body`);
    body.innerHTML = pageRows.length
      ? pageRows.map(r => `<tr>${columns.map(c =>
          `<td class="${c.textCell ? "text-cell" : ""}" style="${c.align === "right" ? "text-align:right" : ""}">${c.format ? c.format(r) : (r[c.key] ?? "—")}</td>`
        ).join("")}</tr>`).join("")
      : `<tr><td colspan="${columns.length}">${emptyState(opts.emptyMsg || "No matching rows.")}</td></tr>`;

    container.querySelectorAll("th[data-key]").forEach(th => {
      const key = th.dataset.key;
      th.classList.toggle("sorted", key === state.sortKey);
      const arrow = th.querySelector(".sort-arrow");
      arrow.textContent = key === state.sortKey ? (state.sortDir === "asc" ? "▲" : "▼") : "";
    });

    const pag = document.getElementById(`${containerId}-pagination`);
    if (data.length <= pageSize) {
      pag.innerHTML = `<span>${data.length} row${data.length === 1 ? "" : "s"}</span>`;
    } else {
      const start = (state.page - 1) * pageSize + 1, end = Math.min(state.page * pageSize, data.length);
      pag.innerHTML = `<span>${start}-${end} of ${data.length}</span>
        <div class="page-btns">
          <button data-action="prev" ${state.page === 1 ? "disabled" : ""}>Prev</button>
          <span style="padding:4px 8px;">Page ${state.page} / ${totalPages}</span>
          <button data-action="next" ${state.page === totalPages ? "disabled" : ""}>Next</button>
        </div>`;
      pag.querySelector('[data-action="prev"]')?.addEventListener("click", () => { state.page--; render(); });
      pag.querySelector('[data-action="next"]')?.addEventListener("click", () => { state.page++; render(); });
    }
  }

  container.querySelectorAll("th[data-key]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else { state.sortKey = key; state.sortDir = "desc"; }
      state.page = 1;
      render();
    });
  });
  const searchEl = document.getElementById(`${containerId}-search`);
  if (searchEl) {
    searchEl.addEventListener("input", () => { state.query = searchEl.value; state.page = 1; render(); });
  }
  render();
}

// ── Sector / holding / cash allocation bars ────────────────────────────
function renderAllocationBars(containerId, items) {
  // items: [{label, value, pct}], sorted desc by caller
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) { container.innerHTML = emptyState("No allocation data yet."); return; }
  container.innerHTML = `<div class="alloc-list">${items.map((it, i) => `
    <div class="alloc-row">
      <div class="alloc-label">${it.label}</div>
      <div class="alloc-bar-track"><div class="alloc-bar-fill" style="width:${Math.max(it.pct, 0.5)}%; background:${SECTOR_PALETTE[i % SECTOR_PALETTE.length]};"></div></div>
      <div class="alloc-pct">${it.pct.toFixed(1)}%</div>
    </div>`).join("")}</div>`;
}

// ── Monthly returns heatmap, from an equity curve dict {iso: value} ────
function renderMonthlyHeatmap(containerId, equityCurve) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const entries = Object.entries(equityCurve || {}).map(([k, v]) => [new Date(k), v]).sort((a, b) => a[0] - b[0]);
  if (entries.length < 2) { container.innerHTML = emptyState("Not enough history yet for a monthly breakdown."); return; }

  // Last equity value per (year, month), then month-over-month % change.
  const byMonth = new Map();
  entries.forEach(([d, v]) => { byMonth.set(`${d.getFullYear()}-${d.getMonth()}`, v); });
  const months = [...byMonth.keys()].sort();
  const monthReturns = {};
  let prevVal = null;
  months.forEach((key) => {
    const val = byMonth.get(key);
    monthReturns[key] = prevVal !== null ? ((val - prevVal) / prevVal) * 100 : null;
    prevVal = val;
  });

  const years = [...new Set(months.map(m => m.split("-")[0]))].sort();
  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const maxAbs = Math.max(1, ...Object.values(monthReturns).filter(v => v !== null).map(Math.abs));

  function cellStyle(v) {
    if (v === null || v === undefined) return "background:transparent; border-color:transparent; color:var(--text-muted);";
    const intensity = Math.min(Math.abs(v) / maxAbs, 1);
    const color = v >= 0 ? `rgba(47,191,113,${0.12 + intensity * 0.45})` : `rgba(240,85,92,${0.12 + intensity * 0.45})`;
    return `background:${color}; color:${intensity > 0.55 ? "#e9eaed" : "var(--text-secondary)"};`;
  }

  let html = `<table class="heatmap-table"><thead><tr><th></th>${MONTH_LABELS.map(m => `<th>${m}</th>`).join("")}</tr></thead><tbody>`;
  years.forEach(y => {
    html += `<tr><td class="heatmap-year-label">${y}</td>`;
    for (let m = 0; m < 12; m++) {
      const key = `${y}-${m}`;
      const v = monthReturns[key];
      html += `<td class="heatmap-cell" style="${cellStyle(v)}">${v !== null && v !== undefined ? (v > 0 ? "+" : "") + v.toFixed(1) + "%" : (byMonth.has(key) ? "—" : "")}</td>`;
    }
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}
