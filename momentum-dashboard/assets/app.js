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

function simpleLineChart(canvasId, series, opts = {}) {
  /* Minimal dependency-free line chart via <canvas> — no CDN, so the
     dashboard keeps working even if a CDN is ever unreachable.
     `series` = [{label, color, points: [[x,y],...]}] */
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 260;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length < 2) {
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
  const padL = 52, padR = 12, padT = 12, padB = 24;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const sx = (x) => padL + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const sy = (y) => padT + plotH - ((y - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad) || 1)) * plotH;

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

  series.forEach((s) => {
    if (s.points.length < 2) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = sx(p[0]), y = sy(p[1]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
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

function seriesFromDict(dict) {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([k, v]) => [new Date(k).getTime(), v])
    .sort((a, b) => a[0] - b[0]);
}
